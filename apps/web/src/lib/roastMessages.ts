import type { IconName } from '../components/ui/AppIcon';

export type RoastCategory = 'nudge' | 'game' | 'watch' | 'streak';

export interface RoastMessage {
  title: string;
  body: string;
  category: RoastCategory;
  icon: IconName;
}

export const ROAST_MESSAGES: Record<RoastCategory, RoastMessage[]> = {
  nudge: [
    {
      title: 'Zomato Rider Alert',
      body: 'Khana thanda ho jayega par aapka reply nahi aayega... Jaldi aao!',
      category: 'nudge',
      icon: 'food'
    },
    {
      title: 'French Connection',
      body: 'Are you French? Because Eiffel for you, but you are not even opening the app!',
      category: 'nudge',
      icon: 'heart'
    },
    {
      title: 'Empty Room Drama',
      body: 'Your partner is staring at an empty room wondering if you found someone better...',
      category: 'nudge',
      icon: 'sad'
    },
    {
      title: 'Wi-Fi Check',
      body: 'Dil toota chalega, par sync connection nahi tootna chahiye! Reconnect now!',
      category: 'nudge',
      icon: 'heart'
    },
    {
      title: 'Extra Cheese Crisis',
      body: 'I miss you more than extra cheese on pizza... Wapas aaja na!',
      category: 'nudge',
      icon: 'food'
    },
    {
      title: 'Dil Ek Hi Hai',
      body: 'Ek hi toh dil hai, kitni baar ignore karoge? Tap to reply!',
      category: 'nudge',
      icon: 'heart'
    },
    {
      title: 'Chicken Butter Warning',
      body: "You're the butter to my chicken, but you're leaving me dry! Click to join!",
      category: 'nudge',
      icon: 'food'
    },
    {
      title: 'Bhookh Lagi Hai?',
      body: 'Bhookh lag gayi ya mujhse bore ho gaye? Waiting for you right here!',
      category: 'nudge',
      icon: 'eye'
    },
    {
      title: 'Popcorn Alert',
      body: 'Notification toh dekh liya karo! Akele akele popcorn khatam kar rahe ho kya?',
      category: 'nudge',
      icon: 'popcorn'
    },
    {
      title: 'Ghostbuster Needed',
      body: 'Warning: Extreme cuteness awaiting on Watch Party! Don’t ghost me!',
      category: 'nudge',
      icon: 'ghost'
    },
    {
      title: 'Aukaat Se Zyada Pyaar',
      body: 'Itna attitude toh Swiggy Instamart wale bhi nahi dikhate... Aaja jaldi!',
      category: 'nudge',
      icon: 'fire'
    }
  ],
  game: [
    {
      title: 'Ludo Challenge',
      body: 'Ludo mein harane ka ghamand toh dekho! Aaja maidaan mein agar dum hai toh!',
      category: 'game',
      icon: 'dice'
    },
    {
      title: 'Direct Dil Se',
      body: 'Four-in-a-Row mein connect karenge ya direct dil se? Tap to play now!',
      category: 'game',
      icon: 'game'
    },
    {
      title: 'Ludo Baazigar',
      body: 'Haarne wale ko baazigar kehte hain... Aao tumhe ek baar fir harata hoon!',
      category: 'game',
      icon: 'trophy'
    },
    {
      title: 'Darr Gaye Kya?',
      body: 'Match accept karne mein itna darr? Ludo board par tumhara wait ho raha hai!',
      category: 'game',
      icon: 'bird'
    },
    {
      title: 'Chhakka Mara Kya?',
      body: 'Mere 6 aane wale hain! Jaldi join karo varna game shuru ho jayegi!',
      category: 'game',
      icon: 'dice'
    }
  ],
  watch: [
    {
      title: 'Popcorn Ready',
      body: 'Popcorn is popping, the movie is buffered, only you are missing!',
      category: 'watch',
      icon: 'popcorn'
    },
    {
      title: 'Watch Party Call',
      body: 'Netflix & Chill can wait, Watch Party is where the real drama is! Tap to join!',
      category: 'watch',
      icon: 'movie'
    },
    {
      title: 'Cinema Time',
      body: 'Your partner started the show! Jump in before the spoilers start!',
      category: 'watch',
      icon: 'movie'
    }
  ],
  streak: [
    {
      title: 'Streak Danger!',
      body: 'Hamara streak toot gaya toh Zomato delivery boy ko shikayat karunga! Save streak now!',
      category: 'streak',
      icon: 'fire'
    },
    {
      title: 'Streak Bachao Rishta Bachao',
      body: 'Only a few hours left! One click can save our flame from burning out!',
      category: 'streak',
      icon: 'fire'
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
