'use client';

import React from 'react';
import { AppIcon } from '../../ui/AppIcon';

interface SpectatorBannerProps {
  count?: number;
  names?: string[];
  /** Optional line such as whose turn it is. */
  status?: string | null;
  onLeave?: () => void;
  leaveLabel?: string;
  className?: string;
}

/** Shared read-only banner shown to spectators on every game page. */
export const SpectatorBanner: React.FC<SpectatorBannerProps> = ({
  count = 0,
  names = [],
  status,
  onLeave,
  leaveLabel = 'Leave',
  className = ''
}) => {
  const n = Math.max(0, Math.floor(count || 0));
  const title = names.length > 0 ? `Also watching: ${names.join(', ')}` : undefined;
  return (
    <div
      role="status"
      data-testid="spectator-banner"
      title={title}
      className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-sm text-sky-100 backdrop-blur ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <AppIcon name="eye" className="h-4 w-4 shrink-0" />
        <span className="font-bold">You are watching (read-only)</span>
        <span className="inline-flex items-center gap-1 text-xs opacity-80">
          <AppIcon name="users" className="h-3.5 w-3.5" />
          {n} {n === 1 ? 'spectator' : 'spectators'}
        </span>
        {status ? <span className="truncate text-xs opacity-90">{status}</span> : null}
      </div>
      {onLeave ? (
        <button
          type="button"
          onClick={onLeave}
          className="rounded-full border border-sky-300/40 px-3 py-1 text-xs font-bold hover:bg-sky-400/20"
        >
          {leaveLabel}
        </button>
      ) : null}
    </div>
  );
};

export default SpectatorBanner;
