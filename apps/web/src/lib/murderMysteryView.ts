// Pure helpers for the Murder Mystery Night UI (no React, no browser APIs) so they can be unit tested.
import { tierAtLeast, MURDER_MIN_PLAYERS, MURDER_MAX_PLAYERS, MURDER_WHISPER_MAX, MURDER_MOTIVE_MAX } from '@synccinema/common';
import type {
  MurderGameView, MurderPhase, MurderPlayer, MurderPublicCharacter, MurderScoreRow, MurderWhisper, MurderPrivateClue, MurderEvidence
} from '@synccinema/common';

/** Only a host with the Creator Pass can create a Murder Mystery Night room. Guests of any pass can join. */
export function canHostMurder(tier: unknown): boolean {
  return tierAtLeast(tier, 'creator');
}

export interface StartCheck { ok: boolean; reason: string }

/** Lobby: can the host press "Start" now? `connected` counts the players with a live connection. */
export function startCheck(isHost: boolean, connected: number, minPlayers: number = MURDER_MIN_PLAYERS): StartCheck {
  if (!isHost) return { ok: false, reason: 'Waiting for the host to start' };
  if (connected < minPlayers) {
    const need = minPlayers - connected;
    return { ok: false, reason: `Need ${need} more ${need === 1 ? 'player' : 'players'} (${minPlayers} to ${MURDER_MAX_PLAYERS} can play)` };
  }
  return { ok: true, reason: 'Ready to start' };
}

const PHASE_TITLES: Record<MurderPhase, string> = {
  LOBBY: 'Lobby',
  CHARACTER_REVEAL: 'Your character',
  CLUE_ROUND: 'Clue round',
  ACCUSATION: 'Accusation',
  RESULT: 'The truth',
  FINAL: 'Final scores',
  ABORTED: 'Game ended'
};
export function phaseTitle(phase: MurderPhase | string | undefined): string {
  return (phase && PHASE_TITLES[phase as MurderPhase]) || 'Murder Mystery Night';
}

/** Short label for the top bar: "Clue round 2 of 4", or the phase title. */
export function roundLabel(view: Pick<MurderGameView, 'phase' | 'round' | 'roundCount'>): string {
  if (view.phase === 'CLUE_ROUND' && view.round > 0) return `Clue round ${view.round} of ${view.roundCount || 4}`;
  return phaseTitle(view.phase);
}

export function murderErrorText(code: string | undefined, message?: string): string {
  switch (code) {
    case 'WRONG_PHASE': return 'That is not possible right now.';
    case 'ALREADY_VOTED': return 'You already did that.';
    case 'RATE_LIMITED': return 'Slow down a little.';
    case 'HOST_ONLY': return 'Only the host can do that.';
    case 'UPGRADE_REQUIRED': return 'Hosting Murder Mystery Night needs the Creator Pass. You can still join a friend\'s game.';
    default: return message || 'That did not work. Try again.';
  }
}

export function characterOf(view: Pick<MurderGameView, 'characters'>, characterId: string | null | undefined): MurderPublicCharacter | undefined {
  return characterId ? view.characters.find((c) => c.id === characterId) : undefined;
}

export function characterName(view: Pick<MurderGameView, 'characters'>, characterId: string | null | undefined): string {
  return characterOf(view, characterId)?.name || 'Unknown';
}

export function characterNameOfUser(view: Pick<MurderGameView, 'characters'>, userId: string | null | undefined): string {
  return view.characters.find((c) => c.userId === userId)?.name || '';
}

export function playerName(players: Pick<MurderPlayer, 'userId' | 'displayName'>[], userId: string | null | undefined): string {
  if (!userId) return '';
  return players.find((p) => p.userId === userId)?.displayName || 'Player';
}

/** Players still in the game (not withdrawn), in seat order. */
export function activePlayers(view: Pick<MurderGameView, 'players'>): MurderPlayer[] {
  return view.players.filter((p) => !p.left).sort((a, b) => a.seat - b.seat);
}

/** Who this player may whisper to: any other player who is still in. */
export function whisperTargets(view: Pick<MurderGameView, 'players'>, myUserId: string): MurderPlayer[] {
  return activePlayers(view).filter((p) => p.userId !== myUserId);
}

export function whisperCheck(text: string, toUserId: string | null, whispersLeft: number): { ok: boolean; reason: string } {
  const t = text.trim();
  if (!toUserId) return { ok: false, reason: 'Pick a player' };
  if (whispersLeft <= 0) return { ok: false, reason: 'No whispers left this round' };
  if (!t) return { ok: false, reason: 'Write a short message' };
  if (t.length > MURDER_WHISPER_MAX) return { ok: false, reason: `At most ${MURDER_WHISPER_MAX} characters` };
  return { ok: true, reason: '' };
}

/** The whispers exchanged with one player (sent or received), oldest first. */
export function whisperThread(whispers: MurderWhisper[], myUserId: string, otherUserId: string | null): MurderWhisper[] {
  if (!otherUserId) return [];
  return whispers
    .filter((w) => (w.fromUserId === myUserId && w.toUserId === otherUserId) || (w.fromUserId === otherUserId && w.toUserId === myUserId))
    .sort((a, b) => a.at - b.at);
}

/** Who whispered to me / I whispered to, with the count, newest conversation first. */
export function whisperPartners(whispers: MurderWhisper[], myUserId: string): Array<{ userId: string; count: number; last: number }> {
  const map = new Map<string, { userId: string; count: number; last: number }>();
  for (const w of whispers) {
    if (w.fromUserId !== myUserId && w.toUserId !== myUserId) continue;
    const other = w.fromUserId === myUserId ? w.toUserId : w.fromUserId;
    const cur = map.get(other) ?? { userId: other, count: 0, last: 0 };
    cur.count += 1;
    cur.last = Math.max(cur.last, w.at);
    map.set(other, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.last - a.last);
}

export function accuseCheck(characterId: string | null, motive: string, myCharacterId: string | null): { ok: boolean; reason: string } {
  if (!characterId) return { ok: false, reason: 'Pick a character' };
  if (characterId === myCharacterId) return { ok: false, reason: 'You cannot accuse your own character' };
  if (motive.trim().length > MURDER_MOTIVE_MAX) return { ok: false, reason: `At most ${MURDER_MOTIVE_MAX} characters` };
  return { ok: true, reason: '' };
}

/** Characters this player may accuse (everybody's character except their own), in roster order. */
export function accusableCharacters(view: Pick<MurderGameView, 'characters'>, myCharacterId: string | null | undefined): MurderPublicCharacter[] {
  return view.characters.filter((c) => c.id !== myCharacterId);
}

export function accusationProgress(view: Pick<MurderGameView, 'players' | 'accusedUserIds'>): { submitted: number; needed: number } {
  const present = activePlayers(view);
  return { submitted: present.filter((p) => view.accusedUserIds.includes(p.userId)).length, needed: present.length };
}

export function readyProgress(view: Pick<MurderGameView, 'players' | 'readyUserIds'>): { ready: number; needed: number } {
  const present = activePlayers(view).filter((p) => p.connected);
  return { ready: present.filter((p) => view.readyUserIds.includes(p.userId)).length, needed: present.length };
}

/** My private clues, newest round first. */
export function cluesByRound(clues: MurderPrivateClue[]): Array<{ round: number; clues: MurderPrivateClue[] }> {
  const map = new Map<number, MurderPrivateClue[]>();
  for (const c of clues) map.set(c.round, [...(map.get(c.round) ?? []), c]);
  return Array.from(map.entries()).sort((a, b) => b[0] - a[0]).map(([round, list]) => ({ round, clues: list }));
}

/** Evidence shared with everybody, grouped by round (oldest round first). */
export function evidenceByRound(evidence: MurderEvidence[]): Array<{ round: number; items: MurderEvidence[] }> {
  const map = new Map<number, MurderEvidence[]>();
  for (const e of evidence) map.set(e.round, [...(map.get(e.round) ?? []), e]);
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([round, items]) => ({ round, items }));
}

export function canShareClue(view: Pick<MurderGameView, 'phase' | 'me'>, clue: Pick<MurderPrivateClue, 'shared'>): boolean {
  return view.phase === 'CLUE_ROUND' && Boolean(view.me) && (view.me?.sharesLeft ?? 0) > 0 && !clue.shared;
}

export function sortRows(rows: MurderScoreRow[]): MurderScoreRow[] {
  return [...rows].sort((a, b) => b.total - a.total || a.rank - b.rank);
}

/** Podium: the three best rows (first, second, third) in display order second / first / third. */
export function podiumOrder(rows: MurderScoreRow[]): MurderScoreRow[] {
  const top = sortRows(rows).slice(0, 3);
  if (top.length < 3) return top;
  return [top[1], top[0], top[2]];
}

export function myRow(view: Pick<MurderGameView, 'result'>, myUserId: string): MurderScoreRow | null {
  return view.result?.rows.find((r) => r.userId === myUserId) ?? null;
}

/** Points breakdown line, e.g. "Correct 100 + Speed 25 + Clues 20". */
export function pointsBreakdown(r: Pick<MurderScoreRow, 'base' | 'speedBonus' | 'murdererBonus' | 'shareBonus' | 'total'>): string {
  const parts: string[] = [];
  if (r.base) parts.push(`Correct ${r.base}`);
  if (r.speedBonus) parts.push(`Speed ${r.speedBonus}`);
  if (r.murdererBonus) parts.push(`Got away ${r.murdererBonus}`);
  if (r.shareBonus) parts.push(`Clues ${r.shareBonus}`);
  return parts.length ? parts.join(' + ') : 'No points';
}

export function iWon(view: Pick<MurderGameView, 'result'>, myUserId: string): boolean {
  const r = view.result;
  if (!r || !r.winnerUserId) return false;
  return r.winnerUserId === myUserId;
}

/** Steps of the step-by-step reveal. */
export const REVEAL_STEPS = ['murderer', 'motive', 'method', 'secrets', 'accusations'] as const;
export type RevealStep = (typeof REVEAL_STEPS)[number];

export function revealStepIndex(step: RevealStep): number {
  return REVEAL_STEPS.indexOf(step);
}

/** Is `step` already visible when the reveal has reached `reached`? */
export function stepVisible(reached: number, step: RevealStep): boolean {
  return reached >= revealStepIndex(step);
}

/** Headline of the result for this player. */
export function resultHeadline(view: Pick<MurderGameView, 'result' | 'characters'>, myUserId: string, isSpectator: boolean): string {
  const r = view.result;
  if (!r) return 'The truth comes out';
  const who = characterName(view, r.murdererCharacterId);
  if (isSpectator) return `${who} did it`;
  const mine = r.rows.find((row) => row.userId === myUserId);
  if (!mine) return `${who} did it`;
  if (mine.isMurderer) return mine.murdererBonus > 0 ? 'You got away with it' : 'You were caught';
  return mine.correct ? `You solved it: ${who}` : `It was ${who}`;
}

export function podiumLabel(rank: number): string {
  return rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
}
