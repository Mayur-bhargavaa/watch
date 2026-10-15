// Pure helpers for the Imposter UI (no React, no browser APIs) so they can be unit tested.
import { tierAtLeast, IMPOSTER_MIN_PLAYERS, IMPOSTER_MAX_PLAYERS } from '@synccinema/common';
import type { ImposterGameView, ImposterPhase, ImposterPlayer, ImposterClue } from '@synccinema/common';

/** Only a VIP (Watch+) or Creator host can create an Imposter room. Guests of any pass can join. */
export function canHostImposter(tier: unknown): boolean {
  return tierAtLeast(tier, 'plus');
}

export interface StartCheck { ok: boolean; reason: string }

/** Lobby: can the host press "Start" now? `connected` counts the players with a live connection. */
export function startCheck(isHost: boolean, connected: number, minPlayers: number = IMPOSTER_MIN_PLAYERS): StartCheck {
  if (!isHost) return { ok: false, reason: 'Waiting for the host to start' };
  if (connected < minPlayers) {
    const need = minPlayers - connected;
    return { ok: false, reason: `Need ${need} more ${need === 1 ? 'player' : 'players'} (${minPlayers} to ${IMPOSTER_MAX_PLAYERS} can play)` };
  }
  return { ok: true, reason: 'Ready to start' };
}

/** Server clock minus client clock, from the `serverNow` the server stamps on every view. */
export function clockOffset(serverNow: number | undefined, clientNow: number): number {
  return typeof serverNow === 'number' && Number.isFinite(serverNow) ? serverNow - clientNow : 0;
}

/** Milliseconds left in the current phase / turn (0 when nothing is timed or it is over). */
export function msLeft(view: Pick<ImposterGameView, 'phaseEndsAt'> | null | undefined, clientNow: number, offset: number): number {
  if (!view || view.phaseEndsAt === null || view.phaseEndsAt === undefined) return 0;
  return Math.max(0, view.phaseEndsAt - (clientNow + offset));
}

/** 0..1 share of the phase that is still left (for the timer ring). */
export function ringFraction(view: Pick<ImposterGameView, 'phaseEndsAt' | 'phaseDurationMs'> | null | undefined, clientNow: number, offset: number): number {
  if (!view || !view.phaseDurationMs) return 0;
  return Math.min(1, Math.max(0, msLeft(view, clientNow, offset) / view.phaseDurationMs));
}

export function secondsLabel(ms: number): string {
  return String(Math.max(0, Math.ceil(ms / 1000)));
}

const PHASE_TITLES: Record<ImposterPhase, string> = {
  REVEAL: 'Your role',
  CLUES: 'Give a clue',
  DISCUSS: 'Discuss',
  VOTE: 'Vote',
  GUESS: 'Last chance',
  RESULT: 'Round result',
  FINISHED: 'Final scores',
  ABORTED: 'Game ended'
};
export function phaseTitle(phase: ImposterPhase | string | undefined): string {
  return (phase && PHASE_TITLES[phase as ImposterPhase]) || 'Imposter';
}

export function playerName(players: Pick<ImposterPlayer, 'userId' | 'displayName'>[], userId: string | null | undefined): string {
  if (!userId) return '';
  return players.find((p) => p.userId === userId)?.displayName || 'Player';
}

/** Players still in the game, in seat order. */
export function activePlayers(view: Pick<ImposterGameView, 'players'>): ImposterPlayer[] {
  return view.players.filter((p) => !p.left).sort((a, b) => a.seat - b.seat);
}

/** Players I may vote for: everybody still in the game except me. */
export function voteTargets(view: Pick<ImposterGameView, 'players'>, myUserId: string): ImposterPlayer[] {
  return activePlayers(view).filter((p) => p.userId !== myUserId);
}

export function canVote(view: Pick<ImposterGameView, 'phase' | 'myVote' | 'players'>, myUserId: string): boolean {
  return view.phase === 'VOTE' && !view.myVote && activePlayers(view).some((p) => p.userId === myUserId);
}

export function voteProgress(view: Pick<ImposterGameView, 'players' | 'votedUserIds'>): { voted: number; needed: number } {
  const present = activePlayers(view).filter((p) => p.connected);
  return { voted: present.filter((p) => view.votedUserIds.includes(p.userId)).length, needed: present.length };
}

export interface ClueRow { userId: string; name: string; words: (string | null)[] }

/** Clue board: one row per player (seat order), one entry per clue round; null = skipped turn, undefined entries are not yet given. */
export function clueRows(view: Pick<ImposterGameView, 'players' | 'clues' | 'clueRounds'>): ClueRow[] {
  return view.players
    .slice()
    .sort((a, b) => a.seat - b.seat)
    .filter((p) => !p.left || view.clues.some((c) => c.userId === p.userId))
    .map((p) => {
      const words: (string | null)[] = [];
      for (let r = 1; r <= view.clueRounds; r++) {
        const c = view.clues.find((x: ImposterClue) => x.userId === p.userId && x.round === r);
        words.push(c ? c.word : null);
      }
      return { userId: p.userId, name: p.displayName, words };
    });
}

/** True when this player has already given (or skipped) their clue for `round`. */
export function clueDone(clues: ImposterClue[], userId: string, round: number): boolean {
  return clues.some((c) => c.userId === userId && c.round === round);
}

export interface ScoreRow { userId: string; name: string; score: number; rank: number; left: boolean }

/** Leaderboard sorted by score, equal scores share a rank. */
export function leaderboard(view: Pick<ImposterGameView, 'players' | 'scores'>): ScoreRow[] {
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

/** Headline of the RESULT card from the viewer's side. */
export function resultHeadline(view: Pick<ImposterGameView, 'result' | 'players'>, myUserId: string, isSpectator = false): string {
  const r = view.result;
  if (!r) return '';
  if (r.voided) return 'Round cancelled';
  const imposter = playerName(view.players, r.imposterId);
  if (isSpectator) return r.winner === 'crew' ? 'The crew wins the round' : `${imposter} fooled the crew`;
  const iAmImposter = r.imposterId === myUserId;
  if (r.winner === 'crew') return iAmImposter ? 'You were caught' : 'The crew wins the round';
  return iAmImposter ? 'You fooled everyone' : `${imposter} fooled the crew`;
}

/** Points I earned in the round that just ended. */
export function myPoints(view: Pick<ImposterGameView, 'result'>, myUserId: string): number {
  return view.result?.points?.[myUserId] ?? 0;
}

/** Friendly text for a game:error code on the Imposter screens. */
export function imposterErrorText(code: string | undefined, message?: string): string {
  switch (code) {
    case 'NOT_YOUR_TURN': return 'It is not your turn.';
    case 'WRONG_PHASE': return 'That is not possible right now.';
    case 'ALREADY_VOTED': return 'Your vote is final.';
    case 'RATE_LIMITED': return 'Slow down a little.';
    case 'HOST_ONLY': return 'Only the host can start the game.';
    case 'UPGRADE_REQUIRED': return 'Hosting Imposter needs Watch+ (VIP Pass). You can still join a friend\'s game.';
    default: return message || 'That did not work. Try again.';
  }
}

/** Client-side mirror of the clue rules, only to avoid a pointless round trip (the server decides). */
export function clueDraftProblem(text: string): string | null {
  const t = text.trim();
  if (!t) return 'Type one word';
  if (/\s/.test(t)) return 'One word only';
  if (t.length > 24) return 'Max 24 characters';
  return null;
}
