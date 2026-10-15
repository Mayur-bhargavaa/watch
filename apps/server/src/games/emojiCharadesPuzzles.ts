/**
 * Curated puzzle list for Emoji Charades. This file is PUZZLE CONTENT: the emoji characters below are the puzzles (like chat
 * stickers), so this file (and the web component that draws the puzzle) is allowed to contain emoji. Keep them out of the rest of the code.
 *
 * Every puzzle: the answer players have to type, accepted alternates ("Dark Knight" for "The Dark Knight"), a string of 3 to 7
 * emoji that really hints at it, a genre, a difficulty (1 easy, 2 medium, 3 hard) and a region for the mix of the list.
 * Keep every answer unique. Alternates may not repeat an answer of another puzzle.
 */
export type EmojiCharadesRegion = 'hollywood' | 'bollywood' | 'tv';

export interface EmojiCharadesPuzzle {
  id: string;
  answer: string;
  alternates: readonly string[];
  /** the emoji as written; use `splitEmoji` to get one entry per emoji (a flag or a family is ONE emoji) */
  emoji: string;
  genre: string;
  difficulty: 1 | 2 | 3;
  region: EmojiCharadesRegion;
}

export const EMOJI_CHARADES_PUZZLES: readonly EmojiCharadesPuzzle[] = [
  // ---- Hollywood
  { id: 'titanic', answer: 'Titanic', alternates: [], emoji: '🚢🧊❤️🌊', genre: 'Romance', difficulty: 1, region: 'hollywood' },
  { id: 'lion-king', answer: 'The Lion King', alternates: ['Lion King'], emoji: '🦁👑🌅🐗', genre: 'Animation', difficulty: 1, region: 'hollywood' },
  { id: 'finding-nemo', answer: 'Finding Nemo', alternates: ['Nemo'], emoji: '🐠🔍🌊🐢', genre: 'Animation', difficulty: 1, region: 'hollywood' },
  { id: 'frozen', answer: 'Frozen', alternates: [], emoji: '❄️👸⛄🎶', genre: 'Animation', difficulty: 1, region: 'hollywood' },
  { id: 'jurassic-park', answer: 'Jurassic Park', alternates: [], emoji: '🦖🌴🧬🚙', genre: 'Sci-Fi', difficulty: 1, region: 'hollywood' },
  { id: 'dark-knight', answer: 'The Dark Knight', alternates: ['Dark Knight'], emoji: '🦇🌃🃏🚔', genre: 'Action', difficulty: 2, region: 'hollywood' },
  { id: 'harry-potter', answer: 'Harry Potter', alternates: ['Harry Potter and the Philosophers Stone', 'Harry Potter and the Sorcerers Stone'], emoji: '⚡👓🧙🦉🪄', genre: 'Fantasy', difficulty: 1, region: 'hollywood' },
  { id: 'spider-man', answer: 'Spider-Man', alternates: ['Spiderman', 'Spider Man'], emoji: '🕷️🕸️🏙️🦸', genre: 'Superhero', difficulty: 1, region: 'hollywood' },
  { id: 'toy-story', answer: 'Toy Story', alternates: [], emoji: '🤠🚀🧸🎒', genre: 'Animation', difficulty: 1, region: 'hollywood' },
  { id: 'jaws', answer: 'Jaws', alternates: [], emoji: '🦈🏖️🚤🩸', genre: 'Thriller', difficulty: 2, region: 'hollywood' },
  { id: 'matrix', answer: 'The Matrix', alternates: ['Matrix'], emoji: '💊🕶️💻🥋', genre: 'Sci-Fi', difficulty: 2, region: 'hollywood' },
  { id: 'inception', answer: 'Inception', alternates: [], emoji: '😴🌀🏙️⏳🎡', genre: 'Sci-Fi', difficulty: 2, region: 'hollywood' },
  { id: 'avatar', answer: 'Avatar', alternates: [], emoji: '🧝🔵🌌🌿', genre: 'Sci-Fi', difficulty: 1, region: 'hollywood' },
  { id: 'ghostbusters', answer: 'Ghostbusters', alternates: ['Ghost Busters'], emoji: '👻🚫🚐🔫', genre: 'Comedy', difficulty: 2, region: 'hollywood' },
  { id: 'home-alone', answer: 'Home Alone', alternates: [], emoji: '🏠👦🎄🪤', genre: 'Comedy', difficulty: 1, region: 'hollywood' },
  { id: 'forrest-gump', answer: 'Forrest Gump', alternates: ['Forest Gump'], emoji: '🏃🍫🦐🪶📻', genre: 'Drama', difficulty: 2, region: 'hollywood' },
  { id: 'pirates-caribbean', answer: 'Pirates of the Caribbean', alternates: ['Pirates of Caribbean'], emoji: '🏴‍☠️🦜⚓🌊💀', genre: 'Adventure', difficulty: 1, region: 'hollywood' },
  { id: 'black-panther', answer: 'Black Panther', alternates: [], emoji: '🐆🖤👑✊', genre: 'Superhero', difficulty: 2, region: 'hollywood' },
  { id: 'godfather', answer: 'The Godfather', alternates: ['Godfather'], emoji: '🤵🐴🔫🍊', genre: 'Crime', difficulty: 3, region: 'hollywood' },
  { id: 'star-wars', answer: 'Star Wars', alternates: ['Starwars'], emoji: '⭐⚔️🌌🤖🚀', genre: 'Sci-Fi', difficulty: 1, region: 'hollywood' },
  { id: 'shrek', answer: 'Shrek', alternates: [], emoji: '🧅👹🐴🏰', genre: 'Animation', difficulty: 1, region: 'hollywood' },
  { id: 'coco', answer: 'Coco', alternates: [], emoji: '💀🎸🌼🐕', genre: 'Animation', difficulty: 2, region: 'hollywood' },
  { id: 'inside-out', answer: 'Inside Out', alternates: [], emoji: '😀😢😡🧠', genre: 'Animation', difficulty: 2, region: 'hollywood' },
  { id: 'up', answer: 'Up', alternates: [], emoji: '🎈🏠👴🐕', genre: 'Animation', difficulty: 1, region: 'hollywood' },
  { id: 'wolf-wall-street', answer: 'The Wolf of Wall Street', alternates: ['Wolf of Wall Street'], emoji: '🐺💰🏢💵', genre: 'Drama', difficulty: 3, region: 'hollywood' },
  { id: 'joker', answer: 'Joker', alternates: ['The Joker'], emoji: '🃏🤡🪜😂', genre: 'Thriller', difficulty: 2, region: 'hollywood' },
  { id: 'gladiator', answer: 'Gladiator', alternates: [], emoji: '⚔️🏟️🦁🛡️', genre: 'Action', difficulty: 2, region: 'hollywood' },
  { id: 'interstellar', answer: 'Interstellar', alternates: [], emoji: '🚀🌌🕳️⏳🌽', genre: 'Sci-Fi', difficulty: 2, region: 'hollywood' },
  { id: 'avengers', answer: 'The Avengers', alternates: ['Avengers', 'Avengers Assemble'], emoji: '🦸🔨🛡️🤖💚', genre: 'Superhero', difficulty: 1, region: 'hollywood' },
  { id: 'mission-impossible', answer: 'Mission Impossible', alternates: ['Mission: Impossible'], emoji: '🕵️💣🎯🏍️', genre: 'Action', difficulty: 2, region: 'hollywood' },
  { id: 'kung-fu-panda', answer: 'Kung Fu Panda', alternates: [], emoji: '🐼🥋🍜🐉', genre: 'Animation', difficulty: 1, region: 'hollywood' },
  { id: 'back-to-the-future', answer: 'Back to the Future', alternates: ['Back to Future'], emoji: '⏪🚗🕰️⚡', genre: 'Sci-Fi', difficulty: 2, region: 'hollywood' },
  { id: 'et', answer: 'E.T.', alternates: ['ET', 'E.T. the Extra-Terrestrial', 'ET the Extra Terrestrial'], emoji: '👽🚲🌕📞', genre: 'Sci-Fi', difficulty: 3, region: 'hollywood' },
  { id: 'ratatouille', answer: 'Ratatouille', alternates: [], emoji: '🐀👨‍🍳🍲🇫🇷', genre: 'Animation', difficulty: 2, region: 'hollywood' },
  // ---- Bollywood
  { id: 'sholay', answer: 'Sholay', alternates: [], emoji: '🔫🐎🏜️🤝', genre: 'Action', difficulty: 2, region: 'bollywood' },
  { id: '3-idiots', answer: '3 Idiots', alternates: ['Three Idiots'], emoji: '3️⃣🎓🤪🔧', genre: 'Comedy', difficulty: 1, region: 'bollywood' },
  { id: 'ddlj', answer: 'Dilwale Dulhania Le Jayenge', alternates: ['DDLJ'], emoji: '💃❤️🚂🌾🇨🇭', genre: 'Romance', difficulty: 2, region: 'bollywood' },
  { id: 'lagaan', answer: 'Lagaan', alternates: ['Lagaan Once Upon a Time in India'], emoji: '🏏🌾☀️🏆', genre: 'Drama', difficulty: 2, region: 'bollywood' },
  { id: 'dangal', answer: 'Dangal', alternates: [], emoji: '🤼🥇👨‍👧‍👧', genre: 'Sports', difficulty: 2, region: 'bollywood' },
  { id: 'bajrangi-bhaijaan', answer: 'Bajrangi Bhaijaan', alternates: ['Bajrangi Bhaijan'], emoji: '🙏👧🗣️🇵🇰', genre: 'Drama', difficulty: 2, region: 'bollywood' },
  { id: 'pk', answer: 'PK', alternates: ['P.K.'], emoji: '👽📻🛕🛸', genre: 'Comedy', difficulty: 2, region: 'bollywood' },
  { id: 'znmd', answer: 'Zindagi Na Milegi Dobara', alternates: ['ZNMD'], emoji: '🏍️🇪🇸🤿🍅', genre: 'Adventure', difficulty: 3, region: 'bollywood' },
  { id: 'k3g', answer: 'Kabhi Khushi Kabhie Gham', alternates: ['K3G', 'Kabhi Khushi Kabhi Gham'], emoji: '👨‍👩‍👦😭😊🏰', genre: 'Family', difficulty: 3, region: 'bollywood' },
  { id: 'baahubali', answer: 'Baahubali', alternates: ['Bahubali'], emoji: '🏹🌊🏔️👑', genre: 'Epic', difficulty: 2, region: 'bollywood' },
  { id: 'rrr', answer: 'RRR', alternates: ['R R R', 'Rise Roar Revolt'], emoji: '🔥💧🐯🏍️', genre: 'Epic', difficulty: 2, region: 'bollywood' },
  { id: 'chak-de-india', answer: 'Chak De India', alternates: ['Chak De! India'], emoji: '🏑🏆🇮🇳👩', genre: 'Sports', difficulty: 2, region: 'bollywood' },
  { id: 'gully-boy', answer: 'Gully Boy', alternates: [], emoji: '🎤🛤️🏙️🎶', genre: 'Music', difficulty: 2, region: 'bollywood' },
  { id: 'jab-we-met', answer: 'Jab We Met', alternates: [], emoji: '🚂💑🎒😄', genre: 'Romance', difficulty: 3, region: 'bollywood' },
  { id: 'munna-bhai', answer: 'Munna Bhai MBBS', alternates: ['Munna Bhai M.B.B.S.'], emoji: '🩺🤗🔫🎓', genre: 'Comedy', difficulty: 3, region: 'bollywood' },
  // ---- TV and streaming
  { id: 'stranger-things', answer: 'Stranger Things', alternates: [], emoji: '🚲👧🧇🔦🌀', genre: 'Sci-Fi Series', difficulty: 1, region: 'tv' },
  { id: 'squid-game', answer: 'Squid Game', alternates: ['Squid Games'], emoji: '🦑🔴🟢🎮💰', genre: 'Thriller Series', difficulty: 1, region: 'tv' },
  { id: 'money-heist', answer: 'Money Heist', alternates: ['La Casa de Papel'], emoji: '💰🎭🏦🔴', genre: 'Crime Series', difficulty: 1, region: 'tv' },
  { id: 'game-of-thrones', answer: 'Game of Thrones', alternates: ['GOT'], emoji: '🐉🗡️👑🐺❄️', genre: 'Fantasy Series', difficulty: 1, region: 'tv' },
  { id: 'breaking-bad', answer: 'Breaking Bad', alternates: [], emoji: '🧪🧑‍🔬🚐💰', genre: 'Crime Series', difficulty: 2, region: 'tv' },
  { id: 'friends', answer: 'Friends', alternates: ['F.R.I.E.N.D.S'], emoji: '☕🛋️👯🦃', genre: 'Sitcom', difficulty: 1, region: 'tv' },
  { id: 'the-office', answer: 'The Office', alternates: ['Office'], emoji: '📎🏢🤦☕', genre: 'Sitcom', difficulty: 2, region: 'tv' },
  { id: 'mirzapur', answer: 'Mirzapur', alternates: [], emoji: '🔫🍺👑🛕', genre: 'Crime Series', difficulty: 3, region: 'tv' },
  { id: 'panchayat', answer: 'Panchayat', alternates: [], emoji: '🏡👨‍💼🌾🛵', genre: 'Comedy Series', difficulty: 3, region: 'tv' },
  { id: 'the-crown', answer: 'The Crown', alternates: ['Crown'], emoji: '👑🇬🇧☕🏰', genre: 'Drama Series', difficulty: 2, region: 'tv' },
  { id: 'wednesday', answer: 'Wednesday', alternates: [], emoji: '🖤💃🏫🕷️', genre: 'Fantasy Series', difficulty: 2, region: 'tv' },
  { id: 'mandalorian', answer: 'The Mandalorian', alternates: ['Mandalorian'], emoji: '🪖👶🟢🚀🔫', genre: 'Sci-Fi Series', difficulty: 2, region: 'tv' },
  { id: 'sherlock', answer: 'Sherlock', alternates: ['Sherlock Holmes'], emoji: '🔍🎻🏠🕵️', genre: 'Mystery Series', difficulty: 2, region: 'tv' },
  { id: 'peaky-blinders', answer: 'Peaky Blinders', alternates: [], emoji: '🎩🚬🥃🏭🐎', genre: 'Crime Series', difficulty: 3, region: 'tv' },
  { id: 'bridgerton', answer: 'Bridgerton', alternates: [], emoji: '👗💌🎻👑', genre: 'Romance Series', difficulty: 3, region: 'tv' },
  { id: 'lupin', answer: 'Lupin', alternates: [], emoji: '🎩🗼💎🇫🇷', genre: 'Crime Series', difficulty: 3, region: 'tv' },
  { id: 'simpsons', answer: 'The Simpsons', alternates: ['Simpsons'], emoji: '🍩🟡👨‍👩‍👧‍👦📺', genre: 'Animated Series', difficulty: 1, region: 'tv' },
  { id: 'black-mirror', answer: 'Black Mirror', alternates: [], emoji: '🪞🖤📱🤖', genre: 'Sci-Fi Series', difficulty: 3, region: 'tv' },
  { id: 'big-bang-theory', answer: 'The Big Bang Theory', alternates: ['Big Bang Theory'], emoji: '🌌💥🧑‍🔬🍕', genre: 'Sitcom', difficulty: 2, region: 'tv' },
  { id: 'tom-and-jerry', answer: 'Tom and Jerry', alternates: ['Tom & Jerry'], emoji: '🐭🐱🧀🔨', genre: 'Cartoon', difficulty: 1, region: 'tv' }
];

/** One entry per emoji (a flag, a family or a pirate flag is a single emoji made of several code points). */
export function splitEmoji(sequence: string): string[] {
  const Seg = (Intl as any).Segmenter as undefined | (new (l: string, o: { granularity: 'grapheme' }) => { segment(s: string): Iterable<{ segment: string }> });
  if (!Seg) return Array.from(sequence);
  return Array.from(new Seg('en', { granularity: 'grapheme' }).segment(sequence), (s) => s.segment);
}
