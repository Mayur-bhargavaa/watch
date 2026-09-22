export interface StickerItem {
  id: string;
  name: string;
  category:
    | 'desi_memes'
    | 'baby_hamster'
    | 'bubu_dudu'
    | 'milk_mocha'
    | 'peach_goma'
    | 'capybara'
    | 'cat_memes'
    | 'genz'
    | 'cinema'
    | 'romance'
    | 'drawn';
  gifUrl?: string; // High-res transparent animated Giphy GIF URL
  webpUrl?: string;
  drawingSvg?: string; // Inline compact SVG markup for user hand-drawn animated stickers
  emoji?: string;
  tagline: string;
  tags: string[];
  bgGradient?: string;
  borderColor?: string;
  textColor?: string;
}

export const STICKER_CATEGORIES = [
  { id: 'all', label: 'All', icon: '✨' },
  { id: 'desi_memes', label: 'Desi Memes', icon: '🇮🇳' },
  { id: 'baby_hamster', label: 'Baby & Hamster', icon: '🐹' },
  { id: 'bubu_dudu', label: 'Bubu & Dudu', icon: '🐼' },
  { id: 'cat_memes', label: 'Cat Memes', icon: '😹' },
  { id: 'milk_mocha', label: 'Milk & Mocha', icon: '🐻' },
  { id: 'capybara', label: 'Capybara', icon: '🦫' },
  { id: 'cinema', label: 'Cinema', icon: '🍿' },
  { id: 'genz', label: 'Gen Z', icon: '💅' }
] as const;

export const WHATSAPP_REACTION_TAGS = [
  { id: 'all', label: 'All', icon: '✨', query: '' },
  { id: 'hi', label: 'Hi', icon: '👋', query: 'hi' },
  { id: 'haha', label: 'Haha', icon: '😂', query: 'haha' },
  { id: 'love', label: 'Love', icon: '❤️', query: 'love' },
  { id: 'sad', label: 'Sad', icon: '😢', query: 'sad' },
  { id: 'mood', label: 'Mood', icon: '🔥', query: 'mood' },
  { id: 'desi', label: 'Memes', icon: '🇮🇳', query: 'desi' },
  { id: 'cats', label: 'Cats', icon: '🐱', query: 'cat' },
  { id: 'cinema', label: 'Cinema', icon: '🍿', query: 'cinema' },
  { id: 'party', label: 'Party', icon: '🎉', query: 'party' },
] as const;

export const TRENDING_GIFS = [
  { id: 'gif_laugh', name: 'LMAO Laugh', url: 'https://media.giphy.com/media/bC9czlgCMtw4cj8RgH/giphy.gif', tags: ['laugh', 'lmao', 'funny'] },
  { id: 'gif_nod', name: 'Nod Approval', url: 'https://media.giphy.com/media/NEvPzZ8bd1V4Y/giphy.gif', tags: ['nod', 'yes', 'agree', 'cool'] },
  { id: 'gif_mindblown', name: 'Mind Blown', url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif', tags: ['mind blown', 'shock', 'wow', 'universe'] },
  { id: 'gif_popcorn', name: 'Popcorn Drama', url: 'https://media.giphy.com/media/GLbiGv98nTFja/giphy.gif', tags: ['popcorn', 'drama', 'watching', 'cinema'] },
  { id: 'gif_facepalm', name: 'Facepalm', url: 'https://media.giphy.com/media/3og0INy0oWXEB7D8aI/giphy.gif', tags: ['facepalm', 'smh', 'fail', 'omg'] },
  { id: 'gif_cheems', name: 'Cheems Bonk', url: 'https://media.giphy.com/media/RodyInIO0ueak/giphy.gif', tags: ['bonk', 'doge', 'cheems', 'meme'] },
  { id: 'gif_paisa', name: 'Paisa Hi Paisa', url: 'https://media.giphy.com/media/eek65vDkx0OJjHs0dc/giphy.gif', tags: ['paisa', 'akshay', 'money', 'rich', 'desi'] },
  { id: 'gif_salman', name: 'Dabangg Swag', url: 'https://media.giphy.com/media/3ohfFMbIeQOa5vXUqs/giphy.gif', tags: ['salman', 'swag', 'dance', 'desi', 'bollywood'] },
  { id: 'gif_srk', name: 'SRK Open Arms', url: 'https://media.giphy.com/media/3ohfFrepUhdF6eN35m/giphy.gif', tags: ['srk', 'shahrukh', 'love', 'romantic', 'bollywood'] },
  { id: 'gif_ranveer', name: 'High Energy', url: 'https://media.giphy.com/media/3otPoHnQ8kK15i27F6/giphy.gif', tags: ['ranveer', 'energy', 'fire', 'dance', 'excited'] },
  { id: 'gif_deepika', name: 'Cute Smile', url: 'https://media.giphy.com/media/3otPoxJ4n5U54d9cPe/giphy.gif', tags: ['deepika', 'smile', 'blush', 'cute', 'love'] },
  { id: 'gif_cat_vibe', name: 'Vibing Cat', url: 'https://media.giphy.com/media/DH1Au7j1gCGxGOkvUm/giphy.gif', tags: ['cat', 'vibing', 'music', 'jam', 'bop'] },
  { id: 'gif_cat_type', name: 'Typing Cat', url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif', tags: ['cat', 'typing', 'work', 'fast', 'busy'] },
  { id: 'gif_hamster', name: 'Dancing Hamster', url: 'https://media.giphy.com/media/14qKckCUUpHeOA/giphy.gif', tags: ['hamster', 'dance', 'cute', 'peace'] }
];

export const EMOJI_CATEGORIES = [
  {
    name: 'Smileys & Emotion',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😭', '🥹', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '😵‍💫', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖']
  },
  {
    name: 'Gestures & People',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫸', '🫷', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶']
  },
  {
    name: 'Hearts & Love',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💋', '💌']
  },
  {
    name: 'Animals & Nature',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐒', '🦍', '🦧', '🦫', '🐺', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🪲', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🐙', '🦑', '🦐', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🦈', '🦭', '🐅', '🐆', '🦓', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐄', '🐎', '🐖', '🐑', '🐐', '🦌', '🐕', '🐩', '🐈', '🕊️', '🦅', '🦆', '🦉', '🪵', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '🍀', '🍁', '🍂', '🍃', '🍄', '🌺', '🌸', '🌼', '🌻', '🌹', '🌷', '💐']
  },
  {
    name: 'Cinema, Fun & Party',
    emojis: ['🍿', '🎬', '🎥', '🎞️', '📽️', '📺', '📻', '🎙️', '🎤', '🎧', '🎵', '🎶', '🎹', '🥁', '🎸', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🕹️', '🎰', '🧩', '🎪', '🎭', '🎨', '🎉', '🎊', '🎈', '🎂', '🍾', '🥂', '🍻', '🍺', '🥤', '🧋', '🍕', '🍔', '🍟', '🌮', '🍩', '🍪', '🍫', '🍬', '🍭', '🧁']
  }
];

export const STICKER_PACK: StickerItem[] = [
  // ==========================================
  // 1. DESI MEMES & BOLLYWOOD (WhatsApp Iconic)
  // ==========================================
  {
    id: 'desi_jethalal',
    name: 'Jethalal Laugh',
    category: 'desi_memes',
    gifUrl: 'https://media.giphy.com/media/10JhviFuU2ywZq/giphy.gif',
    emoji: '😂',
    tagline: 'AISA ITOM!',
    tags: ['jethalal', 'tmkoc', 'laugh', 'desi', 'meme', 'aisa itom', 'funny']
  },
  {
    id: 'desi_akshay_paisa',
    name: '25 Din Mein Paisa Double',
    category: 'desi_memes',
    gifUrl: 'https://media.giphy.com/media/eek65vDkx0OJjHs0dc/giphy.gif',
    emoji: '🤑',
    tagline: 'PAISA HI PAISA!',
    tags: ['akshay', 'hera pheri', 'paisa', 'money', 'double', 'desi', 'meme']
  },
  {
    id: 'desi_monkey_chup',
    name: 'Chup Rehna Seekh Gaya Hoon',
    category: 'desi_memes',
    gifUrl: 'https://media.giphy.com/media/3o85xAYQIED40HIjy8/giphy.gif',
    emoji: '🐒',
    tagline: 'CHUP HO JAO',
    tags: ['monkey', 'chup', 'quiet', 'desi', 'meme', 'relatable']
  },
  {
    id: 'desi_cats_talk',
    name: 'Bhai Aa Du Jhunjhuna',
    category: 'desi_memes',
    gifUrl: 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif',
    emoji: '🐱',
    tagline: 'BHAI LAGTA HAI',
    tags: ['cat', 'jhunjhuna', 'desi', 'meme', 'bhai', 'relatable']
  },
  {
    id: 'desi_salman_swag',
    name: 'Salman Dabangg Hookstep',
    category: 'desi_memes',
    gifUrl: 'https://media.giphy.com/media/3ohfFMbIeQOa5vXUqs/giphy.gif',
    emoji: '🕺',
    tagline: 'SWAG SE SWAGAT',
    tags: ['salman', 'dabangg', 'dance', 'swag', 'bollywood', 'desi']
  },
  {
    id: 'desi_srk_arms',
    name: 'SRK Open Arms Love',
    category: 'desi_memes',
    gifUrl: 'https://media.giphy.com/media/3ohfFrepUhdF6eN35m/giphy.gif',
    emoji: '❤️',
    tagline: 'PYAR DOST HAI',
    tags: ['srk', 'shahrukh', 'love', 'arms', 'romantic', 'bollywood', 'desi']
  },
  {
    id: 'desi_ranveer_energy',
    name: 'Ranveer High Energy',
    category: 'desi_memes',
    gifUrl: 'https://media.giphy.com/media/3otPoHnQ8kK15i27F6/giphy.gif',
    emoji: '🔥',
    tagline: 'FULL POWER!',
    tags: ['ranveer', 'fire', 'energy', 'excited', 'party', 'bollywood']
  },
  {
    id: 'desi_deepika_smile',
    name: 'Deepika Dimple Smile',
    category: 'desi_memes',
    gifUrl: 'https://media.giphy.com/media/3otPoxJ4n5U54d9cPe/giphy.gif',
    emoji: '🥰',
    tagline: 'SWEET SMILE',
    tags: ['deepika', 'smile', 'dimple', 'love', 'blush', 'bollywood']
  },
  {
    id: 'desi_dancing_uncle',
    name: 'Govinda Uncle Dance',
    category: 'desi_memes',
    gifUrl: 'https://media.giphy.com/media/3ohfFq8mK27eJg1m6c/giphy.gif',
    emoji: '💃',
    tagline: 'DANCE FLOOR FIRE',
    tags: ['uncle', 'dance', 'govinda', 'wedding', 'desi', 'bhangra']
  },
  {
    id: 'desi_aamir_confused',
    name: 'Aamir Khan Confused',
    category: 'desi_memes',
    gifUrl: 'https://media.giphy.com/media/3otPoOzO78o6N5e85q/giphy.gif',
    emoji: '🤔',
    tagline: 'ARE BHAIYA!',
    tags: ['aamir', 'pk', 'confused', 'kya', 'desi', 'bhaiya']
  },
  {
    id: 'cheems_bonk',
    name: 'Cheems Doge Bonk',
    category: 'desi_memes',
    gifUrl: 'https://media.giphy.com/media/RodyInIO0ueak/giphy.gif',
    emoji: '🔨',
    tagline: 'BONK!',
    tags: ['cheems', 'doge', 'bonk', 'meme', 'jail', 'shutup']
  },
  {
    id: 'laugh_clapping_hands',
    name: 'Laughing & Clapping Hands',
    category: 'desi_memes',
    gifUrl: 'https://media.giphy.com/media/lszAB3TzFtTxm/giphy.gif',
    emoji: '👏',
    tagline: 'HAHAHA DEAD',
    tags: ['laugh', 'clap', 'hands', 'emoji', 'haha', 'lmao', 'rofl']
  },

  // ==========================================
  // 2. BABY & HAMSTER (WhatsApp Relatable)
  // ==========================================
  {
    id: 'hamster_peace',
    name: 'Hamster Peace Sign',
    category: 'baby_hamster',
    gifUrl: 'https://media.giphy.com/media/v6aOjy0Qo1GIA/giphy.gif',
    emoji: '✌️',
    tagline: 'PEACE OUT 🐹',
    tags: ['hamster', 'peace', 'cute', 'hi', 'vibe', 'hello', 'chill']
  },
  {
    id: 'baby_crying_tears',
    name: 'Chubby Baby Crying',
    category: 'baby_hamster',
    gifUrl: 'https://media.giphy.com/media/OPU6wzx8JrHna/giphy.gif',
    emoji: '😭',
    tagline: 'HUHUHU 😭',
    tags: ['baby', 'crying', 'sad', 'tears', 'plead', 'chubby', 'cute']
  },
  {
    id: 'hamster_dancing_vibes',
    name: 'Hamster Dancing',
    category: 'baby_hamster',
    gifUrl: 'https://media.giphy.com/media/14qKckCUUpHeOA/giphy.gif',
    emoji: '🐹',
    tagline: 'PARTY MOOD',
    tags: ['hamster', 'dance', 'party', 'vibes', 'happy']
  },
  {
    id: 'baby_shocked_face',
    name: 'Baby Shocked',
    category: 'baby_hamster',
    gifUrl: 'https://media.giphy.com/media/l378giAZ0GLSHjIN2/giphy.gif',
    emoji: '😱',
    tagline: 'HATT!!',
    tags: ['baby', 'shocked', 'hatt', 'gasp', 'omg', 'cute']
  },
  {
    id: 'baby_dancing_happy',
    name: 'Baby Happy Dance',
    category: 'baby_hamster',
    gifUrl: 'https://media.giphy.com/media/12BJcgMmv90UZA/giphy.gif',
    emoji: '👶',
    tagline: 'YAY DANCE',
    tags: ['baby', 'dance', 'happy', 'yay', 'cute']
  },
  {
    id: 'bubu_scooter_ride',
    name: 'Bubu & Dudu on Scooter',
    category: 'baby_hamster',
    gifUrl: 'https://media.giphy.com/media/RKq8Lhors1hVHHAsdl/giphy.gif',
    emoji: '🛵',
    tagline: 'ZOOMING!',
    tags: ['bubu', 'dudu', 'scooter', 'ride', 'travel', 'cute', 'couple']
  },
  {
    id: 'cat_thumbsup_yes',
    name: 'Cat Thumbs Up',
    category: 'baby_hamster',
    gifUrl: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif',
    emoji: '👍',
    tagline: 'GOOD JOB 👍',
    tags: ['cat', 'thumbs up', 'approve', 'yes', 'ok', 'good']
  },
  {
    id: 'cat_typing_fast',
    name: 'Cat Typing Busy',
    category: 'baby_hamster',
    gifUrl: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
    emoji: '⌨️',
    tagline: 'BUSY WORKING',
    tags: ['cat', 'typing', 'busy', 'computer', 'work', 'fast']
  },
  {
    id: 'doraemon_happy_face',
    name: 'Doraemon Happy Smile',
    category: 'baby_hamster',
    gifUrl: 'https://media.giphy.com/media/12bjQ0e1XgQc9W/giphy.gif',
    emoji: '🐱',
    tagline: 'DORAEMON!',
    tags: ['doraemon', 'cartoon', 'happy', 'smile', 'cute']
  },

  // ==========================================
  // 3. BUBU & DUDU (Panda & Bear Couple)
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

  // 1.5. Check [custom_img:<dataUrl>] or direct data:image/
  if (content.startsWith('[custom_img:') || content.startsWith('data:image/')) {
    let url = content;
    let caption = 'Custom Sticker';
    if (content.startsWith('[custom_img:')) {
      const raw = content.slice(12, content.endsWith(']') ? -1 : undefined);
      const pipeIdx = raw.lastIndexOf('|');
      if (pipeIdx !== -1) {
        url = raw.slice(0, pipeIdx);
        caption = raw.slice(pipeIdx + 1) || 'Custom Sticker';
      } else {
        url = raw;
      }
    }
    return {
      id: `custom_${Date.now()}`,
      name: caption,
      category: 'desi_memes',
      gifUrl: url,
      tagline: caption.toUpperCase(),
      tags: ['custom', 'user', 'photo']
    };
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

  // 3. Check [draw:<svgContent>|<caption?>]
  if (content.startsWith('[draw:')) {
    const raw = content.slice(6, content.endsWith(']') ? -1 : undefined);
    const pipeIdx = raw.lastIndexOf('|');
    let svgContent = raw;
    let caption = 'HAND-DRAWN ✨';
    if (pipeIdx !== -1) {
      svgContent = raw.slice(0, pipeIdx);
      caption = raw.slice(pipeIdx + 1) || 'HAND-DRAWN ✨';
    }
    return {
      id: `draw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: caption,
      category: 'drawn',
      drawingSvg: svgContent,
      tagline: caption.toUpperCase(),
      tags: ['drawn', 'handdrawn', 'custom', 'art'],
      bgGradient: 'from-fuchsia-600/30 via-rose-600/20 to-amber-500/30',
      borderColor: 'border-rose-400/50',
      textColor: 'text-rose-200'
    };
  }

  // 4. Auto-detect raw GIF or Giphy URLs
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
  if (stickerIdOrUrl.startsWith('data:image/') || stickerIdOrUrl.startsWith('blob:')) {
    return caption ? `[custom_img:${stickerIdOrUrl}|${caption}]` : `[custom_img:${stickerIdOrUrl}]`;
  }
  if (stickerIdOrUrl.startsWith('http://') || stickerIdOrUrl.startsWith('https://')) {
    return caption ? `[gif:${stickerIdOrUrl}|${caption}]` : `[gif:${stickerIdOrUrl}]`;
  }
  return `[sticker:${stickerIdOrUrl}]`;
}

export function formatDrawStickerMessage(svgPathsString: string, caption: string = 'HAND-DRAWN ✨'): string {
  return `[draw:${svgPathsString}|${caption}]`;
}

export function serializeStickerMessage(sticker: any): string {
  if (typeof sticker === 'string') return sticker;
  return formatStickerMessage(sticker?.id || sticker?.gifUrl || sticker?.name || '', sticker?.name);
}
