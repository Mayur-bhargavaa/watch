/**
 * Pure helpers for the Color Clash screens (no React, so they are unit tested). The server decides every rule and sends each player
 * only their own hand; these only turn that into what to draw.
 */
import type { ClashCard, ClashColor, ClashEvent, ClashPlayerView, ClashPublicState } from '@synccinema/common';

export const COLOR_ORDER: readonly ClashColor[] = ['red', 'blue', 'green', 'yellow'];

/** Tailwind-free colour values for the cards (also used for the active-colour dot) */
export const COLOR_HEX: Record<ClashColor, { from: string; to: string; ink: string; name: string }> = {
  red: { from: '#f43f5e', to: '#be123c', ink: '#fff', name: 'Red' },
  blue: { from: '#38bdf8', to: '#1d4ed8', ink: '#fff', name: 'Blue' },
  green: { from: '#4ade80', to: '#15803d', ink: '#052e16', name: 'Green' },
  yellow: { from: '#fde047', to: '#d97706', ink: '#422006', name: 'Yellow' }
};

/** a card the way a screen reader says it: colour first, then what it is */
export function cardLabel(c: ClashCard): string {
  const color = c.color ? `${COLOR_HEX[c.color].name} ` : '';
  switch (c.kind) {
    case 'number': return `${color}${c.value}`;
    case 'skip': return `${color}Skip`;
    case 'reverse': return `${color}Reverse`;
    case 'draw-two': return `${color}Draw Two`;
    case 'wild': return 'Wild';
    default: return 'Wild Draw Four';
  }
}

/** the short mark in the corner of a card */
export function cardMark(c: ClashCard): string {
  switch (c.kind) {
    case 'number': return String(c.value);
    case 'skip': return 'S';
    case 'reverse': return 'R';
    case 'draw-two': return '+2';
    case 'wild': return 'W';
    default: return '+4';
  }
}

/** the hand in a steady order: by colour, then numbers up, then actions, wilds last */
export function sortHand(cards: readonly ClashCard[]): ClashCard[] {
  const kindRank: Record<ClashCard['kind'], number> = { number: 0, skip: 1, reverse: 2, 'draw-two': 3, wild: 4, 'wild-draw-four': 5 };
  return [...cards].sort((a, b) => {
    const ca = a.color ? COLOR_ORDER.indexOf(a.color) : 9;
    const cb = b.color ? COLOR_ORDER.indexOf(b.color) : 9;
    return ca - cb || kindRank[a.kind] - kindRank[b.kind] || (a.value ?? 0) - (b.value ?? 0) || a.id.localeCompare(b.id);
  });
}

/** true only for a table in the Color Clash format (a room from another game, or an older format, is not drawn) */
export function isClashState(s: unknown): s is ClashPublicState {
  const v = s as Partial<ClashPublicState> | null | undefined;
  return !!v && v.game === 'color-clash' && Array.isArray(v.players) && !!v.top && typeof v.version === 'number';
}

export const isLive = (s: ClashPublicState | null | undefined): boolean => !!s && s.status === 'active';

/** whole seconds left on the turn, from the server deadline and this device's offset from the server clock; null when there is no timer */
export function turnSeconds(s: Pick<ClashPublicState, 'deadlineAt'> | null | undefined, deviceNowMs: number, offsetMs: number): number | null {
  if (!s?.deadlineAt) return null;
  return Math.max(0, Math.ceil((Date.parse(s.deadlineAt) - (deviceNowMs + offsetMs)) / 1000));
}

export type TablePosition = 'top' | 'left' | 'right' | 'bottom';
/**
 * Where the other players sit around the table, in the order they play after me (clockwise on screen: left, across, right).
 * Players who left are not drawn.
 */
export function seatsAround(players: ClashPlayerView[], mySeat: number | null): { player: ClashPlayerView; position: TablePosition }[] {
  const active = players.filter((p) => !p.left).sort((a, b) => a.seat - b.seat);
  if (active.length === 0) return [];
  const startIdx = mySeat === null ? -1 : active.findIndex((p) => p.seat === mySeat);
  const others = startIdx === -1 ? active : [...active.slice(startIdx + 1), ...active.slice(0, startIdx)];
  // a spectator has no hand at the bottom, so a fourth player can sit there
  const slots: TablePosition[] = others.length === 1 ? ['top'] : others.length === 2 ? ['left', 'right'] : others.length === 3 ? ['left', 'top', 'right'] : ['left', 'top', 'right', 'bottom'];
  return others.slice(0, 4).map((player, i) => ({ player, position: slots[i] }));
}

/** a one-line description of what just happened (shown briefly over the table) */
export function eventText(e: ClashEvent | null | undefined, players: ClashPlayerView[]): string | null {
  if (!e) return null;
  const name = (seat: number | null | undefined) => players.find((p) => p.seat === seat)?.displayName ?? 'A player';
  switch (e.kind) {
    case 'play': return `${name(e.seat)} played ${e.card ? cardLabel(e.card) : 'a card'}${e.color ? ` and chose ${COLOR_HEX[e.color].name}` : ''}`;
    case 'draw': return `${name(e.seat)} drew ${e.count && e.count > 1 ? `${e.count} cards` : 'a card'}`;
    case 'pass': return e.note === 'left' ? `${name(e.seat)} left the game` : `${name(e.seat)} passed`;
    case 'declare': return `${name(e.seat)} says LAST CARD!`;
    case 'penalty': return `${name(e.seat)} was caught and draws ${e.count ?? 2}`;
    case 'challenge': return e.success ? `The challenge worked! ${name(e.target)} draws ${e.count ?? 4}` : `The challenge failed. ${name(e.seat)} draws ${e.count ?? 6}`;
    case 'timeout': return `${name(e.seat)} ran out of time`;
    default: return null;
  }
}

export interface Prompt { text: string; tone: 'you' | 'wait' | 'over' }
/** what the player should do next, in words */
export function turnPrompt(s: ClashPublicState): Prompt {
  if (!isLive(s)) return { text: s.statusMessage || 'Game over', tone: 'over' };
  const mine = s.mySeat !== null && s.currentSeat === s.mySeat;
  const who = s.players.find((p) => p.seat === s.currentSeat)?.displayName ?? 'A player';
  if (s.mySeat === null) return { text: s.turnPhase === 'challenge' ? `${who} must draw four or challenge` : `${who}'s turn`, tone: 'wait' };
  if (!mine) return { text: s.turnPhase === 'challenge' ? `${who} is deciding on the Wild Draw Four` : `${who}'s turn`, tone: 'wait' };
  if (s.turnPhase === 'challenge') return { text: 'Wild Draw Four! Draw four, or challenge it', tone: 'you' };
  if (s.turnPhase === 'drawn') return { text: 'Play the card you drew, or pass', tone: 'you' };
  return { text: s.playable.length > 0 ? 'Your turn: play a card' : 'Your turn: no card fits, draw one', tone: 'you' };
}

export function resultTitle(s: ClashPublicState): string {
  if (s.status === 'cancelled') return 'GAME CANCELLED';
  const winner = s.players.find((p) => p.seat === s.winnerSeat);
  if (s.mySeat === null) return `${winner?.displayName ?? 'A player'} WON!`;
  return s.winnerSeat === s.mySeat ? 'YOU WIN!' : `${winner?.displayName ?? 'A player'} WINS`;
}
