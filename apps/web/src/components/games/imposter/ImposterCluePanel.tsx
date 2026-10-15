'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { ImposterGameView } from '@synccinema/common';
import { clueDraftProblem, clueRows, playerName } from '../../../lib/imposterView';
import { ImposterPlayerChip } from './ImposterPlayerChip';

interface ImposterCluePanelProps {
  view: ImposterGameView;
  myUserId: string;
  isSpectator: boolean;
  onSendClue: (word: string) => void;
  /** server error text for the last rejected clue (secret word, wrong turn...) */
  error?: string | null;
}

/** Clue phase: whose turn it is, the clue board (2 rounds), and the input for the player on turn. */
export const ImposterCluePanel: React.FC<ImposterCluePanelProps> = ({ view, myUserId, isSpectator, onSendClue, error }) => {
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const myTurn = !isSpectator && view.phase === 'CLUES' && view.currentTurnUserId === myUserId;
  const rows = clueRows(view);

  useEffect(() => {
    setDraft('');
    setProblem(null);
    if (myTurn) inputRef.current?.focus();
  }, [myTurn, view.currentTurnUserId, view.clueRound]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = clueDraftProblem(draft);
    setProblem(p);
    if (p) return;
    onSendClue(draft.trim());
    setDraft('');
  };

  return (
    <div className="space-y-3" data-testid="clue-panel">
      <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Clue round {view.clueRound} of {view.clueRounds}</h3>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">One word each</span>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {rows.map((row) => {
            const player = view.players.find((p) => p.userId === row.userId)!;
            const onTurn = view.currentTurnUserId === row.userId;
            return (
              <li
                key={row.userId}
                className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-1.5 transition-colors duration-150 ${
                  onTurn ? 'border-[#ee1d49] bg-white dark:bg-[#18121f]' : 'border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-[#1b1c24]'
                }`}
              >
                <ImposterPlayerChip name={row.name} avatarUrl={player?.avatarUrl} connected={player?.connected} left={player?.left} active={onTurn} size="sm" isMe={row.userId === myUserId} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                    {row.name}
                    {row.userId === myUserId ? ' (you)' : ''}
                  </p>
                  <p className="flex flex-wrap gap-1 pt-0.5">
                    {row.words.map((w, i) => {
                      const given = view.clues.some((c) => c.userId === row.userId && c.round === i + 1);
                      return (
                        <span
                          key={i}
                          className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                            given
                              ? w
                                ? 'bg-zinc-200 text-zinc-900 dark:bg-[#2a2b35] dark:text-white'
                                : 'bg-zinc-100 text-zinc-500 line-through dark:bg-[#1b1c24] dark:text-zinc-400'
                              : onTurn && view.clueRound === i + 1
                                ? 'motion-safe:animate-pulse bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                                : 'bg-zinc-100 text-zinc-500 dark:bg-[#1b1c24] dark:text-zinc-400'
                          }`}
                        >
                          {given ? (w ?? 'skipped') : onTurn && view.clueRound === i + 1 ? 'thinking' : '...'}
                        </span>
                      );
                    })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {myTurn ? (
        <form onSubmit={submit} className="rounded-2xl border border-[#ee1d49] bg-white p-3 dark:bg-[#14151b] sm:p-4">
          <label htmlFor="imposter-clue" className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <AppIcon name="idea" className="h-4 w-4 text-[#ee1d49]" />
            Your turn: give a one-word clue
          </label>
          <div className="flex gap-2">
            <input
              id="imposter-clue"
              ref={inputRef}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setProblem(null); }}
              maxLength={24}
              autoComplete="off"
              autoCapitalize="none"
              placeholder="One word"
              className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-base font-semibold text-zinc-900 outline-none focus:border-[#ee1d49] focus-visible:ring-2 focus-visible:ring-[#ee1d49]/30 dark:border-white/10 dark:bg-[#0c0d12] dark:text-white"
            />
            <button type="submit" className="h-10 rounded-xl bg-[#ee1d49] px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#14151b]">
              Send
            </button>
          </div>
          {(problem || error) && <p className="mt-2 text-xs font-semibold text-red-700 dark:text-red-300" role="alert">{problem || error}</p>}
        </form>
      ) : (
        <p className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-center text-sm text-zinc-600 dark:border-white/10 dark:bg-[#14151b] dark:text-zinc-300">
          {view.currentTurnUserId
            ? <>Waiting for <span className="font-semibold text-zinc-900 dark:text-white">{playerName(view.players, view.currentTurnUserId)}</span> to give a clue</>
            : 'Getting ready'}
        </p>
      )}
    </div>
  );
};

export default ImposterCluePanel;
