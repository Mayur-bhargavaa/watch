/**
 * A rule violation by a player (bad input, not their turn, game over...). It carries a stable `code`
 * the client can switch on; the message is safe to show to the user.
 */
export type GameRuleErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_YOUR_TURN'
  | 'GAME_OVER'
  | 'NOT_PLAYER'
  | 'WRONG_GAME'
  | 'NOT_PLAYING'
  | 'ILLEGAL_MOVE'
  | 'MUST_ROLL'
  | 'ALREADY_ROLLED'
  | 'COLUMN_FULL'
  | 'CELL_OCCUPIED'
  | 'REMATCH_UNAVAILABLE'
  | 'HOST_ONLY'
  | 'SPECTATOR'
  | 'RATE_LIMITED'
  | 'INVALID_REACTION'
  | 'WRONG_PHASE'
  | 'ALREADY_VOTED'
  | 'ALREADY_SOLVED'
  | 'TOO_MANY_GUESSES'
  | 'DUPLICATE_GUESS'
  | 'CHAT_LOCKED';

export class GameRuleError extends Error {
  public readonly code: GameRuleErrorCode;
  constructor(code: GameRuleErrorCode, message: string) {
    super(message);
    this.name = 'GameRuleError';
    this.code = code;
  }
}
