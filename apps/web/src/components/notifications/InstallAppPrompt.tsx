'use client';

import React, { useEffect, useState } from 'react';
import { Download, X, Share, SquarePlus, Check } from 'lucide-react';
import { getStoredSession } from '../../lib/api';
import { detectInstallState, isStandaloneDisplay, InstallState } from '../../lib/installApp';
import { getDeviceType } from '../../lib/deviceToken';

const DISMISSED_KEY = 'watch_install_prompt_dismissed_at';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    return Boolean(at) && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

/**
 * Asks phone users to install the app. iPhones only allow notifications for apps added to the Home Screen, and
 * iOS offers no way to do that from code, so on iOS we show the exact steps; on Android/Chrome one tap opens the
 * browser's own install dialog.
 */
export const InstallAppPrompt: React.FC = () => {
  const [state, setState] = useState<InstallState>('none');
  const [signedIn, setSignedIn] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const sync = () => setSignedIn(Boolean(getStoredSession()?.user));
    sync();
    window.addEventListener('synccinema:session-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('synccinema:session-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    const evaluate = (ev: BeforeInstallPromptEvent | null) =>
      setState(
        detectInstallState({
          userAgent: navigator.userAgent,
          maxTouchPoints: navigator.maxTouchPoints,
          standalone: isStandaloneDisplay(),
          hasInstallPrompt: Boolean(ev)
        })
      );
    evaluate(null);
    setHidden(recentlyDismissed());

    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep it for our own button
      const ev = e as BeforeInstallPromptEvent;
      setInstallEvent(ev);
      evaluate(ev);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setState('installed');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {}
  };

  const install = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } catch (err) {
      console.warn('[install] prompt failed:', err);
    }
    setInstallEvent(null);
    dismiss();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('[install] could not copy link:', err);
    }
  };

  const isPhoneLike = getDeviceType() !== 'desktop';
  const relevant = state === 'ios-safari' || state === 'ios-other-browser' || (state === 'can-prompt' && isPhoneLike);
  if (!signedIn || hidden || !relevant) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9998] p-3 sm:p-4 flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md rounded-3xl bg-white dark:bg-[#181324] border border-slate-200 dark:border-white/10 shadow-2xl shadow-black/40 p-5 relative">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Not now"
          className="absolute top-3 right-3 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#ee1d49] to-[#ff4b72] text-white flex items-center justify-center shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Get alerts on this phone</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
              {state === 'can-prompt'
                ? 'Install Watch to get message, call and game alerts even when the app is closed.'
                : 'On iPhone, alerts only work once Watch is added to your Home Screen. It takes 10 seconds:'}
            </p>
          </div>
        </div>

        {state === 'ios-safari' && (
          <ol className="mt-4 space-y-2.5 text-xs text-slate-700 dark:text-zinc-200">
            <li className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04]">
              <span className="w-6 h-6 rounded-full bg-[#ee1d49] text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
              <span className="flex-1">Tap the <strong>Share</strong> button in Safari&apos;s toolbar</span>
              <Share className="w-4 h-4 text-[#007aff] shrink-0" />
            </li>
            <li className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04]">
              <span className="w-6 h-6 rounded-full bg-[#ee1d49] text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
              <span className="flex-1">Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong></span>
              <SquarePlus className="w-4 h-4 text-slate-500 shrink-0" />
            </li>
            <li className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04]">
              <span className="w-6 h-6 rounded-full bg-[#ee1d49] text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
              <span className="flex-1">Open <strong>Watch</strong> from your Home Screen and tap <strong>Allow</strong> on the notification question</span>
            </li>
          </ol>
        )}

        {state === 'ios-other-browser' && (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-slate-700 dark:text-zinc-200 leading-relaxed">
            Home Screen apps can only be added from <strong>Safari</strong>. Open this site in Safari (copy the link below and paste it there), then follow the Share → Add to Home Screen steps.
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          {state === 'can-prompt' && (
            <button
              type="button"
              onClick={install}
              className="flex-1 py-2.5 rounded-xl bg-[#ee1d49] hover:bg-[#ff2b5e] text-white text-xs font-bold cursor-pointer"
            >
              Install app
            </button>
          )}
          {state === 'ios-other-browser' && (
            <button
              type="button"
              onClick={copyLink}
              className="flex-1 py-2.5 rounded-xl bg-[#ee1d49] hover:bg-[#ff2b5e] text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : null}
              {copied ? 'Link copied' : 'Copy link for Safari'}
            </button>
          )}
          {state === 'ios-safari' && (
            <button
              type="button"
              onClick={dismiss}
              className="flex-1 py-2.5 rounded-xl bg-[#ee1d49] hover:bg-[#ff2b5e] text-white text-xs font-bold cursor-pointer"
            >
              Got it, I&apos;ll do it now
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};
