export type RoastCategory = 'nudge' | 'game' | 'watch' | 'streak';

export interface RoastMessage {
  title: string;
  body: string;
  category: RoastCategory;
  emoji: string;
}

export const ROAST_MESSAGES: Record<RoastCategory, RoastMessage[]> = {
  nudge: [
    {
      title: 'Zomato Rider Alert 🛵💨',
      body: 'Khana thanda ho jayega par aapka reply nahi aayega... Jaldi aao!',
      category: 'nudge',
      emoji: '🛵'
    },
    {
      title: 'French Connection 🗼😏',
      body: 'Are you French? Because Eiffel for you, but you are not even opening the app!',
      category: 'nudge',
      emoji: '🗼'
    },
    {
      title: 'Empty Room Drama 🥺🍿',
      body: 'Your partner is staring at an empty room wondering if you found someone better...',
      category: 'nudge',
      emoji: '🥺'
    },
    {
      title: 'Wi-Fi Check 💔🔌',
      body: 'Dil toota chalega, par sync connection nahi tootna chahiye! Reconnect now!',
      category: 'nudge',
      emoji: '💔'
    },
    {
      title: 'Extra Cheese Crisis 🍕🥺',
      body: 'I miss you more than extra cheese on pizza... Wapas aaja na!',
      category: 'nudge',
      emoji: '🍕'
    },
    {
      title: 'Dil Ek Hi Hai 💌',
      body: 'Ek hi toh dil hai, kitni baar ignore karoge? Tap to reply!',
      category: 'nudge',
      emoji: '💌'
    },
    {
      title: 'Chicken Butter Warning 🍗✨',
      body: "You're the butter to my chicken, but you're leaving me dry! Click to join!",
      category: 'nudge',
      emoji: '🍗'
    },
    {
      title: 'Bhookh Lagi Hai? 👀',
      body: 'Bhookh lag gayi ya mujhse bore ho gaye? Waiting for you right here!',
      category: 'nudge',
      emoji: '👀'
    },
    {
      title: 'Popcorn Alert 🍿',
      body: 'Notification toh dekh liya karo! Akele akele popcorn khatam kar rahe ho kya?',
      category: 'nudge',
      emoji: '🍿'
    },
    {
      title: 'Ghostbuster Needed 👻💖',
      body: 'Warning: Extreme cuteness awaiting on Watch Party! Don’t ghost me!',
      category: 'nudge',
      emoji: '👻'
    },
    {
      title: 'Aukaat Se Zyada Pyaar ❤️‍🔥',
      body: 'Itna attitude toh Swiggy Instamart wale bhi nahi dikhate... Aaja jaldi!',
      category: 'nudge',
      emoji: '❤️‍🔥'
    }
  ],
  game: [
    {
      title: 'Ludo Challenge 🎲🔥',
      body: 'Ludo mein harane ka ghamand toh dekho! Aaja maidaan mein agar dum hai toh!',
      category: 'game',
      emoji: '🎲'
    },
    {
      title: 'Direct Dil Se ❤️🎮',
      body: 'Four-in-a-Row mein connect karenge ya direct dil se? Tap to play now!',
      category: 'game',
      emoji: '🎮'
    },
    {
      title: 'Ludo Baazigar 🏆😉',
      body: 'Haarne wale ko baazigar kehte hain... Aao tumhe ek baar fir harata hoon!',
      category: 'game',
      emoji: '🏆'
    },
    {
      title: 'Darr Gaye Kya? 🐥',
      body: 'Match accept karne mein itna darr? Ludo board par tumhara wait ho raha hai!',
      category: 'game',
      emoji: '🐥'
    },
    {
      title: 'Chhakka Mara Kya? 🎲✨',
      body: 'Mere 6 aane wale hain! Jaldi join karo varna game shuru ho jayegi!',
      category: 'game',
      emoji: '🎲'
    }
  ],
  watch: [
    {
      title: 'Popcorn Ready 🍿🎬',
      body: 'Popcorn is popping, the movie is buffered, only you are missing!',
      category: 'watch',
      emoji: '🍿'
    },
    {
      title: 'Watch Party Call 🛋️✨',
      body: 'Netflix & Chill can wait, Watch Party is where the real drama is! Tap to join!',
      category: 'watch',
      emoji: '🛋️'
    },
    {
      title: 'Cinema Time 🎬❤️',
      body: 'Your partner started the show! Jump in before the spoilers start!',
      category: 'watch',
      emoji: '🎬'
    }
  ],
  streak: [
    {
      title: 'Streak Danger! 🔥⚠️',
      body: 'Hamara streak toot gaya toh Zomato delivery boy ko shikayat karunga! Save streak now!',
      category: 'streak',
      emoji: '🔥'
    },
    {
      title: 'Streak Bachao Rishta Bachao 🔥💔',
      body: 'Only a few hours left! One click can save our flame from burning out!',
      category: 'streak',
      emoji: '🔥'
    }
  ]
};

export function getRandomRoast(category: RoastCategory = 'nudge', senderName?: string): RoastMessage {
  const list = ROAST_MESSAGES[category] || ROAST_MESSAGES.nudge;
  const picked = list[Math.floor(Math.random() * list.length)];
  return {
    ...picked,
    title: senderName ? `${senderName}: ${picked.title}` : picked.title
  };
}
