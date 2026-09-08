'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Lock } from 'lucide-react';

interface InAppBrowserBarProps {
  currentUrl?: string;
  onNavigate?: (url: string) => void;
}

export function InAppBrowserBar({
  currentUrl = 'https://watch.stitchbyte.in',
  onNavigate
}: InAppBrowserBarProps) {
  const [url, setUrl] = useState(currentUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onNavigate && url.trim()) {
      onNavigate(url.trim());
    }
  };

  return (
    <div className="w-full flex items-center space-x-2.5 px-3 py-2 bg-[#121622] rounded-t-2xl border border-b-0 border-[#1e2538] text-zinc-300 select-none">
      {/* Browser Navigation Buttons */}
      <div className="flex items-center space-x-2 text-zinc-400">
        <button
          className="p-1 hover:bg-white/5 hover:text-white rounded-lg transition"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          className="p-1 hover:bg-white/5 hover:text-white rounded-lg transition"
          title="Forward"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onNavigate && onNavigate(url)}
          className="p-1 hover:bg-white/5 hover:text-white rounded-lg transition"
          title="Reload"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* URL Address Bar */}
      <form onSubmit={handleSubmit} className="flex-1 max-w-xl">
        <div className="flex items-center space-x-2 px-3.5 py-1.5 bg-[#0a0d14] rounded-full border border-[#1e2538] text-xs focus-within:border-emerald-500/60 transition">
          <Lock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none placeholder-zinc-500 font-mono tracking-tight"
            placeholder="Enter streaming URL..."
          />
        </div>
      </form>
    </div>
  );
}
