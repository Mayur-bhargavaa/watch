'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupRedirect() {
  const router = useRouter();
  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(search);
    params.set('tab', 'signup');
    router.replace(`/login?${params.toString()}`);
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#d2281e] border-t-transparent animate-spin" />
    </div>
  );
}
