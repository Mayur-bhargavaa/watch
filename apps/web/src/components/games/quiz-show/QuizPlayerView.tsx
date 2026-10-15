'use client';

import React, { useEffect, useState } from 'react';
import { Check, Hand, Lock, Eye, Timer, X } from 'lucide-react';
import type { QuizGameView } from '@synccinema/common';
import { QUIZ_ANSWER_MAX } from '@synccinema/common';
import { formatPoints, playerName, playerQuestionState } from '../../../lib/quizShowView';
import { ImposterTimerRing } from '../imposter/ImposterTimerRing';
import { QuizOptionButton } from './QuizOptionButton';

const CARD = 'rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4';

interface QuizPlayerViewProps {
  view: QuizGameView;
  myUserId: string;
  /** spectators (and the host's read-only copy) see everything the players see, with no buttons */
  readOnly?: boolean;
  onAnswer: (questionId: string, optionIndex: number) => void;
  onBuzz: (questionId: string) => void;
  onBuzzAnswer: (questionId: string, text: string) => void;
  /** 0..1 and ms left of the buzzer answer window (the question clock lives in the screen header) */
  answerClock?: { fraction: number; msLeft: number };
}

function QuestionHeader({ view }: { view: QuizGameView }) {
  const q = view.question;
  if (!q) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-[#22232c] dark:text-zinc-200">{q.type === 'BUZZER' ? 'Buzzer' : 'Multiple choice'}</span>
      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-[#22232c] dark:text-zinc-200">{q.points} pts</span>
    </div>
  );
}

/** The player's (and spectator's) main area: intro, answer buttons / buzzer, "answered, waiting" and the reveal. */
export const QuizPlayerView: React.FC<QuizPlayerViewProps> = ({ view, myUserId, readOnly = false, onAnswer, onBuzz, onBuzzAnswer, answerClock }) => {
  const q = view.question;
  const state = playerQuestionState(view);
  const me = view.me;
  const [typed, setTyped] = useState('');
  const [sent, setSent] = useState(false);
  const activeId = view.buzz?.activeUserId ?? null;
  const questionId = q?.id ?? '';

  // a new window / question starts with an empty answer box
  useEffect(() => { setTyped(''); setSent(false); }, [questionId, activeId]);

  if (!q) return null;

  if (view.phase === 'INTRO') {
    return (
      <div className={`${CARD} flex flex-col items-center py-8 text-center sm:py-10`} data-testid="quiz-intro">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Question {q.index + 1} of {q.total}</p>
        <h2 className="mt-1 text-2xl font-extrabold text-zinc-900 dark:text-white sm:text-3xl">Get ready</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{q.type === 'BUZZER' ? 'Buzzer question' : 'Multiple choice'} · {q.points} points</p>
      </div>
    );
  }

  const isReveal = view.phase === 'REVEAL' && view.reveal;
  const reveal = isReveal ? view.reveal : null;
  const myResult = reveal?.results.find((r) => r.userId === myUserId) ?? null;

  const body = (() => {
    if (q.type === 'MULTIPLE_CHOICE') {
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5" role="group" aria-label="Answer options">
          {q.options.map((text, i) => {
            if (reveal) {
              const correct = i === reveal.correctIndex;
              const mine = myResult?.optionIndex === i;
              return <QuizOptionButton key={i} index={i} text={text} state={correct ? 'correct' : 'dim'} count={reveal.optionCounts[i] ?? 0} counts={reveal.optionCounts} mine={mine} />;
            }
            const mineNow = me?.myOption === i;
            const answered = state === 'answered' || me?.answered;
            return (
              <QuizOptionButton
                key={i}
                index={i}
                text={text}
                state={answered ? (mineNow ? 'selected' : 'dim') : 'idle'}
                disabled={readOnly || Boolean(answered) || state !== 'answering'}
                onClick={readOnly ? undefined : () => onAnswer(q.id, i)}
              />
            );
          })}
        </div>
      );
    }
    // BUZZER
    if (reveal || view.phase !== 'QUESTION') return null;
    if (readOnly) {
      return (
        <div className="rounded-xl bg-zinc-50 px-3 py-4 text-center text-sm font-semibold text-zinc-700 dark:bg-[#1b1c24] dark:text-zinc-200" data-testid="buzzer-watch">
          {activeId ? `${playerName(view, activeId)} is answering` : view.buzz && view.buzz.queue.length === 0 ? 'Waiting for a buzz' : 'Waiting'}
        </div>
      );
    }
    if (state === 'turn') {
      return (
        <form
          onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { onBuzzAnswer(q.id, typed.trim()); setSent(true); } }}
          className="space-y-2 rounded-xl bg-zinc-50 p-3 dark:bg-[#1b1c24]"
          data-testid="buzzer-turn"
        >
          <div className="flex items-center gap-3">
            {answerClock && <ImposterTimerRing fraction={answerClock.fraction} msLeft={answerClock.msLeft} size={44} label="Answer window" />}
            <div className="min-w-0">
              <p className="text-sm font-bold text-zinc-900 dark:text-white">Your turn: answer out loud or type it</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">The host will mark it. Chat is locked while you answer.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input value={typed} onChange={(e) => { setTyped(e.target.value); setSent(false); }} maxLength={QUIZ_ANSWER_MAX} aria-label="Your answer" placeholder="Type your answer (optional)" className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-[#ee1d49] focus-visible:ring-2 focus-visible:ring-[#ee1d49]/30 dark:border-white/10 dark:bg-[#0c0d12] dark:text-white" />
            <button type="submit" disabled={!typed.trim() || sent} className="h-10 rounded-xl bg-[#ee1d49] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-[#14151b]">{sent ? 'Sent' : 'Send'}</button>
          </div>
        </form>
      );
    }
    if (state === 'locked') {
      return (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-zinc-50 px-3 py-5 text-sm font-semibold text-zinc-700 dark:bg-[#1b1c24] dark:text-zinc-200" data-testid="buzzer-locked">
          <Lock className="h-4 w-4" /> You are locked out of this question
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onBuzz(q.id)}
          disabled={state === 'buzzed'}
          data-testid="buzz-button"
          className="flex h-24 w-full items-center justify-center gap-2 rounded-2xl bg-[#ee1d49] text-xl font-extrabold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-500 motion-safe:active:scale-[0.99] dark:focus-visible:ring-white sm:h-28"
        >
          <Hand className="h-7 w-7" aria-hidden="true" />
          {state === 'buzzed' ? `Buzzed (#${me?.queuePosition ?? '?'} in line)` : 'BUZZ'}
        </button>
        {activeId && activeId !== myUserId && <p className="text-center text-xs font-medium text-zinc-600 dark:text-zinc-300">{playerName(view, activeId)} is answering</p>}
      </div>
    );
  })();

  return (
    <div className="space-y-2.5" data-testid="quiz-question" data-state={state}>
      <div className={`${CARD} space-y-2`}>
        <QuestionHeader view={view} />
        <h2 className="break-words text-xl font-extrabold leading-snug text-zinc-900 dark:text-white sm:text-2xl" data-testid="question-text">{q.text}</h2>
        {/* in the buzzer reveal the answer is shown as text */}
        {reveal && q.type === 'BUZZER' && (
          <div className="rounded-xl bg-emerald-700 px-3 py-2 text-white" data-testid="buzzer-answer">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">Answer</p>
            <p className="break-words text-base font-bold">{reveal.answerText || 'See the host'}</p>
          </div>
        )}
        {reveal && reveal.note && q.type === 'MULTIPLE_CHOICE' && <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{reveal.note}</p>}
      </div>

      {body}

      {/* status line under the answer area */}
      {!readOnly && state === 'answered' && (
        <p className="flex items-center justify-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-800 dark:bg-[#1b1c24] dark:text-zinc-100" role="status" data-testid="answered-waiting">
          <Check className="h-4 w-4" /> Answer locked in. Waiting for the others...
        </p>
      )}
      {readOnly && (
        <p className="flex items-center justify-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 dark:bg-[#1b1c24] dark:text-zinc-200" data-testid="spectating"><Eye className="h-3.5 w-3.5" /> You are watching</p>
      )}
      {reveal && !readOnly && me?.role === 'player' && (
        <div className={`flex items-center justify-between gap-3 rounded-2xl p-3 ${myResult?.correct ? 'bg-emerald-700 text-white' : myResult && myResult.points < 0 ? 'bg-rose-700 text-white' : 'bg-zinc-100 text-zinc-800 dark:bg-[#1b1c24] dark:text-zinc-100'}`} data-testid="my-result">
          <span className="flex items-center gap-2 text-sm font-bold">
            {myResult?.correct ? <Check className="h-4 w-4" /> : myResult && myResult.points < 0 ? <X className="h-4 w-4" /> : <Timer className="h-4 w-4" />}
            {myResult?.correct ? 'Correct!' : myResult && myResult.points < 0 ? 'Wrong answer' : myResult?.optionIndex !== null && myResult?.optionIndex !== undefined ? 'Not this time' : 'No answer'}
          </span>
          <span className="text-lg font-extrabold tabular-nums">{formatPoints(myResult?.points ?? 0)}</span>
        </div>
      )}
      {reveal && (
        <p className="text-center text-xs font-medium text-zinc-600 dark:text-zinc-300" data-testid="reveal-summary">
          {reveal.noWinner ? 'Nobody got it right.' : `Right: ${reveal.results.filter((r) => r.correct).slice(0, 6).map((r) => playerName(view, r.userId)).join(', ')}${reveal.results.filter((r) => r.correct).length > 6 ? ' and more' : ''}`}
        </p>
      )}
    </div>
  );
};

export default QuizPlayerView;
