'use client';

import React, { useState } from 'react';
import { AppSidebar } from '../layout/AppSidebar';
import { AppHeader } from '../layout/AppHeader';

import type { SidebarNavItem } from '../../lib/sidebarNav';

/** Page frame shared by /discover, the title pages and /watchlist: composed exactly like Home (sidebar + scrolling column with the header). */
export function DiscoverShell({ children, activeNav = 'home' }: { children: React.ReactNode; activeNav?: SidebarNavItem }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#111217] text-slate-900 dark:text-slate-100 flex selection:bg-rose-600 selection:text-white font-sans antialiased overflow-x-hidden transition-colors duration-150">
      <AppSidebar activeNav={activeNav} isMobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <main className="flex-1 flex flex-col h-screen overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
        <AppHeader onOpenMobileSidebar={() => setMobileOpen(true)} />
        <div className="w-full pb-[max(2.5rem,env(safe-area-inset-bottom))]">{children}</div>
      </main>
    </div>
  );
}

/** Room codes are 3-40 chars of letters, digits, dash and underscore; anything else is ignored. */
export function cleanRoomParam(value: string | null): string | null {
  return value && /^[A-Za-z0-9_-]{3,64}$/.test(value) ? value : null;
}
