import type { IconName } from '../components/ui/AppIcon';

/**
 * Quick reactions that players send each other during a game. These are chat-style content (like stickers), so they are
 * the one place in the game screens where emoji are allowed; everything else in the interface uses icons.
 */
export const TIC_TAC_TOE_REACTIONS = ['❤️', '😂', '🔥', '👏', '🎉', '❌', '⭕', '🥳', '🥺', '✨'];
export const FOUR_IN_A_ROW_REACTIONS = ['❤️', '😂', '🔥', '👏', '🎉', '🔴', '🟡', '🥳', '🥺', '✨'];
export const LUDO_REACTIONS = ['❤️', '😂', '🔥', '👏', '🎉', '🎲', '🥳', '🥺', '👍', '✨'];
export const IMPOSTER_REACTIONS = ['😂', '🤔', '🕵️', '👀', '😱', '🔥', '👏', '🎉', '🤥', '❤️'];
export const TAMBOLA_REACTIONS = ['❤️', '😂', '🔥', '🎉', '🎲', '😍'];
export const CHESS_REACTIONS = ['❤️', '😂', '🔥', '👏', '🧠', '👑', '💀'];
export const CHESS_CHAT_REACTIONS = ['❤️', '😂', '🔥', '👏', '🎉', '👑'];
export const BINGO_REACTIONS = ['😂', '❤️', '🔥', '😱', '👏', '😭'];

/** Cinema room live reactions (sent to the other viewers as emoji; the buttons themselves show icons). */
export const CINEMA_REACTIONS = ['❤️', '😂', '🔥', '👏', '🎉', '🎲', '🥳', '🥺'] as const;
export const CINEMA_REACTION_ICONS: Record<string, IconName> = { '❤️': 'heart', '😂': 'laugh', '🔥': 'fire', '👏': 'hand', '🎉': 'party', '🎲': 'dice', '🥳': 'sparkles', '🥺': 'sad' };
const CINEMA_CODES: Record<string, string> = { '❤️': 'heart', '😂': 'joy', '🔥': 'fire', '👏': 'clap', '🎉': 'party', '🎲': 'dice', '🥳': 'celebrate', '🥺': 'pleading' };
export const cinemaReactionCode = (emoji: string): string => CINEMA_CODES[emoji] || 'emoji';

/** Quick chat messages in the cinema room (sent as chat text). */
export const QUICK_CHAT_PHRASES = ['Good Luck! 🍀', 'Nice Move! 👏', 'Oops! 🙈', 'Well Played! 🌟', 'Hurry Up! ⏰', 'GG! 🏆'];

/** Fake chat conversation shown on the landing page (it imitates a real chat, so it contains emoji). */
export const LANDING_CHAT_SAMPLES = [
  { user: 'Sarah', text: 'OMG that scene was breathtaking!! 🤯', time: '12:04' },
  { user: 'Mayur (Host)', text: 'The soundtrack in sync hits completely different 🎧', time: '12:05' },
  { user: 'Alex', text: 'Wait rewind 5 seconds look at the background!', time: '12:06' },
  { user: 'Elena', text: 'Sub-second sync is insane, zero delay 🔥', time: '12:07' }
];
export const LANDING_BUBBLES = {
  musicChills: 'Music is giving me chills! 😭✨',
  musicGoosebumps: 'The music is giving me goosebumps! 😭✨',
  rematch: 'Rematch on Four-in-a-Row after this? 🔴'
};

/** Doodle Duel: quick chat lines and reactions players send each other. */
export const DOODLE_GUESS_QUICK_MESSAGES = ['Nice drawing! 🎨', 'So close!! 🔥', 'Haha that looks like a cat 😂', 'Good guess! 👏', 'Hurry, timer running out! ⏳', 'What is that?! 🤯'];
export const DOODLE_CHAT_PILLS = ['Good job! 👏', 'Haha nice! 😂', 'Hurry up! ⏳', 'Close one! 🔥', 'What is that?! 🤯'];
export const DOODLE_REACTIONS = ['🎨', '🧠', '🔥', '😂', '👏', '🤯', '❤️'];
export const DOODLE_WAITING_REACTIONS = ['❤️', '😂', '🔥', '👏', '🎉'];
