'use client';

import React, { useState } from 'react';
import { Check, EyeOff, FastForward, Flag, SkipForward, X } from 'lucide-react';
import type { QuizGameView } from '@synccinema/common';
import { allLockedOut, barFraction, optionStyle, playerName } from '../../../lib/quizShowView';
import { ImposterTimerRing } from '../imposter/ImposterTimerRing';
import { ImposterPlayerChip } from '../imposter/ImposterPlayerChip';

const CARD = 'rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4';
const BTN = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-[#14151b]';
const BTN_PRIMARY = `${BTN} bg-[#ee1d49] text-white hover:bg-[#d6143c]`;
const BTN_QUIET = `${BTN} border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]`;

interface QuizHostConsoleProps {
  view: QuizGameView;
  onControl: (action: 'skip' | 'reveal' | 'next' | 'end') => void;
  onJudge: (questionId: string, correct: boolean) => void;
  answerClock?: { fraction: number; msLeft: number };
}

/** The quiz master's console: the current question with the correct answer, live counts, the buzzer queue with Correct / Wrong, and the pacing buttons. */
export const QuizHostConsole: React.FC<QuizHostConsoleProps> = ({ view, onControl, onJudge, answerClock }) => {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const q = view.question;
  const hq = view.hostQuestion;
  if (!q || !hq) return null;
  const inQuestion = view.phase === 'QUESTION';
  const inReveal = view.phase === 'REVEAL';
  const reveal = inReveal ? view.reveal : null;
  const players = view.players.filter((p) => !p.left);
  const connected = players.filter((p) => p.connected).length;
  const counts = reveal?.optionCounts ?? view.answerCounts ?? [];
  const buzz = view.buzz;
  const activeId = buzz?.activeUserId ?? null;
  const locked = allLockedOut(view);

  return (
    <div className="space-y-2.5" data-testid="host-console">
      <div className={`${CARD} space-y-2`}>
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
            <span className="rounded-md bg-[#ee1d49] px-2 py-0.5 text-white">Host console</span>
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-[#22232c] dark:text-zinc-200">{q.type === 'BUZZER' ? 'Buzzer' : 'Multiple choice'}</span>
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-[#22232c] dark:text-zinc-200">{q.points} pts</span>
          </div>
          {q.type === 'MULTIPLE_CHOICE' && (
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300" data-testid="answered-count">{view.answeredCount} of {connected} answered</span>
          )}
        </div>
        <h2 className="break-words text-lg font-extrabold leading-snug text-zinc-900 dark:text-white sm:text-xl" data-testid="question-text">{q.text}</h2>

        {q.type === 'MULTIPLE_CHOICE' ? (
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" aria-label="Options with live answer counts">
            {q.options.map((text, i) => {
              const correct = i === hq.correctIndex;
              const n = counts[i] ?? 0;
              return (
                <li key={i} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold text-white ${optionStyle(i).bg.split(' ')[0]} ${correct ? 'ring-4 ring-zinc-900 dark:ring-white' : 'opacity-70'}`} data-correct={correct}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black/25 text-xs font-bold">{optionStyle(i).letter}</span>
                  <span className="min-w-0 flex-1 break-words">{text}</span>
                  {correct && <span className="flex shrink-0 items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-zinc-900"><Check className="h-3 w-3" /> Correct</span>}
                  <span className="flex shrink-0 flex-col items-end gap-1 text-[11px] font-bold tabular-nums">
                    <span>{n}</span>
                    <span className="block h-1.5 w-12 overflow-hidden rounded-full bg-black/30"><span className="block h-full rounded-full bg-white" style={{ width: `${Math.round(barFraction(n, counts) * 100)}%` }} /></span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-xl bg-emerald-700 px-3 py-2 text-white" data-testid="host-answer">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/80"><EyeOff className="h-3 w-3" /> Answer (only you see it until the reveal)</p>
            <p className="break-words text-base font-bold">{hq.note || 'No answer note. Judge it yourself.'}</p>
          </div>
        )}
        {q.type === 'MULTIPLE_CHOICE' && hq.note && <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300"><span className="font-semibold">Note:</span> {hq.note}</p>}
      </div>

      {/* BUZZER QUEUE */}
      {q.type === 'BUZZER' && buzz && inQuestion && (
        <div className={`${CARD} space-y-2`} data-testid="buzzer-queue">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Buzzer queue</h3>
          {buzz.queue.length === 0 ? (
            <p className="text-xs text-zinc-600 dark:text-zinc-300">{locked ? 'Everybody is locked out. Reveal the answer when you are ready.' : 'Waiting for somebody to buzz in...'}</p>
          ) : (
            <ol className="space-y-1.5">
              {buzz.queue.map((id, i) => {
                const p = view.players.find((x) => x.userId === id);
                const active = id === activeId;
                return (
                  <li key={id} className={`flex flex-wrap items-center gap-2 rounded-xl border px-2.5 py-1.5 ${active ? 'border-[#ee1d49] bg-zinc-50 dark:bg-[#1b1c24]' : 'border-zinc-200 dark:border-white/10'}`}>
                    <span className="w-5 text-center text-xs font-bold text-zinc-500 dark:text-zinc-400">{i + 1}</span>
                    <ImposterPlayerChip name={p?.displayName ?? '?'} avatarUrl={p?.avatarUrl} connected={p?.connected} size="sm" active={active} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-zinc-900 dark:text-white">{playerName(view, id)}</p>
                      {active && <p className="truncate text-[11px] text-zinc-600 dark:text-zinc-300" data-testid="typed-answer">{buzz.activeText ? `Typed: ${buzz.activeText}` : 'Answering out loud (or typing)...'}</p>}
                    </div>
                    {active && (
                      <div className="flex items-center gap-1.5">
                        {answerClock && <ImposterTimerRing fraction={answerClock.fraction} msLeft={answerClock.msLeft} size={36} label="Answer window" />}
                        <button type="button" onClick={() => onJudge(q.id, true)} className={`${BTN} bg-emerald-700 text-white hover:bg-emerald-800`} data-testid="judge-correct"><Check className="h-4 w-4" /> Correct</button>
                        <button type="button" onClick={() => onJudge(q.id, false)} className={`${BTN} bg-rose-700 text-white hover:bg-rose-800`} data-testid="judge-wrong"><X className="h-4 w-4" /> Wrong</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {buzz.lockedOut.length > 0 && <p className="text-[11px] text-zinc-600 dark:text-zinc-300">Locked out: {buzz.lockedOut.map((id) => playerName(view, id)).join(', ')}</p>}
        </div>
      )}

      {/* PACING */}
      <div className={`${CARD} flex flex-wrap items-center gap-2`} data-testid="host-controls">
        <button type="button" onClick={() => onControl('skip')} disabled={view.phase === 'REVEAL'} className={BTN_QUIET}><SkipForward className="h-4 w-4" /> Skip question</button>
        <button type="button" onClick={() => onControl('reveal')} disabled={!inQuestion} className={BTN_PRIMARY}><EyeOff className="h-4 w-4" /> Reveal now</button>
        <button type="button" onClick={() => onControl('next')} disabled={view.phase === 'QUESTION'} className={BTN_PRIMARY}><FastForward className="h-4 w-4" /> {view.phase === 'INTRO' ? 'Start question' : q.index + 1 >= q.total ? 'Final results' : 'Next question'}</button>
        <span className="flex-1" />
        {confirmEnd ? (
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">End the quiz now?</span>
            <button type="button" onClick={() => { setConfirmEnd(false); onControl('end'); }} className={`${BTN} bg-rose-700 text-white hover:bg-rose-800`}>End quiz</button>
            <button type="button" onClick={() => setConfirmEnd(false)} className={BTN_QUIET}>Keep going</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmEnd(true)} className={BTN_QUIET}><Flag className="h-4 w-4" /> End quiz</button>
        )}
      </div>

      {reveal && (
        <p className="text-center text-xs font-medium text-zinc-600 dark:text-zinc-300" data-testid="host-reveal-summary">
          {reveal.noWinner ? 'Nobody got it right.' : `${reveal.results.filter((r) => r.correct).length} got it right.`} The next question starts on its own, or press Next question.
        </p>
      )}
    </div>
  );
};

export default QuizHostConsole;
