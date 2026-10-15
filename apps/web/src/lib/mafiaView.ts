// Pure helpers for the Mafia Night UI (no React, no browser APIs) so they can be unit tested.
import { tierAtLeast, MAFIA_MIN_PLAYERS, MAFIA_MAX_PLAYERS, MAFIA_SKIP_VOTE } from '@synccinema/common';
import type { MafiaGameView, MafiaPhase, MafiaPlayer, MafiaRole, MafiaChatChannel, MafiaLogEntry } from '@synccinema/common';

/** Only a VIP (Watch+) or Creator host can create a Mafia Night room. Guests of any pass can join. */
export function canHostMafia(tier: unknown): boolean {
  return tierAtLeast(tier, 'plus');
}

export interface StartCheck { ok: boolean; reason: string }

/** Lobby: can the host press "Start" now? `connected` counts the players with a live connection. */
export function startCheck(isHost: boolean, connected: number, minPlayers: number = MAFIA_MIN_PLAYERS): StartCheck {
  if (!isHost) return { ok: false, reason: 'Waiting for the host to start' };
  if (connected < minPlayers) {
    const need = minPlayers - connected;
    return { ok: false, reason: `Need ${need} more ${need === 1 ? 'player' : 'players'} (${minPlayers} to ${MAFIA_MAX_PLAYERS} can play)` };
  }
  return { ok: true, reason: 'Ready to start' };
}

const PHASE_TITLES: Record<MafiaPhase, string> = {
  ROLE_REVEAL: 'Your role',
  NIGHT: 'Night',
  DAWN: 'Dawn',
  DAY: 'Discussion',
  VOTE: 'Vote',
  VOTE_RESULT: 'Vote result',
  FINISHED: 'Game over',
  ABORTED: 'Game ended'
};
export function phaseTitle(phase: MafiaPhase | string | undefined): string {
  return (phase && PHASE_TITLES[phase as MafiaPhase]) || 'Mafia Night';
}

export const ROLE_LABELS: Record<MafiaRole, string> = { mafia: 'Mafia', doctor: 'Doctor', detective: 'Detective', villager: 'Villager' };
export function roleLabel(role: MafiaRole | null | undefined): string {
  return role ? ROLE_LABELS[role] : 'Unknown';
}

/** Muted solid role colours (text on a solid background, contrast >= 4.5:1): Mafia red-700, Town emerald-700, Doctor blue-700, Detective amber-700 (white text). */
export function roleBadgeClass(role: MafiaRole | null | undefined): string {
  switch (role) {
    case 'mafia': return 'bg-red-700 text-white';
    case 'doctor': return 'bg-blue-700 text-white';
    case 'detective': return 'bg-amber-700 text-white';
    case 'villager': return 'bg-emerald-700 text-white';
    default: return 'bg-zinc-200 text-zinc-800 dark:bg-[#22232c] dark:text-zinc-200';
  }
}

export function playerName(players: Pick<MafiaPlayer, 'userId' | 'displayName'>[], userId: string | null | undefined): string {
  if (!userId) return '';
  if (userId === MAFIA_SKIP_VOTE) return 'Skip';
  return players.find((p) => p.userId === userId)?.displayName || 'Player';
}

/** Players still in the game, in seat order. */
export function livingPlayers(view: Pick<MafiaGameView, 'players'>): MafiaPlayer[] {
  return view.players.filter((p) => p.alive && !p.left).sort((a, b) => a.seat - b.seat);
}

export function deadPlayers(view: Pick<MafiaGameView, 'players'>): MafiaPlayer[] {
  return view.players.filter((p) => !p.alive || p.left).sort((a, b) => a.seat - b.seat);
}

/** Who this player may pick tonight, by role (the server decides; this only draws the right buttons). */
export function nightTargets(view: Pick<MafiaGameView, 'players' | 'me'>, myUserId: string): MafiaPlayer[] {
  const me = view.me;
  if (!me || !me.alive || !me.nightAction) return [];
  const living = livingPlayers(view);
  if (me.nightAction === 'kill') return living.filter((p) => p.userId !== myUserId && !me.teammates.includes(p.userId));
  if (me.nightAction === 'save') return living.filter((p) => p.userId !== me.lastSavedUserId);
  return living.filter((p) => p.userId !== myUserId);
}

export function nightPrompt(action: 'kill' | 'save' | 'investigate' | null | undefined): string {
  if (action === 'kill') return 'Choose who the mafia attack tonight';
  if (action === 'save') return 'Choose who to protect tonight';
  if (action === 'investigate') return 'Choose who to investigate tonight';
  return 'The town sleeps. Stay quiet until dawn.';
}

/** Doctor and detective pick once; the mafia may change their pick until the night ends. */
export function nightPickLocked(view: Pick<MafiaGameView, 'me'>): boolean {
  const me = view.me;
  return Boolean(me && me.nightAction && me.nightAction !== 'kill' && me.nightChoice);
}

export function voteTargets(view: Pick<MafiaGameView, 'players'>, myUserId: string): MafiaPlayer[] {
  return livingPlayers(view).filter((p) => p.userId !== myUserId);
}

export function canVote(view: Pick<MafiaGameView, 'phase' | 'myVote' | 'me'>): boolean {
  return view.phase === 'VOTE' && !view.myVote && Boolean(view.me?.alive);
}

export function voteProgress(view: Pick<MafiaGameView, 'players' | 'votedUserIds'>): { voted: number; needed: number } {
  const present = livingPlayers(view).filter((p) => p.connected);
  return { voted: present.filter((p) => view.votedUserIds.includes(p.userId)).length, needed: present.length };
}

/** Votes needed to eliminate somebody (more than half of the living players). */
export function votesNeeded(livingCount: number): number {
  return Math.floor(livingCount / 2) + 1;
}

export interface ChatTab { id: MafiaChatChannel; label: string; writable: boolean }

/**
 * The chat tabs a recipient gets. Town (always, writable in DAY / VOTE for the living), Mafia (living mafia; writable at night) and
 * Graveyard (the dead). Spectators get the town tab, read only. The server enforces all of it; this only draws it.
 */
export function chatTabs(view: Pick<MafiaGameView, 'phase' | 'me'>, isSpectator: boolean): ChatTab[] {
  const over = view.phase === 'FINISHED' || view.phase === 'ABORTED';
  const me = view.me;
  const tabs: ChatTab[] = [];
  const townOpen = !isSpectator && Boolean(me) && (over || (Boolean(me?.alive) && (view.phase === 'DAY' || view.phase === 'VOTE')));
  tabs.push({ id: 'town', label: 'Town', writable: townOpen });
  if (!isSpectator && me && me.role === 'mafia' && me.alive && !over) tabs.push({ id: 'mafia', label: 'Mafia', writable: view.phase === 'NIGHT' });
  if (!isSpectator && me && !me.alive && !over) tabs.push({ id: 'dead', label: 'Graveyard', writable: true });
  return tabs;
}

/** The tab to show first / after a change: the one that is writable now, else town. */
export function defaultChatTab(tabs: ChatTab[]): MafiaChatChannel {
  return (tabs.find((t) => t.writable && t.id !== 'town') ?? tabs.find((t) => t.writable) ?? tabs[0]).id;
}

export function channelMessages<T extends { channel?: MafiaChatChannel }>(messages: T[], channel: MafiaChatChannel): T[] {
  return messages.filter((m) => (m.channel ?? 'town') === channel);
}

/** Why chat is closed right now, for the placeholder of a locked input. */
export function chatLockedReason(view: Pick<MafiaGameView, 'phase' | 'me'>, tab: ChatTab, isSpectator: boolean): string {
  if (isSpectator) return 'Spectators can only watch';
  if (tab.writable) return '';
  if (tab.id === 'mafia') return 'The den is open at night';
  if (view.phase === 'NIGHT') return 'The town is asleep. Chat opens at dawn.';
  return 'Chat opens during the day';
}

/** The mic is muted and the video hidden during the night by default (a notice explains it; the player can still switch them on). */
export function nightQuiet(phase: MafiaPhase | string | undefined): boolean {
  return phase === 'NIGHT';
}

export function mafiaErrorText(code: string | undefined, message?: string): string {
  switch (code) {
    case 'WRONG_PHASE': return 'That is not possible right now.';
    case 'ALREADY_VOTED': return 'Your choice is final.';
    case 'RATE_LIMITED': return 'Slow down a little.';
    case 'HOST_ONLY': return 'Only the host can start the game.';
    case 'CHAT_LOCKED': return message || 'Chat is closed right now.';
    case 'UPGRADE_REQUIRED': return 'Hosting Mafia Night needs Watch+ (VIP Pass). You can still join a friend\'s game.';
    default: return message || 'That did not work. Try again.';
  }
}

/** Public timeline grouped per night, for the recap. */
export function timelineByRound(log: MafiaLogEntry[]): Array<{ round: number; entries: MafiaLogEntry[] }> {
  const rounds = new Map<number, MafiaLogEntry[]>();
  for (const l of log) rounds.set(l.round, [...(rounds.get(l.round) ?? []), l]);
  return Array.from(rounds.entries()).sort((a, b) => a[0] - b[0]).map(([round, entries]) => ({ round, entries }));
}

export function winnerHeadline(view: Pick<MafiaGameView, 'winner' | 'me'>, isSpectator = false): string {
  if (view.winner === 'none' || !view.winner) return 'Game ended';
  if (isSpectator || !view.me) return view.winner === 'town' ? 'The town wins' : 'The mafia win';
  const mine = view.me.role === 'mafia' ? 'mafia' : 'town';
  return mine === view.winner ? (view.winner === 'town' ? 'The town wins. You won' : 'The mafia win. You won') : (view.winner === 'town' ? 'The town wins. You lost' : 'The mafia win. You lost');
}

export function iWon(view: Pick<MafiaGameView, 'winner' | 'me'>): boolean {
  if (!view.me || (view.winner !== 'town' && view.winner !== 'mafia')) return false;
  return (view.me.role === 'mafia' ? 'mafia' : 'town') === view.winner;
}
