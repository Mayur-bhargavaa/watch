import {
  QUIZ_ANSWER_MAX,
  QUIZ_BUZZ_PENALTY,
  QUIZ_BUZZER_ANSWER_SEC,
  QUIZ_BUZZER_QUESTION_SEC,
  QUIZ_MAX_PLAYERS,
  QUIZ_MAX_QUESTIONS,
  QUIZ_MIN_PLAYERS,
  QUIZ_STREAK_BONUS,
  QUIZ_STREAK_BONUS_MAX,
  QuizControlAction,
  QuizGameView,
  QuizLeaderboardRow,
  QuizMe,
  QuizPlayer,
  QuizQuestion,
  QuizQuestionInput,
  QuizResultRow,
  QuizReveal,
  QuizServerState,
  QuizViewQuestion
} from '@synccinema/common';
import { GameRuleError } from './GameRuleError.js';
import { quizQuestionInputSchema, sanitizeQuizText } from './quizShowSchemas.js';

/**
 * Quiz Show Studio engine: pure, server-authoritative rules. No sockets, no timers, no database.
 *  - the clock is injected (`now` is epoch ms on every call), so tests are deterministic
 *  - the full state (`QuizServerState`) holds the correct answers; it never leaves the server. Every recipient gets
 *    `publicStateFor(state, viewerId)`, a redacted copy (the same idea as MafiaNightEngine.publicStateFor)
 *  - every action first settles any expired phase (`tick`), so a late message can never act on a finished phase
 */

const envMs = (name: string, fallback: number): number => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 100 ? Math.floor(v) : fallback;
};

/** Phase lengths. Only the intro / reveal length can be shortened for tests, through the environment. */
export const QUIZ_TIMING = {
  introMs: envMs('QUIZ_INTRO_MS', 3_000),
  revealMs: envMs('QUIZ_REVEAL_MS', 6_000),
  buzzerQuestionMs: QUIZ_BUZZER_QUESTION_SEC * 1000,
  buzzerAnswerMs: QUIZ_BUZZER_ANSWER_SEC * 1000
} as const;

/** When a phase expires and the tick is at most this late, the next phase starts at the old deadline (no drift between phases). */
const CHAIN_SLACK_MS = 2_000;

/** Players needed to start (the host is not a player). The default is 1: host + 1 player. */
export function quizMinPlayers(): number {
  return QUIZ_MIN_PLAYERS;
}

export interface QuizSeat {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  seat: number;
  connected?: boolean;
}

export interface QuizHostSeat {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  connected?: boolean;
}

const RUNNING = new Set(['INTRO', 'QUESTION', 'REVEAL']);

// ---------------------------------------------------------------------
// Rate limiting (answer / buzz / host controls / edits), keyed by `${roomId}:${userId}:${kind}`
// ---------------------------------------------------------------------

const rateBuckets = new Map<string, number[]>();

export function quizRateAllowed(key: string, max: number, windowMs: number, now: number = Date.now()): boolean {
  const arr = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    rateBuckets.set(key, arr);
    return false;
  }
  arr.push(now);
  rateBuckets.set(key, arr);
  return true;
}

export function clearQuizRate(roomId: string): void {
  for (const key of Array.from(rateBuckets.keys())) {
    if (key.startsWith(`${roomId}:`)) rateBuckets.delete(key);
  }
}

/** The streak bonus for reaching a streak of `streak` consecutive correct answers: +10 per answer beyond the first, at most +50. */
export function quizStreakBonus(streak: number): number {
  return Math.min(QUIZ_STREAK_BONUS_MAX, Math.max(0, streak - 1) * QUIZ_STREAK_BONUS);
}

/** MULTIPLE_CHOICE points: base x (0.5 + 0.5 x remaining / limit), rounded (streak bonus not included). */
export function quizSpeedPoints(basePoints: number, remainingMs: number, limitMs: number): number {
  const ratio = limitMs > 0 ? Math.min(1, Math.max(0, remainingMs / limitMs)) : 0;
  return Math.round(basePoints * (0.5 + 0.5 * ratio));
}

const emptyBuzz = (): QuizServerState['buzz'] => ({ queue: [], lockedOut: [], activeUserId: null, answerEndsAt: null, texts: {}, buzzAt: {} });

// ---------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------

export class QuizShowEngine {
  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private static findPlayer(state: QuizServerState, userId: unknown): QuizPlayer | undefined {
    return typeof userId === 'string' ? state.players.find((p) => p.userId === userId) : undefined;
  }

  private static requirePlayer(state: QuizServerState, userId: string): QuizPlayer {
    const p = this.findPlayer(state, userId);
    if (!p || p.left) throw new GameRuleError('NOT_PLAYER', 'You are not a player in this quiz');
    return p;
  }

  private static requireHost(state: QuizServerState, userId: string): void {
    if (state.host.userId !== userId || state.host.left) throw new GameRuleError('HOST_ONLY', 'Only the quiz master can do this');
  }

  private static name(state: QuizServerState, userId: string | null | undefined): string {
    return (userId && this.findPlayer(state, userId)?.displayName) || 'Someone';
  }

  private static setPhase(state: QuizServerState, phase: QuizServerState['phase'], now: number, durationMs: number | null): void {
    state.phase = phase;
    state.phaseEndsAt = durationMs === null ? null : now + durationMs;
    state.phaseDurationMs = durationMs ?? 0;
  }

  private static current(state: QuizServerState): QuizQuestion | null {
    return state.questionIndex >= 0 ? state.quiz[state.questionIndex] ?? null : null;
  }

  private static activePlayers(state: QuizServerState): QuizPlayer[] {
    return state.players.filter((p) => !p.left);
  }

  /** The players ranked: score (high first), then fewer total answer milliseconds, then join order. */
  public static leaderboard(players: QuizPlayer[]): QuizLeaderboardRow[] {
    return [...players]
      .sort((a, b) => b.score - a.score || a.totalAnswerMs - b.totalAnswerMs || a.seat - b.seat)
      .map((p, i) => ({
        rank: i + 1,
        userId: p.userId,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl ?? null,
        score: p.score,
        streak: p.streak,
        correctCount: p.correctCount,
        left: p.left,
        connected: p.connected
      }));
  }

  // -------------------------------------------------------------------
  // Lobby: the draft quiz
  // -------------------------------------------------------------------

  /** A new lobby (room created, quiz still being written). */
  public static createLobbyState(host: QuizHostSeat, quiz: QuizQuestion[] = [], idSeq = 0): QuizServerState {
    return {
      game: 'quiz-show',
      phase: 'LOBBY',
      host: { userId: host.userId, displayName: host.displayName, avatarUrl: host.avatarUrl ?? null, connected: host.connected !== false, left: false },
      players: [],
      quiz: quiz.map((q) => ({ ...q, options: [...q.options] })),
      idSeq: Math.max(idSeq, quiz.length),
      questionIndex: -1,
      phaseEndsAt: null,
      phaseDurationMs: 0,
      questionStartedAt: 0,
      answers: {},
      buzz: emptyBuzz(),
      deltas: {},
      reveal: null,
      winnerUserId: null,
      statusMessage: 'Build your quiz, then start when your players are in.'
    };
  }

  /** Validates and cleans a question (throws INVALID_INPUT with the first problem). */
  public static normalizeQuestion(raw: unknown): QuizQuestionInput {
    const parsed = quizQuestionInputSchema.safeParse(raw);
    if (!parsed.success) throw new GameRuleError('INVALID_INPUT', parsed.error.issues[0]?.message || 'Invalid question');
    return parsed.data;
  }

  private static requireLobby(state: QuizServerState, userId: string): void {
    this.requireHost(state, userId);
    if (state.phase !== 'LOBBY') throw new GameRuleError('WRONG_PHASE', 'The quiz can only be edited in the lobby');
  }

  private static nextId(state: QuizServerState): string {
    state.idSeq += 1;
    return `q${state.idSeq}`;
  }

  public static addQuestion(state: QuizServerState, userId: string, raw: unknown): QuizQuestion {
    this.requireLobby(state, userId);
    if (state.quiz.length >= QUIZ_MAX_QUESTIONS) throw new GameRuleError('INVALID_INPUT', `A quiz can have at most ${QUIZ_MAX_QUESTIONS} questions`);
    const q: QuizQuestion = { id: this.nextId(state), ...this.normalizeQuestion(raw) };
    state.quiz.push(q);
    return q;
  }

  public static updateQuestion(state: QuizServerState, userId: string, id: string, raw: unknown): QuizQuestion {
    this.requireLobby(state, userId);
    const idx = state.quiz.findIndex((q) => q.id === id);
    if (idx < 0) throw new GameRuleError('INVALID_INPUT', 'That question does not exist');
    const q: QuizQuestion = { id, ...this.normalizeQuestion(raw) };
    state.quiz[idx] = q;
    return q;
  }

  public static deleteQuestion(state: QuizServerState, userId: string, id: string): void {
    this.requireLobby(state, userId);
    const idx = state.quiz.findIndex((q) => q.id === id);
    if (idx < 0) throw new GameRuleError('INVALID_INPUT', 'That question does not exist');
    state.quiz.splice(idx, 1);
  }

  /** Moves a question one place up or down. Returns false when it is already at the edge. */
  public static moveQuestion(state: QuizServerState, userId: string, id: string, direction: 'up' | 'down'): boolean {
    this.requireLobby(state, userId);
    const idx = state.quiz.findIndex((q) => q.id === id);
    if (idx < 0) throw new GameRuleError('INVALID_INPUT', 'That question does not exist');
    const to = direction === 'up' ? idx - 1 : idx + 1;
    if (to < 0 || to >= state.quiz.length) return false;
    [state.quiz[idx], state.quiz[to]] = [state.quiz[to], state.quiz[idx]];
    return true;
  }

  /** Replaces the draft with a ready-made set of questions (every question is validated like one typed by the host). */
  public static loadQuestions(state: QuizServerState, userId: string, questions: readonly QuizQuestionInput[]): void {
    this.requireLobby(state, userId);
    if (questions.length > QUIZ_MAX_QUESTIONS) throw new GameRuleError('INVALID_INPUT', `A quiz can have at most ${QUIZ_MAX_QUESTIONS} questions`);
    const clean = questions.map((q) => this.normalizeQuestion(q));
    state.quiz = clean.map((q) => ({ id: this.nextId(state), ...q }));
  }

  public static clearQuestions(state: QuizServerState, userId: string): void {
    this.requireLobby(state, userId);
    state.quiz = [];
  }

  /** The problem that stops the host from starting, or null. */
  public static startProblem(state: QuizServerState): string | null {
    if (state.quiz.length < 1) return 'Add at least one question first';
    return null;
  }

  // -------------------------------------------------------------------
  // Start / restart
  // -------------------------------------------------------------------

  /** New game from a quiz (the lobby draft, or the quiz of a finished game for a rematch): scores reset, first intro begins. */
  public static createInitialState(host: QuizHostSeat, seats: QuizSeat[], quiz: QuizQuestion[], now: number, idSeq = 0): QuizServerState {
    if (!Array.isArray(quiz) || quiz.length < 1 || quiz.length > QUIZ_MAX_QUESTIONS) {
      throw new GameRuleError('INVALID_INPUT', `A quiz needs 1 to ${QUIZ_MAX_QUESTIONS} questions`);
    }
    if (!Array.isArray(seats) || seats.length < quizMinPlayers() || seats.length > QUIZ_MAX_PLAYERS) {
      throw new GameRuleError('INVALID_INPUT', `Quiz Show Studio needs ${quizMinPlayers()} to ${QUIZ_MAX_PLAYERS} players besides the host`);
    }
    const ids = new Set(seats.map((s) => s.userId));
    if (ids.size !== seats.length || ids.has(host.userId)) throw new GameRuleError('INVALID_INPUT', 'Duplicate player in the game');
    const state = this.createLobbyState(host, quiz, idSeq);
    state.players = [...seats]
      .sort((a, b) => a.seat - b.seat)
      .map((s) => ({
        userId: s.userId,
        displayName: s.displayName,
        avatarUrl: s.avatarUrl ?? null,
        seat: s.seat,
        connected: s.connected !== false,
        left: false,
        score: 0,
        streak: 0,
        correctCount: 0,
        totalAnswerMs: 0
      }));
    this.startIntro(state, now, 0);
    return state;
  }

  /** FINAL / ABORTED -> LOBBY with the same quiz, so the host can edit it again. */
  public static backToLobby(state: QuizServerState, userId: string): QuizServerState {
    this.requireHost(state, userId);
    if (state.phase !== 'FINAL' && state.phase !== 'ABORTED') throw new GameRuleError('WRONG_PHASE', 'The quiz is still running');
    return this.createLobbyState({ ...state.host, connected: state.host.connected }, state.quiz, state.idSeq);
  }

  // -------------------------------------------------------------------
  // Phase machine
  // -------------------------------------------------------------------

  private static startIntro(state: QuizServerState, now: number, index: number): void {
    state.questionIndex = index;
    state.answers = {};
    state.buzz = emptyBuzz();
    state.deltas = {};
    state.reveal = null;
    state.statusMessage = `Question ${index + 1} of ${state.quiz.length}`;
    this.setPhase(state, 'INTRO', now, QUIZ_TIMING.introMs);
  }

  private static startQuestion(state: QuizServerState, now: number): void {
    const q = this.current(state);
    if (!q) return;
    state.questionStartedAt = now;
    state.statusMessage = q.type === 'BUZZER' ? 'Buzz in to answer!' : 'Pick your answer.';
    this.setPhase(state, 'QUESTION', now, q.type === 'BUZZER' ? QUIZ_TIMING.buzzerQuestionMs : q.timeLimitSec * 1000);
  }

  /** The end of the quiz: the podium is final. */
  private static finish(state: QuizServerState): void {
    const top = this.leaderboard(state.players)[0];
    state.winnerUserId = top && top.score > 0 ? top.userId : null;
    state.buzz = emptyBuzz();
    state.reveal = null;
    state.statusMessage = state.winnerUserId ? `${this.name(state, state.winnerUserId)} wins the quiz!` : 'The quiz is over.';
    this.setPhase(state, 'FINAL', 0, null);
  }

  /** Ends the quiz early without a podium (the host left, or every player left). Safe to call twice. */
  public static abort(state: QuizServerState, message: string): void {
    if (state.phase === 'ABORTED' || state.phase === 'FINAL') return;
    state.phase = 'ABORTED';
    state.phaseEndsAt = null;
    state.phaseDurationMs = 0;
    state.winnerUserId = null;
    state.statusMessage = message;
  }

  private static advance(state: QuizServerState, now: number): void {
    if (state.questionIndex + 1 >= state.quiz.length) this.finish(state);
    else this.startIntro(state, now, state.questionIndex + 1);
  }

  private static resultRow(userId: string, optionIndex: number | null, correct: boolean, points: number, answerText: string): QuizResultRow {
    return { userId, optionIndex, correct, points, answerText };
  }

  /** Enters REVEAL: scores a MULTIPLE_CHOICE question now (nothing is added to a score before this), then publishes the answer. */
  private static revealQuestion(state: QuizServerState, now: number): void {
    const q = this.current(state);
    if (!q) return;
    const results: QuizResultRow[] = [];
    let optionCounts: number[] = [];
    let noWinner = false;

    if (q.type === 'MULTIPLE_CHOICE') {
      optionCounts = q.options.map(() => 0);
      const limitMs = q.timeLimitSec * 1000;
      const endsAt = state.questionStartedAt + limitMs;
      for (const p of state.players) {
        const a = state.answers[p.userId];
        if (!a) {
          p.streak = 0;
          results.push(this.resultRow(p.userId, null, false, 0, ''));
          continue;
        }
        optionCounts[a.optionIndex] = (optionCounts[a.optionIndex] ?? 0) + 1;
        if (a.optionIndex === q.correctIndex) {
          p.streak += 1;
          const pts = quizSpeedPoints(q.points, endsAt - a.at, limitMs) + quizStreakBonus(p.streak);
          p.score += pts;
          p.correctCount += 1;
          p.totalAnswerMs += Math.max(0, a.at - state.questionStartedAt);
          results.push(this.resultRow(p.userId, a.optionIndex, true, pts, ''));
        } else {
          p.streak = 0;
          results.push(this.resultRow(p.userId, a.optionIndex, false, 0, ''));
        }
      }
      noWinner = !results.some((r) => r.correct);
    } else {
      // BUZZER: points were applied the moment the host judged; here only the public record is built
      const buzzed = new Set([...Object.keys(state.buzz.buzzAt), ...Object.keys(state.deltas)]);
      for (const p of state.players) {
        if (!buzzed.has(p.userId)) continue;
        const delta = state.deltas[p.userId] ?? 0;
        results.push(this.resultRow(p.userId, null, delta > 0, delta, state.buzz.texts[p.userId] ?? ''));
      }
      noWinner = !results.some((r) => r.correct);
    }

    const correctOption = q.type === 'MULTIPLE_CHOICE' ? q.options[q.correctIndex] ?? '' : '';
    const reveal: QuizReveal = {
      questionId: q.id,
      type: q.type,
      correctIndex: q.type === 'MULTIPLE_CHOICE' ? q.correctIndex : -1,
      answerText: q.type === 'MULTIPLE_CHOICE' ? correctOption : q.note,
      note: q.note,
      optionCounts,
      results,
      noWinner,
      skipped: false
    };
    state.reveal = reveal;
    state.buzz.activeUserId = null;
    state.buzz.answerEndsAt = null;
    state.statusMessage = noWinner ? 'Nobody got it.' : q.type === 'BUZZER' ? `${this.name(state, results.find((r) => r.correct)?.userId)} got it!` : 'Answer revealed.';
    this.setPhase(state, 'REVEAL', now, QUIZ_TIMING.revealMs);
  }

  /** Opens the answer window of the first buzzer in line (nobody active and somebody waiting). */
  private static promoteBuzzer(state: QuizServerState, now: number): void {
    if (state.buzz.activeUserId) return;
    while (state.buzz.queue.length) {
      const next = state.buzz.queue[0];
      const p = this.findPlayer(state, next);
      if (!p || p.left) { state.buzz.queue.shift(); continue; }
      state.buzz.activeUserId = next;
      state.buzz.answerEndsAt = now + QUIZ_TIMING.buzzerAnswerMs;
      state.statusMessage = `${p.displayName} is answering.`;
      return;
    }
    state.buzz.activeUserId = null;
    state.buzz.answerEndsAt = null;
  }

  /** The active buzzer is out for this question (wrong answer, no answer in time, or left); `penalty` takes half the question points. */
  private static lockOutActive(state: QuizServerState, now: number, penalty: boolean): void {
    const id = state.buzz.activeUserId;
    const q = this.current(state);
    if (!id || !q) return;
    state.buzz.queue = state.buzz.queue.filter((x) => x !== id);
    if (!state.buzz.lockedOut.includes(id)) state.buzz.lockedOut.push(id);
    state.buzz.activeUserId = null;
    state.buzz.answerEndsAt = null;
    const p = this.findPlayer(state, id);
    if (p) {
      p.streak = 0;
      if (penalty) {
        const loss = Math.min(p.score, Math.round(q.points * QUIZ_BUZZ_PENALTY));
        p.score -= loss;
        state.deltas[id] = (state.deltas[id] ?? 0) - loss;
      }
    }
    this.promoteBuzzer(state, now);
    if (!state.buzz.activeUserId) {
      state.statusMessage = this.buzzersLeft(state) ? 'Waiting for the next buzz.' : 'Everybody is locked out. Reveal the answer.';
    }
  }

  private static buzzersLeft(state: QuizServerState): boolean {
    return state.players.some((p) => !p.left && !state.buzz.lockedOut.includes(p.userId));
  }

  /**
   * Applies everything that is due at `now`: the intro / question / reveal clocks, an expired buzzer window, "everybody answered".
   * Returns true when the state changed. Call it from the server timer and before every action.
   */
  public static tick(state: QuizServerState, now: number): boolean {
    let changed = false;
    for (let guard = 0; guard < 64; guard++) {
      if (!RUNNING.has(state.phase)) break;
      if (state.host.left) {
        this.abort(state, 'The quiz master left, so the quiz ended.');
        changed = true;
        break;
      }
      if (this.activePlayers(state).length === 0) {
        this.abort(state, 'Every player left, so the quiz ended.');
        changed = true;
        break;
      }
      const due = state.phaseEndsAt !== null && now >= state.phaseEndsAt;
      const startAt = due && now - (state.phaseEndsAt as number) <= CHAIN_SLACK_MS ? (state.phaseEndsAt as number) : now;
      let progressed = false;

      switch (state.phase) {
        case 'INTRO':
          if (due) { this.startQuestion(state, startAt); progressed = true; }
          break;
        case 'QUESTION': {
          const q = this.current(state);
          if (!q) break;
          if (q.type === 'MULTIPLE_CHOICE') {
            const present = state.players.filter((p) => !p.left && p.connected);
            const everyoneAnswered = present.length > 0 && present.every((p) => state.answers[p.userId] !== undefined);
            if (due || everyoneAnswered) { this.revealQuestion(state, due ? startAt : now); progressed = true; }
          } else {
            const winEnd = state.buzz.answerEndsAt;
            // the active buzzer ran out of time before the question clock did: lock them out, the next in line gets a turn
            if (state.buzz.activeUserId && winEnd !== null && now >= winEnd && !(due && (state.phaseEndsAt as number) <= winEnd)) {
              this.lockOutActive(state, winEnd, false);
              progressed = true;
            } else if (due) {
              this.revealQuestion(state, startAt);
              progressed = true;
            }
          }
          break;
        }
        case 'REVEAL':
          if (due) { this.advance(state, startAt); progressed = true; }
          break;
      }
      if (!progressed) break;
      changed = true;
    }
    return changed;
  }

  // -------------------------------------------------------------------
  // Player actions (each throws GameRuleError for anything out of phase / role / invalid)
  // -------------------------------------------------------------------

  private static requireOpenQuestion(state: QuizServerState, questionId: unknown, type: QuizQuestion['type']): QuizQuestion {
    if (state.phase !== 'QUESTION') throw new GameRuleError('WRONG_PHASE', 'No question is open right now');
    const q = this.current(state);
    if (!q || q.id !== questionId) throw new GameRuleError('WRONG_PHASE', 'That question has already moved on');
    if (q.type !== type) throw new GameRuleError('ILLEGAL_MOVE', type === 'MULTIPLE_CHOICE' ? 'This is a buzzer question' : 'This is not a buzzer question');
    return q;
  }

  /** One answer to the open MULTIPLE_CHOICE question. Idempotent: a second answer (even a different one) is ignored (false). */
  public static submitAnswer(state: QuizServerState, userId: string, questionId: unknown, optionIndex: unknown, now: number): boolean {
    this.tick(state, now);
    this.requirePlayer(state, userId);
    const q = this.requireOpenQuestion(state, questionId, 'MULTIPLE_CHOICE');
    if (typeof optionIndex !== 'number' || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= q.options.length) {
      throw new GameRuleError('INVALID_INPUT', 'Pick one of the options');
    }
    if (state.answers[userId] !== undefined) return false;
    state.answers[userId] = { optionIndex, at: now };
    this.tick(state, now);
    return true;
  }

  /** A buzz. The server decides the order by arrival. Returns false when the player already buzzed. */
  public static buzz(state: QuizServerState, userId: string, questionId: unknown, now: number): boolean {
    this.tick(state, now);
    this.requirePlayer(state, userId);
    this.requireOpenQuestion(state, questionId, 'BUZZER');
    if (state.buzz.lockedOut.includes(userId)) throw new GameRuleError('ILLEGAL_MOVE', 'You are locked out of this question');
    if (state.buzz.queue.includes(userId)) return false;
    state.buzz.queue.push(userId);
    state.buzz.buzzAt[userId] = Math.max(0, now - state.questionStartedAt);
    this.promoteBuzzer(state, now);
    return true;
  }

  /** The typed answer of the player whose window is open (the host sees it and judges). */
  public static submitBuzzAnswer(state: QuizServerState, userId: string, questionId: unknown, text: unknown, now: number): boolean {
    this.tick(state, now);
    this.requirePlayer(state, userId);
    this.requireOpenQuestion(state, questionId, 'BUZZER');
    if (state.buzz.activeUserId !== userId) throw new GameRuleError('ILLEGAL_MOVE', 'It is not your turn to answer');
    if (typeof text !== 'string') throw new GameRuleError('INVALID_INPUT', 'Type your answer');
    const clean = sanitizeQuizText(text).slice(0, QUIZ_ANSWER_MAX);
    if (!clean) throw new GameRuleError('INVALID_INPUT', 'Type your answer');
    if (state.buzz.texts[userId] === clean) return false;
    state.buzz.texts[userId] = clean;
    return true;
  }

  // -------------------------------------------------------------------
  // Host actions
  // -------------------------------------------------------------------

  /** The host marks the active buzzer's answer. Correct: full points (+ streak bonus) and the question is revealed. Wrong: half the points are lost, the next buzzer gets a turn. */
  public static judge(state: QuizServerState, hostId: string, questionId: unknown, correct: boolean, now: number): boolean {
    this.tick(state, now);
    this.requireHost(state, hostId);
    const q = this.requireOpenQuestion(state, questionId, 'BUZZER');
    const id = state.buzz.activeUserId;
    if (!id) throw new GameRuleError('ILLEGAL_MOVE', 'Nobody is answering right now');
    if (!correct) {
      this.lockOutActive(state, now, true);
      return true;
    }
    const p = this.requirePlayer(state, id);
    p.streak += 1;
    const pts = q.points + quizStreakBonus(p.streak);
    p.score += pts;
    p.correctCount += 1;
    p.totalAnswerMs += state.buzz.buzzAt[id] ?? 0;
    state.deltas[id] = (state.deltas[id] ?? 0) + pts;
    this.revealQuestion(state, now);
    return true;
  }

  /** Skip / Reveal now / Next question / End quiz. Returns false when there was nothing to do. */
  public static hostControl(state: QuizServerState, hostId: string, action: QuizControlAction, now: number): boolean {
    this.tick(state, now);
    this.requireHost(state, hostId);
    if (!RUNNING.has(state.phase)) throw new GameRuleError('WRONG_PHASE', 'The quiz is not running');
    switch (action) {
      case 'reveal':
        if (state.phase !== 'QUESTION') throw new GameRuleError('WRONG_PHASE', 'There is no open question to reveal');
        this.revealQuestion(state, now);
        return true;
      case 'next':
        if (state.phase === 'REVEAL') { this.advance(state, now); return true; }
        if (state.phase === 'INTRO') { this.startQuestion(state, now); return true; }
        throw new GameRuleError('WRONG_PHASE', 'Reveal the answer first');
      case 'skip':
        if (state.phase === 'REVEAL') { this.advance(state, now); return true; }
        // the question is dropped without a reveal; MULTIPLE_CHOICE answers are discarded (nothing was scored yet)
        this.advance(state, now);
        return true;
      case 'end':
        this.finish(state);
        return true;
    }
    return false;
  }

  // -------------------------------------------------------------------
  // Chat
  // -------------------------------------------------------------------

  /** True while this player's own buzzer answer window is open (typed chat could leak the answer to the host's room). */
  public static chatLockedFor(state: QuizServerState | QuizGameView | null | undefined, userId: string): boolean {
    if (!state || state.phase !== 'QUESTION') return false;
    if (this.isServerState(state)) return (state as QuizServerState).buzz.activeUserId === userId;
    return (state as QuizGameView).buzz?.activeUserId === userId;
  }

  // -------------------------------------------------------------------
  // Connection / membership
  // -------------------------------------------------------------------

  public static setConnected(state: QuizServerState, userId: string, connected: boolean): void {
    if (state.host.userId === userId) {
      if (!state.host.left) state.host.connected = connected;
      return;
    }
    const p = this.findPlayer(state, userId);
    if (p && !p.left) p.connected = connected;
  }

  /**
   * Somebody left for good (explicit leave, or the reconnect window ran out). The host leaving ends the quiz (ABORTED). A player
   * leaving keeps their score on the leaderboard, marked "left"; with no player left the quiz ends too.
   * Returns true when the quiz was aborted.
   */
  public static removePlayer(state: QuizServerState, userId: string, now: number): boolean {
    if (state.host.userId === userId) {
      if (state.host.left) return state.phase === 'ABORTED';
      state.host.left = true;
      state.host.connected = false;
      if (RUNNING.has(state.phase)) this.abort(state, 'The quiz master left, so the quiz ended.');
      return state.phase === 'ABORTED';
    }
    const p = this.findPlayer(state, userId);
    if (!p || p.left) return state.phase === 'ABORTED';
    p.left = true;
    p.connected = false;
    if (state.phase === 'QUESTION') {
      const wasActive = state.buzz.activeUserId === userId;
      state.buzz.queue = state.buzz.queue.filter((x) => x !== userId);
      if (wasActive) {
        state.buzz.activeUserId = null;
        state.buzz.answerEndsAt = null;
        this.promoteBuzzer(state, now);
      }
    }
    this.tick(state, now);
    return state.phase === 'ABORTED';
  }

  // -------------------------------------------------------------------
  // Redaction
  // -------------------------------------------------------------------

  /** True for the full server state (it still carries the quiz); false for a redacted view. */
  public static isServerState(state: unknown): boolean {
    return Boolean(state && typeof state === 'object' && Array.isArray((state as any).quiz));
  }

  /**
   * The redacted copy of the state for ONE recipient. Rules:
   *  - the correct option and the note exist only in the host view (and in the reveal, once the question is revealed)
   *  - what other players picked is never sent before the reveal; the host sees live counts per option, players only how many answered
   *  - the draft quiz (with its answers) goes to the host in the lobby only
   *  - the buzzer answer a player typed goes to the host and to that player only
   *  - spectators (and strangers) get the public view only (`me` is null)
   */
  public static publicStateFor(state: QuizServerState | QuizGameView | null | undefined, viewerId: string | null | undefined, now: number = Date.now()): QuizGameView | null {
    if (!state) return null;
    if (!this.isServerState(state)) return state as QuizGameView; // already redacted
    const s = state as QuizServerState;
    const isHost = typeof viewerId === 'string' && viewerId === s.host.userId && !s.host.left;
    const viewer = typeof viewerId === 'string' ? this.findPlayer(s, viewerId) : undefined;
    const q = this.current(s);
    const inQuestionFlow = RUNNING.has(s.phase) && q !== null;
    const board = this.leaderboard(s.players);

    const question: QuizViewQuestion | null = inQuestionFlow && q
      ? { id: q.id, index: s.questionIndex, total: s.quiz.length, type: q.type, text: q.text, options: [...q.options], timeLimitSec: q.timeLimitSec, points: q.points }
      : null;

    let me: QuizMe | null = null;
    if (isHost) {
      me = { role: 'host', myOption: null, answered: false, buzzed: false, lockedOut: false, isActiveAnswerer: false, queuePosition: null, rank: null, score: 0 };
    } else if (viewer && !viewer.left) {
      const pos = s.buzz.queue.indexOf(viewer.userId);
      me = {
        role: 'player',
        myOption: s.phase === 'QUESTION' || s.phase === 'REVEAL' ? s.answers[viewer.userId]?.optionIndex ?? null : null,
        answered: s.answers[viewer.userId] !== undefined,
        buzzed: s.buzz.buzzAt[viewer.userId] !== undefined,
        lockedOut: s.buzz.lockedOut.includes(viewer.userId),
        isActiveAnswerer: s.phase === 'QUESTION' && s.buzz.activeUserId === viewer.userId,
        queuePosition: s.phase === 'QUESTION' && pos >= 0 ? pos + 1 : null,
        rank: board.find((r) => r.userId === viewer.userId)?.rank ?? null,
        score: viewer.score
      };
    }

    const isBuzzer = q?.type === 'BUZZER' && (s.phase === 'QUESTION' || s.phase === 'REVEAL');
    const activeId = s.buzz.activeUserId;
    const canSeeText = isHost || (viewer && viewer.userId === activeId);
    const optionCount = q?.type === 'MULTIPLE_CHOICE' ? q.options.length : 0;

    return {
      game: 'quiz-show',
      phase: s.phase,
      host: { ...s.host },
      players: s.players.map((p) => ({ ...p })),
      questionCount: s.quiz.length,
      questionIndex: s.questionIndex,
      question,
      phaseEndsAt: s.phaseEndsAt,
      phaseDurationMs: s.phaseDurationMs,
      serverNow: now,
      me,
      answeredCount: s.phase === 'QUESTION' || s.phase === 'REVEAL' ? Object.keys(s.answers).length : 0,
      answerCounts: isHost && inQuestionFlow && optionCount > 0 && s.phase !== 'REVEAL'
        ? Array.from({ length: optionCount }, (_, i) => Object.values(s.answers).filter((a) => a.optionIndex === i).length)
        : null,
      hostQuestion: isHost && inQuestionFlow && q ? { correctIndex: q.correctIndex, note: q.note } : null,
      draft: isHost && s.phase === 'LOBBY' ? s.quiz.map((x) => ({ ...x, options: [...x.options] })) : null,
      buzz: isBuzzer
        ? {
            queue: s.phase === 'QUESTION' ? [...s.buzz.queue] : [],
            lockedOut: [...s.buzz.lockedOut],
            activeUserId: s.phase === 'QUESTION' ? activeId : null,
            answerEndsAt: s.phase === 'QUESTION' ? s.buzz.answerEndsAt : null,
            activeText: s.phase === 'QUESTION' && canSeeText && activeId ? s.buzz.texts[activeId] ?? null : null
          }
        : null,
      reveal: s.phase === 'REVEAL' && s.reveal ? { ...s.reveal, optionCounts: [...s.reveal.optionCounts], results: s.reveal.results.map((r) => ({ ...r })) } : null,
      leaderboard: board,
      winnerUserId: s.phase === 'FINAL' ? s.winnerUserId : null,
      statusMessage: s.statusMessage
    };
  }
}
