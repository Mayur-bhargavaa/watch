/** Which sidebar item a route highlights. Pure, so the rules (and every route that renders the sidebar) are unit tested. */
export type SidebarNavItem =
  | 'home'
  | 'dashboard'
  | 'discover'
  | 'watchlist'
  | 'friends'
  | 'plans'
  | 'rooms'
  | 'games'
  | 'chat'
  | 'notifications'
  | 'profile'
  | 'pricing'
  | 'settings';

const underPath = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** The item a pathname belongs to. `/discover` and `/dashboard` are Home; `/games/...` is Games. */
export function sidebarItemForPath(pathname: string): SidebarNavItem {
  const p = (pathname || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (p === '/' || underPath(p, '/dashboard') || underPath(p, '/discover')) return 'home';
  if (underPath(p, '/watchlist')) return 'watchlist';
  if (underPath(p, '/rooms')) return 'rooms';
  if (underPath(p, '/friends')) return 'friends';
  if (underPath(p, '/plans')) return 'plans';
  if (underPath(p, '/games')) return 'games';
  if (underPath(p, '/chat')) return 'chat';
  if (underPath(p, '/profile')) return 'profile';
  if (underPath(p, '/pricing')) return 'pricing';
  return 'home';
}

/** An explicit `activeNav` from a page wins, with legacy names "dashboard" and "discover" meaning Home. */
export function resolveActiveNav(explicit: SidebarNavItem | undefined, pathname: string): SidebarNavItem {
  if (!explicit) return sidebarItemForPath(pathname);
  return explicit === 'dashboard' || explicit === 'discover' ? 'home' : explicit;
}
