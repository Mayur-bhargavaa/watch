// Pure helpers for the Emoji Charades UI (no React, no browser APIs) so they can be unit tested.
import { tierAtLeast, EMOJI_CHARADES_MIN_PLAYERS, EMOJI_CHARADES_MAX_PLAYERS, EMOJI_CHARADES_GUESS_MAX_LENGTH } from '@synccinema/common';
import type { EmojiCharadesGameView, EmojiCharadesPhase, EmojiCharadesPlayer } from '@synccinema/common';

/** Only a VIP (Watch+) or Creator host can create an Emoji Charades room. Guests of any pass can join. */
export function canHostEmojiCharades(tier: unknown): boolean {
  return tierAtLeast(tier, 'plus');
}

export interface StartCheck { ok: boolean; reason: string }

/** Lobby: can the host press "Start" now? `connected` counts the players with a live connection. */
export function startCheck(isHost: boolean, connected: number): StartCheck {
  if (!isHost) return { ok: false, reason: 'Waiting for the host to start' };
  if (connected < EMOJI_CHARADES_MIN_PLAYERS) {
    const need = EMOJI_CHARADES_MIN_PLAYERS - connected;
    return { ok: false, reason: `Need ${need} more ${need === 1 ? 'player' : 'players'} (${EMOJI_CHARADES_MIN_PLAYERS} to ${EMOJI_CHARADES_MAX_PLAYERS} can play)` };
  }
  return { ok: true, reason: 'Ready to start' };
}

/** Server clock minus client clock, from the `serverNow` the server stamps on every view. */
export function clockOffset(serverNow: number | undefined, clientNow: number): number {
  return typeof serverNow === 'number' && Number.isFinite(serverNow) ? serverNow - clientNow : 0;
}

/** Milliseconds left in the current phase (0 when nothing is timed or it is over). */
export function msLeft(view: Pick<EmojiCharadesGameView, 'phaseEndsAt'> | null | undefined, clientNow: number, offset: number): number {
  if (!view || view.phaseEndsAt === null || view.phaseEndsAt === undefined) return 0;
  return Math.max(0, view.phaseEndsAt - (clientNow + offset));
}

/** 0..1 share of the phase that is still left (for the timer ring). */
export function ringFraction(view: Pick<EmojiCharadesGameView, 'phaseEndsAt' | 'phaseDurationMs'> | null | undefined, clientNow: number, offset: number): number {
  if (!view || !view.phaseDurationMs) return 0;
  return Math.min(1, Math.max(0, msLeft(view, clientNow, offset) / view.phaseDurationMs));
}

export function secondsLabel(ms: number): string {
  return String(Math.max(0, Math.ceil(ms / 1000)));
}

/** Seconds until the next automatic hint (null when there is none to come). */
export function nextHintSeconds(view: Pick<EmojiCharadesGameView, 'nextHintAt'> | null | undefined, clientNow: number, offset: number): number | null {
  if (!view || view.nextHintAt === null || view.nextHintAt === undefined) return null;
  return Math.max(0, Math.ceil((view.nextHintAt - (clientNow + offset)) / 1000));
}

const PHASE_TITLES: Record<EmojiCharadesPhase, string> = {
  COUNTDOWN: 'Get ready',
  PLAY: 'Guess it',
  REVEAL: 'The answer',
  FINAL: 'Final scores',
  ABORTED: 'Game ended'
};
export function phaseTitle(phase: EmojiCharadesPhase | string | undefined): string {
  return (phase && PHASE_TITLES[phase as EmojiCharadesPhase]) || 'Emoji Charades';
}

export function playerName(players: Pick<EmojiCharadesPlayer, 'userId' | 'displayName'>[], userId: string | null | undefined): string {
  if (!userId) return '';
  return players.find((p) => p.userId === userId)?.displayName || 'Player';
}

/** Players still in the game, in seat order. */
export function activePlayers(view: Pick<EmojiCharadesGameView, 'players'>): EmojiCharadesPlayer[] {
  return view.players.filter((p) => !p.left).sort((a, b) => a.seat - b.seat);
}

/**
 * The masked answer as rows of words, each word a list of cells ("_" or a letter): "T _ _   D _ _ _" gives [["T","_","_"],["D","_","_","_"]].
 * Returns [] when there is no hint yet.
 */
export function hintWords(hint: string | null | undefined): string[][] {
  if (!hint) return [];
  return hint
    .split('   ')
    .map((word) => word.split(' ').filter((c) => c.length > 0))
    .filter((cells) => cells.length > 0);
}

/** "Hint 1 of 2" style label for the tier that is showing. */
export function hintLabel(tier: number): string {
  if (tier >= 2) return 'First letters revealed';
  if (tier === 1) return 'Letter count revealed';
  return 'Hints come as the clock runs';
}

export interface SolvedRow { userId: string; name: string; order: number | null; solved: boolean; connected: boolean }

/** "Who solved" strip: solvers first in solve order, then everybody still guessing. Names and order only, never answers. */
export function solvedStrip(view: Pick<EmojiCharadesGameView, 'players' | 'solvedUserIds'>): SolvedRow[] {
  const active = activePlayers(view);
  const solvedRows: SolvedRow[] = [];
  view.solvedUserIds.forEach((id, i) => {
    const p = view.players.find((x) => x.userId === id);
    if (p) solvedRows.push({ userId: id, name: p.displayName, order: i + 1, solved: true, connected: p.connected });
  });
  const rest = active
    .filter((p) => !view.solvedUserIds.includes(p.userId))
    .map((p): SolvedRow => ({ userId: p.userId, name: p.displayName, order: null, solved: false, connected: p.connected }));
  return [...solvedRows, ...rest];
}

export interface ScoreRow { userId: string; name: string; score: number; rank: number; left: boolean }

/** Leaderboard sorted by score, equal scores share a rank. */
export function leaderboard(view: Pick<EmojiCharadesGameView, 'players' | 'scores'>): ScoreRow[] {
  const rows = view.players
    .map((p) => ({ userId: p.userId, name: p.displayName, score: view.scores[p.userId] ?? 0, left: p.left }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  let rank = 0;
  let prev: number | null = null;
  return rows.map((r, i) => {
    if (prev === null || r.score !== prev) rank = i + 1;
    prev = r.score;
    return { ...r, rank };
  });
}

/** Top three players still in the game for the podium (rank 1 in the middle is a layout job of the component). */
export function podium(view: Pick<EmojiCharadesGameView, 'players' | 'scores'>): ScoreRow[] {
  return leaderboard(view).filter((r) => !r.left).slice(0, 3);
}

/** Points I earned in the round that just ended. */
export function myPoints(view: Pick<EmojiCharadesGameView, 'result'>, myUserId: string): number {
  return view.result?.points?.[myUserId] ?? 0;
}

/** Client-side mirror of the guess rules, only to avoid a pointless round trip (the server decides). */
export function guessDraftProblem(text: string): string | null {
  const t = text.trim();
  if (!t) return 'Type a movie or show';
  if (t.length > EMOJI_CHARADES_GUESS_MAX_LENGTH) return `Max ${EMOJI_CHARADES_GUESS_MAX_LENGTH} characters`;
  if (!/[\p{L}\p{N}]/u.test(t)) return 'Type a movie or show';
  return null;
}

/** What the guesser is told about their latest guess. */
export function feedbackFor(view: Pick<EmojiCharadesGameView, 'me'>): { kind: 'close' | 'wrong'; text: string } | null {
  const last = view.me?.guesses?.[view.me.guesses.length - 1];
  if (!last) return null;
  return last.kind === 'close' ? { kind: 'close', text: 'So close!' } : { kind: 'wrong', text: 'Not it' };
}

/** Friendly text for a game:error code on the Emoji Charades screens. */
export function emojiCharadesErrorText(code: string | undefined, message?: string): string {
  switch (code) {
    case 'WRONG_PHASE': return 'Guessing is not open right now.';
    case 'ALREADY_SOLVED': return 'You already solved this one.';
    case 'TOO_MANY_GUESSES': return 'No guesses left in this round.';
    case 'DUPLICATE_GUESS': return 'You already tried that.';
    case 'CHAT_LOCKED': return 'Chat is locked until the round ends.';
    case 'RATE_LIMITED': return 'Slow down a little.';
    case 'HOST_ONLY': return 'Only the host can start the game.';
    case 'UPGRADE_REQUIRED': return 'Hosting Emoji Charades needs Watch+ (VIP Pass). You can still join a friend\'s game.';
    default: return message || 'That did not work. Try again.';
  }
}
