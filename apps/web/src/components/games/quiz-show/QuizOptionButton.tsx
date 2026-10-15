'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { barFraction, optionStyle } from '../../../lib/quizShowView';

export type QuizOptionState = 'idle' | 'selected' | 'dim' | 'correct';

interface QuizOptionButtonProps {
  index: number;
  text: string;
  state?: QuizOptionState;
  onClick?: () => void;
  disabled?: boolean;
  /** reveal: how many players picked this option */
  count?: number;
  counts?: number[];
  /** reveal: this is my own pick */
  mine?: boolean;
}

/** One answer button in one of the four muted solid hues (white text). The selected / correct state is shown with an icon and a ring, not with colour alone. */
export const QuizOptionButton: React.FC<QuizOptionButtonProps> = ({ index, text, state = 'idle', onClick, disabled = false, count, counts, mine = false }) => {
  const st = optionStyle(index);
  const isButton = Boolean(onClick);
  const base = `relative flex min-h-[3.5rem] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold text-white transition-colors duration-150 sm:min-h-[4.25rem] sm:text-base ${st.bg}`;
  const ring =
    state === 'selected' || state === 'correct'
      ? 'ring-4 ring-zinc-900 dark:ring-white'
      : '';
  const dim = state === 'dim' ? 'opacity-40' : '';
  const content = (
    <>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/25 text-xs font-bold" aria-hidden="true">{st.letter}</span>
      <span className="min-w-0 flex-1 break-words">{text}</span>
      {(state === 'selected' || state === 'correct') && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-zinc-900">
          <Check className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{state === 'correct' ? 'Correct answer' : 'Your answer'}</span>
        </span>
      )}
      {count !== undefined && counts && (
        <span className="flex shrink-0 flex-col items-end gap-1 text-[11px] font-bold tabular-nums">
          <span>{count}{mine ? ' (you)' : ''}</span>
          <span className="block h-1.5 w-12 overflow-hidden rounded-full bg-black/30">
            <span className="block h-full rounded-full bg-white" style={{ width: `${Math.round(barFraction(count, counts) * 100)}%` }} />
          </span>
        </span>
      )}
    </>
  );
  if (!isButton) return <div className={`${base} ${ring} ${dim}`} data-state={state}>{content}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === 'selected'}
      data-state={state}
      className={`${base} ${ring} ${dim} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-900 dark:focus-visible:ring-white disabled:cursor-not-allowed motion-safe:active:scale-[0.99]`}
    >
      {content}
    </button>
  );
};

export default QuizOptionButton;
