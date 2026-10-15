'use client';

import React from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { EmojiCharadesGameView } from '@synccinema/common';
import { EMOJI_CHARADES_MIN_PLAYERS } from '@synccinema/common';
import { leaderboard, playerName, podium } from '../../../lib/emojiCharadesView';
import { BingoPartyPoppers } from '../bingo-duel/BingoPartyPoppers';
import { EmojiCharadesScoreboard } from './EmojiCharadesScoreboard';

interface RematchState {
  votedUserIds?: string[];
  votedCount?: number;
  totalNeeded?: number;
}

interface EmojiCharadesFinalScreenProps {
  view: EmojiCharadesGameView;
  myUserId: string;
  isSpectator: boolean;
  rematchStatus: RematchState | null;
  rematchUnavailable: boolean;
  onRematch: () => void;
  onLeave: () => void;
}

/** Podium columns on screen: 2nd, 1st, 3rd (`place` is the index into the top three). */
const COLUMN = [
  { place: 1, height: 'h-24', tone: 'from-slate-300 to-slate-400 text-slate-800' },
  { place: 0, height: 'h-32', tone: 'from-amber-300 to-amber-500 text-amber-950' },
  { place: 2, height: 'h-20', tone: 'from-orange-300 to-orange-500 text-orange-950' }
];

/** Winner screen after the last round (or after the game was ended early): podium, scores, the answers, rematch. */
export const EmojiCharadesFinalScreen: React.FC<EmojiCharadesFinalScreenProps> = ({ view, myUserId, isSpectator, rematchStatus, rematchUnavailable, onRematch, onLeave }) => {
  const aborted = view.phase === 'ABORTED';
  const winners = view.winnerUserIds.map((id) => playerName(view.players, id));
  const iWon = view.winnerUserIds.includes(myUserId);
  const iVoted = Boolean(rematchStatus?.votedUserIds?.includes(myUserId));
  const rows = leaderboard(view);
  const top = podium(view);

  return (
    <div data-testid="final-screen" className="mx-auto w-full max-w-xl space-y-4">
      {iWon && !aborted && !isSpectator && <BingoPartyPoppers durationMs={6000} isSoundMuted />}
      <div className={`rounded-[2rem] p-6 text-center text-white shadow-xl sm:p-8 ${aborted ? 'bg-gradient-to-br from-slate-500 to-slate-700' : 'bg-gradient-to-br from-amber-500 via-[#ff2b70] to-violet-600'}`}>
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
          <AppIcon name={aborted ? 'warning' : 'trophy'} className="h-8 w-8" />
        </div>
        {aborted ? (
          <>
            <h2 className="text-3xl font-black">Game ended</h2>
            <p className="mt-2 text-sm text-white/90">{view.statusMessage || 'Not enough players were left to continue.'}</p>
          </>
        ) : winners.length === 0 ? (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">Game over</p>
            <h2 className="mt-1 text-3xl font-black sm:text-4xl">Nobody scored</h2>
            <p className="mt-2 text-sm text-white/90">Those were tough ones. Play again?</p>
          </>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">Game over</p>
            <h2 className="mt-1 text-3xl font-black sm:text-4xl">{winners.length === 1 ? `${winners[0]} wins!` : `${winners.join(' and ')} win!`}</h2>
            <p className="mt-2 text-sm text-white/90">{rows[0] ? `${rows[0].score} points after ${view.totalRounds} rounds` : ''}</p>
          </>
        )}
      </div>

      {!aborted && top.length > 0 && top[0].score > 0 && (
        <div data-testid="podium" className="rounded-3xl border border-white/60 bg-white/80 p-4 pt-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#121629]/80">
          <div className="flex items-end justify-center gap-2 sm:gap-3">
            {COLUMN.map((col) => {
              const entry = top[col.place];
              if (!entry) return <div key={col.place} className="w-24 sm:w-28" />;
              return (
                <div key={col.place} className="flex w-24 flex-col items-center sm:w-28" data-rank={entry.rank}>
                  {entry.rank === 1 && <AppIcon name="crown" className="mb-1 h-6 w-6 text-amber-500" />}
                  <p className="w-full truncate text-center text-sm font-black text-[#16132b] dark:text-white">{entry.name}{entry.userId === myUserId ? ' (you)' : ''}</p>
                  <p className="mb-1 text-xs font-bold tabular-nums text-slate-500 dark:text-zinc-400">{entry.score}</p>
                  <div className={`flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b pt-2 text-2xl font-black ${col.height} ${col.tone}`}>{entry.rank}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <EmojiCharadesScoreboard view={view} myUserId={myUserId} title="Final scores" />

      {view.history.length > 0 && (
        <div className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#121629]/80 sm:p-5">
          <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-[#16132b] dark:text-white">The puzzles</h3>
          <ul className="space-y-1.5">
            {view.history.map((h) => (
              <li key={h.round} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-white/5">
                <span className="min-w-0 truncate font-bold text-slate-700 dark:text-zinc-200">
                  <span className="mr-2" aria-hidden="true">{h.emoji.join('')}</span>
                  {h.answer}
                </span>
                <span className="shrink-0 text-xs text-slate-500 dark:text-zinc-400">{h.solves.length === 0 ? 'unsolved' : `${h.solves.length} solved`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {!isSpectator && !rematchUnavailable && (
          <button
            type="button"
            onClick={onRematch}
            disabled={iVoted}
            className="flex-1 rounded-2xl bg-gradient-to-r from-violet-600 to-[#ff2b70] px-5 py-3.5 text-sm font-black text-white shadow active:scale-95 disabled:opacity-70"
          >
            {iVoted ? `Waiting for others (${rematchStatus?.votedCount ?? 1}/${rematchStatus?.totalNeeded ?? view.players.length})` : 'Play again'}
          </button>
        )}
        <button
          type="button"
          onClick={onLeave}
          className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
        >
          Back to games
        </button>
      </div>
      {!isSpectator && rematchUnavailable && <p className="text-center text-xs text-slate-500 dark:text-zinc-400">A rematch needs at least {EMOJI_CHARADES_MIN_PLAYERS} players still in the room.</p>}
    </div>
  );
};

export default EmojiCharadesFinalScreen;
