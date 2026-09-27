'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface ActiveWatchParty {
  slug: string;
  roomId?: string;
  title: string;
  mediaUrl?: string;
  mediaProvider?: string;
  mediaTitle?: string;
  isPlaying: boolean;
  participantCount: number;
}

interface WatchPartyContextValue {
  activeParty: ActiveWatchParty | null;
  isPiPEnabled: boolean;
  setActiveParty: (party: ActiveWatchParty | null) => void;
  updatePartyState: (updates: Partial<ActiveWatchParty>) => void;
  togglePiP: (enabled?: boolean) => void;
  leaveParty: () => void;
  returnToRoom: () => void;
}

const WatchPartyContext = createContext<WatchPartyContextValue | undefined>(undefined);

export const WatchPartyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [activeParty, setActivePartyState] = useState<ActiveWatchParty | null>(null);
  const [isPiPEnabled, setIsPiPEnabled] = useState(true);

  const setActiveParty = useCallback((party: ActiveWatchParty | null) => {
    setActivePartyState(party);
  }, []);

  const updatePartyState = useCallback((updates: Partial<ActiveWatchParty>) => {
    setActivePartyState((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const togglePiP = useCallback((enabled?: boolean) => {
    setIsPiPEnabled((prev) => (typeof enabled === 'boolean' ? enabled : !prev));
  }, []);

  const leaveParty = useCallback(() => {
    setActivePartyState(null);
  }, []);

  const returnToRoom = useCallback(() => {
    if (activeParty?.slug) {
      router.push(`/room/${activeParty.slug}`);
    }
  }, [activeParty?.slug, router]);

  const value = useMemo(
    () => ({
      activeParty,
      isPiPEnabled,
      setActiveParty,
      updatePartyState,
      togglePiP,
      leaveParty,
      returnToRoom,
    }),
    [activeParty, isPiPEnabled, setActiveParty, updatePartyState, togglePiP, leaveParty, returnToRoom]
  );

  return <WatchPartyContext.Provider value={value}>{children}</WatchPartyContext.Provider>;
};

export function useWatchParty() {
  const ctx = useContext(WatchPartyContext);
  if (!ctx) {
    throw new Error('useWatchParty must be used within a WatchPartyProvider');
  }
  return ctx;
}
