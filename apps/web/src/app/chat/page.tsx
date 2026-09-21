'use client';

import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { AppSidebar } from '../../components/layout/AppSidebar';
import { ChatLayout } from '../../components/chat/ChatLayout';

export default function ChatPage() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="h-screen bg-[#F8F9FC] dark:bg-zinc-950 text-slate-900 dark:text-white flex overflow-hidden font-sans">
      {/* Centralized App Sidebar with 'chat' active */}
      <AppSidebar
        activeNav="chat"
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Chat Workspace */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden relative">
        {/* Mobile Top Header with Menu Button */}
        <header className="lg:hidden h-12 px-3 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 flex items-center justify-between shrink-0 z-20">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-1.5 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl"
            aria-label="Open Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-sm tracking-tight">watch. chat</span>
          <div className="w-8" />
        </header>

        {/* Chat Application */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ChatLayout />
        </div>
      </main>
    </div>
  );
}
