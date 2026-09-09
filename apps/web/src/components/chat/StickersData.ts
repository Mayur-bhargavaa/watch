export interface StickerItem {
  id: string;
  name: string;
  category:
    | 'bubu_dudu'
    | 'milk_mocha'
    | 'peach_goma'
    | 'capybara'
    | 'cat_memes'
    | 'genz'
    | 'cinema'
    | 'romance';
  gifUrl?: string; // High-res transparent animated Giphy GIF URL
  webpUrl?: string;
  emoji?: string;
  tagline: string;
  tags: string[];
  bgGradient: string;
  borderColor: string;
  textColor: string;
}

export const STICKER_CATEGORIES = [
  { id: 'all', label: 'All', icon: '✨' },
  { id: 'bubu_dudu', label: 'Bubu & Dudu', icon: '🐼' },
  { id: 'milk_mocha', label: 'Milk & Mocha', icon: '🐻' },
  { id: 'peach_goma', label: 'Peach & Goma', icon: '🐱' },
  { id: 'capybara', label: 'Capybara', icon: '🦫' },
  { id: 'cat_memes', label: 'Cat Memes', icon: '😹' },
  { id: 'genz', label: 'Gen Z', icon: '💅' },
  { id: 'cinema', label: 'Cinema', icon: '🍿' },
  { id: 'romance', label: 'Romance', icon: '❤️' }
] as const;

export const STICKER_PACK: StickerItem[] = [
  // ==========================================
  // 1. BUBU & DUDU (Panda & Bear Couple)
  // ==========================================
  {
    id: 'bubu_dance',
    name: 'Bubu Dudu Dance',
    category: 'bubu_dudu',
    gifUrl: 'https://media4.giphy.com/media/Pw4DoWaNHDj8YVCWtu/giphy.gif',
    emoji: '🐼',
    tagline: 'HAPPY DANCE!',
    tags: ['bubu', 'dudu', 'dance', 'happy', 'yay', 'couple', 'bounce', 'cute'],
    bgGradient: 'from-amber-500/30 via-rose-500/20 to-pink-600/30',
    borderColor: 'border-rose-400/50',
    textColor: 'text-rose-200'
  },
  {
    id: 'bubu_kiss',
    name: 'Bubu Kiss Dudu',
    category: 'bubu_dudu',
    gifUrl: 'https://media2.giphy.com/media/fX5NLVCyAnWyGsERta/giphy.gif',
    emoji: '💋',
    tagline: 'MWAHH! ❤️',
    tags: ['bubu', 'dudu', 'kiss', 'muah', 'love', 'sweet', 'couple'],
    bgGradient: 'from-pink-500/30 via-rose-600/20 to-red-500/30',
    borderColor: 'border-pink-400/50',
    textColor: 'text-pink-200'
  },
  {
    id: 'bubu_hug',
    name: 'Bubu Warm Bear Hug',
    category: 'bubu_dudu',
    gifUrl: 'https://media3.giphy.com/media/GhUy4fOxwX1YGyIgEJ/giphy.gif',
    emoji: '🫂',
    tagline: 'TIGHT HUG ❤️',
    tags: ['bubu', 'dudu', 'hug', 'love', 'cuddle', 'warm', 'comfort'],
    bgGradient: 'from-rose-500/30 via-orange-500/20 to-amber-600/30',
    borderColor: 'border-rose-400/50',
    textColor: 'text-rose-200'
  },
  {
    id: 'bubu_headpat',
    name: 'Bubu Head Pat',
    category: 'bubu_dudu',
    gifUrl: 'https://media3.giphy.com/media/6FfOKVchlToDnqtd00/giphy.gif',
    emoji: '🐾',
    tagline: 'GOOD JOB! 🐾',
    tags: ['bubu', 'dudu', 'pat', 'comfort', 'cute', 'good boy', 'sweet'],
    bgGradient: 'from-yellow-400/30 via-amber-500/20 to-orange-600/30',
    borderColor: 'border-amber-400/50',
    textColor: 'text-amber-200'
  },
  {
    id: 'bubu_loveheart',
    name: 'Bubu Big Heart',
    category: 'bubu_dudu',
    gifUrl: 'https://media4.giphy.com/media/ZO6uFYmEKnPWUQQsf7/giphy.gif',
    emoji: '💖',
    tagline: 'I LOVE YOU',
    tags: ['bubu', 'dudu', 'heart', 'love', 'forever', 'ily', 'sweet'],
    bgGradient: 'from-rose-600/30 via-pink-600/20 to-red-600/30',
    borderColor: 'border-rose-400/50',
    textColor: 'text-rose-200'
  },
  {
    id: 'bubu_running',
    name: 'Bubu Zooming In',
    category: 'bubu_dudu',
    gifUrl: 'https://media3.giphy.com/media/RKq8Lhors1hVHHAsdl/giphy.gif',
    emoji: '🏃',
    tagline: 'ON MY WAY! 🏃',
    tags: ['bubu', 'dudu', 'run', 'zoom', 'coming', 'fast', 'excited'],
    bgGradient: 'from-cyan-500/30 via-blue-600/20 to-indigo-600/30',
    borderColor: 'border-cyan-400/50',
    textColor: 'text-cyan-200'
  },
  {
    id: 'bubu_crying',
    name: 'Bubu Cry Baby',
    category: 'bubu_dudu',
    gifUrl: 'https://media2.giphy.com/media/ccy51ucWzDJwiHTP0I/giphy.gif',
    emoji: '🥺',
    tagline: 'HUHUHU 🥺',
    tags: ['bubu', 'dudu', 'cry', 'sad', 'comfort', 'tears', 'plead'],
    bgGradient: 'from-blue-500/30 via-cyan-600/20 to-indigo-600/30',
    borderColor: 'border-blue-400/50',
    textColor: 'text-blue-200'
  },
  {
    id: 'bubu_snacks',
    name: 'Bubu Eating Snacks',
    category: 'bubu_dudu',
    gifUrl: 'https://media1.giphy.com/media/1NMk54KqDCy7VLCbe7/giphy.gif',
    emoji: '🍿',
    tagline: 'NOM NOM 🍿',
    tags: ['bubu', 'dudu', 'eat', 'food', 'snack', 'popcorn', 'nom', 'hungry'],
    bgGradient: 'from-amber-400/30 via-yellow-500/20 to-orange-600/30',
    borderColor: 'border-amber-400/50',
    textColor: 'text-amber-200'
  },
  {
    id: 'bubu_cheeks',
    name: 'Dudu Cheek Squish',
    category: 'bubu_dudu',
    gifUrl: 'https://media0.giphy.com/media/AVarCftTBximdfi2sQ/giphy.gif',
    emoji: '🐻',
    tagline: 'SQUISHY CHEEKS',
    tags: ['bubu', 'dudu', 'cheek', 'pinch', 'squish', 'cute', 'soft'],
    bgGradient: 'from-rose-400/30 via-amber-500/20 to-pink-600/30',
    borderColor: 'border-rose-400/50',
    textColor: 'text-rose-200'
  },
  {
    id: 'bubu_angry',
    name: 'Cute Angry Pout',
    category: 'bubu_dudu',
    gifUrl: 'https://media1.giphy.com/media/vsOs4PeQFTJB4vzuPk/giphy.gif',
    emoji: '😤',
    tagline: 'HMPH! 😤',
    tags: ['bubu', 'dudu', 'angry', 'mad', 'pout', 'grumpy', 'cute'],
    bgGradient: 'from-red-500/30 via-orange-500/20 to-rose-600/30',
    borderColor: 'border-red-400/50',
    textColor: 'text-red-200'
  },
  {
    id: 'bubu_sleep',
    name: 'Sleepy Under Blanket',
    category: 'bubu_dudu',
    gifUrl: 'https://media4.giphy.com/media/KmqRTBbPvTRkvFOwxa/giphy.gif',
    emoji: '💤',
    tagline: 'SLEEPY ZZZ',
    tags: ['bubu', 'dudu', 'sleep', 'bed', 'night', 'tired', 'zzz'],
    bgGradient: 'from-indigo-600/30 via-purple-700/20 to-blue-900/30',
    borderColor: 'border-indigo-400/50',
    textColor: 'text-indigo-200'
  },
  {
    id: 'bubu_wave',
    name: 'Wave Hello',
    category: 'bubu_dudu',
    gifUrl: 'https://media2.giphy.com/media/WRitVHJJFMii9yowCB/giphy.gif',
    emoji: '👋',
    tagline: 'HEYYY THERE 👋',
    tags: ['bubu', 'dudu', 'hello', 'hi', 'wave', 'greet', 'welcome'],
    bgGradient: 'from-emerald-500/30 via-teal-600/20 to-cyan-600/30',
    borderColor: 'border-emerald-400/50',
    textColor: 'text-emerald-200'
  },

  // ==========================================
  // 2. MILK & MOCHA BEARS
  // ==========================================
  {
    id: 'mocha_hug',
    name: 'Milk & Mocha Hug',
    category: 'milk_mocha',
    gifUrl: 'https://media3.giphy.com/media/fvN5KrNcKKUyX7hNIA/giphy.gif',
    emoji: '🧸',
    tagline: 'BEST HUG EVER',
    tags: ['milk', 'mocha', 'bear', 'hug', 'love', 'couple', 'cuddle'],
    bgGradient: 'from-amber-400/30 via-orange-500/20 to-rose-500/30',
    borderColor: 'border-amber-400/50',
    textColor: 'text-amber-200'
  },
  {
    id: 'mocha_recharge',
    name: 'Charging Battery',
    category: 'milk_mocha',
    gifUrl: 'https://media4.giphy.com/media/kfRKF0iqA8jyDqq1nH/giphy.gif',
    emoji: '⚡',
    tagline: 'RECHARGING ⚡',
    tags: ['milk', 'mocha', 'battery', 'tired', 'recharge', 'sleep', 'rest'],
    bgGradient: 'from-yellow-500/30 via-amber-600/20 to-red-500/30',
    borderColor: 'border-yellow-400/50',
    textColor: 'text-yellow-200'
  },
  {
    id: 'mocha_kiss',
    name: 'Sweet Mocha Kiss',
    category: 'milk_mocha',
    gifUrl: 'https://media4.giphy.com/media/JRsQiAN79bPWUv43Ko/giphy.gif',
    emoji: '🥰',
    tagline: 'SO SWEET 🥰',
    tags: ['milk', 'mocha', 'kiss', 'love', 'sweet', 'blush'],
    bgGradient: 'from-pink-500/30 via-rose-500/20 to-red-500/30',
    borderColor: 'border-pink-400/50',
    textColor: 'text-pink-200'
  },
  {
    id: 'mocha_comfort',
    name: 'Milk Comforts Mocha',
    category: 'milk_mocha',
    gifUrl: 'https://media0.giphy.com/media/kf3EjrAsKp3P9bhYHG/giphy.gif',
    emoji: '🥺',
    tagline: 'THERE THERE 🧸',
    tags: ['milk', 'mocha', 'comfort', 'gentle', 'care', 'soft'],
    bgGradient: 'from-teal-500/30 via-cyan-600/20 to-blue-600/30',
    borderColor: 'border-teal-400/50',
    textColor: 'text-teal-200'
  },
  {
    id: 'mocha_cuddle',
    name: 'Warm Blanket Cuddle',
    category: 'milk_mocha',
    gifUrl: 'https://media1.giphy.com/media/4r08O3GEapsIg/giphy.gif',
    emoji: '🧣',
    tagline: 'COZY BLANKET',
    tags: ['milk', 'mocha', 'blanket', 'cuddle', 'cozy', 'winter'],
    bgGradient: 'from-rose-500/30 via-purple-600/20 to-amber-600/30',
    borderColor: 'border-rose-400/50',
    textColor: 'text-rose-200'
  },

  // ==========================================
  // 3. PEACH & GOMA CATS
  // ==========================================
  {
    id: 'peach_kisses',
    name: 'Peach Kisses Goma',
    category: 'peach_goma',
    gifUrl: 'https://media2.giphy.com/media/USya70imGupyCOEYjp/giphy.gif',
    emoji: '😽',
    tagline: 'MUCH LOVE 💖',
    tags: ['peach', 'goma', 'cat', 'kiss', 'love', 'kitty', 'mochi'],
    bgGradient: 'from-rose-500/30 via-pink-600/20 to-purple-600/30',
    borderColor: 'border-rose-400/50',
    textColor: 'text-rose-200'
  },
  {
    id: 'peach_cheekpat',
    name: 'Goma Cheek Pat',
    category: 'peach_goma',
    gifUrl: 'https://media2.giphy.com/media/d9p1Ob280Qfgd8codf/giphy.gif',
    emoji: '🐾',
    tagline: 'CUTIE PIE',
    tags: ['peach', 'goma', 'cat', 'pat', 'cute', 'boop'],
    bgGradient: 'from-amber-400/30 via-orange-500/20 to-pink-500/30',
    borderColor: 'border-amber-400/50',
    textColor: 'text-amber-200'
  },
  {
    id: 'peach_hug',
    name: 'Kitty Big Hug',
    category: 'peach_goma',
    gifUrl: 'https://media2.giphy.com/media/05Uqwg5SxO9wxzFJkI/giphy.gif',
    emoji: '😻',
    tagline: 'KITTY HUG 🐱',
    tags: ['peach', 'goma', 'cat', 'hug', 'snuggle', 'love'],
    bgGradient: 'from-pink-500/30 via-rose-500/20 to-amber-500/30',
    borderColor: 'border-pink-400/50',
    textColor: 'text-pink-200'
  },
  {
    id: 'peach_sleepy',
    name: 'Sleepy Kitties',
    category: 'peach_goma',
    gifUrl: 'https://media3.giphy.com/media/Kb3rmGKyyov27n0fFl/giphy.gif',
    emoji: '😴',
    tagline: 'SWEET DREAMS',
    tags: ['peach', 'goma', 'cat', 'sleep', 'night', 'tired', 'dream'],
    bgGradient: 'from-indigo-600/30 via-purple-700/20 to-slate-800/30',
    borderColor: 'border-indigo-400/50',
    textColor: 'text-indigo-200'
  },
  {
    id: 'peach_dancing',
    name: 'Happy Kitty Dance',
    category: 'peach_goma',
    gifUrl: 'https://media3.giphy.com/media/TdGFBmMrfPMOhkqCDV/giphy.gif',
    emoji: '💃',
    tagline: "VIBIN' DANCE ✨",
    tags: ['peach', 'goma', 'cat', 'dance', 'party', 'fun', 'happy'],
    bgGradient: 'from-yellow-400/30 via-pink-500/20 to-purple-600/30',
    borderColor: 'border-yellow-400/50',
    textColor: 'text-yellow-200'
  },

  // ==========================================
  // 4. CAPYBARA (OK I PULL UP)
  // ==========================================
  {
    id: 'capy_pullup',
    name: 'OK I Pull Up Chill',
    category: 'capybara',
    gifUrl: 'https://media2.giphy.com/media/zHl2mmFFLTQ2dsL8vH/giphy.gif',
    emoji: '🦫',
    tagline: 'OK I PULL UP 🦫',
    tags: ['capybara', 'pull up', 'chill', 'vibe', 'relax', 'after party'],
    bgGradient: 'from-amber-600/30 via-yellow-600/20 to-emerald-600/30',
    borderColor: 'border-amber-400/50',
    textColor: 'text-amber-200'
  },
  {
    id: 'capy_orange',
    name: 'Orange On Head',
    category: 'capybara',
    gifUrl: 'https://media3.giphy.com/media/btM5A2EKKhJkLCTXcT/giphy.gif',
    emoji: '🍊',
    tagline: 'ZERO CARES 🍊',
    tags: ['capybara', 'orange', 'zen', 'calm', 'peace', 'unbothered'],
    bgGradient: 'from-orange-500/30 via-amber-500/20 to-yellow-500/30',
    borderColor: 'border-orange-400/50',
    textColor: 'text-orange-200'
  },
  {
    id: 'capy_spa',
    name: 'Hot Spring Bath',
    category: 'capybara',
    gifUrl: 'https://media4.giphy.com/media/3esL6MEpYoHkjl9eRp/giphy.gif',
    emoji: '🛁',
    tagline: 'SPA DAY 🛁',
    tags: ['capybara', 'bath', 'water', 'spa', 'hot tub', 'cozy'],
    bgGradient: 'from-cyan-500/30 via-teal-600/20 to-blue-600/30',
    borderColor: 'border-cyan-400/50',
    textColor: 'text-cyan-200'
  },
  {
    id: 'capy_shades',
    name: 'Cool Sunglasses',
    category: 'capybara',
    gifUrl: 'https://media2.giphy.com/media/RCXFo5xryuFhSvfncM/giphy.gif',
    emoji: '😎',
    tagline: 'CHILL MAX 😎',
    tags: ['capybara', 'cool', 'sunglasses', 'swag', 'boss'],
    bgGradient: 'from-purple-600/30 via-indigo-600/20 to-cyan-600/30',
    borderColor: 'border-purple-400/50',
    textColor: 'text-purple-200'
  },
  {
    id: 'capy_walk',
    name: 'Capybara Stroll',
    category: 'capybara',
    gifUrl: 'https://media1.giphy.com/media/sbW2AUZLt98WoenLSl/giphy.gif',
    emoji: '🚶',
    tagline: 'CRUISING 🚶',
    tags: ['capybara', 'walk', 'chill', 'peace', 'stroll'],
    bgGradient: 'from-emerald-500/30 via-teal-500/20 to-green-600/30',
    borderColor: 'border-emerald-400/50',
    textColor: 'text-emerald-200'
  },

  // ==========================================
  // 5. CAT MEMES
  // ==========================================
  {
    id: 'cat_vibing',
    name: 'Vibing Jamming Cat',
    category: 'cat_memes',
    gifUrl: 'https://media0.giphy.com/media/DH1Au7j1gCGxGOkvUm/giphy.gif',
    emoji: '🐱',
    tagline: "VIBIN' TO BEAT 🎶",
    tags: ['cat', 'vibing', 'music', 'bop', 'jam', 'head nod'],
    bgGradient: 'from-fuchsia-500/30 via-pink-600/20 to-purple-600/30',
    borderColor: 'border-fuchsia-400/50',
    textColor: 'text-fuchsia-200'
  },
  {
    id: 'cat_pop',
    name: 'Pop Cat Mouth',
    category: 'cat_memes',
    gifUrl: 'https://media4.giphy.com/media/NEmydmd0cXFdj4ZH9m/giphy.gif',
    emoji: '👄',
    tagline: 'POP POP POP 🐱',
    tags: ['pop cat', 'cat', 'click', 'pop', 'mouth', 'meme'],
    bgGradient: 'from-amber-400/30 via-yellow-500/20 to-orange-500/30',
    borderColor: 'border-amber-400/50',
    textColor: 'text-amber-200'
  },
  {
    id: 'cat_sideeye',
    name: 'Bombastic Side Eye Cat',
    category: 'cat_memes',
    gifUrl: 'https://media3.giphy.com/media/X6hLfRgoJmWiF0i9Xr/giphy.gif',
    emoji: '👀',
    tagline: 'SIDE EYE 👀',
    tags: ['cat', 'side eye', 'bombastic', 'criminal', 'sus', 'judging'],
    bgGradient: 'from-zinc-600/30 via-slate-700/20 to-neutral-800/30',
    borderColor: 'border-zinc-400/50',
    textColor: 'text-zinc-200'
  },
  {
    id: 'cat_crying',
    name: 'Banana Cat Tears',
    category: 'cat_memes',
    gifUrl: 'https://media1.giphy.com/media/rrasLFSTyi4Th1e8Xo/giphy.gif',
    emoji: '😿',
    tagline: 'WHY THO?! 😭',
    tags: ['banana cat', 'cat', 'crying', 'sad', 'tears', 'weep'],
    bgGradient: 'from-yellow-400/30 via-amber-500/20 to-red-500/30',
    borderColor: 'border-yellow-400/50',
    textColor: 'text-yellow-200'
  },
  {
    id: 'cat_heart',
    name: 'Cat Presenting Heart',
    category: 'cat_memes',
    gifUrl: 'https://media3.giphy.com/media/uXZOSmv0glEDpG26VC/giphy.gif',
    emoji: '💝',
    tagline: 'FOR YOU 💕',
    tags: ['cat', 'heart', 'present', 'cute', 'love', 'wholesome'],
    bgGradient: 'from-rose-500/30 via-pink-500/20 to-red-600/30',
    borderColor: 'border-rose-400/50',
    textColor: 'text-rose-200'
  },

  // ==========================================
  // 6. GEN Z SLANG & REACTIONS
  // ==========================================
  {
    id: 'genz_slay',
    name: 'Slay Queen',
    category: 'genz',
    gifUrl: 'https://media1.giphy.com/media/IumJINdEhV5g3jtf3N/giphy.gif',
    emoji: '💅',
    tagline: 'SLAAAY 💅',
    tags: ['slay', 'queen', 'serving', 'genz', 'yas', 'ate', 'left no crumbs'],
    bgGradient: 'from-pink-500/30 via-rose-500/20 to-purple-600/30',
    borderColor: 'border-pink-400/50',
    textColor: 'text-pink-200'
  },
  {
    id: 'genz_hearthands',
    name: 'Heart Hands',
    category: 'genz',
    gifUrl: 'https://media3.giphy.com/media/aF62VuTgabQ6OyvM8P/giphy.gif',
    emoji: '🫶',
    tagline: 'HEART HANDS 🫶',
    tags: ['heart hands', 'love', 'wholesome', 'genz', 'kpop', 'cute'],
    bgGradient: 'from-rose-500/30 via-amber-400/20 to-pink-600/30',
    borderColor: 'border-rose-400/50',
    textColor: 'text-rose-200'
  },
  {
    id: 'genz_dead',
    name: 'I Am Dead Skull',
    category: 'genz',
    gifUrl: 'https://media3.giphy.com/media/LhmN52QWRnc0emM93z/giphy.gif',
    emoji: '💀',
    tagline: 'I AM DEAD 💀',
    tags: ['skull', 'dead', 'lmao', 'dying', 'genz', 'wheezing', 'cant even'],
    bgGradient: 'from-zinc-600/30 via-neutral-700/20 to-slate-800/30',
    borderColor: 'border-zinc-400/50',
    textColor: 'text-zinc-200'
  },
  {
    id: 'genz_sideeye',
    name: 'Bombastic Look',
    category: 'genz',
    gifUrl: 'https://media0.giphy.com/media/qCZEQEYYb23y4e1bPn/giphy.gif',
    emoji: '🤨',
    tagline: 'SUS DETECTED 🔍',
    tags: ['side eye', 'sus', 'genz', 'look', 'bombastic', 'criminal'],
    bgGradient: 'from-amber-500/30 via-orange-600/20 to-red-600/30',
    borderColor: 'border-amber-400/50',
    textColor: 'text-amber-200'
  },
  {
    id: 'genz_damage',
    name: 'Emotional Damage',
    category: 'genz',
    gifUrl: 'https://media2.giphy.com/media/yaGcme72oRAy0MDslJ/giphy.gif',
    emoji: '💔',
    tagline: 'EMOTIONAL DAMAGE 💔',
    tags: ['damage', 'shock', 'hurt', 'rip', 'oof', 'roasted'],
    bgGradient: 'from-red-600/30 via-rose-700/20 to-purple-800/30',
    borderColor: 'border-red-400/50',
    textColor: 'text-red-200'
  },
  {
    id: 'genz_sheesh',
    name: 'Certified Sheesh',
    category: 'genz',
    gifUrl: 'https://media2.giphy.com/media/Ibe2QterRvthh32DDn/giphy.gif',
    emoji: '🥶',
    tagline: 'SHEEEESH 🥶',
    tags: ['sheesh', 'ice', 'cold', 'fire', 'genz', 'drip', 'clean'],
    bgGradient: 'from-cyan-500/30 via-blue-600/20 to-indigo-600/30',
    borderColor: 'border-cyan-400/50',
    textColor: 'text-cyan-200'
  },
  {
    id: 'genz_maincharacter',
    name: 'Main Character',
    category: 'genz',
    gifUrl: 'https://media2.giphy.com/media/ecnESJQQHZAcyuAfYE/giphy.gif',
    emoji: '✨',
    tagline: 'MAIN CHARACTER ✨',
    tags: ['main character', 'iconic', 'vibe', 'star', 'energy'],
    bgGradient: 'from-amber-400/30 via-yellow-500/20 to-purple-600/30',
    borderColor: 'border-amber-400/50',
    textColor: 'text-amber-200'
  },

  // ==========================================
  // 7. CINEMA & WATCH PARTY
  // ==========================================
  {
    id: 'cinema_popcorn',
    name: 'Popcorn Crunch',
    category: 'cinema',
    emoji: '🍿',
    tagline: 'EXTRA BUTTER!',
    tags: ['popcorn', 'snack', 'crunch', 'cinema', 'movie'],
    bgGradient: 'from-amber-500/30 via-orange-500/20 to-yellow-600/30',
    borderColor: 'border-amber-400/50',
    textColor: 'text-amber-200'
  },
  {
    id: 'cinema_plottwist',
    name: 'Plot Twist',
    category: 'cinema',
    emoji: '🌀',
    tagline: 'NO WAY!!',
    tags: ['plot twist', 'shock', 'cinema', 'mind blown'],
    bgGradient: 'from-purple-600/30 via-indigo-600/20 to-pink-600/30',
    borderColor: 'border-purple-400/50',
    textColor: 'text-purple-200'
  },
  {
    id: 'cinema_3dglasses',
    name: 'Cinema Vibe',
    category: 'cinema',
    emoji: '🕶️',
    tagline: 'FRONT ROW SEAT',
    tags: ['3d', 'glasses', 'cinema', 'theater'],
    bgGradient: 'from-cyan-500/30 via-blue-600/20 to-indigo-600/30',
    borderColor: 'border-cyan-400/50',
    textColor: 'text-cyan-200'
  },
  {
    id: 'cinema_clapper',
    name: 'Movie Time',
    category: 'cinema',
    emoji: '🎬',
    tagline: 'ACTION!',
    tags: ['action', 'clapper', 'cinema', 'movie', 'start'],
    bgGradient: 'from-red-600/30 via-rose-600/20 to-amber-600/30',
    borderColor: 'border-red-400/50',
    textColor: 'text-red-200'
  },
  {
    id: 'cinema_sleeping',
    name: 'Boring Part',
    category: 'cinema',
    emoji: '😴',
    tagline: 'WAKE ME UP Zzz',
    tags: ['sleep', 'boring', 'zzz', 'cinema'],
    bgGradient: 'from-slate-600/30 via-zinc-700/20 to-blue-900/30',
    borderColor: 'border-slate-400/50',
    textColor: 'text-slate-200'
  },

  // ==========================================
  // 8. ROMANCE & LOVE
  // ==========================================
  {
    id: 'romance_snuggle',
    name: 'Snuggle Up',
    category: 'romance',
    emoji: '🧸',
    tagline: 'COZY WITH YOU',
    tags: ['snuggle', 'cozy', 'hug', 'love', 'romance'],
    bgGradient: 'from-rose-500/30 via-pink-600/20 to-red-500/30',
    borderColor: 'border-rose-400/50',
    textColor: 'text-rose-200'
  },
  {
    id: 'romance_hearteyes',
    name: 'Heart Eyes',
    category: 'romance',
    emoji: '😍',
    tagline: 'SO IN LOVE',
    tags: ['heart eyes', 'love', 'crush', 'cute'],
    bgGradient: 'from-pink-500/30 via-rose-500/20 to-purple-600/30',
    borderColor: 'border-pink-400/50',
    textColor: 'text-pink-200'
  },
  {
    id: 'romance_cheers',
    name: 'Wine Cheers',
    category: 'romance',
    emoji: '🥂',
    tagline: 'TO US! ❤️',
    tags: ['cheers', 'wine', 'toast', 'celebrate', 'love'],
    bgGradient: 'from-amber-400/30 via-rose-500/20 to-purple-700/30',
    borderColor: 'border-amber-400/50',
    textColor: 'text-amber-200'
  },
  {
    id: 'romance_fireheart',
    name: 'Pure Chemistry',
    category: 'romance',
    emoji: '❤️‍🔥',
    tagline: 'ON FIRE',
    tags: ['fire', 'chemistry', 'spark', 'heart', 'hot'],
    bgGradient: 'from-red-500/30 via-orange-500/20 to-rose-600/30',
    borderColor: 'border-red-400/50',
    textColor: 'text-red-200'
  }
];

export function parseStickerMessage(content: string): StickerItem | null {
  if (!content) return null;

  // 1. Check [sticker:<id>]
  if (content.startsWith('[sticker:')) {
    const match = content.match(/^\[sticker:([a-zA-Z0-9_-]+)\]$/);
    if (match) {
      const stickerId = match[1];
      const found = STICKER_PACK.find((s) => s.id === stickerId);
      if (found) return found;
    }
  }

  // 2. Check [gif:<url>] or [gif:<url>:<caption?>]
  if (content.startsWith('[gif:')) {
    const match = content.match(/^\[gif:(https?:\/\/[^\]|]+)(?:\|([^\]]+))?\]$/);
    if (match) {
      const url = match[1];
      const caption = match[2] || 'STICKER';
      return {
        id: `custom_${encodeURIComponent(url).slice(0, 16)}`,
        name: caption,
        category: 'genz',
        gifUrl: url,
        tagline: caption.toUpperCase(),
        tags: ['custom', 'gif', 'giphy'],
        bgGradient: 'from-purple-600/30 via-pink-600/20 to-rose-600/30',
        borderColor: 'border-pink-400/50',
        textColor: 'text-pink-200'
      };
    }
  }

  // 3. Auto-detect raw GIF or Giphy URLs
  if (/^https?:\/\/[^\s]+(?:\.gif|\.webp|giphy\.com|tenor\.com)[^\s]*$/i.test(content.trim())) {
    const url = content.trim();
    return {
      id: `url_${encodeURIComponent(url).slice(0, 16)}`,
      name: 'GIF Sticker',
      category: 'genz',
      gifUrl: url,
      tagline: 'GIPHY',
      tags: ['gif', 'giphy'],
      bgGradient: 'from-purple-600/30 via-pink-600/20 to-rose-600/30',
      borderColor: 'border-pink-400/50',
      textColor: 'text-pink-200'
    };
  }

  return null;
}

export function formatStickerMessage(stickerIdOrUrl: string, caption?: string): string {
  if (stickerIdOrUrl.startsWith('http://') || stickerIdOrUrl.startsWith('https://')) {
    return caption ? `[gif:${stickerIdOrUrl}|${caption}]` : `[gif:${stickerIdOrUrl}]`;
  }
  return `[sticker:${stickerIdOrUrl}]`;
}
