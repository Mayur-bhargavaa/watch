'use client';

import React from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { QuizGameView } from '@synccinema/common';
import { podium, ordinal } from '../../../lib/quizShowView';
import { BingoPartyPoppers } from '../bingo-duel/BingoPartyPoppers';
import { ImposterPlayerChip } from '../imposter/ImposterPlayerChip';
import { QuizLeaderboard } from './QuizLeaderboard';

interface QuizFinalScreenProps {
  view: QuizGameView;
  myUserId: string;
  isSpectator: boolean;
  isHost: boolean;
  /** the host can start the same quiz again (needs a player still in the room) */
  canRematch: boolean;
  onRematch: () => void;
  onEditAgain: () => void;
  onLeave: () => void;
}

const CARD = 'rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4';
const PODIUM_HEIGHT: Record<number, string> = { 1: 'h-24', 2: 'h-16', 3: 'h-12' };
const PODIUM_FILL: Record<number, string> = { 1: 'bg-[#ee1d49]', 2: 'bg-zinc-600', 3: 'bg-zinc-500' };

/** Final screen: the podium of the top 3, the full leaderboard, the winner and (for the host) rematch / edit the quiz. */
export const QuizFinalScreen: React.FC<QuizFinalScreenProps> = ({ view, myUserId, isSpectator, isHost, canRematch, onRematch, onEditAgain, onLeave }) => {
  const aborted = view.phase === 'ABORTED';
  const winner = view.leaderboard.find((r) => r.userId === view.winnerUserId) ?? null;
  const top = podium(view.leaderboard);
  const mine = view.leaderboard.find((r) => r.userId === myUserId);

  return (
    <div data-testid="final-screen" className="mx-auto w-full max-w-xl space-y-2.5 motion-safe:animate-imposter-in">
      {!aborted && winner && <BingoPartyPoppers durationMs={6000} isSoundMuted />}
      <div className={`${CARD} text-center`}>
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <AppIcon name={aborted ? 'warning' : 'trophy'} className="h-5 w-5" />
        </div>
        {aborted ? (
          <>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Quiz ended</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{view.statusMessage || 'The quiz was stopped.'}</p>
          </>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Final results</p>
            <h2 className="mt-0.5 text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl" data-testid="winner-headline">{winner ? `${winner.displayName} wins!` : 'The quiz is over'}</h2>
            {!isSpectator && !isHost && mine && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">You finished {ordinal(mine.rank)} with {mine.score} points.</p>}
          </>
        )}
      </div>

      {!aborted && top.length > 0 && (
        <div className={`${CARD}`} data-testid="podium" aria-label="Podium">
          <div className="flex items-end justify-center gap-2">
            {top.map((r) => (
              <div key={r.userId} className="flex w-24 flex-col items-center sm:w-28" data-testid={`podium-${r.rank}`}>
                <ImposterPlayerChip name={r.displayName} avatarUrl={r.avatarUrl} connected={r.connected} left={r.left} isMe={r.userId === myUserId} />
                <p className="mt-1 w-full truncate text-center text-xs font-bold text-zinc-900 dark:text-white">{r.displayName}</p>
                <p className="text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">{r.score}</p>
                <div className={`mt-1 flex w-full items-center justify-center rounded-t-lg text-lg font-extrabold text-white ${PODIUM_HEIGHT[r.rank] ?? 'h-10'} ${PODIUM_FILL[r.rank] ?? 'bg-zinc-500'}`}>{r.rank}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <QuizLeaderboard rows={view.leaderboard} myUserId={myUserId} limit={null} title="Full leaderboard" />

      <div className="flex flex-col gap-2 sm:flex-row">
        {isHost && canRematch && (
          <button type="button" onClick={onRematch} className="h-10 flex-1 rounded-xl bg-[#ee1d49] px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0c0d12]">
            Play again (same quiz)
          </button>
        )}
        {isHost && (
          <button type="button" onClick={onEditAgain} className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]">
            Edit the quiz
          </button>
        )}
        <button type="button" onClick={onLeave} className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]">
          Back to games
        </button>
      </div>
      {!isHost && !isSpectator && !aborted && <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">The host can start another round or change the questions.</p>}
    </div>
  );
};

export default QuizFinalScreen;
