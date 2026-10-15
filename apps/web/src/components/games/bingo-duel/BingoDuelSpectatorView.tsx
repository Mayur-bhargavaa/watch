'use client';

import React from 'react';
import { AppIcon } from '../../ui/AppIcon';

interface SpectatorPlayer {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface BingoDuelSpectatorViewProps {
  players: SpectatorPlayer[];
  gameState: any | null;
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  onLeave?: () => void;
}

/**
 * Read-only view of a Bingo Duel for spectators. Uses only the public projection of the state:
 * called numbers, who has the turn, marked counts, round score and the result. No boards and no marks.
 */
export const BingoDuelSpectatorView: React.FC<BingoDuelSpectatorViewProps> = ({
  players,
  gameState,
  onToggleChat,
  isChatOpen,
  onLeave
}) => {
  const called: number[] = Array.isArray(gameState?.calledNumbers) ? gameState.calledNumbers : [];
  const current: number | null = typeof gameState?.currentNumber === 'number' ? gameState.currentNumber : null;
  const turnId: string | null = gameState?.currentTurnUserId ?? null;
  const markedCounts: Record<string, number> = gameState?.markedCounts || {};
  const roundsWon: Record<string, number> = gameState?.roundsWon || {};
  const phase: string = gameState?.phase || '';
  const done = phase === 'FINISHED' || phase === 'ROUND_OVER';
  const winnerName: string | null = gameState?.winnerDisplayName || null;
  const turnPlayer = players.find(p => p.userId === turnId) || null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-2 sm:p-4 text-slate-900">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {players.slice(0, 2).map(p => {
          const isTurn = !done && turnId === p.userId;
          return (
            <div
              key={p.userId}
              className={`rounded-2xl border bg-white/95 p-4 shadow ${isTurn ? 'border-purple-500 ring-2 ring-purple-300' : 'border-purple-100'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-black">{p.displayName}</span>
                {isTurn ? <span className="text-xs font-bold text-purple-700">Picking</span> : null}
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                <span>Marked {markedCounts[p.userId] ?? 0}</span>
                <span>Rounds won {roundsWon[p.userId] ?? 0}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-purple-100 bg-white/95 p-4 shadow">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-bold">
            {done
              ? winnerName
                ? `${winnerName} won`
                : 'Game over'
              : turnPlayer
                ? `${turnPlayer.displayName} to pick`
                : 'Waiting for the next pick'}
          </span>
          <span className="text-xs text-slate-500">Round {gameState?.currentRound ?? 1}</span>
        </div>
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-600">
          <AppIcon name="target" className="h-4 w-4" />
          <span>{current !== null ? `Last number: ${current}` : 'No number called yet'}</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 25 }, (_, i) => i + 1).map(n => {
            const isCalled = called.includes(n);
            return (
              <div
                key={n}
                className={`flex aspect-square items-center justify-center rounded-xl border text-sm font-bold ${
                  n === current
                    ? 'border-pink-500 bg-pink-500 text-white'
                    : isCalled
                      ? 'border-purple-300 bg-purple-100 text-purple-800'
                      : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                {n}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        {onToggleChat ? (
          <button type="button" onClick={onToggleChat} className="rounded-full border border-purple-200 bg-white px-4 py-2 text-xs font-bold text-purple-700">
            {isChatOpen ? 'Hide chat' : 'Show chat'}
          </button>
        ) : null}
        {onLeave ? (
          <button type="button" onClick={onLeave} className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700">
            Leave
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default BingoDuelSpectatorView;
