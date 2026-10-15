/**
 * Tournament Arena: a single-elimination bracket of 1v1 matches played in the platform's existing two-player games
 * (CREATOR game: only a Creator Pass host can create the room). The HOST is the organiser and does not play.
 * 4 to 32 PLAYERS (2 in the testing mode, see TOURNAMENT_TEST_MIN_PLAYERS).
 *
 * Every match is played in a REAL game room of the chosen game, created by the server with exactly the two players pre-seated.
 * The result of a match comes ONLY from the server game state of that room: neither the host nor a player can submit a winner.
 *
 * Nothing in a tournament is secret, so the view is the state minus its internal bookkeeping (`TournamentServerState.internal`).
 */

export const TOURNAMENT_MIN_PLAYERS = 4;
export const TOURNAMENT_MAX_PLAYERS = 32;
/** Room size: the host plus the players. */
export const TOURNAMENT_MAX_ROOM = TOURNAMENT_MAX_PLAYERS + 1;
/** The two-player games a match can be played in. */
export const TOURNAMENT_MATCH_GAMES = ['tic-tac-toe', 'four-in-a-row', 'chess'] as const;
export type TournamentMatchGame = (typeof TOURNAMENT_MATCH_GAMES)[number];
export const TOURNAMENT_DEFAULT_GAME: TournamentMatchGame = 'tic-tac-toe';
export const TOURNAMENT_GAME_NAMES: Record<TournamentMatchGame, string> = {
  'tic-tac-toe': 'Tic Tac Toe',
  'four-in-a-row': 'Four in a Row',
  chess: 'Chess'
};
/** Each game room of a match: both players have this long to open it, or the one who stayed away forfeits. */
export const TOURNAMENT_JOIN_WINDOW_SEC = 120;
/** A match without a result for this long is "stuck": the host may advance a player. */
export const TOURNAMENT_STUCK_SEC = 600;
/** Nobody opened the match room: the host may pick who advances for this long, then the higher seed advances. */
export const TOURNAMENT_DOUBLE_NO_SHOW_HOST_SEC = 60;
/** A drawn game is replayed in a new room, at most this many extra times; after that the higher seed advances. */
export const TOURNAMENT_MAX_EXTRA_GAMES = 2;
export const TOURNAMENT_LOG_MAX = 120;

export type TournamentPhase = 'REGISTRATION' | 'RUNNING' | 'COMPLETE' | 'ABORTED';
/** SCHEDULED: a participant is not known yet. PENDING_PLAYERS: both known, waiting for the room / the players. LIVE: the game runs. DONE: has a result. */
export type TournamentMatchStatus = 'SCHEDULED' | 'PENDING_PLAYERS' | 'LIVE' | 'DONE';
export type TournamentMatchKind = 'MAIN' | 'THIRD';
export type TournamentResultReason = 'played' | 'bye' | 'no_show' | 'double_no_show' | 'forfeit' | 'host_advance' | 'draw_tiebreak';
export type TournamentFinalBestOf = 1 | 3;
export type TournamentLogKind = 'system' | 'result' | 'forfeit' | 'host';

export interface TournamentConfig {
  game: TournamentMatchGame;
  /** play a match for third place between the two losing semi-finalists (needs at least 4 players) */
  thirdPlace: boolean;
  /** the Final only: best of 1 (default) or best of 3 */
  finalBestOf: TournamentFinalBestOf;
}

export interface TournamentHost {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  connected: boolean;
  left: boolean;
}

export interface TournamentPlayer {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  /** room seat (join order) */
  seat: number;
  /** 1 = top seed */
  seed: number;
  /** connected to the TOURNAMENT room (a player who is in a match room is "away" here, which is fine) */
  connected: boolean;
  /** left the tournament for good: every remaining match is forfeited */
  left: boolean;
  /** lost a bracket match */
  eliminated: boolean;
}

export type TournamentSource =
  | { kind: 'seed'; seed: number }
  | { kind: 'winner'; matchId: string }
  | { kind: 'loser'; matchId: string }
  | { kind: 'bye' };

export interface TournamentGameRecord {
  gameNo: number;
  roomCode: string;
  /** null = drawn (or abandoned by both) */
  winnerUserId: string | null;
}

export interface TournamentMatch {
  id: string;
  kind: TournamentMatchKind;
  /** 1-based round of the bracket (the third place match has the round of the Final) */
  round: number;
  /** 0-based position inside the round */
  index: number;
  roundName: string;
  a: string | null;
  b: string | null;
  seedA: number | null;
  seedB: number | null;
  srcA: TournamentSource;
  srcB: TournamentSource;
  status: TournamentMatchStatus;
  /** decided without a game: one seed had no opponent */
  bye: boolean;
  bestOf: TournamentFinalBestOf;
  winsA: number;
  winsB: number;
  draws: number;
  winnerUserId: string | null;
  loserUserId: string | null;
  reason: TournamentResultReason | null;
  /** games started so far in this match (the current / last one is `gameNo`) */
  gameNo: number;
  /** the CURRENT game room of this match */
  roomId: string | null;
  roomCode: string | null;
  /** who opened the current game room */
  joined: string[];
  /** when the current game room was created */
  createdAt: number | null;
  joinDeadline: number | null;
  liveAt: number | null;
  doneAt: number | null;
  /** nobody opened the room: the host decision window started at this time */
  doubleNoShowAt: number | null;
  games: TournamentGameRecord[];
}

export interface TournamentLogEntry {
  id: number;
  at: number;
  kind: TournamentLogKind;
  text: string;
  matchId?: string;
}

export interface TournamentStandingRow {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  seed: number;
  /** "Champion", "Runner-up", "Third place", "Semi-finalist", "Eliminated in Quarter-finals"... */
  label: string;
  matchWins: number;
  matchLosses: number;
  left: boolean;
}

export interface TournamentStandings {
  championUserId: string | null;
  runnerUpUserId: string | null;
  thirdPlaceUserId: string | null;
  rows: TournamentStandingRow[];
}

export interface TournamentMe {
  role: 'host' | 'player' | 'spectator';
  seed: number | null;
  eliminated: boolean;
  left: boolean;
  /** my match that is waiting for me or running right now */
  activeMatchId: string | null;
  /** my next match that is not ready yet (the opponent is not known) */
  upcomingMatchId: string | null;
  /** final rank once the tournament is over */
  rank: number | null;
}

export interface TournamentGameView {
  game: 'tournament';
  phase: TournamentPhase;
  host: TournamentHost;
  config: TournamentConfig;
  /** registration: the seed order the host shuffled (user ids; may lag behind joins and leaves, see orderLobbyPlayers) */
  seedOrder: string[];
  players: TournamentPlayer[];
  matches: TournamentMatch[];
  /** rounds of the main bracket (0 before the start) */
  rounds: number;
  bracketSize: number;
  log: TournamentLogEntry[];
  standings: TournamentStandings | null;
  /** players needed to start (4, or fewer in the testing mode) */
  minPlayers: number;
  maxPlayers: number;
  startedAt: number | null;
  endedAt: number | null;
  /** server clock when this view was built (lets the client correct its own clock) */
  serverNow: number;
  me: TournamentMe | null;
  statusMessage: string;
}

/** Server-only state: includes the internal bookkeeping. Never serialise this to a client. */
export interface TournamentServerState extends Omit<TournamentGameView, 'standings' | 'serverNow' | 'me' | 'minPlayers' | 'maxPlayers'> {
  logSeq: number;
  championUserId: string | null;
  runnerUpUserId: string | null;
  thirdPlaceUserId: string | null;
  internal: {
    /** removed by the host before the start: cannot join again */
    kicked: string[];
    /** counter for the room codes asked for the match rooms (diagnostics) */
    roomSeq: number;
  };
}

/** Registration order of the players: the host's shuffled order first (only players still present), then everybody else by seat. Pure. */
export function orderLobbyPlayers<T extends { userId: string; seat: number }>(seats: readonly T[], seedOrder: readonly string[]): T[] {
  const bySeat = [...seats].sort((a, b) => a.seat - b.seat);
  const rank = new Map<string, number>();
  seedOrder.forEach((id, i) => { if (!rank.has(id)) rank.set(id, i); });
  const known = bySeat.filter((s) => rank.has(s.userId)).sort((a, b) => (rank.get(a.userId) as number) - (rank.get(b.userId) as number));
  const fresh = bySeat.filter((s) => !rank.has(s.userId));
  return [...known, ...fresh];
}

export function isTournamentMatchGame(value: unknown): value is TournamentMatchGame {
  return typeof value === 'string' && (TOURNAMENT_MATCH_GAMES as readonly string[]).includes(value);
}

/** True when a third place match makes sense (two real semi-finals need at least 4 players). */
export function tournamentThirdPlaceAvailable(playerCount: number): boolean {
  return playerCount >= 4;
}

/** "Round of 16", "Quarter-finals", "Semi-finals" or "Final" for round `round` (1-based) of a bracket with `rounds` rounds. */
export function tournamentRoundName(round: number, rounds: number): string {
  const fromEnd = rounds - round; // 0 = the Final
  if (fromEnd <= 0) return 'Final';
  if (fromEnd === 1) return 'Semi-finals';
  if (fromEnd === 2) return 'Quarter-finals';
  return `Round of ${2 ** (fromEnd + 1)}`;
}
