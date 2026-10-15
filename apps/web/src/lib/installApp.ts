/** What the "install the app" prompt should offer on this device (pure, so it can be unit-tested). */
export type InstallState =
  | 'installed' // already running as an installed app: nothing to ask
  | 'ios-safari' // iPhone/iPad Safari tab: must use Share → Add to Home Screen
  | 'ios-other-browser' // iPhone/iPad Chrome/Firefox/etc: only Safari can add to the Home Screen
  | 'can-prompt' // Chrome/Edge/Android: the browser lets us open its install dialog
  | 'none'; // desktop or unsupported: nothing needed

export function detectInstallState(opts: {
  userAgent: string;
  maxTouchPoints?: number;
  standalone: boolean;
  hasInstallPrompt: boolean;
}): InstallState {
  if (opts.standalone) return 'installed';
  const ua = opts.userAgent;
  // iPadOS 13+ reports itself as a Mac, but has a touch screen
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (opts.maxTouchPoints ?? 0) > 1);
  if (isIOS) {
    const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua);
    return otherBrowser ? 'ios-other-browser' : 'ios-safari';
  }
  return opts.hasInstallPrompt ? 'can-prompt' : 'none';
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}
