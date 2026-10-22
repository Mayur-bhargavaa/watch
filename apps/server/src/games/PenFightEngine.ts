import type { PenFightFlick, PenFightGameState, PenFightPen, PenFightRoundResult } from '@synccinema/common';
import { GameRuleError } from './GameRuleError.js';

/** The desk, in desk units. Seat 0 starts on the left, seat 1 on the right. */
export const DESK = { width: 1000, height: 600 } as const;
export const PEN_RADIUS = 44; // big enough to see and tap on a phone (the desk is 1000 wide)
export const ROUNDS_TO_WIN = 3;
export const MAX_FLICKS_PER_ROUND = 12; // 6 each

const MAX_SPEED = 1500; // units per second at full power
const MIN_POWER = 0.06;
const FRICTION = 2.3; // per second: speed * exp(-FRICTION * t)
const STOP_SPEED = 9; // below this a pen is at rest
const RESTITUTION = 0.93;
const STEP = 1 / 120; // physics step
const MAX_SECONDS = 7;
const FPS = 30;
const STEPS_PER_FRAME = Math.round(1 / STEP / FPS);

const START: [{ x: number; y: number }, { x: number; y: number }] = [
  { x: 210, y: DESK.height / 2 },
  { x: DESK.width - 210, y: DESK.height / 2 }
];

type Player = { userId: string; displayName: string; seat: number };
const r1 = (n: number): number => Math.round(n * 10) / 10;

export interface PenFightMoveResult {
  state: PenFightGameState;
  flick: PenFightFlick;
  /** the flick ended the round */
  roundOver: PenFightRoundResult | null;
  /** the flick ended the match */
  matchOver: boolean;
}

/** Authoritative rules and physics for Pen Fight (see PenFightGameState). Pure: the same input always gives the same flick. */
export class PenFightEngine {
  static createInitialState(players: Player[], startingSeat = 0): PenFightGameState {
    const first = players.find((p) => p.seat === startingSeat) || players[0];
    return {
      desk: { width: DESK.width, height: DESK.height },
      penRadius: PEN_RADIUS,
      pens: [
        { x: START[0].x, y: START[0].y, out: false },
        { x: START[1].x, y: START[1].y, out: false }
      ],
      currentTurnSeat: startingSeat,
      currentTurnMark: startingSeat === 0 ? 'X' : 'O',
      startingSeat,
      round: 1,
      roundsToWin: ROUNDS_TO_WIN,
      scores: [0, 0],
      flicksThisRound: 0,
      maxFlicksPerRound: MAX_FLICKS_PER_ROUND,
      lastRound: null,
      winner: null,
      winnerUserId: null,
      isDraw: false,
      statusMessage: `${first?.displayName || 'Player 1'} flicks first. Drag back from your pen to aim, then let go!`,
      moveCount: 0
    };
  }

  /** the pen is out when its centre has gone past the desk edge */
  private static isOut(p: { x: number; y: number }): boolean {
    return p.x < 0 || p.x > DESK.width || p.y < 0 || p.y > DESK.height;
  }

  /** Plays one flick: `seat` flicks its pen at `angle` (radians, 0 = towards the right, y grows downwards) with `power` 0..1. */
  static flick(state: PenFightGameState, seat: number, angle: number, power: number, players: Player[]): PenFightMoveResult {
    if (state.winner || state.isDraw) throw new GameRuleError('GAME_OVER', 'Game is already finished');
    if (seat !== 0 && seat !== 1) throw new GameRuleError('NOT_PLAYER', 'Only the two players can flick');
    if (seat !== state.currentTurnSeat) throw new GameRuleError('NOT_YOUR_TURN', `It is not your turn (Current seat: ${state.currentTurnSeat})`);
    if (typeof angle !== 'number' || typeof power !== 'number' || !Number.isFinite(angle) || !Number.isFinite(power)) {
      throw new GameRuleError('INVALID_INPUT', 'A flick needs an angle and a power');
    }

    const strength = Math.min(1, Math.max(MIN_POWER, power));
    // positions and velocities of both pens
    const pos = state.pens.map((p) => ({ x: p.x, y: p.y })) as { x: number; y: number }[];
    const vel = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    vel[seat] = { x: Math.cos(angle) * strength * MAX_SPEED, y: Math.sin(angle) * strength * MAX_SPEED };

    const frames: number[][] = [[r1(pos[0].x), r1(pos[0].y), r1(pos[1].x), r1(pos[1].y)]];
    const out = [false, false];
    const steps = Math.floor(MAX_SECONDS / STEP);

    for (let i = 1; i <= steps; i++) {
      // move and slow down
      const decay = Math.exp(-FRICTION * STEP);
      for (let k = 0; k < 2; k++) {
        pos[k].x += vel[k].x * STEP;
        pos[k].y += vel[k].y * STEP;
        vel[k].x *= decay;
        vel[k].y *= decay;
        if (Math.hypot(vel[k].x, vel[k].y) < STOP_SPEED) vel[k] = { x: 0, y: 0 };
      }
      // pen against pen: equal masses, so they swap the speed along the line between them
      const dx = pos[1].x - pos[0].x;
      const dy = pos[1].y - pos[0].y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < PEN_RADIUS * 2) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = PEN_RADIUS * 2 - dist;
        pos[0].x -= (nx * overlap) / 2;
        pos[0].y -= (ny * overlap) / 2;
        pos[1].x += (nx * overlap) / 2;
        pos[1].y += (ny * overlap) / 2;
        const rel = (vel[0].x - vel[1].x) * nx + (vel[0].y - vel[1].y) * ny; // closing speed
        if (rel > 0) {
          const j = ((1 + RESTITUTION) * rel) / 2;
          vel[0].x -= j * nx;
          vel[0].y -= j * ny;
          vel[1].x += j * nx;
          vel[1].y += j * ny;
        }
      }
      if (i % STEPS_PER_FRAME === 0) frames.push([r1(pos[0].x), r1(pos[0].y), r1(pos[1].x), r1(pos[1].y)]);
      out[0] = this.isOut(pos[0]);
      out[1] = this.isOut(pos[1]);
      if (out[0] || out[1]) break;
      if (vel[0].x === 0 && vel[0].y === 0 && vel[1].x === 0 && vel[1].y === 0) break;
    }
    const last = [r1(pos[0].x), r1(pos[0].y), r1(pos[1].x), r1(pos[1].y)];
    if (frames[frames.length - 1].some((v, idx) => v !== last[idx])) frames.push(last);

    const flick: PenFightFlick = { seat, angle: Math.round(angle * 1000) / 1000, power: Math.round(strength * 1000) / 1000, fps: FPS, frames };
    const next: PenFightGameState = {
      ...state,
      pens: [
        { x: last[0], y: last[1], out: out[0] },
        { x: last[2], y: last[3], out: out[1] }
      ] as [PenFightPen, PenFightPen],
      flicksThisRound: state.flicksThisRound + 1,
      moveCount: state.moveCount + 1,
      lastRound: null
    };
    const name = (s: number): string => players.find((p) => p.seat === s)?.displayName || `Player ${s + 1}`;
    const other = seat === 0 ? 1 : 0;

    // 1. someone slid off the desk
    let result: PenFightRoundResult | null = null;
    if (out[0] || out[1]) {
      const loser = out[seat] ? seat : other; // if both went over, the flicker loses
      result = { round: state.round, winnerSeat: loser === 0 ? 1 : 0, reason: loser === seat ? 'self_out' : 'knocked_out' };
    } else if (next.flicksThisRound >= next.maxFlicksPerRound) {
      // 2. nobody fell: after the last flick the pen nearer the middle of the desk takes the round
      const cx = DESK.width / 2;
      const cy = DESK.height / 2;
      const d0 = Math.hypot(last[0] - cx, last[1] - cy);
      const d1 = Math.hypot(last[2] - cx, last[3] - cy);
      result = Math.abs(d0 - d1) < 1
        ? { round: state.round, winnerSeat: null, reason: 'draw' }
        : { round: state.round, winnerSeat: d0 < d1 ? 0 : 1, reason: 'closest_to_center' };
    }

    if (!result) {
      next.currentTurnSeat = other;
      next.currentTurnMark = other === 0 ? 'X' : 'O';
      next.statusMessage = `${name(other)}'s turn: aim and flick!`;
      return { state: next, flick, roundOver: null, matchOver: false };
    }

    // the round is over: score it
    const scores: [number, number] = [state.scores[0], state.scores[1]];
    if (result.winnerSeat !== null) scores[result.winnerSeat] += 1;
    next.scores = scores;
    next.lastRound = result;
    const why =
      result.reason === 'knocked_out' ? `${name(result.winnerSeat as number)} knocked ${name(other === result.winnerSeat ? seat : other)} off the desk!`
      : result.reason === 'self_out' ? `${name(seat)} slid off their own desk!`
      : result.reason === 'closest_to_center' ? `${name(result.winnerSeat as number)} is closest to the middle.`
      : 'Dead even: nobody scores.';

    if (result.winnerSeat !== null && scores[result.winnerSeat] >= next.roundsToWin) {
      const champ = players.find((p) => p.seat === result!.winnerSeat);
      next.winner = result.winnerSeat === 0 ? 'X' : 'O';
      next.winnerUserId = champ?.userId ?? null;
      next.statusMessage = `${why} ${name(result.winnerSeat)} wins the Pen Fight ${scores[0]}-${scores[1]}!`;
      return { state: next, flick, roundOver: result, matchOver: true };
    }

    // next round: pens back to their starting spots, and the other player flicks first
    const nextStarter = (state.startingSeat + state.round) % 2;
    next.round = state.round + 1;
    next.pens = [
      { x: START[0].x, y: START[0].y, out: false },
      { x: START[1].x, y: START[1].y, out: false }
    ];
    next.flicksThisRound = 0;
    next.currentTurnSeat = nextStarter;
    next.currentTurnMark = nextStarter === 0 ? 'X' : 'O';
    next.statusMessage = `${why} Round ${next.round}: ${name(nextStarter)} flicks first.`;
    return { state: next, flick, roundOver: result, matchOver: false };
  }
}
