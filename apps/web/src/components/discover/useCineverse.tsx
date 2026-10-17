'use client';

import { useEffect, useState } from 'react';
import { getStoredSession, type UserSession } from '../../lib/api';

/** Signed-in session (guests / anonymous sessions count as signed out). */
export function useSignedInSession(): { session: UserSession | null; ready: boolean } {
  const [session, setSession] = useState<UserSession | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const s = getStoredSession();
    setSession(s && s.token && !s.user?.isAnonymous ? s : null);
    setReady(true);
  }, []);
  return { session, ready };
}
