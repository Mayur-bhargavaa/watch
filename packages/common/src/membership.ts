/**
 * Membership tiers shared by the server (limits, billing) and the web app (badges, pricing page).
 * The badge is what people see next to a name: "Standard Pass" (free), "VIP Pass" (Watch+), "Creator Pass".
 */
export type MembershipTier = 'free' | 'plus' | 'creator';

export interface TierLimits {
  /** how many plans a person may host at the same time */
  hostedPlans: number;
  /** weekly / monthly repeating plans */
  recurringPlans: boolean;
  /** how many people may be in one watch room at once (set by the room host's tier) */
  roomCapacity: number;
  /** may pick the premium theater themes */
  premiumThemes: boolean;
  /** may use the premium avatar styles */
  premiumAvatars: boolean;
  /** may send the premium reaction packs */
  reactionPacks: boolean;
  /** full post-watch recap (heatmap, member stats, chat highlights) */
  advancedRecaps: boolean;
  /** personal watch stats page */
  personalStats: boolean;
}

/** DiceBear styles offered as premium avatars. The free "Bitmoji" builder uses the avataaars style only. */
export const PREMIUM_AVATAR_STYLES: readonly string[] = ['adventurer', 'lorelei', 'notionists', 'personas', 'micah', 'big-smile', 'bottts', 'miniavs'];
/** True for a DiceBear avatar URL in any style other than the free avataaars builder. */
export function isPremiumAvatarUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const m = /^https:\/\/api\.dicebear\.com\/[0-9]+\.x\/([a-z0-9-]+)\//i.exec(url);
  return !!m && m[1].toLowerCase() !== 'avataaars';
}

/** Room themes anyone can use; every other theme id is a premium theme. */
export const FREE_THEME_IDS: readonly string[] = ['default', 'theam1', 'theam2'];
export function isPremiumTheme(themeId: string): boolean {
  return !FREE_THEME_IDS.includes(themeId);
}

export interface TierInfo {
  tier: MembershipTier;
  name: string;
  /** short badge text shown on profiles */
  badge: string;
  /** full label, e.g. "VIP Pass" */
  badgeLabel: string;
  rank: number;
  limits: TierLimits;
}

export const TIER_INFO: Record<MembershipTier, TierInfo> = {
  free: { tier: 'free', name: 'Watch Free', badge: 'Standard', badgeLabel: 'Standard Pass', rank: 0, limits: { hostedPlans: 10, recurringPlans: false, roomCapacity: 6, premiumThemes: false, premiumAvatars: false, reactionPacks: false, advancedRecaps: false, personalStats: false } },
  plus: { tier: 'plus', name: 'Watch+', badge: 'VIP', badgeLabel: 'VIP Pass', rank: 1, limits: { hostedPlans: 50, recurringPlans: true, roomCapacity: 10, premiumThemes: true, premiumAvatars: true, reactionPacks: true, advancedRecaps: true, personalStats: true } },
  creator: { tier: 'creator', name: 'Communities & Creators', badge: 'Creator', badgeLabel: 'Creator Pass', rank: 2, limits: { hostedPlans: 200, recurringPlans: true, roomCapacity: 12, premiumThemes: true, premiumAvatars: true, reactionPacks: true, advancedRecaps: true, personalStats: true } }
};

export function normalizeTier(value: unknown): MembershipTier {
  return value === 'plus' || value === 'creator' ? value : 'free';
}

export function tierAtLeast(tier: unknown, required: MembershipTier): boolean {
  return TIER_INFO[normalizeTier(tier)].rank >= TIER_INFO[required].rank;
}

export const BILLING_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'] as const;
export type BillingCurrency = (typeof BILLING_CURRENCIES)[number];
export type BillingInterval = 'monthly' | 'yearly';

/** Prices in MINOR units (paise / cents). Illustrative starting prices to test, not validated market prices. */
export const TIER_PRICES: Record<Exclude<MembershipTier, 'free'>, Record<BillingCurrency, Record<BillingInterval, number>>> = {
  plus: {
    INR: { monthly: 9900, yearly: 99000 },
    USD: { monthly: 119, yearly: 1199 },
    EUR: { monthly: 119, yearly: 1199 },
    GBP: { monthly: 99, yearly: 999 }
  },
  creator: {
    INR: { monthly: 14900, yearly: 149000 },
    USD: { monthly: 179, yearly: 1799 },
    EUR: { monthly: 179, yearly: 1799 },
    GBP: { monthly: 149, yearly: 1499 }
  }
};

/** Games on the roadmap. Shown as "Coming soon" and marked with the pass that will unlock them; nothing here is playable yet. Every game built so far is live (Imposter, Emoji Charades, Mafia Night, Quiz Show Studio, Murder Mystery Night and Tournament Arena: see GAME_DEFINITIONS requiredHostTier), so the list is EMPTY today: every consumer must handle that and hide the empty section. */
export interface UpcomingGame { id: string; title: string; tier: 'plus' | 'creator'; blurb: string; players: string; category: string; icon: string }
export const UPCOMING_GAMES: readonly UpcomingGame[] = [];
