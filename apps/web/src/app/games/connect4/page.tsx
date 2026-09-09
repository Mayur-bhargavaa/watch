'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Connect4RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/games/four-in-a-row');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0d0e15] flex items-center justify-center text-white">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-zinc-400">Loading Four in a Row...</span>
      </div>
    </div>
  );
}
