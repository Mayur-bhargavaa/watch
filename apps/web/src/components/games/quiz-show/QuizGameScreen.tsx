'use client';

import React, { useEffect, useState } from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { QuizGameView } from '@synccinema/common';
import { QUIZ_BUZZER_ANSWER_SEC } from '@synccinema/common';
import { clockOffset } from '../../../lib/imposterView';
import { phaseTitle, progressLabel } from '../../../lib/quizShowView';
import { useImposterClock } from '../imposter/useImposterClock';
import { ImposterTimerRing } from '../imposter/ImposterTimerRing';
import { QuizFinalScreen } from './QuizFinalScreen';
import { QuizHostConsole } from './QuizHostConsole';
import { QuizLeaderboard } from './QuizLeaderboard';
import { QuizPlayerView } from './QuizPlayerView';

interface QuizGameScreenProps {
  view: QuizGameView;
  myUserId: string;
  isSpectator: boolean;
  actionError?: string | null;
  onAnswer: (questionId: string, optionIndex: number) => void;
  onBuzz: (questionId: string) => void;
  onBuzzAnswer: (questionId: string, text: string) => void;
  onJudge: (questionId: string, correct: boolean) => void;
  onControl: (action: 'skip' | 'reveal' | 'next' | 'end') => void;
  onRematch: () => void;
  onEditAgain: () => void;
  onLeave: () => void;
  /** the room's chat column */
  sidePanel: React.ReactNode;
}

const PHASE_HINT: Record<string, string> = {
  INTRO: 'The next question is about to start.',
  QUESTION: 'Answer before the timer runs out.',
  REVEAL: 'The answer and the standings.'
};

/** The countdown of the buzzer answer window (15 s), drawn from the server deadline and corrected by the server clock. */
function useAnswerClock(view: QuizGameView): { fraction: number; msLeft: number } | undefined {
  const [now, setNow] = useState(() => Date.now());
  const [offset, setOffset] = useState(0);
  useEffect(() => { setOffset(clockOffset(view.serverNow, Date.now())); }, [view.serverNow]);
  const endsAt = view.buzz?.answerEndsAt ?? null;
  useEffect(() => {
    if (endsAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [endsAt]);
  if (endsAt === null) return undefined;
  const left = Math.max(0, endsAt - (now + offset));
  return { msLeft: left, fraction: Math.min(1, left / (QUIZ_BUZZER_ANSWER_SEC * 1000)) };
}

/** The running quiz: header with timer, the host console or the player / spectator view, the leaderboard and the chat column. */
export const QuizGameScreen: React.FC<QuizGameScreenProps> = ({ view, myUserId, isSpectator, actionError, onAnswer, onBuzz, onBuzzAnswer, onJudge, onControl, onRematch, onEditAgain, onLeave, sidePanel }) => {
  const clock = useImposterClock(view);
  const answerClock = useAnswerClock(view);
  const isHost = !isSpectator && view.me?.role === 'host';
  const over = view.phase === 'FINAL' || view.phase === 'ABORTED';

  if (over) {
    const stillIn = view.players.filter((p) => !p.left).length;
    return (
      <div className="mx-auto grid w-full gap-2.5 lg:grid-cols-[1.5fr_1fr] lg:gap-3" data-testid="quiz-screen" data-phase={view.phase}>
        <QuizFinalScreen view={view} myUserId={myUserId} isSpectator={isSpectator} isHost={isHost} canRematch={isHost && view.host.connected && stillIn >= 1} onRematch={onRematch} onEditAgain={onEditAgain} onLeave={onLeave} />
        <aside className="space-y-2.5">{sidePanel}</aside>
      </div>
    );
  }

  const timed = view.phaseEndsAt !== null && view.phase !== 'REVEAL';
  const deltas = view.reveal ? Object.fromEntries(view.reveal.results.map((r) => [r.userId, r.points])) : undefined;

  return (
    <div className="mx-auto grid w-full gap-2.5 lg:grid-cols-[1.5fr_1fr] lg:gap-3" data-testid="quiz-screen" data-phase={view.phase}>
      <div className="space-y-2.5">
        <header className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-2.5 dark:border-white/10 dark:bg-[#14151b] sm:p-3">
          {timed ? <ImposterTimerRing fraction={clock.fraction} msLeft={clock.msLeft} label={phaseTitle(view.phase)} /> : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-[#22232c] dark:text-zinc-300"><AppIcon name="trophy" className="h-5 w-5" /></div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{progressLabel(view)}</p>
            <h1 className="truncate text-base font-bold text-zinc-900 dark:text-white sm:text-lg">{phaseTitle(view.phase)}</h1>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{PHASE_HINT[view.phase] ?? ''}</p>
          </div>
          {!isHost && !isSpectator && view.me && (
            <div className="shrink-0 text-right" data-testid="my-score">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Your score</p>
              <p className="text-lg font-extrabold tabular-nums text-zinc-900 dark:text-white">{view.me.score}</p>
            </div>
          )}
        </header>

        <div key={`${view.questionIndex}-${view.phase}`} className="motion-safe:animate-imposter-in">
          {isHost ? (
            <QuizHostConsole view={view} onControl={onControl} onJudge={onJudge} answerClock={answerClock} />
          ) : (
            <QuizPlayerView view={view} myUserId={myUserId} readOnly={isSpectator} onAnswer={onAnswer} onBuzz={onBuzz} onBuzzAnswer={onBuzzAnswer} answerClock={answerClock} />
          )}
        </div>

        {actionError && <p className="text-center text-xs font-semibold text-red-700 dark:text-red-300" role="alert">{actionError}</p>}
      </div>

      <aside className="space-y-2.5">
        <QuizLeaderboard rows={view.leaderboard} myUserId={isHost || isSpectator ? null : myUserId} limit={view.phase === 'REVEAL' ? 10 : 5} deltas={deltas} />
        {sidePanel}
      </aside>
    </div>
  );
};

export default QuizGameScreen;
