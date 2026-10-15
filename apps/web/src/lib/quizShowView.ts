// Pure helpers for the Quiz Show Studio UI (no React, no browser APIs) so they can be unit tested.
import {
  tierAtLeast,
  QUIZ_LEADERBOARD_TOP,
  QUIZ_MAX_OPTIONS,
  QUIZ_MAX_PLAYERS,
  QUIZ_MAX_QUESTIONS,
  QUIZ_MIN_OPTIONS,
  QUIZ_NOTE_MAX,
  QUIZ_OPTION_MAX,
  QUIZ_TEXT_MAX
} from '@synccinema/common';
import type { QuizGameView, QuizLeaderboardRow, QuizPhase, QuizQuestionInput, QuizQuestionType } from '@synccinema/common';

/** Only a Creator Pass host can create a Quiz Show Studio room. Guests of any pass can join and watch. */
export function canHostQuiz(tier: unknown): boolean {
  return tierAtLeast(tier, 'creator');
}

export interface StartCheck { ok: boolean; reason: string }

/** Lobby: can the host press "Start" now? `connectedPlayers` counts the players (not the host) with a live connection. */
export function startCheck(isHost: boolean, connectedPlayers: number, questionCount: number): StartCheck {
  if (!isHost) return { ok: false, reason: 'Waiting for the host to start' };
  if (questionCount < 1) return { ok: false, reason: 'Add at least one question to start' };
  if (connectedPlayers < 1) return { ok: false, reason: `Waiting for a player to join (up to ${QUIZ_MAX_PLAYERS} can play)` };
  return { ok: true, reason: `Ready: ${questionCount} ${questionCount === 1 ? 'question' : 'questions'}, ${connectedPlayers} ${connectedPlayers === 1 ? 'player' : 'players'}` };
}

const PHASE_TITLES: Record<QuizPhase, string> = {
  LOBBY: 'Lobby',
  INTRO: 'Get ready',
  QUESTION: 'Question',
  REVEAL: 'Answer',
  FINAL: 'Final results',
  ABORTED: 'Quiz ended'
};
export function phaseTitle(phase: QuizPhase | string | undefined): string {
  return (phase && PHASE_TITLES[phase as QuizPhase]) || 'Quiz Show Studio';
}

/** "Question 3 of 12" for the top bar. */
export function progressLabel(view: Pick<QuizGameView, 'phase' | 'questionIndex' | 'questionCount'>): string {
  if (view.phase === 'FINAL' || view.phase === 'ABORTED') return phaseTitle(view.phase);
  if (view.questionIndex < 0) return phaseTitle(view.phase);
  return `Question ${view.questionIndex + 1} of ${view.questionCount}`;
}

/** The four muted solid option hues (white text, contrast >= 4.5:1), in option order. */
export const OPTION_STYLES = [
  { bg: 'bg-rose-700 hover:bg-rose-800', ring: 'ring-rose-300', letter: 'A' },
  { bg: 'bg-blue-700 hover:bg-blue-800', ring: 'ring-blue-300', letter: 'B' },
  { bg: 'bg-amber-700 hover:bg-amber-800', ring: 'ring-amber-300', letter: 'C' },
  { bg: 'bg-emerald-700 hover:bg-emerald-800', ring: 'ring-emerald-300', letter: 'D' }
] as const;
export function optionStyle(index: number) {
  return OPTION_STYLES[((index % 4) + 4) % 4];
}

export interface LeaderboardWindow { top: QuizLeaderboardRow[]; mine: QuizLeaderboardRow | null; hidden: number }

/** The live leaderboard: the first `limit` rows plus the viewer's own row when they are further down. */
export function leaderboardWindow(rows: QuizLeaderboardRow[], myUserId: string | null | undefined, limit: number = QUIZ_LEADERBOARD_TOP): LeaderboardWindow {
  const top = rows.slice(0, limit);
  const mine = myUserId && !top.some((r) => r.userId === myUserId) ? rows.find((r) => r.userId === myUserId) ?? null : null;
  return { top, mine, hidden: Math.max(0, rows.length - top.length - (mine ? 1 : 0)) };
}

/** First three of the leaderboard for the podium, ordered for display: 2nd, 1st, 3rd. Fewer than 3 players: what exists. */
export function podium(rows: QuizLeaderboardRow[]): QuizLeaderboardRow[] {
  const [first, second, third] = rows;
  return [second, first, third].filter(Boolean) as QuizLeaderboardRow[];
}

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

export function playerName(view: Pick<QuizGameView, 'players' | 'host'>, userId: string | null | undefined): string {
  if (!userId) return '';
  if (userId === view.host.userId) return view.host.displayName;
  return view.players.find((p) => p.userId === userId)?.displayName || 'Player';
}

/** Share of a count out of the largest count (for the answer bars), 0..1. */
export function barFraction(count: number, counts: number[]): number {
  const max = Math.max(1, ...counts);
  return Math.min(1, Math.max(0, count / max));
}

export function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : points < 0 ? `${points}` : '0';
}

export type PlayerQuestionState = 'waiting' | 'answering' | 'answered' | 'reveal' | 'buzz' | 'buzzed' | 'turn' | 'locked' | 'idle';

/** What the player's main area should show right now (the server decides everything; this only picks the screen). */
export function playerQuestionState(view: Pick<QuizGameView, 'phase' | 'question' | 'me' | 'buzz'>): PlayerQuestionState {
  const me = view.me;
  if (!me || me.role !== 'player') return 'idle';
  if (view.phase === 'INTRO') return 'waiting';
  if (view.phase === 'REVEAL') return 'reveal';
  if (view.phase !== 'QUESTION' || !view.question) return 'idle';
  if (view.question.type === 'MULTIPLE_CHOICE') return me.answered ? 'answered' : 'answering';
  if (me.isActiveAnswerer) return 'turn';
  if (me.lockedOut) return 'locked';
  if (me.buzzed) return 'buzzed';
  return 'buzz';
}

/** Everybody (not locked out) who is still in the game has a buzz queue position or is locked out. */
export function allLockedOut(view: Pick<QuizGameView, 'players' | 'buzz'>): boolean {
  if (!view.buzz) return false;
  const active = view.players.filter((p) => !p.left);
  return active.length > 0 && active.every((p) => view.buzz!.lockedOut.includes(p.userId));
}

export function secondsText(ms: number): string {
  return String(Math.max(0, Math.ceil(ms / 1000)));
}

// ---------------------------------------------------------------------------- quiz editor

export interface EditorQuestion {
  type: QuizQuestionType;
  text: string;
  options: string[];
  correctIndex: number;
  timeLimitSec: number;
  points: number;
  note: string;
}

export function blankQuestion(type: QuizQuestionType = 'MULTIPLE_CHOICE'): EditorQuestion {
  return type === 'BUZZER'
    ? { type, text: '', options: [], correctIndex: -1, timeLimitSec: 45, points: 100, note: '' }
    : { type, text: '', options: ['', '', '', ''], correctIndex: 0, timeLimitSec: 20, points: 100, note: '' };
}

/** The same rules the server enforces, as readable messages (an empty list means the question can be saved). */
export function validateQuestion(q: EditorQuestion): string[] {
  const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
  const problems: string[] = [];
  const text = clean(q.text);
  if (!text) problems.push('Write the question');
  else if (text.length > QUIZ_TEXT_MAX) problems.push(`The question can be at most ${QUIZ_TEXT_MAX} characters`);
  if (clean(q.note).length > QUIZ_NOTE_MAX) problems.push(`The note can be at most ${QUIZ_NOTE_MAX} characters`);
  if (q.type === 'MULTIPLE_CHOICE') {
    const filled = q.options.map(clean);
    const used = filled.filter(Boolean);
    if (q.options.length < QUIZ_MIN_OPTIONS || q.options.length > QUIZ_MAX_OPTIONS) problems.push(`Use ${QUIZ_MIN_OPTIONS} to ${QUIZ_MAX_OPTIONS} options`);
    if (filled.some((o) => !o)) problems.push('Fill in every option or remove the empty ones');
    if (used.some((o) => o.length > QUIZ_OPTION_MAX)) problems.push(`An option can be at most ${QUIZ_OPTION_MAX} characters`);
    if (new Set(used.map((o) => o.toLowerCase())).size !== used.length) problems.push('Options must be different from each other');
    if (q.correctIndex < 0 || q.correctIndex >= q.options.length) problems.push('Pick the correct option');
  }
  return problems;
}

/** The message the server expects for the editor state (the server validates it again). */
export function questionPayload(q: EditorQuestion): QuizQuestionInput {
  return {
    type: q.type,
    text: q.text,
    options: q.type === 'MULTIPLE_CHOICE' ? q.options : [],
    correctIndex: q.type === 'MULTIPLE_CHOICE' ? q.correctIndex : -1,
    timeLimitSec: q.type === 'MULTIPLE_CHOICE' ? q.timeLimitSec : 45,
    points: q.points as QuizQuestionInput['points'],
    note: q.note
  };
}

export function canAddQuestion(count: number): boolean {
  return count < QUIZ_MAX_QUESTIONS;
}

export function quizErrorText(code: string | undefined, message?: string): string {
  switch (code) {
    case 'WRONG_PHASE': return 'That is not possible right now.';
    case 'RATE_LIMITED': return 'Slow down a little.';
    case 'HOST_ONLY': return 'Only the quiz master can do that.';
    case 'NOT_PLAYER': return 'Only players can do that.';
    case 'ILLEGAL_MOVE': return message || 'That is not possible right now.';
    case 'CHAT_LOCKED': return message || 'Chat is closed right now.';
    case 'UPGRADE_REQUIRED': return 'Hosting Quiz Show Studio needs the Creator Pass. You can still join a friend\'s quiz.';
    default: return message || 'That did not work. Try again.';
  }
}

/** Chat is closed for the player whose own buzzer answer window is open (the server enforces it; this only draws it). */
export function chatLockedReason(view: Pick<QuizGameView, 'phase' | 'me'>, isSpectator: boolean): string {
  if (isSpectator) return 'Spectators can only watch';
  if (view.phase === 'QUESTION' && view.me?.isActiveAnswerer) return 'Chat is locked while you answer';
  return '';
}
