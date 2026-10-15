'use client';

import React from 'react';
import type { MurderGameView } from '@synccinema/common';
import { AppIcon } from '../../ui/AppIcon';
import { PartyPoppers } from '../common/PartyPoppers';
import { ImposterPlayerChip } from '../imposter/ImposterPlayerChip';
import { characterName, iWon, myRow, podiumLabel, podiumOrder } from '../../../lib/murderMysteryView';
import { MurderRowsTable, MurderSecretsList, MurderTimeline } from './MurderResult';
import { MurderScoring } from './MurderScoring';

interface RematchState { votedUserIds?: string[]; votedCount?: number; totalNeeded?: number }

interface MurderFinalScreenProps {
  view: MurderGameView;
  isSpectator: boolean;
  isHost: boolean;
  rematchStatus: RematchState | null;
  rematchUnavailable: boolean;
  myUserId: string;
  onRematch: () => void;
  onLeave: () => void;
}

const CARD = 'rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4';
const HEIGHTS: Record<number, string> = { 1: 'h-24', 2: 'h-16', 3: 'h-12' };

/** Final screen: podium, the leaderboard with everyone's accusation, the truth recap and the host's rematch (another case). */
export const MurderFinalScreen: React.FC<MurderFinalScreenProps> = ({ view, isSpectator, isHost, rematchStatus, rematchUnavailable, myUserId, onRematch, onLeave }) => {
  const aborted = view.phase === 'ABORTED';
  const r = view.result;
  const podium = r ? podiumOrder(r.rows) : [];
  const mine = myRow(view, myUserId);
  const celebrate = !aborted && !isSpectator && (iWon(view, myUserId) || Boolean(mine?.correct));
  const waiting = Boolean(rematchStatus && (rematchStatus.votedCount ?? 0) > 0);

  return (
    <div data-testid="final-screen" className="mx-auto w-full space-y-2.5 motion-safe:animate-imposter-in">
      {celebrate && <PartyPoppers durationMs={6000} isSoundMuted />}
      <div className={`${CARD} text-center`}>
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <AppIcon name={aborted ? 'warning' : 'trophy'} className="h-5 w-5" />
        </div>
        {aborted || !r ? (
          <>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Game ended</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{view.statusMessage || 'Not enough players were left to continue. Nothing was revealed.'}</p>
          </>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Final leaderboard</p>
            <h2 className="mt-0.5 text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl">{characterName(view, r.murdererCharacterId)} did it</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{view.case?.title}</p>
          </>
        )}
      </div>

      {!aborted && r && (
        <>
          <div className={CARD} data-testid="podium">
            <div className="flex items-end justify-center gap-2">
              {podium.map((p) => (
                <div key={p.userId} className="flex w-24 flex-col items-center sm:w-28">
                  <ImposterPlayerChip name={p.displayName} avatarUrl={p.avatarUrl} left={p.left} isMe={p.userId === myUserId} />
                  <p className="mt-1 w-full truncate text-center text-xs font-bold text-zinc-900 dark:text-white">{p.displayName}</p>
                  <p className="font-mono text-xs font-bold text-zinc-600 dark:text-zinc-300">{p.total}</p>
                  <div className={`mt-1 flex w-full items-start justify-center rounded-t-lg pt-1 text-sm font-bold ${HEIGHTS[p.rank] || 'h-10'} ${p.rank === 1 ? 'bg-amber-500 text-black' : 'bg-zinc-200 text-zinc-800 dark:bg-[#22232c] dark:text-zinc-100'}`}>
                    {podiumLabel(p.rank)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2.5 lg:grid-cols-[1.4fr_1fr]">
            <div className={CARD}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Everyone&apos;s accusation</h3>
              <MurderRowsTable view={view} rows={r.rows} myUserId={myUserId} />
            </div>
            <div className="space-y-2.5">
              <MurderScoring />
              {r.timeline.length > 0 && (
                <div className={CARD}>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">What really happened</h3>
                  <MurderTimeline timeline={r.timeline} />
                </div>
              )}
            </div>
          </div>
          <details className={CARD}>
            <summary className="cursor-pointer text-xs font-semibold text-zinc-800 dark:text-zinc-100">Everyone&apos;s secrets</summary>
            <div className="mt-2"><MurderSecretsList view={view} /></div>
          </details>
        </>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {!isSpectator && isHost && !rematchUnavailable && (
          <button type="button" onClick={onRematch} disabled={waiting} className="h-10 flex-1 rounded-xl bg-[#ee1d49] px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 disabled:opacity-70 dark:focus-visible:ring-offset-[#0c0d12]">
            Play another case
          </button>
        )}
        <button type="button" onClick={onLeave} className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]">
          Back to games
        </button>
      </div>
      {!isSpectator && !isHost && !aborted && <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">The host can start another case with the same group.</p>}
      {!isSpectator && isHost && rematchUnavailable && <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">A rematch needs enough players still in the room.</p>}
    </div>
  );
};

export default MurderFinalScreen;
