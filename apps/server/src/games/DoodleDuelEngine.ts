import {
  DoodleConfig,
  DoodleGameState,
  DoodleDifficulty,
  DoodleScoringMode,
  DoodleStroke,
  DoodleGuess,
  DoodleRoundSummary
} from '@synccinema/common';
import { secureRandom } from '../util/random.js';

export interface WordItem {
  word: string;
  icon: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  hint: string;
  aliases?: string[];
}

export const DOODLE_WORDS: WordItem[] = [
  // Animals
  { word: 'Elephant', icon: 'paw', category: 'Animals', difficulty: 'easy', hint: 'A large animal with a long trunk' },
  { word: 'Lion', icon: 'paw', category: 'Animals', difficulty: 'easy', hint: 'The king of the jungle with a mane' },
  { word: 'Monkey', icon: 'paw', category: 'Animals', difficulty: 'easy', hint: 'Loves bananas and swings from trees' },
  { word: 'Dolphin', icon: 'paw', category: 'Animals', difficulty: 'medium', hint: 'A smart marine mammal known for jumping' },
  { word: 'Giraffe', icon: 'paw', category: 'Animals', difficulty: 'easy', hint: 'The tallest animal with a very long neck' },
  { word: 'Penguin', icon: 'paw', category: 'Animals', difficulty: 'easy', hint: 'A flightless bird dressed in a tuxedo' },
  { word: 'Kangaroo', icon: 'paw', category: 'Animals', difficulty: 'medium', hint: 'Hops around with a baby pouch' },
  { word: 'Panda', icon: 'paw', category: 'Animals', difficulty: 'easy', hint: 'Black and white bear that eats bamboo' },
  { word: 'Chameleon', icon: 'paw', category: 'Animals', difficulty: 'hard', hint: 'A lizard that changes colors to blend in' },
  { word: 'Butterfly', icon: 'paw', category: 'Animals', difficulty: 'easy', hint: 'Colorful insect that starts as a caterpillar' },

  // Food
  { word: 'Pizza', icon: 'food', category: 'Food', difficulty: 'easy', hint: 'Italian triangular slice with melted cheese' },
  { word: 'Burger', icon: 'food', category: 'Food', difficulty: 'easy', hint: 'Patty between sesame buns with lettuce' },
  { word: 'Ice Cream', icon: 'food', category: 'Food', difficulty: 'easy', hint: 'Cold sweet dessert on a waffle cone' },
  { word: 'Sushi', icon: 'food', category: 'Food', difficulty: 'medium', hint: 'Japanese rice roll wrapped in seaweed' },
  { word: 'Taco', icon: 'food', category: 'Food', difficulty: 'easy', hint: 'Folded Mexican tortilla with savory filling' },
  { word: 'Pancake', icon: 'food', category: 'Food', difficulty: 'easy', hint: 'Flat golden breakfast cake with syrup' },
  { word: 'Donut', icon: 'food', category: 'Food', difficulty: 'easy', hint: 'Fried dough ring with colorful sprinkles' },
  { word: 'Popcorn', icon: 'food', category: 'Food', difficulty: 'easy', hint: 'Puffed corn snack enjoyed at movie cinemas' },
  { word: 'Watermelon', icon: 'food', category: 'Food', difficulty: 'easy', hint: 'Big green fruit with red flesh and black seeds' },
  { word: 'Croissant', icon: 'food', category: 'Food', difficulty: 'hard', hint: 'Flaky crescent-shaped French pastry' },

  // Movies
  { word: 'Interstellar', icon: 'movie', category: 'Movies', difficulty: 'medium', hint: 'Sci-fi epic traveling through a wormhole and black hole' },
  { word: 'Titanic', icon: 'movie', category: 'Movies', difficulty: 'easy', hint: 'Tragic romance ship that hits an iceberg' },
  { word: 'Inception', icon: 'movie', category: 'Movies', difficulty: 'hard', hint: 'Dreams within dreams and a spinning totem top' },
  { word: 'Jurassic Park', icon: 'movie', category: 'Movies', difficulty: 'medium', hint: 'Theme park with cloned dinosaurs running loose' },
  { word: 'The Matrix', icon: 'movie', category: 'Movies', difficulty: 'medium', hint: 'Green digital rain, black sunglasses, red or blue pill' },
  { word: 'Harry Potter', icon: 'movie', category: 'Movies', difficulty: 'easy', hint: 'Wizard with round glasses and lightning scar' },
  { word: 'Spider-Man', icon: 'movie', category: 'Movies', difficulty: 'easy', hint: 'Web-slinging superhero in red and blue suit' },
  { word: 'Batman', icon: 'movie', category: 'Movies', difficulty: 'easy', hint: 'Caped crusader protecting Gotham City with bat signal' },
  { word: 'Star Wars', icon: 'movie', category: 'Movies', difficulty: 'medium', hint: 'Galactic saga with glowing lightsabers and Jedi' },
  { word: 'Avatar', icon: 'movie', category: 'Movies', difficulty: 'medium', hint: 'Blue humanoid Na\'vi living on the moon Pandora' },

  // Games
  { word: 'Ludo', icon: 'game', category: 'Games', difficulty: 'easy', hint: 'Board game with 4 colored home yards and a die' },
  { word: 'Minecraft', icon: 'game', category: 'Games', difficulty: 'easy', hint: 'Blocky voxel sandbox where you mine and craft' },
  { word: 'Chess', icon: 'game', category: 'Games', difficulty: 'easy', hint: 'Checkmate game with kings, queens, and pawns' },
  { word: 'Pac-Man', icon: 'game', category: 'Games', difficulty: 'easy', hint: 'Yellow circle eating dots while running from ghosts' },
  { word: 'Tetris', icon: 'game', category: 'Games', difficulty: 'easy', hint: 'Falling geometric blocks cleared in lines' },
  { word: 'Fortnite', icon: 'game', category: 'Games', difficulty: 'medium', hint: 'Battle royale with battle bus and pickaxe' },
  { word: 'Bowling', icon: 'game', category: 'Games', difficulty: 'easy', hint: 'Rolling a heavy ball to knock down 10 pins' },
  { word: 'Billiards', icon: 'game', category: 'Games', difficulty: 'medium', hint: 'Hitting pool balls into pockets with a cue stick' },

  // Objects
  { word: 'Rocket', icon: 'package', category: 'Objects', difficulty: 'easy', hint: 'Spacecraft blasting off with fiery exhaust' },
  { word: 'Phone', icon: 'package', category: 'Objects', difficulty: 'easy', hint: 'Touchscreen device you carry in your pocket' },
  { word: 'Car', icon: 'package', category: 'Objects', difficulty: 'easy', hint: 'Four-wheeled automobile on the road' },
  { word: 'Guitar', icon: 'package', category: 'Objects', difficulty: 'easy', hint: 'Musical instrument with strings and a fretboard' },
  { word: 'Bicycle', icon: 'package', category: 'Objects', difficulty: 'easy', hint: 'Two wheels powered by pedals and handlebars' },
  { word: 'Telescope', icon: 'package', category: 'Objects', difficulty: 'medium', hint: 'Optical tube used for stargazing at night' },
  { word: 'Submarine', icon: 'package', category: 'Objects', difficulty: 'medium', hint: 'Underwater vessel with a periscope' },
  { word: 'Hot Air Balloon', icon: 'package', category: 'Objects', difficulty: 'medium', hint: 'Giant floating bag of heated air carrying a wicker basket' },

  // Actions
  { word: 'Running', icon: 'zap', category: 'Actions', difficulty: 'easy', hint: 'Moving rapidly on foot with speed' },
  { word: 'Sleeping', icon: 'zap', category: 'Actions', difficulty: 'easy', hint: 'Resting in bed with closed eyes and snoring' },
  { word: 'Swimming', icon: 'zap', category: 'Actions', difficulty: 'easy', hint: 'Propelling through water in a pool' },
  { word: 'Cooking', icon: 'zap', category: 'Actions', difficulty: 'easy', hint: 'Preparing food in a hot pan or pot' },
  { word: 'Fishing', icon: 'zap', category: 'Actions', difficulty: 'medium', hint: 'Catching fish with a rod, hook, and line' },
  { word: 'Juggling', icon: 'zap', category: 'Actions', difficulty: 'hard', hint: 'Tossing multiple balls in the air continuously' },

  // Technology
  { word: 'Robot', icon: 'bot', category: 'Technology', difficulty: 'easy', hint: 'Mechanical humanoid made of metal and circuits' },
  { word: 'Satellite', icon: 'bot', category: 'Technology', difficulty: 'medium', hint: 'Orbital machine with solar panels transmitting signals' },
  { word: 'VR Headset', icon: 'bot', category: 'Technology', difficulty: 'medium', hint: 'Goggles worn on eyes for virtual reality immersion' },
  { word: 'Drone', icon: 'bot', category: 'Technology', difficulty: 'easy', hint: 'Remote-controlled flyer with 4 spinning propellers' },
  { word: 'Space Station', icon: 'bot', category: 'Technology', difficulty: 'hard', hint: 'Large artificial habitat orbiting Earth in space' },

  // Places
  { word: 'Eiffel Tower', icon: 'globe', category: 'Places', difficulty: 'easy', hint: 'Famous iron landmark in Paris, France' },
  { word: 'Pyramids', icon: 'globe', category: 'Places', difficulty: 'easy', hint: 'Ancient triangular stone monuments in Egypt' },
  { word: 'Volcano', icon: 'globe', category: 'Places', difficulty: 'easy', hint: 'Mountain with a crater that erupts hot lava' },
  { word: 'Lighthouse', icon: 'globe', category: 'Places', difficulty: 'medium', hint: 'Coastal tower guiding ships with a rotating beam' },
  { word: 'Roller Coaster', icon: 'globe', category: 'Places', difficulty: 'medium', hint: 'Amusement park ride with loops and steep drops' },

  // Funny & Random
  { word: 'Alien', icon: 'laugh', category: 'Funny', difficulty: 'easy', hint: 'Green extraterrestrial creature with big black eyes' },
  { word: 'Flying Pig', icon: 'laugh', category: 'Funny', difficulty: 'medium', hint: 'An impossible farm animal with angel wings' },
  { word: 'Banana Peel', icon: 'laugh', category: 'Funny', difficulty: 'easy', hint: 'Slippery yellow fruit skin left on the floor' },
  { word: 'Treasure Chest', icon: 'sparkles', category: 'Random', difficulty: 'easy', hint: 'Wooden trunk full of gold coins and pirate loot' },
  { word: 'Campfire', icon: 'sparkles', category: 'Random', difficulty: 'easy', hint: 'Outdoor wood fire for roasting marshmallows' },
  { word: 'Rainbow', icon: 'sparkles', category: 'Random', difficulty: 'easy', hint: 'Arc of seven colorful light bands after rain' }
];

export const DEFAULT_DOODLE_CONFIG: DoodleConfig = {
  drawTime: 60,
  guessTime: 60,
  rounds: 6,
  difficulty: 'mixed',
  scoringMode: 'time_based',
  drawingAssistance: false,
  customWords: [],
  useCustomWords: false
};

export const DOODLE_LIMITS = {
  maxGuessLength: 60,
  maxGuessesPerRound: 30,
  maxStrokes: 300,
  maxPointsPerStroke: 600,
  maxTotalPoints: 6000,
  maxStrokeSize: 64,
  maxCustomWords: 20,
  maxCustomWordLength: 40,
  allowedTimes: [30, 45, 60, 90],
  minRounds: 2,
  maxRounds: 10,
  maxStrokeBytes: 24_000
} as const;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

// Sliding-window rate limiter for drawing messages (keyed by room:user:kind)
const rateBuckets = new Map<string, number[]>();

export function doodleRateAllowed(key: string, maxPerSec: number, now: number = Date.now()): boolean {
  const arr = (rateBuckets.get(key) || []).filter(t => now - t < 1000);
  if (arr.length >= maxPerSec) {
    rateBuckets.set(key, arr);
    return false;
  }
  arr.push(now);
  rateBuckets.set(key, arr);
  return true;
}

export function clearDoodleRate(roomId: string): void {
  const prefix = `${roomId}:`;
  for (const k of Array.from(rateBuckets.keys())) {
    if (k.startsWith(prefix)) rateBuckets.delete(k);
  }
}

export class DoodleDuelEngine {
  /**
   * Normalizes guess string for fair comparison: case, accents, whitespace and punctuation
   * are ignored; letters and digits of every script are kept.
   */
  public static normalize(text: string): string {
    if (typeof text !== 'string') return '';
    return text
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '');
  }

  /**
   * Checks if user guess matches target word or any aliases (a simple trailing "s" plural is accepted)
   */
  public static checkGuess(guess: string, targetWord: string, aliases: string[] = []): boolean {
    const normGuess = this.normalize(guess);
    if (!normGuess) return false;

    for (const candidate of [targetWord, ...aliases]) {
      const norm = this.normalize(candidate);
      if (!norm) continue;
      if (normGuess === norm) return true;
      if (norm.length >= 3 && normGuess === `${norm}s`) return true;
    }
    return false;
  }

  /**
   * Masks secret word for the guesser e.g. "Rocket" -> "_ _ _ _ _ _"
   */
  public static maskWord(word: string): string {
    return word
      .split(' ')
      .map(part => '_ '.repeat(part.length).trim())
      .join('   ');
  }

  /**
   * Whitelists and clamps host-supplied config. Unknown / invalid fields fall back to `base`.
   */
  public static sanitizeConfig(input: any, base: DoodleConfig = DEFAULT_DOODLE_CONFIG): DoodleConfig {
    const src = input && typeof input === 'object' ? input : {};
    const out: DoodleConfig = { ...DEFAULT_DOODLE_CONFIG, ...this.pickKnown(base) };

    const time = (v: any, fallback: number): number =>
      typeof v === 'number' && (DOODLE_LIMITS.allowedTimes as readonly number[]).includes(v) ? v : fallback;

    const drawRaw = src.drawTime !== undefined ? src.drawTime : src.drawTimeSeconds;
    out.drawTime = time(drawRaw, out.drawTime);
    out.guessTime = time(src.guessTime, out.guessTime);
    delete out.drawTimeSeconds;

    const roundsRaw = src.rounds !== undefined ? src.rounds : src.totalRounds;
    if (typeof roundsRaw === 'number' && Number.isFinite(roundsRaw)) {
      let r = Math.round(roundsRaw / 2) * 2; // even so both players draw equally often
      r = Math.min(DOODLE_LIMITS.maxRounds, Math.max(DOODLE_LIMITS.minRounds, r));
      out.rounds = r;
    }
    delete out.totalRounds;

    if (['easy', 'medium', 'hard', 'mixed'].includes(src.difficulty)) out.difficulty = src.difficulty;
    if (['time_based', 'fixed'].includes(src.scoringMode)) out.scoringMode = src.scoringMode;
    if (typeof src.drawingAssistance === 'boolean') out.drawingAssistance = src.drawingAssistance;
    if (typeof src.useCustomWords === 'boolean') out.useCustomWords = src.useCustomWords;
    if (typeof src.hintsEnabled === 'boolean') out.hintsEnabled = src.hintsEnabled;
    if (Array.isArray(src.customWords)) out.customWords = this.sanitizeCustomWords(src.customWords);
    if (!Array.isArray(out.customWords)) out.customWords = [];
    delete out.wordSelectionTimeSeconds;
    return out;
  }

  private static pickKnown(c: any): Partial<DoodleConfig> {
    const o: any = {};
    if (!c || typeof c !== 'object') return o;
    for (const k of ['drawTime', 'guessTime', 'rounds', 'difficulty', 'scoringMode', 'drawingAssistance', 'customWords', 'useCustomWords', 'hintsEnabled']) {
      if (c[k] !== undefined) o[k] = c[k];
    }
    return o;
  }

  public static sanitizeCustomWords(words: any[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const w of words) {
      if (typeof w !== 'string') continue;
      const t = w.trim().replace(/\s+/g, ' ');
      if (!t || t.length > DOODLE_LIMITS.maxCustomWordLength) continue;
      const n = this.normalize(t);
      if (!n || seen.has(n)) continue; // unguessable (punctuation only) or duplicate
      seen.add(n);
      out.push(t);
      if (out.length >= DOODLE_LIMITS.maxCustomWords) break;
    }
    return out;
  }

  /**
   * Validates & normalises a stroke coming from a client. Returns null when invalid.
   */
  public static validateStroke(raw: any): DoodleStroke | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (!Array.isArray(raw.points) || raw.points.length < 1 || raw.points.length > DOODLE_LIMITS.maxPointsPerStroke) return null;
    if (typeof raw.color !== 'string' || !HEX_COLOR.test(raw.color)) return null;
    if (typeof raw.size !== 'number' || !Number.isFinite(raw.size)) return null;

    const points: { x: number; y: number }[] = [];
    for (const p of raw.points) {
      if (!p || typeof p !== 'object') return null;
      const x = p.x;
      const y = p.y;
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
      points.push({ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) });
    }
    const id = typeof raw.id === 'string' && raw.id.length > 0 && raw.id.length <= 64
      ? raw.id
      : `strk_${Date.now()}_${secureRandom().toString(36).substring(2, 8)}`;
    return {
      id,
      points,
      color: raw.color,
      size: Math.min(DOODLE_LIMITS.maxStrokeSize, Math.max(1, raw.size)),
      isEraser: raw.isEraser === true,
      timestamp: typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp) ? raw.timestamp : Date.now()
    };
  }

  /**
   * Can this stroke still be added to the canvas (count / total point budget)?
   */
  public static canAddStroke(state: DoodleGameState, stroke: DoodleStroke): boolean {
    if (state.strokes.length >= DOODLE_LIMITS.maxStrokes) return false;
    let total = stroke.points.length;
    for (const s of state.strokes) total += s.points.length;
    return total <= DOODLE_LIMITS.maxTotalPoints;
  }

  private static buildPool(config: DoodleConfig): { custom: WordItem[]; builtin: WordItem[]; allBuiltin: WordItem[] } {
    const seen = new Set<string>();
    const dedupe = (items: WordItem[]) => items.filter(w => {
      const k = w.word.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const custom: WordItem[] = [];
    if (config.useCustomWords && Array.isArray(config.customWords)) {
      for (const w of this.sanitizeCustomWords(config.customWords)) {
        custom.push(this.customWordItem(w));
      }
    }
    const customDeduped = dedupe(custom);
    const allBuiltin = dedupe([...DOODLE_WORDS]);
    const builtin = config.difficulty !== 'mixed' ? allBuiltin.filter(w => w.difficulty === config.difficulty) : allBuiltin;
    return { custom: customDeduped, builtin, allBuiltin };
  }

  public static customWordItem(word: string): WordItem {
    return {
      word,
      icon: 'sparkles',
      category: 'Custom',
      difficulty: 'medium',
      hint: `${this.normalize(word).length} letters`
    };
  }

  private static shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(secureRandom() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Selects 3 distinct word options for drawer choice. Custom words get priority slots, words already
   * used this game are only reused once every other word (of any difficulty) has been used.
   */
  public static getWordChoices(config: DoodleConfig, usedWords: Set<string> = new Set()): WordItem[] {
    const { custom, builtin, allBuiltin } = this.buildPool(config);
    const unused = (items: WordItem[]) => items.filter(w => !usedWords.has(w.word.toLowerCase()));

    const picked: WordItem[] = [];
    const has = (w: WordItem) => picked.some(p => p.word.toLowerCase() === w.word.toLowerCase());
    const take = (items: WordItem[], max: number) => {
      for (const w of this.shuffle(items)) {
        if (picked.length >= max) break;
        if (!has(w)) picked.push(w);
      }
    };

    take(unused(custom), Math.min(2, 3));
    take(unused(builtin), 3);
    take(unused(custom), 3);
    take(unused(allBuiltin), 3); // difficulty pool exhausted -> other difficulties before repeating
    take([...custom, ...builtin, ...allBuiltin], 3); // everything used: repeat as a last resort
    return this.shuffle(picked).slice(0, 3);
  }

  /**
   * Resolves a client-chosen word against the offered choices. Returns null if it was not offered.
   */
  public static resolveChosenWord(state: DoodleGameState, chosen: any): WordItem | null {
    if (typeof chosen !== 'string') return null;
    const target = chosen.trim().toLowerCase();
    if (!target || !Array.isArray(state.wordChoices)) return null;
    for (const c of state.wordChoices) {
      const w = typeof c === 'string' ? c : c?.word;
      if (typeof w !== 'string' || w.trim().toLowerCase() !== target) continue;
      const builtin = DOODLE_WORDS.find(d => d.word.toLowerCase() === w.trim().toLowerCase());
      if (builtin && (typeof c === 'string' || c.category !== 'Custom')) return builtin;
      return {
        ...this.customWordItem(w.trim()),
        category: typeof c === 'object' && c?.category ? String(c.category) : 'Custom'
      };
    }
    return null;
  }

  /**
   * Calculates points earned based on time taken. `secondsTaken` is scaled against `totalSeconds`
   * (the whole round: draw + guess) so thresholds are relative to the configured times.
   */
  public static calculatePoints(
    secondsTaken: number,
    scoringMode: DoodleScoringMode,
    hintUsed: boolean,
    totalSeconds: number = 60
  ): number {
    let base = 100;

    if (scoringMode !== 'fixed') {
      const total = totalSeconds > 0 ? totalSeconds : 60;
      const s = (Math.max(0, secondsTaken) / total) * 60;
      if (s <= 10) base = 100;
      else if (s <= 20) base = 90;
      else if (s <= 30) base = 75;
      else if (s <= 40) base = 60;
      else if (s <= 50) base = 40;
      else base = 25;
    }

    if (hintUsed) {
      base = Math.max(10, base - 50);
    }

    return base;
  }

  /**
   * Creates initial game state for a room
   */
  public static createInitialState(
    players: { userId: string; displayName: string }[],
    configInput: DoodleConfig = DEFAULT_DOODLE_CONFIG
  ): DoodleGameState {
    const config = this.sanitizeConfig(configInput, DEFAULT_DOODLE_CONFIG);
    const p1 = players[0]?.userId || 'p1';
    const p2 = players[1]?.userId || 'p2';

    const scores: Record<string, number> = {};
    const roleSelections: Record<string, 'drawer' | 'guesser' | null> = {};

    players.forEach(p => {
      scores[p.userId] = 0;
      roleSelections[p.userId] = null;
    });

    return {
      phase: 'LOBBY',
      config,
      round: 1,
      totalRounds: config.rounds,
      drawerUserId: p1,
      guesserUserId: p2,
      roleSelections,
      maskedWord: '',
      secretWordCategory: '',
      hint: null,
      hintAvailable: false,
      hintUsed: false,
      scores,
      timeRemaining: config.drawTime,
      strokes: [],
      guesses: [],
      roundWinnerUserId: null,
      roundWinnerDisplayName: null,
      roundPointsEarned: 0,
      roundHistory: [],
      finalWinnerUserId: null,
      finalWinnerDisplayName: null,
      statusMessage: 'Choose who draws first!'
    };
  }

  /**
   * Prepares round transition (countdown 3..2..1)
   */
  public static startRoundIntro(state: DoodleGameState, drawerId: string, guesserId: string): DoodleGameState {
    state.drawerUserId = drawerId;
    state.guesserUserId = guesserId;
    state.phase = 'ROUND_INTRO';
    state.strokes = [];
    state.guesses = [];
    state.secretWord = undefined;
    state.wordChoices = undefined;
    state.maskedWord = '';
    state.secretWordCategory = '';
    state.hint = null;
    state.hintAvailable = false;
    state.hintUsed = false;
    state.roundWinnerUserId = null;
    state.roundWinnerDisplayName = null;
    state.roundPointsEarned = 0;
    state.timeRemaining = 3; // 3-second countdown
    state.timeLeftSeconds = 3;
    state.currentRound = state.round;
    state.statusMessage = 'Get ready to draw!';
    return state;
  }

  /**
   * Advances to Word Choice for drawer
   */
  public static advanceToWordChoice(state: DoodleGameState): { state: DoodleGameState; choices: WordItem[] } {
    const usedWords = new Set(state.roundHistory.map(r => r.word.toLowerCase()));
    const choices = this.getWordChoices(state.config, usedWords);

    state.phase = 'WORD_CHOICE';
    state.wordChoices = choices.map(c => ({
      word: c.word,
      icon: c.icon,
      category: c.category,
      difficulty: c.difficulty
    }));
    state.timeRemaining = 30; // 30 seconds to pick word
    state.timeLeftSeconds = 30;
    state.statusMessage = 'Drawer is choosing a secret word...';

    return { state, choices };
  }

  /**
   * Starts drawing phase once word is chosen
   */
  public static startDrawing(state: DoodleGameState, wordItem: WordItem): DoodleGameState {
    state.phase = 'DRAWING';
    state.secretWord = wordItem.word;
    state.secretWordCategory = `${wordItem.category || 'General'}`;
    state.maskedWord = this.maskWord(wordItem.word);
    state.hint = wordItem.hint || 'Creative sketch';
    state.hintAvailable = false;
    state.hintUsed = false;
    state.wordChoices = undefined;
    state.timeRemaining = state.config.drawTime || 60;
    state.timeLeftSeconds = state.timeRemaining;
    state.currentRound = state.round;
    state.strokes = [];
    state.guesses = [];
    state.statusMessage = `Phase 1: Drawing Time (${state.timeRemaining}s) — Drawer is drawing live!`;
    return state;
  }

  /**
   * Advances from Drawing Phase to Guessing Phase
   */
  public static startGuessing(state: DoodleGameState): DoodleGameState {
    state.phase = 'GUESSING';
    state.timeRemaining = state.config.guessTime || 60;
    state.timeLeftSeconds = state.timeRemaining;
    state.hintAvailable = false;
    state.statusMessage = `Phase 2: Guessing Time (${state.timeRemaining}s) — Guess what was drawn!`;
    return state;
  }

  /**
   * Validates guess submission. `rejected` is set (and state untouched) when the guess is not acceptable.
   */
  public static submitGuess(
    state: DoodleGameState,
    userId: string,
    displayName: string,
    guessText: any
  ): {
    isCorrect: boolean;
    state: DoodleGameState;
    points: number;
    completed: boolean;
    rejected?: 'invalid' | 'empty' | 'not_guessing' | 'not_guesser' | 'duplicate' | 'too_many';
  } {
    const reject = (rejected: NonNullable<ReturnType<typeof DoodleDuelEngine.submitGuess>['rejected']>) =>
      ({ isCorrect: false, state, points: 0, completed: false, rejected });

    if ((state.phase !== 'DRAWING' && state.phase !== 'GUESSING') || !state.secretWord) return reject('not_guessing');
    if (userId !== state.guesserUserId || userId === state.drawerUserId) return reject('not_guesser');
    if (typeof guessText !== 'string') return reject('invalid');
    const text = guessText.trim().replace(/\s+/g, ' ').slice(0, DOODLE_LIMITS.maxGuessLength);
    if (!text) return reject('empty');
    const norm = this.normalize(text);
    if (!norm) return reject('empty');
    if (state.guesses.length >= DOODLE_LIMITS.maxGuessesPerRound) return reject('too_many');
    if (state.guesses.some(g => g.userId === userId && this.normalize(g.text) === norm)) return reject('duplicate');

    const isCorrect = this.checkGuess(text, state.secretWord);

    const guess: DoodleGuess = {
      id: `guess_${Date.now()}_${secureRandom().toString(36).substring(2, 6)}`,
      userId,
      displayName,
      text,
      guess: text,
      isCorrect,
      timestamp: Date.now()
    };

    state.guesses.push(guess);

    if (isCorrect) {
      const drawTime = state.config.drawTime || 60;
      const guessTime = state.config.guessTime || 60;
      const timeTaken = state.phase === 'GUESSING'
        ? drawTime + guessTime - state.timeRemaining
        : drawTime - state.timeRemaining;
      const elapsed = Math.max(1, timeTaken);
      const points = this.calculatePoints(elapsed, state.config.scoringMode, state.hintUsed, drawTime + guessTime);
      const drawerBonus = 50;
      guess.pointsAwarded = points;

      state.scores[userId] = (state.scores[userId] || 0) + points;
      if (state.drawerUserId) {
        state.scores[state.drawerUserId] = (state.scores[state.drawerUserId] || 0) + drawerBonus;
      }

      state.roundWinnerUserId = userId;
      state.roundWinnerDisplayName = displayName;
      state.roundPointsEarned = points;
      state.phase = 'ROUND_RESULT';
      state.hintAvailable = false;
      state.timeRemaining = 5;
      state.timeLeftSeconds = 5;
      state.statusMessage = `${displayName} guessed "${state.secretWord}" after ${elapsed}s! (+${points} pts)`;

      const roundSummary: DoodleRoundSummary = {
        round: state.round,
        roundNumber: state.round,
        word: state.secretWord,
        secretWord: state.secretWord,
        category: state.secretWordCategory,
        drawerUserId: state.drawerUserId,
        drawerName: state.drawerDisplayName || 'Drawer',
        drawerDisplayName: state.drawerDisplayName || 'Drawer',
        drawerPoints: drawerBonus,
        guesserUserId: state.guesserUserId,
        guesserName: state.guesserDisplayName || displayName || 'Guesser',
        guesserDisplayName: state.guesserDisplayName || displayName || 'Guesser',
        guesserPoints: points,
        guessedCorrectly: true,
        guessed: true,
        timeTaken: elapsed,
        timeTakenSeconds: elapsed,
        pointsEarned: points
      };
      state.roundHistory.push(roundSummary);
      state.lastRoundSummary = roundSummary;

      return { isCorrect: true, state, points, completed: true };
    }

    return { isCorrect: false, state, points: 0, completed: false };
  }

  /**
   * Handles timer tick
   */
  public static tick(state: DoodleGameState): {
    state: DoodleGameState;
    phaseChanged: boolean;
    isTimeUp: boolean;
  } {
    if (state.phase === 'LOBBY' || state.phase === 'ROLE_SELECTION' || state.phase === 'FINISHED') {
      return { state, phaseChanged: false, isTimeUp: false };
    }

    state.timeRemaining = Math.max(0, state.timeRemaining - 1);
    state.timeLeftSeconds = state.timeRemaining;

    // Hint becomes available once half of the guess time has elapsed (guessing phase only)
    if (
      state.phase === 'GUESSING' &&
      !state.hintAvailable &&
      !state.hintUsed &&
      state.config.hintsEnabled !== false &&
      state.timeRemaining > 0 &&
      state.timeRemaining <= Math.floor((state.config.guessTime || 60) / 2)
    ) {
      state.hintAvailable = true;
    }

    if (state.timeRemaining <= 0) {
      if (state.phase === 'ROUND_INTRO') {
        this.advanceToWordChoice(state);
        return { state, phaseChanged: true, isTimeUp: false };
      }

      if (state.phase === 'WORD_CHOICE') {
        // Drawer didn't pick in time -> auto-pick the first offered option (keeps custom metadata)
        const firstChoice = state.wordChoices && state.wordChoices[0];
        const first = typeof firstChoice === 'string' ? firstChoice : firstChoice?.word;
        const wordItem = this.resolveChosenWord(state, first) || DOODLE_WORDS[0];
        this.startDrawing(state, wordItem);
        return { state, phaseChanged: true, isTimeUp: false };
      }

      if (state.phase === 'DRAWING') {
        this.startGuessing(state);
        return { state, phaseChanged: true, isTimeUp: false };
      }

      if (state.phase === 'GUESSING') {
        state.phase = 'ROUND_RESULT';
        state.hintAvailable = false;
        state.timeRemaining = 5;
        state.timeLeftSeconds = 5;
        state.roundWinnerUserId = null;
        state.roundWinnerDisplayName = null;
        state.roundPointsEarned = 0;
        state.statusMessage = `Time's up! The word was "${state.secretWord}"`;

        const total = (state.config.drawTime || 60) + (state.config.guessTime || 60);
        const summary: DoodleRoundSummary = {
          round: state.round,
          roundNumber: state.round,
          word: state.secretWord || '',
          secretWord: state.secretWord || '',
          category: state.secretWordCategory,
          drawerUserId: state.drawerUserId,
          drawerName: state.drawerDisplayName || 'Drawer',
          drawerDisplayName: state.drawerDisplayName || 'Drawer',
          drawerPoints: 0,
          guesserUserId: state.guesserUserId,
          guesserName: state.guesserDisplayName || 'Guesser',
          guesserDisplayName: state.guesserDisplayName || 'Guesser',
          guesserPoints: 0,
          guessedCorrectly: false,
          guessed: false,
          timeTaken: total,
          timeTakenSeconds: total,
          pointsEarned: 0
        };
        state.roundHistory.push(summary);
        state.lastRoundSummary = summary;
        return { state, phaseChanged: true, isTimeUp: true };
      }

      if (state.phase === 'ROUND_RESULT') {
        this.advanceToNextRound(state);
        return { state, phaseChanged: true, isTimeUp: false };
      }
    }

    return { state, phaseChanged: false, isTimeUp: false };
  }

  /**
   * Advances to next round with automatic role swap
   */
  public static advanceToNextRound(state: DoodleGameState): DoodleGameState {
    if (state.round >= state.totalRounds) {
      state.phase = 'FINISHED';
      state.hintAvailable = false;

      // Winner = unique top score; a tie has no winner (null)
      const entries = Object.entries(state.scores);
      const top = entries.reduce((m, [, sc]) => Math.max(m, sc), -Infinity);
      const leaders = entries.filter(([, sc]) => sc === top).map(([uid]) => uid);
      if (leaders.length === 1) {
        const uid = leaders[0];
        state.finalWinnerUserId = uid;
        state.finalWinnerDisplayName =
          uid === state.drawerUserId ? (state.drawerDisplayName || null)
            : uid === state.guesserUserId ? (state.guesserDisplayName || null)
              : null;
        state.statusMessage = 'Doodle Duel Complete!';
      } else {
        state.finalWinnerUserId = null;
        state.finalWinnerDisplayName = null;
        state.statusMessage = "Doodle Duel Complete! It's a tie!";
      }
      return state;
    }

    // Automatically swap roles!
    const nextRound = state.round + 1;
    const nextDrawerId = state.guesserUserId;
    const nextGuesserId = state.drawerUserId;
    const nextDrawerName = state.guesserDisplayName;
    const nextGuesserName = state.drawerDisplayName;

    state.round = nextRound;
    this.startRoundIntro(state, nextDrawerId, nextGuesserId);
    state.drawerDisplayName = nextDrawerName;
    state.guesserDisplayName = nextGuesserName;
    return state;
  }

  /**
   * Strips secret word for non-drawers (kept for compatibility, prefer publicStateFor)
   */
  public static sanitizeStateForGuesser(state: DoodleGameState): DoodleGameState {
    const copy = { ...state };
    delete copy.secretWord;
    delete copy.wordChoices;
    if (!copy.hintUsed) {
      delete copy.hint;
    }
    return copy;
  }

  /**
   * The ONLY safe way to serialise doodle state for a client. Everybody except the current drawer
   * (spectators and the guesser included) gets no secret word / word choices, and no hint text until
   * the hint is used. The full state is shown once the round result / game over is reached.
   * Pure: never mutates `state`.
   */
  public static publicStateFor(state: DoodleGameState, viewerId: string | null | undefined): DoodleGameState {
    const copy: DoodleGameState = { ...state };
    copy.currentRound = state.round;
    copy.timeLeftSeconds = state.timeRemaining;
    copy.category = state.secretWordCategory;
    copy.currentGuesses = state.guesses;

    const isDrawer = !!viewerId && viewerId === state.drawerUserId;
    const reveal = state.phase === 'ROUND_RESULT' || state.phase === 'FINISHED';
    if (!isDrawer && !reveal) {
      delete copy.secretWord;
      delete copy.wordChoices;
      if (!state.hintUsed) copy.hint = null;
    }
    return copy;
  }
}
