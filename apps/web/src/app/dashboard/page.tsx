'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function DashboardRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'games') {
      router.replace('/games');
    } else if (tab === 'watchlist') {
      router.replace('/watchlist');
    } else if (tab === 'myrooms' || tab === 'rooms') {
      router.replace('/rooms');
    } else if (tab === 'friends') {
      router.replace('/friends');
    } else {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      router.replace(`/discover${search}`);
    }
  }, [router, searchParams]);

  return null;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardRedirectInner />
    </Suspense>
  );
}
