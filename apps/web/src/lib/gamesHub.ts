import { UPCOMING_GAMES } from '@synccinema/common';

/**
 * The games hub catalogue (one source for the /games page and the header search). `route` is set for every live game;
 * entries with `isComingSoon` are roadmap items and are never offered as playable.
 */
export interface GameCardData {
  id: string;
  title: string;
  subtext: string;
  players: string;
  gradient: string;
  image: string;
  route?: string;
  watermark: 'crown' | 'sparkle';
  category: 'party' | 'duel';
  isComingSoon?: boolean;
  /** pass needed: to unlock a coming-soon game, or to HOST a live VIP game (guests of any pass can still join) */
  tier?: 'plus' | 'creator';
}

export const GAMES_DATA: GameCardData[] = [
  {
    id: 'ludo',
    title: 'Ludo Party',
    subtext: 'Roll. Move. Capture. Win W/together.',
    players: '2-4 Players',
    gradient: 'from-[#ff456e] via-[#dc1947] to-[#7f0b27]',
    image: '/images/card-ludo-dice.png',
    route: '/games/ludo',
    watermark: 'crown',
    category: 'party'
  },
  {
    id: 'bingo',
    title: 'Bingo Duel',
    subtext: 'Fast 1–25 5×5 duel. Complete the pattern first!',
    players: '2 Players',
    gradient: 'from-[#6366f1] via-[#4f46e5] to-[#1e1b4b]',
    image: '/images/card-bingo-duel.png',
    route: '/games/bingo',
    watermark: 'sparkle',
    category: 'duel'
  },
  {
    id: 'tambola',
    title: 'Tambola',
    subtext: 'Classic 90-Ball Housie. Modern twist.',
    players: '2–20 Players',
    gradient: 'from-[#06b6d4] via-[#0284c7] to-[#082f49]',
    image: '/images/card-tambola.png',
    route: '/games/tambola',
    watermark: 'crown',
    category: 'party'
  },
  {
    id: 'doodle-duel',
    title: 'Doodle Duel',
    subtext: 'Draw it. Guess it. Switch.',
    players: '2 Players',
    gradient: 'from-[#8755f8] via-[#6523c9] to-[#360966]',
    image: '/images/card-doodle-duel.png',
    route: '/games/doodle-duel',
    watermark: 'sparkle',
    category: 'duel'
  },
  {
    id: 'tic-tac-toe',
    title: 'Tic Tac Toe',
    subtext: 'Quick games. Big fun.',
    players: '2 Players',
    gradient: 'from-[#e5a463] via-[#bc7533] to-[#6b3a16]',
    image: '/images/card-tictactoe.png',
    route: '/games/tic-tac-toe',
    watermark: 'sparkle',
    category: 'duel'
  },
  {
    id: 'zero-cross',
    title: 'Zero Cross',
    subtext: '3 pieces each. Place them, then move them.',
    players: '2 Players',
    gradient: 'from-[#38bdf8] via-[#0e7490] to-[#082f49]',
    image: '/images/card-zero-cross.png',
    route: '/games/zero-cross',
    watermark: 'sparkle',
    category: 'duel'
  },
  {
    id: 'pen-fight',
    title: 'Pen Fight',
    subtext: 'Flick your pen. Knock theirs off the desk.',
    players: '2 Players',
    gradient: 'from-[#fb7185] via-[#be123c] to-[#1e1b4b]',
    image: '/images/card-pen-fight.png',
    route: '/games/pen-fight',
    watermark: 'sparkle',
    category: 'duel'
  },
  {
    id: 'rock-paper-scissors',
    title: 'Rock Paper Scissors',
    subtext: 'Secret picks. One big reveal. Best of 3.',
    players: '2 Players',
    gradient: 'from-[#f59e0b] via-[#b45309] to-[#1c1917]',
    image: '/images/card-rock-paper-scissors.png',
    route: '/games/rock-paper-scissors',
    watermark: 'sparkle',
    category: 'duel'
  },
  {
    id: 'color-clash',
    title: 'Color Clash',
    subtext: 'Match colours, play action cards, empty your hand first.',
    players: '2-4 Players',
    gradient: 'from-[#ef4444] via-[#9f1239] to-[#1e1b4b]',
    image: '/images/card-color-clash.png',
    route: '/games/color-clash',
    watermark: 'sparkle',
    category: 'party'
  },
  {
    id: 'four-in-a-row',
    title: 'Four in a Row',
    subtext: 'Vertical disc duel. 4 in a line.',
    players: '2 Players',
    gradient: 'from-[#3b82f6] via-[#1d4ed8] to-[#0f172a]',
    image: '/images/card-four-in-row.png',
    route: '/games/four-in-a-row',
    watermark: 'sparkle',
    category: 'duel'
  },
  {
    id: 'chess',
    title: 'Chess',
    subtext: 'Classic 2-player strategy. Standard 8×8 rules.',
    players: '2 Players',
    gradient: 'from-[#b45309] via-[#78350f] to-[#1c1917]',
    image: '/images/card-chess-arena.png',
    route: '/games/chess',
    watermark: 'crown',
    category: 'duel'
  },
  {
    id: 'imposter',
    title: 'Imposter',
    subtext: 'Everyone knows the word except one. Clue, bluff, vote.',
    players: '4-8 Players',
    gradient: 'from-[#8b5cf6] via-[#6d28d9] to-[#2e1065]',
    image: '/images/card-imposter.png',
    route: '/games/imposter',
    watermark: 'sparkle',
    category: 'party',
    // VIP to HOST; anyone can still join a friend's game (the page explains this to free users)
    tier: 'plus'
  },
  {
    id: 'emoji-charades',
    title: 'Emoji Charades',
    subtext: 'Guess the movie or show from the emoji. Race your friends.',
    players: '2-8 Players',
    gradient: 'from-[#f59e0b] via-[#d97706] to-[#78350f]',
    image: '/images/card-emoji-charades.png',
    route: '/games/emoji-charades',
    watermark: 'sparkle',
    category: 'party',
    // VIP to HOST; anyone can still join a friend's game (the page explains this to free users)
    tier: 'plus'
  },
  {
    id: 'mafia',
    title: 'Mafia Night',
    subtext: 'Night falls. Find the mafia before they find you.',
    players: '5-10 Players',
    gradient: 'from-[#ef4444] via-[#991b1b] to-[#1c1917]',
    image: '/images/card-mafia.png',
    route: '/games/mafia',
    watermark: 'sparkle',
    category: 'party',
    // VIP to HOST; anyone can still join a friend's game (the page explains this to free users)
    tier: 'plus'
  },
  {
    id: 'quiz-show',
    title: 'Quiz Show Studio',
    subtext: 'Host a live quiz with your own questions, buzzers and a leaderboard.',
    players: 'Up to 30 Players',
    gradient: 'from-[#ee1d49] via-[#9f1239] to-[#1c1917]',
    image: '/images/card-quiz-show.png',
    route: '/games/quiz-show',
    watermark: 'crown',
    category: 'party',
    // Creator Pass to HOST; anyone can still join a quiz with its room code (the page explains this to free users)
    tier: 'creator'
  },
  {
    id: 'murder-mystery',
    title: 'Murder Mystery Night',
    subtext: 'A whodunit for the whole group: clues, secrets and a final accusation.',
    players: '6-12 Players',
    gradient: 'from-[#ee1d49] via-[#9f1239] to-[#1c1917]',
    image: '/images/card-murder-mystery.png',
    route: '/games/murder-mystery',
    watermark: 'sparkle',
    category: 'party',
    // Creator Pass to HOST; anyone can still join with a room code (the page explains this to free users)
    tier: 'creator'
  },
  {
    id: 'tournament',
    title: 'Tournament Arena',
    subtext: 'Run a knockout bracket of 1v1 matches with seeding, byes and a champion.',
    players: '4-32 Players',
    gradient: 'from-[#ee1d49] via-[#9f1239] to-[#1c1917]',
    image: '/images/card-tournament.png',
    route: '/games/tournament',
    watermark: 'crown',
    category: 'party',
    // Creator Pass to ORGANISE; anyone can still join with a room code (the page explains this to free users)
    tier: 'creator'
  },
];

const UPCOMING_STYLE = [
  { gradient: 'from-[#6366f1] via-[#4338ca] to-[#1e1b4b]', image: '/images/card-tictactoe.png' },
  { gradient: 'from-[#f59e0b] via-[#d97706] to-[#78350f]', image: '/images/card-cinema-trivia.png' },
  { gradient: 'from-[#ef4444] via-[#991b1b] to-[#1c1917]', image: '/images/card-chess-arena.png' },
  { gradient: 'from-[#14b8a6] via-[#0f766e] to-[#042f2e]', image: '/images/card-bingo-duel.png' },
  { gradient: 'from-[#8b5cf6] via-[#6d28d9] to-[#2e1065]', image: '/images/card-doodle-duel.png' },
  { gradient: 'from-[#ec4899] via-[#be185d] to-[#500724]', image: '/images/card-four-in-row.png' }
];
GAMES_DATA.push(
  ...UPCOMING_GAMES.map((g, i): GameCardData => ({
    id: g.id,
    title: g.title,
    subtext: g.blurb,
    players: g.players,
    gradient: UPCOMING_STYLE[i % UPCOMING_STYLE.length].gradient,
    image: UPCOMING_STYLE[i % UPCOMING_STYLE.length].image,
    watermark: 'sparkle',
    category: 'party',
    isComingSoon: true,
    tier: g.tier
  }))
);

/** Live (playable) games only. */
export const liveGames = (): GameCardData[] => GAMES_DATA.filter((g) => !g.isComingSoon && typeof g.route === 'string');
