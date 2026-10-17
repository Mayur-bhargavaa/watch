/**
 * The user's standing Bitmoji (the avatar shown behind the top-right of the hero banner on Home and Discover).
 * `getStandingBitmojiUrl` is the same logic as Home (app/dashboard/page.tsx): local avatars are used as they are,
 * remote avatar URLs lose the radius / background parameters so the figure renders as a transparent standing torso.
 */
export const DEFAULT_STANDING_BITMOJI = 'https://api.dicebear.com/7.x/avataaars/svg?seed=watch_dcu82&skinColor=edb98a&top=shortCurly&hairColor=4a312c&accessoriesProbability=0&clothing=blazerAndShirt&clothesColor=25557c&eyes=wink&mouth=smile';

export const getStandingBitmojiUrl = (url?: string) => {
  if (!url) {
    return DEFAULT_STANDING_BITMOJI;
  }
  if (url.startsWith('/avatars/')) {
    return url;
  }
  return url
    .replace(/[?&]radius=[^&]+/g, '')
    .replace(/[?&]backgroundColor=[^&]+/g, '');
};

interface SessionLike {
  token?: string | null;
  user?: { avatarUrl?: string | null; isAnonymous?: boolean } | null;
}

/**
 * The Bitmoji to show for a stored session, or null when there is nothing to show: no session, a guest / anonymous
 * account, or no chosen avatar. Callers render nothing for null (never a broken image or a made-up default).
 */
export function bitmojiForSession(session: SessionLike | null | undefined): string | null {
  if (!session || !session.token || !session.user || session.user.isAnonymous) return null;
  const avatar = typeof session.user.avatarUrl === 'string' ? session.user.avatarUrl.trim() : '';
  if (!avatar) return null;
  return getStandingBitmojiUrl(avatar) || null;
}
