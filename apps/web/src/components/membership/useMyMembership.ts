'use client';

import { useEffect, useState } from 'react';
import { loadBillingMe, peekBillingMe, subscribeBillingMe, type BillingMe } from '../../lib/billingApi';
import { getStoredSession } from '../../lib/api';

/** The signed-in user's own membership from /api/billing/me, shared through a module-level cache. */
export function useMyMembership(): BillingMe | null {
  const [me, setMe] = useState<BillingMe | null>(peekBillingMe());
  useEffect(() => {
    const s = getStoredSession();
    if (!s?.user || s.user.isAnonymous) return;
    const unsub = subscribeBillingMe(() => setMe(peekBillingMe()));
    void loadBillingMe().then((v) => v && setMe(v));
    return unsub;
  }, []);
  return me;
}
