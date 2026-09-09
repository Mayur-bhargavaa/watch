import { LudoColor, LudoToken, LudoGameState } from '@synccinema/common';
import { GAME_DEFINITIONS } from './GameDefinitions.js';

// Color starting tile indices on the common 52-tile ring
export const COLOR_START_TILES: Record<LudoColor, number> = {
  yellow: 0,
  blue: 13,
  red: 26,
  green: 39
};

// Safe Star tiles on the common 52-tile ring where tokens cannot be captured
export const SAFE_STAR_TILES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);

export class LudoEngine {
  /**
   * Initializes a brand new authoritative Ludo game state
   */
  public static createInitialState(
    players: Array<{ userId: string; displayName: string; seat: number; color: LudoColor }>,
    playersCount: 2 | 3 | 4
  ): LudoGameState {
    const seats: Record<number, { userId: string; displayName: string; color: LudoColor }> = {};
    const tokens: Record<LudoColor, LudoToken[]> = {
      red: [0, 1, 2, 3].map(id => ({ id, color: 'red', step: -1 })),
      green: [0, 1, 2, 3].map(id => ({ id, color: 'green', step: -1 })),
      yellow: [0, 1, 2, 3].map(id => ({ id, color: 'yellow', step: -1 })),
      blue: [0, 1, 2, 3].map(id => ({ id, color: 'blue', step: -1 }))
    };

    players.forEach(p => {
      seats[p.seat] = {
        userId: p.userId,
        displayName: p.displayName,
        color: p.color
      };
    });

    const firstPlayer = seats[0] || players[0];
    const initialTurnColor = firstPlayer.color;

    return {
      playersCount,
      seats,
      currentTurnSeat: 0,
      currentTurnColor: initialTurnColor,
      diceValue: null,
      isRolling: false,
      canRoll: true,
      legalMoves: [],
      tokens,
      winnerColor: null,
      winnerUserId: null,
      statusMessage: `${firstPlayer.displayName}'s turn (${initialTurnColor.toUpperCase()}) — Roll the dice!`,
      consecutiveSixes: 0
    };
  }

  /**
   * Converts a token's local step (0..50) into an absolute ring coordinate (0..51)
   */
  public static getAbsoluteRingPosition(color: LudoColor, step: number): number | null {
    if (step < 0 || step > 50) return null; // in yard (-1) or in home stretch (51..56)
    return (COLOR_START_TILES[color] + step) % 52;
  }

  /**
   * Calculates legal moves for a player given the rolled dice value
   */
  public static getLegalMoves(state: LudoGameState, color: LudoColor, dice: number): number[] {
    const playerTokens = state.tokens[color];
    const legal: number[] = [];

    playerTokens.forEach(token => {
      if (token.step === 56) {
        // Token already finished in home
        return;
      }

      if (token.step === -1) {
        // Token in yard: can only come out on rolling a 6
        if (dice === 6) {
          legal.push(token.id);
        }
      } else {
        // Token on track: can advance if step + dice does not exceed home (56)
        if (token.step + dice <= 56) {
          legal.push(token.id);
        }
      }
    });

    return legal;
  }

  /**
   * Server executes a dice roll for the current active player
   */
  public static rollDice(state: LudoGameState, seatIndex: number): {
    state: LudoGameState;
    diceValue: number;
    hasLegalMoves: boolean;
    earnedBonusRoll: boolean;
    passedTurn: boolean;
  } {
    if (state.winnerColor) {
      throw new Error('Game is already finished');
    }

    if (seatIndex !== state.currentTurnSeat) {
      throw new Error("It is not this player's turn to roll");
    }

    if (!state.canRoll) {
      throw new Error('Dice has already been rolled for this turn');
    }

    // Authoritative pseudo-random dice roll: 1 to 6
    const diceValue = Math.floor(Math.random() * 6) + 1;
    const isSix = diceValue === 6;
    const consecutiveSixes = isSix ? state.consecutiveSixes + 1 : 0;

    // Rule: 3 consecutive sixes cancels turn
    if (consecutiveSixes >= 3) {
      const nextSeat = (state.currentTurnSeat + 1) % state.playersCount;
      const nextPlayer = state.seats[nextSeat];
      const updated: LudoGameState = {
        ...state,
        diceValue,
        canRoll: true,
        legalMoves: [],
        consecutiveSixes: 0,
        currentTurnSeat: nextSeat,
        currentTurnColor: nextPlayer.color,
        statusMessage: `3 consecutive sixes! Turn passed to ${nextPlayer.displayName} (${nextPlayer.color.toUpperCase()})`
      };
      return {
        state: updated,
        diceValue,
        hasLegalMoves: false,
        earnedBonusRoll: false,
        passedTurn: true
      };
    }

    const legalMoves = this.getLegalMoves(state, state.currentTurnColor, diceValue);
    const activePlayer = state.seats[state.currentTurnSeat];

    if (legalMoves.length === 0) {
      // No legal moves possible with this roll -> turn passes to next seat
      const nextSeat = (state.currentTurnSeat + 1) % state.playersCount;
      const nextPlayer = state.seats[nextSeat];
      const updated: LudoGameState = {
        ...state,
        diceValue,
        canRoll: true,
        legalMoves: [],
        consecutiveSixes: 0,
        currentTurnSeat: nextSeat,
        currentTurnColor: nextPlayer.color,
        statusMessage: `${activePlayer.displayName} rolled ${diceValue} (No valid moves). ${nextPlayer.displayName}'s turn!`
      };
      return {
        state: updated,
        diceValue,
        hasLegalMoves: false,
        earnedBonusRoll: false,
        passedTurn: true
      };
    }

    // Has legal moves -> player must pick a token to move
    const updated: LudoGameState = {
      ...state,
      diceValue,
      canRoll: false,
      legalMoves,
      consecutiveSixes,
      statusMessage: `${activePlayer.displayName} rolled ${diceValue}! Select a token to move.`
    };

    return {
      state: updated,
      diceValue,
      hasLegalMoves: true,
      earnedBonusRoll: isSix,
      passedTurn: false
    };
  }

  /**
   * Server executes a token move chosen by the player
   */
  public static moveToken(
    state: LudoGameState,
    seatIndex: number,
    tokenId: number
  ): {
    state: LudoGameState;
    capturedToken?: { color: LudoColor; tokenId: number };
    earnedBonusRoll: boolean;
    isWinner: boolean;
  } {
    if (state.winnerColor) {
      throw new Error('Game is already finished');
    }

    if (seatIndex !== state.currentTurnSeat) {
      throw new Error("It is not this player's turn to move");
    }

    if (state.canRoll || state.diceValue === null) {
      throw new Error('Must roll dice before moving token');
    }

    if (!state.legalMoves.includes(tokenId)) {
      throw new Error('Illegal move: this token cannot move with the current dice value');
    }

    const activeColor = state.currentTurnColor;
    const activePlayer = state.seats[seatIndex];
    const dice = state.diceValue;

    // Deep clone tokens
    const tokensCopy: Record<LudoColor, LudoToken[]> = {
      red: state.tokens.red.map(t => ({ ...t })),
      green: state.tokens.green.map(t => ({ ...t })),
      yellow: state.tokens.yellow.map(t => ({ ...t })),
      blue: state.tokens.blue.map(t => ({ ...t }))
    };

    const token = tokensCopy[activeColor].find(t => t.id === tokenId);
    if (!token) {
      throw new Error('Token not found');
    }

    // Advance token
    if (token.step === -1) {
      token.step = 0; // Spawns onto starting track
    } else {
      token.step = Math.min(56, token.step + dice);
    }

    let capturedToken: { color: LudoColor; tokenId: number } | undefined;
    let earnedBonusRoll = dice === 6;

    // Check for token capture on the common track (step 0..50)
    const newRingPos = this.getAbsoluteRingPosition(activeColor, token.step);
    if (newRingPos !== null && !SAFE_STAR_TILES.has(newRingPos)) {
      // Look for opponent tokens occupying this exact ring position
      for (const [seatStr, seatInfo] of Object.entries(state.seats)) {
        if (seatInfo.color === activeColor) continue;
        const opponentTokens = tokensCopy[seatInfo.color];
        for (const oppToken of opponentTokens) {
          const oppRingPos = this.getAbsoluteRingPosition(seatInfo.color, oppToken.step);
          if (oppRingPos === newRingPos) {
            // Cut / Capture opponent token!
            oppToken.step = -1; // Send back to base yard
            capturedToken = { color: seatInfo.color, tokenId: oppToken.id };
            earnedBonusRoll = true; // Capturing awards bonus roll!
            break;
          }
        }
        if (capturedToken) break;
      }
    }

    // Extra roll awarded if token reached home (56)
    if (token.step === 56) {
      earnedBonusRoll = true;
    }

    // Check win condition: all 4 tokens at step 56
    const allHome = tokensCopy[activeColor].every(t => t.step === 56);
    let winnerColor: LudoColor | null = null;
    let winnerUserId: string | null = null;

    if (allHome) {
      winnerColor = activeColor;
      winnerUserId = activePlayer.userId;
    }

    let statusMessage = '';
    let nextSeat = state.currentTurnSeat;
    let nextColor = activeColor;

    if (winnerColor) {
      statusMessage = `🏆 ${activePlayer.displayName} (${activeColor.toUpperCase()}) HAS WON THE LUDO MATCH!`;
    } else if (earnedBonusRoll) {
      if (capturedToken) {
        statusMessage = `💥 ${activePlayer.displayName} captured an opponent token! Bonus roll awarded!`;
      } else if (token.step === 56) {
        statusMessage = `🏁 ${activePlayer.displayName} brought a token HOME! Bonus roll awarded!`;
      } else {
        statusMessage = `🎲 ${activePlayer.displayName} rolled a 6! Bonus roll awarded!`;
      }
    } else {
      // Pass turn to next seat
      nextSeat = (state.currentTurnSeat + 1) % state.playersCount;
      const nextPlayer = state.seats[nextSeat];
      nextColor = nextPlayer.color;
      statusMessage = `${nextPlayer.displayName}'s turn (${nextColor.toUpperCase()}) — Roll the dice!`;
    }

    const updatedState: LudoGameState = {
      ...state,
      tokens: tokensCopy,
      diceValue: earnedBonusRoll ? null : state.diceValue,
      canRoll: true,
      legalMoves: [],
      consecutiveSixes: earnedBonusRoll ? state.consecutiveSixes : 0,
      currentTurnSeat: nextSeat,
      currentTurnColor: nextColor,
      winnerColor,
      winnerUserId,
      statusMessage
    };

    return {
      state: updatedState,
      capturedToken,
      earnedBonusRoll,
      isWinner: !!winnerColor
    };
  }
}
