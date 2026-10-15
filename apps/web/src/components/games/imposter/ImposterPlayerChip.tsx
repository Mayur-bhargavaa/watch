'use client';

import React from 'react';
import { AppIcon } from '../../ui/AppIcon';

interface ImposterPlayerChipProps {
  name: string;
  avatarUrl?: string | null;
  isHost?: boolean;
  isMe?: boolean;
  connected?: boolean;
  left?: boolean;
  /** highlight ring (whose turn it is, selected vote...) */
  active?: boolean;
  size?: 'sm' | 'md';
}

const HUES = ['bg-zinc-600', 'bg-slate-600', 'bg-stone-600', 'bg-sky-700', 'bg-teal-700', 'bg-emerald-700', 'bg-amber-700', 'bg-neutral-700'];

function hueFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

/** Round avatar (picture or initial) with host crown and a connection dot. */
export const ImposterPlayerChip: React.FC<ImposterPlayerChipProps> = ({
  name,
  avatarUrl,
  isHost = false,
  isMe = false,
  connected = true,
  left = false,
  active = false,
  size = 'md'
}) => {
  const dim = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <div className={`relative shrink-0 ${left ? 'opacity-40' : ''}`}>
      <div
        className={`${dim} flex items-center justify-center overflow-hidden rounded-full font-semibold text-white ring-2 ${
          active ? 'ring-[#ee1d49] ring-offset-2 ring-offset-white dark:ring-offset-[#14151b]' : isMe ? 'ring-zinc-400 dark:ring-zinc-500' : 'ring-zinc-200 dark:ring-white/10'
        } ${avatarUrl ? 'bg-zinc-100 dark:bg-[#22232c]' : hueFor(name)}`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true">{(name || '?').trim().charAt(0).toUpperCase()}</span>
        )}
      </div>
      {isHost && (
        <span className="absolute -right-1 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white" title="Host">
          <AppIcon name="crown" className="h-2.5 w-2.5" />
        </span>
      )}
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-[#14151b] ${connected && !left ? 'bg-emerald-500' : 'bg-zinc-400'}`}
        title={left ? 'Left the game' : connected ? 'Connected' : 'Reconnecting'}
      />
    </div>
  );
};

export default ImposterPlayerChip;
