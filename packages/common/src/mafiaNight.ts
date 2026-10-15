/**
 * Mafia Night: a 5-10 player social deduction party game (VIP game: only a Watch+ / Creator host can create a room).
 * Secret roles (Mafia, Doctor, Detective, Villagers), a night where the mafia strike, a day of discussion and a vote.
 *
 * The server keeps the full state (`MafiaServerState`, every role and every night action inside `secret` / `night`) and sends
 * every recipient a redacted `MafiaGameView`. A client never receives `MafiaServerState`.
 */

export const MAFIA_MIN_PLAYERS = 5;
export const MAFIA_MAX_PLAYERS = 10;
/** The vote target that means "nobody": a vote to skip the elimination. */
export const MAFIA_SKIP_VOTE = 'skip';

export type MafiaPhase =
  | 'ROLE_REVEAL'
  | 'NIGHT'
  | 'DAWN'
  | 'DAY'
  | 'VOTE'
  | 'VOTE_RESULT'
  | 'FINISHED'
  | 'ABORTED';

export type MafiaRole = 'mafia' | 'doctor' | 'detective' | 'villager';
export type MafiaTeam = 'town' | 'mafia';
export type MafiaWinner = MafiaTeam | 'none';
/** The three secret night actions. A player may only send the one that belongs to their role. */
export type MafiaNightAction = 'kill' | 'save' | 'investigate';
/** Chat channels: the town square (DAY / VOTE), the mafia den (NIGHT, living mafia only) and the graveyard (dead players). */
export type MafiaChatChannel = 'town' | 'mafia' | 'dead';

/** Mafia win when the living mafia are at least as many as everybody else; the town wins when no mafia is left. */
export function mafiaTeamOf(role: MafiaRole): MafiaTeam {
  return role === 'mafia' ? 'mafia' : 'town';
}

/** How many of each role a table of `n` players gets. (4 players only exist in the testing mode: no doctor.) */
export function mafiaRoleCounts(n: number): { mafia: number; doctor: number; detective: number; villager: number } {
  const mafia = n >= 9 ? 3 : n >= 7 ? 2 : 1;
  const doctor = n >= 5 ? 1 : 0;
  const detective = 1;
  return { mafia, doctor, detective, villager: Math.max(0, n - mafia - doctor - detective) };
}

export interface MafiaPlayer {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  seat: number;
  /** currently has a live socket (a disconnected player keeps the seat for the grace period) */
  connected: boolean;
  /** left for good (explicit leave or the reconnect window ran out); a player who left counts as dead */
  left: boolean;
  alive: boolean;
  /** PUBLIC role: null while the player is alive (until game over); set when they die, are eliminated or leave */
  role: MafiaRole | null;
}

/** One line of the public timeline (the recap). Only public events: deaths, eliminations, leavers. */
export interface MafiaLogEntry {
  /** night number the event belongs to */
  round: number;
  kind: 'night_death' | 'night_peace' | 'elimination' | 'no_elimination' | 'left';
  userId: string | null;
  /** role revealed with the event (death, elimination, leaving) */
  role: MafiaRole | null;
  text: string;
}

export type MafiaVoteOutcome = 'eliminated' | 'skip' | 'tie' | 'no_majority';

/** Public record of a finished vote. Only created once the vote is over, so individual votes become public here. */
export interface MafiaVoteResult {
  round: number;
  /** voter -> target user id or `skip` */
  votes: Record<string, string>;
  /** target (user id or `skip`) -> number of votes */
  tally: Record<string, number>;
  /** votes needed to eliminate somebody (more than half of the living players) */
  needed: number;
  outcome: MafiaVoteOutcome;
  eliminatedUserId: string | null;
  eliminatedRole: MafiaRole | null;
  text: string;
}

/** What the detective has learned (only ever sent to the detective). */
export interface MafiaInvestigation {
  round: number;
  targetUserId: string;
  isMafia: boolean;
}

/** What a recipient is allowed to know about themselves. Never sent for a spectator. */
export interface MafiaMe {
  role: MafiaRole;
  alive: boolean;
  /** mafia only (and only while they live): the other living mafia */
  teammates: string[];
  /** the action this role may take tonight (null for villagers and for the dead) */
  nightAction: MafiaNightAction | null;
  /** my own night pick (mafia: my latest choice) */
  nightChoice: string | null;
  /** mafia only: the current choice of each living mafia, to agree on a victim */
  teamChoices: Record<string, string>;
  /** doctor only: the player saved last night (cannot be saved twice in a row) */
  lastSavedUserId: string | null;
  /** detective only: every answer so far (the newest arrives at dawn) */
  investigations: MafiaInvestigation[];
}

export interface MafiaGameView {
  game: 'mafia-night';
  phase: MafiaPhase;
  /** night number (1 = the first night) */
  round: number;
  players: MafiaPlayer[];
  /** epoch ms at which the current phase ends; null when nothing is timed */
  phaseEndsAt: number | null;
  phaseDurationMs: number;
  /** server clock when this view was built (lets the client correct its own clock) */
  serverNow: number;
  me: MafiaMe | null;
  /** DAY: players who pressed "ready to vote" */
  readyToVote: string[];
  /** VOTE: who has voted (not for whom) */
  votedUserIds: string[];
  /** the recipient's own vote (a user id or `skip`) */
  myVote: string | null;
  /** DAWN: who died in the night (null = nobody died). Says nothing about a save. */
  dawnDeathUserId: string | null;
  /** VOTE_RESULT: the vote that just ended (everyone's votes are public now) */
  voteResult: MafiaVoteResult | null;
  /** every finished vote */
  voteHistory: MafiaVoteResult[];
  /** the public timeline of the game */
  log: MafiaLogEntry[];
  winner: MafiaWinner | null;
  statusMessage: string;
}

/** Server-only state: includes the secrets. Never serialise this to a client. */
export interface MafiaServerState extends Omit<MafiaGameView, 'me' | 'myVote' | 'serverNow' | 'votedUserIds' | 'dawnDeathUserId' | 'voteResult'> {
  /** every player's real role; `players[].role` only carries the public (revealed) one */
  secret: { roles: Record<string, MafiaRole> };
  /** this night's secret actions */
  night: {
    /** living mafia member -> chosen victim (the latest choice of each one counts; `seq` orders the choices) */
    kill: Record<string, { target: string; seq: number }>;
    seq: number;
    save: string | null;
    check: string | null;
    /** the player the doctor saved on the previous night */
    lastSaved: string | null;
  };
  /** detective id -> answers received so far */
  investigations: Record<string, MafiaInvestigation[]>;
  /** voter -> target user id or `skip`; hidden until the vote ends */
  votes: Record<string, string>;
  lastDawnDeath: string | null;
  lastVote: MafiaVoteResult | null;
}
