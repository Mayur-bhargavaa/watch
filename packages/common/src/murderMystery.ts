/**
 * Murder Mystery Night: a scripted whodunit for a group of 6-12 players (CREATOR game: only a Creator Pass host can create a room).
 * Every player is a suspect: the server deals one character of the case to each player (one of them is the murderer), delivers the
 * clue rounds (public clues to everybody, private clues to their owners), runs the discussion (public chat + private whispers) and
 * scores the final accusations.
 *
 * The server keeps the full state (`MurderServerState`: the case, who plays whom, every private clue, whisper and accusation) and
 * sends every recipient a redacted `MurderGameView`. A client never receives `MurderServerState`.
 */

export const MURDER_MIN_PLAYERS = 6;
export const MURDER_MAX_PLAYERS = 12;
/** Characters every case defines (a game with N players uses N of them). */
export const MURDER_CHARACTERS_PER_CASE = 12;
export const MURDER_CLUE_ROUNDS = 4;
/** Whispers a player may send per clue round. */
export const MURDER_WHISPERS_PER_ROUND = 5;
export const MURDER_WHISPER_MAX = 140;
export const MURDER_MOTIVE_MAX = 120;
/** "Reveal my clue to everyone" uses per game. */
export const MURDER_MAX_SHARES = 3;
/** The game aborts when fewer than this many players (still seated) remain. */
export const MURDER_MIN_ACTIVE = 4;
/** The case choice that means "pick one for us". */
export const MURDER_RANDOM_CASE = 'random';

/** Scoring table (shown in the UI). */
export const MURDER_SCORING = {
  /** a correct accusation */
  correct: 100,
  /** extra for being among the first `speedSlots` correct accusations */
  speedBonus: 25,
  speedSlots: 3,
  /** the murderer scores this when fewer than half of the OTHER players accused the right character */
  murdererSurvives: 150,
  /** per distinct private clue shared with everyone (at most MURDER_MAX_SHARES) */
  perSharedClue: 10
} as const;

/** Phase lengths in seconds (the reveal / clue round / accusation / result lengths of a real game). */
export const MURDER_PHASE_SECONDS = { reveal: 15, round: 90, accusation: 60, result: 120 } as const;

export type MurderPhase = 'LOBBY' | 'CHARACTER_REVEAL' | 'CLUE_ROUND' | 'ACCUSATION' | 'RESULT' | 'FINAL' | 'ABORTED';

// ---------------------------------------------------------------------
// Case catalogue (static content; lives on the server, only the redacted parts are ever sent)
// ---------------------------------------------------------------------

export interface MurderCharacterDef {
  id: string;
  name: string;
  /** one public line: who they are (shown to everybody) */
  bio: string;
  /** how they knew the victim (private card line; also public at RESULT) */
  relationship: string;
  /** their secret reason to want the victim gone (private until RESULT) */
  secretMotive: string;
  /** what they SAY they did: TRUE for innocents, PARTLY FALSE for the murderer (private until RESULT) */
  alibi: string;
  /** what really happened (revealed at RESULT; for innocents it confirms the alibi, for the murderer it exposes the lie) */
  alibiTruth: string;
  /** a personal secret that is NOT the murder (private until RESULT) */
  secret: string;
}

export interface MurderPrivateClueDef {
  id: string;
  /** the character who learns this clue (nobody if that character is not in the game) */
  ownerId: string;
  text: string;
}

export interface MurderPublicClueDef {
  id: string;
  text: string;
}

export interface MurderRoundDef {
  /** short title of the round, e.g. "The first look" */
  title: string;
  /** one or two clues shown to everybody when the round opens */
  publicClues: MurderPublicClueDef[];
  /** 2-3 clues across the cast, delivered to their owners only */
  privateClues: MurderPrivateClueDef[];
}

export interface MurderCaseDef {
  id: string;
  title: string;
  /** one line for the case picker */
  tagline: string;
  /** setting blurb (public) */
  blurb: string;
  victim: { name: string; bio: string; causeOfDeath: string };
  /** exactly MURDER_CHARACTERS_PER_CASE characters */
  characters: MurderCharacterDef[];
  /** characters that must be in the game so the case is solvable: includes the murderer; holders of the clues the solution needs */
  required: string[];
  solution: { murdererId: string; motive: string; method: string; summary: string };
  /** exactly MURDER_CLUE_ROUNDS rounds */
  rounds: MurderRoundDef[];
  /** the recap timeline shown at RESULT (what really happened, in order) */
  timeline: string[];
}

/** What the lobby shows for each case. */
export interface MurderCaseSummary {
  id: string;
  title: string;
  tagline: string;
  blurb: string;
  victimName: string;
}

/** The public part of the case once the game started. */
export interface MurderPublicCase {
  id: string;
  title: string;
  blurb: string;
  victim: { name: string; bio: string; causeOfDeath: string };
}

// ---------------------------------------------------------------------
// Public view
// ---------------------------------------------------------------------

export interface MurderPlayer {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  seat: number;
  connected: boolean;
  /** withdrawn: left the game for good */
  left: boolean;
  /** the character this player plays (null in the lobby) */
  characterId: string | null;
}

/** A character that is in the game: public information only. */
export interface MurderPublicCharacter {
  id: string;
  name: string;
  bio: string;
  /** the player who plays it */
  userId: string;
  /** its player left the party */
  withdrawn: boolean;
}

export interface MurderPublicClue {
  id: string;
  text: string;
}

export interface MurderPublicRound {
  round: number;
  title: string;
  clues: MurderPublicClue[];
}

/** A private clue its owner chose to show everybody. */
export interface MurderEvidence {
  clueId: string;
  round: number;
  text: string;
  sharedByUserId: string;
  characterId: string;
}

export interface MurderLogEntry {
  round: number;
  kind: 'start' | 'round' | 'evidence' | 'left' | 'accusation' | 'result';
  text: string;
}

/** The card of the recipient's own character. Never sent to anybody else. */
export interface MurderCard {
  characterId: string;
  name: string;
  bio: string;
  relationship: string;
  secretMotive: string;
  alibi: string;
  secret: string;
  isMurderer: boolean;
  /** murderer only: how it was really done */
  method: string | null;
  /** murderer only: the instruction to bluff */
  bluffNote: string | null;
}

export interface MurderPrivateClue {
  id: string;
  round: number;
  text: string;
  /** already shown to everybody */
  shared: boolean;
}

export interface MurderWhisper {
  id: string;
  round: number;
  fromUserId: string;
  toUserId: string;
  text: string;
  at: number;
}

export interface MurderAccusation {
  characterId: string;
  motive: string;
}

/** What a recipient may know about themselves. Never sent for a spectator or a player who left. */
export interface MurderMe {
  characterId: string;
  card: MurderCard;
  /** the private clues delivered so far */
  privateClues: MurderPrivateClue[];
  sharesLeft: number;
  /** whispers I sent or received (nobody else's) */
  whispers: MurderWhisper[];
  /** whispers I can still send this round */
  whispersLeft: number;
  ready: boolean;
  myAccusation: MurderAccusation | null;
}

/** One row of the final table (public once the result is out). */
export interface MurderScoreRow {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  characterId: string;
  left: boolean;
  isMurderer: boolean;
  /** null: did not accuse anybody */
  accusedCharacterId: string | null;
  accusedMotive: string;
  correct: boolean;
  /** 1 = first correct accusation, null when wrong / none */
  correctOrder: number | null;
  base: number;
  speedBonus: number;
  murdererBonus: number;
  /** distinct private clues this player shared (count) */
  sharedClues: number;
  shareBonus: number;
  total: number;
}

/** What the RESULT reveals about each character. */
export interface MurderResultCharacter {
  id: string;
  name: string;
  userId: string;
  relationship: string;
  secretMotive: string;
  alibi: string;
  alibiTruth: string;
  secret: string;
  isMurderer: boolean;
  withdrawn: boolean;
}

export interface MurderResult {
  murdererCharacterId: string;
  murdererUserId: string;
  motive: string;
  method: string;
  summary: string;
  timeline: string[];
  characters: MurderResultCharacter[];
  rows: MurderScoreRow[];
  /** number of players (not the murderer, still seated) who named the murderer */
  correctCount: number;
  /** other players the murderer needed fewer than half of */
  otherCount: number;
  murdererSurvived: boolean;
  winnerUserId: string | null;
}

export interface MurderGameView {
  game: 'murder-mystery';
  phase: MurderPhase;
  /** clue round (1..4); 0 before the first one */
  round: number;
  roundCount: number;
  /** LOBBY: the host's choice (a case id or `random`) */
  caseChoice: string;
  /** LOBBY only: the catalogue */
  cases: MurderCaseSummary[];
  /** the case being played (null in the lobby) */
  case: MurderPublicCase | null;
  players: MurderPlayer[];
  /** the characters in this game (null until dealt) */
  characters: MurderPublicCharacter[];
  /** public clues of the rounds opened so far */
  clues: MurderPublicRound[];
  /** private clues shared with everybody */
  evidence: MurderEvidence[];
  /** CLUE_ROUND: players who pressed ready */
  readyUserIds: string[];
  /** ACCUSATION: players who have submitted (not who they accused) */
  accusedUserIds: string[];
  phaseEndsAt: number | null;
  phaseDurationMs: number;
  /** server clock when this view was built (lets the client correct its own clock) */
  serverNow: number;
  me: MurderMe | null;
  /** RESULT / FINAL only */
  result: MurderResult | null;
  log: MurderLogEntry[];
  /** games played in this room before this one */
  gamesPlayed: number;
  statusMessage: string;
}

// ---------------------------------------------------------------------
// Server-only state
// ---------------------------------------------------------------------

/** Server-only state: includes the secrets. Never serialise this to a client. */
export interface MurderServerState {
  game: 'murder-mystery';
  phase: MurderPhase;
  round: number;
  roundCount: number;
  caseChoice: string;
  players: MurderPlayer[];
  phaseEndsAt: number | null;
  phaseDurationMs: number;
  /** public timeline */
  log: MurderLogEntry[];
  /** private clues shared with everybody */
  evidence: MurderEvidence[];
  readyUserIds: string[];
  gamesPlayed: number;
  statusMessage: string;
  secret: {
    /** the case being played (null in the lobby); the content is looked up in the server catalogue */
    caseId: string | null;
    /** user id -> character id */
    assignment: Record<string, string>;
    /** characters of the case that are not in this game (an "absent guest" in the clues) */
    absent: string[];
    /** the player who plays the murderer */
    murdererUserId: string | null;
    /** user id -> accusation, with the server order of the submission */
    accusations: Record<string, MurderAccusation & { seq: number }>;
    accuseSeq: number;
    /** every whisper of the game (delivered only to its two parties) */
    whispers: MurderWhisper[];
    /** user id -> whispers sent per round number */
    whisperCounts: Record<string, Record<number, number>>;
    /** user id -> ids of the private clues the player shared */
    shared: Record<string, string[]>;
    whisperSeq: number;
    /** cases played in this room before (a rematch plays another one) */
    usedCaseIds: string[];
    result: MurderResult | null;
  };
}
