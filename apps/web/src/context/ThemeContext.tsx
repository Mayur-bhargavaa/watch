'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  /** Toggles light/dark with a colour wipe that spreads from the clicked button (bottom-left) to the opposite corner. */
  toggleTheme: (event?: unknown) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'watch_theme';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [mounted, setMounted] = useState(false);
  // Where the wipe starts: the last pointer press (the toggle button); keyboard use falls back to bottom-left
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const transitioning = useRef(false);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      lastPointer.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, []);

  // Initialize theme from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        setThemeState(stored);
      } else {
        setThemeState('light');
      }
    } catch {
      setThemeState('light');
    }
    setMounted(true);
  }, []);

  // Sync DOM classes whenever theme changes or system preference changes
  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = () => {
      const currentResolved: ResolvedTheme =
        theme === 'system' ? getSystemTheme() : theme;

      setResolvedTheme(currentResolved);

      if (currentResolved === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // storage unavailable / sandboxed
    }
  };

  const applyDomTheme = (t: ResolvedTheme) => {
    const root = document.documentElement;
    root.classList.toggle('dark', t === 'dark');
    root.classList.toggle('light', t === 'light');
    root.style.colorScheme = t;
  };

  const toggleTheme = (event?: unknown) => {
    const next: ResolvedTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } };
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!doc.startViewTransition || reduceMotion || transitioning.current) {
      setTheme(next);
      return;
    }

    // Origin of the wipe: the click that triggered this (or the last press), else the bottom-left corner
    const ev = event as { clientX?: number; clientY?: number } | undefined;
    const origin =
      typeof ev?.clientX === 'number' && typeof ev?.clientY === 'number' && (ev.clientX !== 0 || ev.clientY !== 0)
        ? { x: ev.clientX, y: ev.clientY }
        : lastPointer.current ?? { x: 0, y: window.innerHeight };
    // Radius that reaches the farthest corner (so the colour finishes in the top-right when started bottom-left)
    const radius = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y));

    transitioning.current = true;
    const transition = doc.startViewTransition(() => {
      // Must change the DOM synchronously so the browser can snapshot "after"
      applyDomTheme(next);
      flushSync(() => setTheme(next));
    });

    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
          { duration: 800, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' }
        );
      })
      .catch(() => {});
    void transition.finished.finally(() => {
      transitioning.current = false;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback if rendered outside ThemeProvider
    return {
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}
