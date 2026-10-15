'use client';

import React from 'react';
import type { TournamentLogEntry } from '@synccinema/common';
import { AppIcon } from '../../ui/AppIcon';

const ICON: Record<TournamentLogEntry['kind'], string> = { system: 'info', result: 'check', forfeit: 'flag', host: 'crown' };

function timeText(at: number): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** The public tournament log: results, forfeits and every organiser decision, newest first. */
export const TournamentLog: React.FC<{ log: TournamentLogEntry[]; limit?: number }> = ({ log, limit = 40 }) => {
  const rows = [...log].reverse().slice(0, limit);
  return (
    <section aria-label="Tournament log" data-testid="tournament-log" className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4">
      <h2 className="mb-2 text-sm font-bold text-zinc-900 dark:text-white">Log</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Nothing has happened yet.</p>
      ) : (
        <ul className="max-h-60 space-y-1 overflow-y-auto pr-1">
          {rows.map((l) => (
            <li key={l.id} className="flex items-start gap-2 text-xs">
              <AppIcon name={ICON[l.kind] ?? 'info'} className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${l.kind === 'host' ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-400'}`} />
              <span className="min-w-0 flex-1 text-zinc-800 dark:text-zinc-200">{l.text}</span>
              <span className="shrink-0 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{timeText(l.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default TournamentLog;
