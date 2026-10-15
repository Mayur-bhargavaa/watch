// Pure helpers for the Tournament Arena UI (no React, no browser APIs) so they can be unit tested.
import {
  TOURNAMENT_DOUBLE_NO_SHOW_HOST_SEC,
  TOURNAMENT_GAME_NAMES,
  TOURNAMENT_MATCH_GAMES,
  TOURNAMENT_MAX_PLAYERS,
  TOURNAMENT_STUCK_SEC,
  orderLobbyPlayers,
  tierAtLeast,
  tournamentThirdPlaceAvailable
} from '@synccinema/common';
import type {
  TournamentGameView,
  TournamentMatch,
  TournamentMatchGame,
  TournamentPhase,
  TournamentStandingRow,
  TournamentStandings
} from '@synccinema/common';

/** Only a Creator Pass host can create a Tournament Arena room. Guests of any pass can join, play and watch. */
export function canHostTournament(tier: unknown): boolean {
  return tierAtLeast(tier, 'creator');
}

export const MATCH_GAMES: readonly { id: TournamentMatchGame; name: string }[] = TOURNAMENT_MATCH_GAMES.map((id) => ({ id, name: TOURNAMENT_GAME_NAMES[id] }));

export function gameName(game: string | undefined | null): string {
  return (game && (TOURNAMENT_GAME_NAMES as Record<string, string>)[game]) || 'the game';
}

export interface StartCheck { ok: boolean; reason: string }

/** Lobby: can the organiser press "Start" now? `connectedPlayers` counts the players (not the organiser) with a live connection. */
export function startCheck(isHost: boolean, seatedPlayers: number, connectedPlayers: number, minPlayers: number): StartCheck {
  if (!isHost) return { ok: false, reason: 'Waiting for the organiser to start' };
  if (seatedPlayers < minPlayers) {
    const missing = minPlayers - seatedPlayers;
    return { ok: false, reason: `Waiting for ${missing} more ${missing === 1 ? 'player' : 'players'} (at least ${minPlayers} to start, up to ${TOURNAMENT_MAX_PLAYERS})` };
  }
  if (connectedPlayers < seatedPlayers) {
    const away = seatedPlayers - connectedPlayers;
    return { ok: false, reason: `${away} ${away === 1 ? 'player is' : 'players are'} not connected: wait or remove them first` };
  }
  return { ok: true, reason: `Ready: ${seatedPlayers} ${seatedPlayers === 1 ? 'player' : 'players'}` };
}

export interface LobbyPlayer {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  seat: number;
  isConnected?: boolean;
  status?: string;
  /** seed the player gets if the tournament starts now */
  seed: number;
}

/** The seated players (not the organiser, not people who left) in seed order, each with the seed they would get now. Same rule as the server. */
export function lobbyPlayers(
  players: ReadonlyArray<{ userId: string; displayName: string; avatarUrl?: string | null; seat: number; isConnected?: boolean; status?: string }>,
  hostUserId: string,
  seedOrder: readonly string[] | undefined
): LobbyPlayer[] {
  const seated = players.filter((p) => p.userId !== hostUserId && p.status !== 'LEFT');
  return orderLobbyPlayers(seated, seedOrder ?? []).map((p, i) => ({ ...p, seed: i + 1 }));
}

/** How many rounds the lobby bracket would have and how many byes (a preview line in the lobby). */
export function bracketPreview(playerCount: number): { rounds: number; byes: number; size: number } {
  if (playerCount < 2) return { rounds: 0, byes: 0, size: 0 };
  let size = 2;
  while (size < playerCount) size *= 2;
  return { rounds: Math.round(Math.log2(size)), byes: size - playerCount, size };
}

export function thirdPlaceAllowed(playerCount: number): boolean {
  return tournamentThirdPlaceAvailable(playerCount);
}

// ---------------------------------------------------------------------------- clock

/** Server time minus client time when the view was built; add it to Date.now() for the server clock. */
export function clockOffsetMs(serverNow: number | undefined, clientNow: number): number {
  return typeof serverNow === 'number' && Number.isFinite(serverNow) ? serverNow - clientNow : 0;
}

/** Whole seconds until `deadline` (epoch ms, server clock). Never negative. */
export function secondsUntil(deadline: number | null | undefined, offsetMs: number, clientNow: number): number {
  if (typeof deadline !== 'number') return 0;
  return Math.max(0, Math.ceil((deadline - (clientNow + offsetMs)) / 1000));
}

/** 125 -> "2:05". */
export function clockText(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------- bracket

export interface RoundColumn { round: number; name: string; matches: TournamentMatch[] }

/** The main bracket as columns (round 1 first). The third place match is not a column: see thirdPlaceMatch. */
export function roundColumns(view: Pick<TournamentGameView, 'matches' | 'rounds'>): RoundColumn[] {
  const cols: RoundColumn[] = [];
  for (let r = 1; r <= view.rounds; r++) {
    const matches = view.matches.filter((m) => m.kind === 'MAIN' && m.round === r).sort((a, b) => a.index - b.index);
    if (matches.length) cols.push({ round: r, name: matches[0].roundName, matches });
  }
  return cols;
}

export function thirdPlaceMatch(view: Pick<TournamentGameView, 'matches'>): TournamentMatch | null {
  return view.matches.find((m) => m.kind === 'THIRD') ?? null;
}

export function playerName(view: Pick<TournamentGameView, 'players' | 'host'>, userId: string | null | undefined): string {
  if (!userId) return '';
  if (userId === view.host.userId) return view.host.displayName;
  return view.players.find((p) => p.userId === userId)?.displayName || 'Player';
}

export function seedOf(view: Pick<TournamentGameView, 'players'>, userId: string | null | undefined): number | null {
  return view.players.find((p) => p.userId === userId)?.seed ?? null;
}

/** "Semi-final 2", "Round of 16 #3", "the Final": how a feeder match is named in an empty slot. */
export function matchTitle(view: Pick<TournamentGameView, 'matches'>, matchId: string): string {
  const m = view.matches.find((x) => x.id === matchId);
  if (!m) return 'an earlier match';
  if (m.kind === 'THIRD') return 'the third place match';
  if (m.roundName === 'Final') return 'the Final';
  const same = view.matches.filter((x) => x.kind === 'MAIN' && x.round === m.round).length;
  if (m.roundName.endsWith('-finals')) return same === 1 ? m.roundName.replace(/s$/, '') : `${m.roundName.replace(/s$/, '')} ${m.index + 1}`;
  return `${m.roundName} #${m.index + 1}`;
}

export interface SlotLabel { text: string; known: boolean }

/** What a match card shows in a slot: the player, or where the player will come from. */
export function slotLabel(view: Pick<TournamentGameView, 'matches' | 'players' | 'host'>, m: TournamentMatch, slot: 'a' | 'b'): SlotLabel {
  const id = slot === 'a' ? m.a : m.b;
  if (id) return { text: playerName(view, id), known: true };
  const src = slot === 'a' ? m.srcA : m.srcB;
  if (src.kind === 'bye') return { text: 'Bye', known: false };
  if (src.kind === 'seed') return { text: `Seed ${src.seed}`, known: false };
  return { text: `${src.kind === 'winner' ? 'Winner' : 'Loser'} of ${matchTitle(view, src.matchId)}`, known: false };
}

export function isMyMatch(m: Pick<TournamentMatch, 'a' | 'b'>, userId: string | null | undefined): boolean {
  return Boolean(userId && (m.a === userId || m.b === userId));
}

export type MatchTone = 'idle' | 'ready' | 'live' | 'done' | 'warn';

export interface MatchChip { label: string; tone: MatchTone }

/** The small status chip of a match card. */
export function matchChip(m: TournamentMatch): MatchChip {
  if (m.status === 'DONE') {
    if (m.bye) return { label: 'Bye', tone: 'done' };
    return { label: 'Final result', tone: 'done' };
  }
  if (m.status === 'LIVE') return { label: 'Live', tone: 'live' };
  if (m.status === 'PENDING_PLAYERS') {
    if (m.doubleNoShowAt !== null) return { label: 'Nobody showed up', tone: 'warn' };
    return { label: m.roomId ? 'Waiting for players' : 'Starting', tone: 'ready' };
  }
  return { label: 'Not ready', tone: 'idle' };
}

/** "2-1" style score of a match (games won), or null for a bye / a match nobody has played. */
export function matchScore(m: Pick<TournamentMatch, 'winsA' | 'winsB' | 'bye' | 'status'>): { a: number; b: number } | null {
  if (m.bye) return null;
  if (m.winsA === 0 && m.winsB === 0 && m.status !== 'DONE') return null;
  return { a: m.winsA, b: m.winsB };
}

const REASON_TEXT: Record<string, string> = {
  played: '',
  bye: 'Bye',
  no_show: 'Opponent did not show up',
  double_no_show: 'Higher seed (nobody showed up)',
  forfeit: 'Opponent left',
  host_advance: 'Advanced by the organiser',
  draw_tiebreak: 'Higher seed after drawn games'
};
export function reasonText(reason: string | null | undefined): string {
  return (reason && REASON_TEXT[reason]) || '';
}

/** Matches being played or waiting for their players (rooms that exist). */
export function liveMatches(view: Pick<TournamentGameView, 'matches'>): TournamentMatch[] {
  return view.matches
    .filter((m) => (m.status === 'LIVE' || m.status === 'PENDING_PLAYERS') && m.roomCode)
    .sort((a, b) => (a.status === b.status ? a.round - b.round || a.index - b.index : a.status === 'LIVE' ? -1 : 1));
}

export function myActiveMatch(view: Pick<TournamentGameView, 'matches' | 'me'>): TournamentMatch | null {
  const id = view.me?.activeMatchId;
  return id ? view.matches.find((m) => m.id === id) ?? null : null;
}

/** Why the organiser may or may not advance a player of this match right now (the server decides, this only draws the button). */
export function advanceState(m: TournamentMatch, serverNowMs: number): { allowed: boolean; reason: string } {
  if (m.status === 'DONE') return { allowed: false, reason: 'Already decided' };
  if (m.status === 'SCHEDULED' || !m.a || !m.b) return { allowed: false, reason: 'No players yet' };
  if (m.doubleNoShowAt !== null) {
    const left = Math.max(0, Math.ceil((m.doubleNoShowAt + TOURNAMENT_DOUBLE_NO_SHOW_HOST_SEC * 1000 - serverNowMs) / 1000));
    return { allowed: true, reason: `Nobody showed up: pick who advances (the higher seed advances in ${left}s)` };
  }
  if (m.createdAt !== null && serverNowMs - m.createdAt >= TOURNAMENT_STUCK_SEC * 1000) return { allowed: true, reason: 'This match is stuck' };
  const wait = m.createdAt === null ? TOURNAMENT_STUCK_SEC : Math.max(0, Math.ceil((m.createdAt + TOURNAMENT_STUCK_SEC * 1000 - serverNowMs) / 1000));
  return { allowed: false, reason: `Only possible when a match is stuck (in ${clockText(wait)})` };
}

// ---------------------------------------------------------------------------- phases and results

const PHASE_TITLES: Record<TournamentPhase, string> = {
  REGISTRATION: 'Registration',
  RUNNING: 'Bracket',
  COMPLETE: 'Final results',
  ABORTED: 'Tournament ended'
};
export function phaseTitle(phase: TournamentPhase | string | undefined): string {
  return (phase && PHASE_TITLES[phase as TournamentPhase]) || 'Tournament Arena';
}

/** Top bar label: the phase and how far the bracket is. */
export function progressLabel(view: Pick<TournamentGameView, 'phase' | 'matches' | 'rounds'>): string {
  if (view.phase !== 'RUNNING') return phaseTitle(view.phase);
  const main = view.matches.filter((m) => m.kind === 'MAIN');
  const open = main.filter((m) => m.status !== 'DONE');
  if (!open.length) return 'Bracket';
  const round = Math.min(...open.map((m) => m.round));
  const name = open.find((m) => m.round === round)?.roundName ?? 'Bracket';
  return `${name} · ${main.filter((m) => m.status === 'DONE').length}/${main.length} matches done`;
}

/** First three of the standings for the podium, ordered for display: 2nd, 1st, 3rd. */
export function podium(standings: TournamentStandings | null | undefined): TournamentStandingRow[] {
  if (!standings) return [];
  const byRank = (rank: number) => standings.rows.find((r) => r.rank === rank);
  return [byRank(2), byRank(1), byRank(3)].filter(Boolean) as TournamentStandingRow[];
}

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/** Link of a match room: the existing game page with the room code, or its spectator form. */
export function matchRoomPath(basePath: string, roomCode: string, spectate = false): string {
  return `${basePath}?room=${encodeURIComponent(roomCode)}${spectate ? '&spectate=1' : ''}`;
}

export function tournamentErrorText(code: string | undefined, message?: string): string {
  switch (code) {
    case 'WRONG_PHASE': return 'That is not possible right now.';
    case 'RATE_LIMITED': return 'Slow down a little.';
    case 'HOST_ONLY': return 'Only the organiser can do that.';
    case 'NOT_PLAYER': return 'Only players can do that.';
    case 'ILLEGAL_MOVE': return message || 'That is not possible right now.';
    case 'INVALID_INPUT': return message || 'That did not work.';
    case 'UPGRADE_REQUIRED': return 'Hosting Tournament Arena needs the Creator Pass. You can still join a friend\'s tournament.';
    default: return message || 'That did not work. Try again.';
  }
}
