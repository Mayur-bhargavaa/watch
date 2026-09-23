import {
  DoodleConfig,
  DoodleGameState,
  DoodleDifficulty,
  DoodleScoringMode,
  DoodleStroke,
  DoodleGuess,
  DoodleRoundSummary
} from '@synccinema/common';

export interface WordItem {
  word: string;
  emoji: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  hint: string;
  aliases?: string[];
}

export const DOODLE_WORDS: WordItem[] = [
  // Animals
  { word: 'Elephant', emoji: '🐘', category: 'Animals', difficulty: 'easy', hint: 'A large animal with a long trunk' },
  { word: 'Lion', emoji: '🦁', category: 'Animals', difficulty: 'easy', hint: 'The king of the jungle with a mane' },
  { word: 'Monkey', emoji: '🐒', category: 'Animals', difficulty: 'easy', hint: 'Loves bananas and swings from trees' },
  { word: 'Dolphin', emoji: '🐬', category: 'Animals', difficulty: 'medium', hint: 'A smart marine mammal known for jumping' },
  { word: 'Giraffe', emoji: '🦒', category: 'Animals', difficulty: 'easy', hint: 'The tallest animal with a very long neck' },
  { word: 'Penguin', emoji: '🐧', category: 'Animals', difficulty: 'easy', hint: 'A flightless bird dressed in a tuxedo' },
  { word: 'Kangaroo', emoji: '🦘', category: 'Animals', difficulty: 'medium', hint: 'Hops around with a baby pouch' },
  { word: 'Panda', emoji: '🐼', category: 'Animals', difficulty: 'easy', hint: 'Black and white bear that eats bamboo' },
  { word: 'Chameleon', emoji: '🦎', category: 'Animals', difficulty: 'hard', hint: 'A lizard that changes colors to blend in' },
  { word: 'Butterfly', emoji: '🦋', category: 'Animals', difficulty: 'easy', hint: 'Colorful insect that starts as a caterpillar' },

  // Food
  { word: 'Pizza', emoji: '🍕', category: 'Food', difficulty: 'easy', hint: 'Italian triangular slice with melted cheese' },
  { word: 'Burger', emoji: '🍔', category: 'Food', difficulty: 'easy', hint: 'Patty between sesame buns with lettuce' },
  { word: 'Ice Cream', emoji: '🍦', category: 'Food', difficulty: 'easy', hint: 'Cold sweet dessert on a waffle cone' },
  { word: 'Sushi', emoji: '🍣', category: 'Food', difficulty: 'medium', hint: 'Japanese rice roll wrapped in seaweed' },
  { word: 'Taco', emoji: '🌮', category: 'Food', difficulty: 'easy', hint: 'Folded Mexican tortilla with savory filling' },
  { word: 'Pancake', emoji: '🥞', category: 'Food', difficulty: 'easy', hint: 'Flat golden breakfast cake with syrup' },
  { word: 'Donut', emoji: '🍩', category: 'Food', difficulty: 'easy', hint: 'Fried dough ring with colorful sprinkles' },
  { word: 'Popcorn', emoji: '🍿', category: 'Food', difficulty: 'easy', hint: 'Puffed corn snack enjoyed at movie cinemas' },
  { word: 'Watermelon', emoji: '🍉', category: 'Food', difficulty: 'easy', hint: 'Big green fruit with red flesh and black seeds' },
  { word: 'Croissant', emoji: '🥐', category: 'Food', difficulty: 'hard', hint: 'Flaky crescent-shaped French pastry' },

  // Movies
  { word: 'Interstellar', emoji: '🎬', category: 'Movies', difficulty: 'medium', hint: 'Sci-fi epic traveling through a wormhole and black hole' },
  { word: 'Titanic', emoji: '🚢', category: 'Movies', difficulty: 'easy', hint: 'Tragic romance ship that hits an iceberg' },
  { word: 'Inception', emoji: '🌀', category: 'Movies', difficulty: 'hard', hint: 'Dreams within dreams and a spinning totem top' },
  { word: 'Jurassic Park', emoji: '🦖', category: 'Movies', difficulty: 'medium', hint: 'Theme park with cloned dinosaurs running loose' },
  { word: 'The Matrix', emoji: '🕶️', category: 'Movies', difficulty: 'medium', hint: 'Green digital rain, black sunglasses, red or blue pill' },
  { word: 'Harry Potter', emoji: '⚡', category: 'Movies', difficulty: 'easy', hint: 'Wizard with round glasses and lightning scar' },
  { word: 'Spider-Man', emoji: '🕷️', category: 'Movies', difficulty: 'easy', hint: 'Web-slinging superhero in red and blue suit' },
  { word: 'Batman', emoji: '🦇', category: 'Movies', difficulty: 'easy', hint: 'Caped crusader protecting Gotham City with bat signal' },
  { word: 'Star Wars', emoji: '⚔️', category: 'Movies', difficulty: 'medium', hint: 'Galactic saga with glowing lightsabers and Jedi' },
  { word: 'Avatar', emoji: '🌿', category: 'Movies', difficulty: 'medium', hint: 'Blue humanoid Na\'vi living on the moon Pandora' },

  // Games
  { word: 'Ludo', emoji: '🎲', category: 'Games', difficulty: 'easy', hint: 'Board game with 4 colored home yards and a die' },
  { word: 'Minecraft', emoji: '⛏️', category: 'Games', difficulty: 'easy', hint: 'Blocky voxel sandbox where you mine and craft' },
  { word: 'Chess', emoji: '♟️', category: 'Games', difficulty: 'easy', hint: 'Checkmate game with kings, queens, and pawns' },
  { word: 'Pac-Man', emoji: '🟡', category: 'Games', difficulty: 'easy', hint: 'Yellow circle eating dots while running from ghosts' },
  { word: 'Tetris', emoji: '🧱', category: 'Games', difficulty: 'easy', hint: 'Falling geometric blocks cleared in lines' },
  { word: 'Fortnite', emoji: '🪂', category: 'Games', difficulty: 'medium', hint: 'Battle royale with battle bus and pickaxe' },
  { word: 'Bowling', emoji: '🎳', category: 'Games', difficulty: 'easy', hint: 'Rolling a heavy ball to knock down 10 pins' },
  { word: 'Billiards', emoji: '🎱', category: 'Games', difficulty: 'medium', hint: 'Hitting pool balls into pockets with a cue stick' },

  // Objects
  { word: 'Rocket', emoji: '🚀', category: 'Objects', difficulty: 'easy', hint: 'Spacecraft blasting off with fiery exhaust' },
  { word: 'Phone', emoji: '📱', category: 'Objects', difficulty: 'easy', hint: 'Touchscreen device you carry in your pocket' },
  { word: 'Car', emoji: '🚗', category: 'Objects', difficulty: 'easy', hint: 'Four-wheeled automobile on the road' },
  { word: 'Guitar', emoji: '🎸', category: 'Objects', difficulty: 'easy', hint: 'Musical instrument with strings and a fretboard' },
  { word: 'Bicycle', emoji: '🚲', category: 'Objects', difficulty: 'easy', hint: 'Two wheels powered by pedals and handlebars' },
  { word: 'Telescope', emoji: '🔭', category: 'Objects', difficulty: 'medium', hint: 'Optical tube used for stargazing at night' },
  { word: 'Submarine', emoji: '🚤', category: 'Objects', difficulty: 'medium', hint: 'Underwater vessel with a periscope' },
  { word: 'Hot Air Balloon', emoji: '🎈', category: 'Objects', difficulty: 'medium', hint: 'Giant floating bag of heated air carrying a wicker basket' },

  // Actions
  { word: 'Running', emoji: '🏃', category: 'Actions', difficulty: 'easy', hint: 'Moving rapidly on foot with speed' },
  { word: 'Sleeping', emoji: '😴', category: 'Actions', difficulty: 'easy', hint: 'Resting in bed with closed eyes and snoring' },
  { word: 'Swimming', emoji: '🏊', category: 'Actions', difficulty: 'easy', hint: 'Propelling through water in a pool' },
  { word: 'Cooking', emoji: '🍳', category: 'Actions', difficulty: 'easy', hint: 'Preparing food in a hot pan or pot' },
  { word: 'Fishing', emoji: '🎣', category: 'Actions', difficulty: 'medium', hint: 'Catching fish with a rod, hook, and line' },
  { word: 'Juggling', emoji: '🤹', category: 'Actions', difficulty: 'hard', hint: 'Tossing multiple balls in the air continuously' },

  // Technology
  { word: 'Robot', emoji: '🤖', category: 'Technology', difficulty: 'easy', hint: 'Mechanical humanoid made of metal and circuits' },
  { word: 'Satellite', emoji: '🛰️', category: 'Technology', difficulty: 'medium', hint: 'Orbital machine with solar panels transmitting signals' },
  { word: 'VR Headset', emoji: '🥽', category: 'Technology', difficulty: 'medium', hint: 'Goggles worn on eyes for virtual reality immersion' },
  { word: 'Drone', emoji: '🚁', category: 'Technology', difficulty: 'easy', hint: 'Remote-controlled flyer with 4 spinning propellers' },
  { word: 'Space Station', emoji: '🌌', category: 'Technology', difficulty: 'hard', hint: 'Large artificial habitat orbiting Earth in space' },

  // Places
  { word: 'Eiffel Tower', emoji: '🗼', category: 'Places', difficulty: 'easy', hint: 'Famous iron landmark in Paris, France' },
  { word: 'Pyramids', emoji: '🏛️', category: 'Places', difficulty: 'easy', hint: 'Ancient triangular stone monuments in Egypt' },
  { word: 'Volcano', emoji: '🌋', category: 'Places', difficulty: 'easy', hint: 'Mountain with a crater that erupts hot lava' },
  { word: 'Lighthouse', emoji: '🚨', category: 'Places', difficulty: 'medium', hint: 'Coastal tower guiding ships with a rotating beam' },
  { word: 'Roller Coaster', emoji: '🎢', category: 'Places', difficulty: 'medium', hint: 'Amusement park ride with loops and steep drops' },

  // Funny & Random
  { word: 'Alien', emoji: '👽', category: 'Funny', difficulty: 'easy', hint: 'Green extraterrestrial creature with big black eyes' },
  { word: 'Flying Pig', emoji: '🐷', category: 'Funny', difficulty: 'medium', hint: 'An impossible farm animal with angel wings' },
  { word: 'Banana Peel', emoji: '🍌', category: 'Funny', difficulty: 'easy', hint: 'Slippery yellow fruit skin left on the floor' },
  { word: 'Treasure Chest', emoji: '🪙', category: 'Random', difficulty: 'easy', hint: 'Wooden trunk full of gold coins and pirate loot' },
  { word: 'Campfire', emoji: '🔥', category: 'Random', difficulty: 'easy', hint: 'Outdoor wood fire for roasting marshmallows' },
  { word: 'Rainbow', emoji: '🌈', category: 'Random', difficulty: 'easy', hint: 'Arc of seven colorful light bands after rain' }
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

export class DoodleDuelEngine {
  /**
   * Normalizes guess string for strict, fair comparison
   */
  public static normalize(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\s\-_'".!?,;:]+/g, '') // strip whitespace, punctuation, hyphens
      .replace(/[^\w]/g, ''); // keep only alphanumerics
  }

  /**
   * Checks if user guess matches target word or any aliases
   */
  public static checkGuess(guess: string, targetWord: string, aliases: string[] = []): boolean {
    const normGuess = this.normalize(guess);
    if (!normGuess) return false;

    if (normGuess === this.normalize(targetWord)) return true;

    for (const alias of aliases) {
      if (normGuess === this.normalize(alias)) return true;
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
   * Selects 3 distinct word options for drawer choice
   */
  public static getWordChoices(config: DoodleConfig, usedWords: Set<string> = new Set()): WordItem[] {
    let pool = [...DOODLE_WORDS];

    // Filter by difficulty if not mixed
    if (config.difficulty !== 'mixed') {
      pool = pool.filter(w => w.difficulty === config.difficulty);
    }

    // Append custom words if enabled
    if (config.useCustomWords && config.customWords.length > 0) {
      const customItems: WordItem[] = config.customWords.map(w => ({
        word: w,
        emoji: '✨',
        category: 'Custom',
        difficulty: 'medium',
        hint: 'Custom user word'
      }));
      pool = [...customItems, ...pool];
    }

    // Filter out already used words if pool allows
    const available = pool.filter(w => !usedWords.has(w.word.toLowerCase()));
    const finalPool = available.length >= 3 ? available : pool;

    // Shuffle and pick 3
    const shuffled = [...finalPool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, 3);
  }

  /**
   * Calculates points earned based on time taken (0-60s)
   */
  public static calculatePoints(secondsTaken: number, scoringMode: DoodleScoringMode, hintUsed: boolean): number {
    let base = 100;

    if (scoringMode === 'fixed') {
      base = 100;
    } else {
      if (secondsTaken <= 10) base = 100;
      else if (secondsTaken <= 20) base = 90;
      else if (secondsTaken <= 30) base = 75;
      else if (secondsTaken <= 40) base = 60;
      else if (secondsTaken <= 50) base = 40;
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
    config: DoodleConfig = DEFAULT_DOODLE_CONFIG
  ): DoodleGameState {
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
      totalRounds: config.rounds || 6,
      drawerUserId: p1,
      guesserUserId: p2,
      roleSelections,
      maskedWord: '',
      secretWordCategory: '',
      hint: null,
      hintAvailable: false,
      hintUsed: false,
      scores,
      timeRemaining: config.drawTime || 60,
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
      word: `${c.emoji} ${c.word}`,
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
    state.secretWordCategory = `${wordItem.emoji || '🎨'} ${wordItem.category || 'General'}`;
    state.maskedWord = this.maskWord(wordItem.word);
    state.hint = wordItem.hint || 'Creative sketch';
    state.hintAvailable = false;
    state.hintUsed = false;
    state.timeRemaining = state.config.drawTime || 60;
    state.timeLeftSeconds = state.timeRemaining;
    state.currentRound = state.round;
    state.strokes = [];
    state.guesses = [];
    state.statusMessage = 'Phase 1: Drawing Time (60s) — Drawer is drawing live!';
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
    state.statusMessage = 'Phase 2: Guessing Time (60s) — Guess what was drawn!';
    return state;
  }

  /**
   * Validates guess submission
   */
  public static submitGuess(
    state: DoodleGameState,
    userId: string,
    displayName: string,
    guessText: string
  ): {
    isCorrect: boolean;
    state: DoodleGameState;
    points: number;
    completed: boolean;
  } {
    if ((state.phase !== 'DRAWING' && state.phase !== 'GUESSING') || !state.secretWord) {
      return { isCorrect: false, state, points: 0, completed: false };
    }

    const isCorrect = this.checkGuess(guessText, state.secretWord);

    const guess: DoodleGuess = {
      id: `guess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      displayName,
      text: guessText.trim(),
      isCorrect,
      timestamp: Date.now()
    };

    state.guesses.push(guess);

    if (isCorrect) {
      const totalPhaseTime = state.phase === 'GUESSING' ? (state.config.guessTime || 60) : (state.config.drawTime || 60);
      const timeTaken = Math.max(1, totalPhaseTime - state.timeRemaining);
      const points = this.calculatePoints(timeTaken, state.config.scoringMode, state.hintUsed);
      const drawerBonus = 50;

      state.scores[userId] = (state.scores[userId] || 0) + points;
      if (state.drawerUserId) {
        state.scores[state.drawerUserId] = (state.scores[state.drawerUserId] || 0) + drawerBonus;
      }

      state.roundWinnerUserId = userId;
      state.roundWinnerDisplayName = displayName;
      state.roundPointsEarned = points;
      state.phase = 'ROUND_RESULT';
      state.timeRemaining = 5;
      state.timeLeftSeconds = 5;
      state.statusMessage = `🎉 ${displayName} guessed "${state.secretWord}" in ${timeTaken}s! (+${points} pts)`;

      // Record round summary with all aliases so frontend never fails
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
        timeTaken,
        timeTakenSeconds: timeTaken,
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
    if (state.phase === 'LOBBY' || state.phase === 'FINISHED') {
      return { state, phaseChanged: false, isTimeUp: false };
    }

    state.timeRemaining = Math.max(0, state.timeRemaining - 1);
    state.timeLeftSeconds = state.timeRemaining;

    // Check hint availability in guessing phase after 30 seconds
    if (state.phase === 'GUESSING' && !state.hintAvailable && state.timeRemaining <= (state.config.guessTime - 30)) {
      state.hintAvailable = true;
    }

    if (state.timeRemaining <= 0) {
      if (state.phase === 'ROUND_INTRO') {
        // Countdown finished -> go to word choice
        this.advanceToWordChoice(state);
        return { state, phaseChanged: true, isTimeUp: false };
      }

      if (state.phase === 'WORD_CHOICE') {
        // Drawer didn't pick word in time -> pick first option automatically
        const firstChoice = state.wordChoices && state.wordChoices[0];
        let wordStr = 'Rocket';
        if (typeof firstChoice === 'string') {
          wordStr = firstChoice;
        } else if (firstChoice && typeof firstChoice === 'object' && (firstChoice as any).word) {
          wordStr = (firstChoice as any).word;
        }
        const rawWord = wordStr.replace(/^[^\w\s]+\s*/, '').trim();
        const wordItem = DOODLE_WORDS.find(w => w.word.toLowerCase() === rawWord.toLowerCase()) || {
          word: rawWord || 'Rocket',
          emoji: '🚀',
          category: 'Objects',
          difficulty: 'easy' as const,
          hint: 'Spacecraft'
        };
        this.startDrawing(state, wordItem);
        return { state, phaseChanged: true, isTimeUp: false };
      }

      if (state.phase === 'DRAWING') {
        // Phase 1 (Drawing) ends after 60s! Transition directly to Phase 2 (Guessing, 60s)!
        this.startGuessing(state);
        return { state, phaseChanged: true, isTimeUp: false };
      }

      if (state.phase === 'GUESSING') {
        // Phase 2 (Guessing) timer expired without correct guess -> Round Result
        state.phase = 'ROUND_RESULT';
        state.timeRemaining = 5;
        state.timeLeftSeconds = 5;
        state.roundWinnerUserId = null;
        state.roundWinnerDisplayName = null;
        state.roundPointsEarned = 0;
        state.statusMessage = `Time's up! The word was "${state.secretWord}"`;

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
          timeTaken: state.config.guessTime || 60,
          timeTakenSeconds: state.config.guessTime || 60,
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
      // Game Complete!
      state.phase = 'FINISHED';

      let topScore = -1;
      let topUser: string | null = null;
      Object.entries(state.scores).forEach(([uid, sc]) => {
        if (sc > topScore) {
          topScore = sc;
          topUser = uid;
        }
      });

      state.finalWinnerUserId = topUser;
      state.statusMessage = 'Doodle Duel Complete!';
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
   * Strips secret word from state for guesser
   */
  public static sanitizeStateForGuesser(state: DoodleGameState): DoodleGameState {
    const copy = { ...state };
    // MASK secret word and word choices
    delete copy.secretWord;
    delete copy.wordChoices;
    if (!copy.hintUsed) {
      delete copy.hint;
    }
    return copy;
  }
}
