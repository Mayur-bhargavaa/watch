'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { EmojiCharadesGameView } from '@synccinema/common';
import { EMOJI_CHARADES_GUESS_MAX_LENGTH } from '@synccinema/common';
import { feedbackFor, guessDraftProblem } from '../../../lib/emojiCharadesView';

interface EmojiCharadesGuessPanelProps {
  view: EmojiCharadesGameView;
  isSpectator: boolean;
  onGuess: (guess: string) => void;
  error?: string | null;
}

/**
 * Guess input. Wrong guesses and "so close" are shown only here, to the guesser (the server never sends them to anybody else).
 * After solving, the player sees the answer and waits for the others.
 */
export const EmojiCharadesGuessPanel: React.FC<EmojiCharadesGuessPanelProps> = ({ view, isSpectator, onGuess, error }) => {
  const [text, setText] = useState('');
  const [localProblem, setLocalProblem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const me = view.me;
  const playing = view.phase === 'PLAY';
  const solvedCount = view.solvedUserIds.length;
  const needed = view.players.filter((p) => !p.left && p.connected).length;
  const feedback = feedbackFor(view);
  const outOfGuesses = Boolean(me) && (me?.guessesLeft ?? 0) <= 0;

  useEffect(() => {
    if (playing && !me?.solved) inputRef.current?.focus();
  }, [playing, me?.solved, view.round]);

  useEffect(() => {
    setText('');
    setLocalProblem(null);
  }, [view.round]);

  if (isSpectator || !me) {
    return (
      <div className="rounded-3xl border border-white/60 bg-white/80 p-5 text-center shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#121629]/80" data-testid="guess-panel-spectator">
        <AppIcon name="eye" className="mx-auto mb-2 h-7 w-7 text-violet-500" />
        <p className="text-sm font-bold text-[#16132b] dark:text-white">You are watching</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{solvedCount} of {needed} players solved it so far.</p>
      </div>
    );
  }

  if (me.solved) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-center shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10" data-testid="solved-card">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white">
          <AppIcon name="check" className="h-6 w-6" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">You got it! +{me.points}</p>
        <p className="mt-1 break-words text-2xl font-black text-[#16132b] dark:text-white" data-testid="my-answer">{me.answer}</p>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-600 dark:text-zinc-300" role="status">
          <AppIcon name="clock" className="h-3.5 w-3.5" />
          Waiting for others ({solvedCount} of {needed} solved)
        </p>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playing) return;
    const problem = guessDraftProblem(text);
    setLocalProblem(problem);
    if (problem) return;
    onGuess(text.trim());
    setText('');
    inputRef.current?.focus();
  };

  const recent = me.guesses.slice(-6);
  return (
    <div className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#121629]/80 sm:p-5" data-testid="guess-panel">
      <form onSubmit={submit} className="flex gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => { setText(e.target.value); setLocalProblem(null); }}
          maxLength={EMOJI_CHARADES_GUESS_MAX_LENGTH}
          disabled={!playing || outOfGuesses}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          placeholder={playing ? 'Name the movie or show' : 'Wait for the puzzle'}
          aria-label="Your guess"
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-[#16132b] outline-none focus:border-violet-500 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <button type="submit" disabled={!playing || outOfGuesses} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-[#ff2b70] px-5 py-3 text-sm font-black text-white shadow active:scale-95 disabled:opacity-50">
          <AppIcon name="rocket" className="h-4 w-4" />
          Guess
        </button>
      </form>

      <div className="mt-3 min-h-[1.5rem]" role="status" aria-live="polite">
        {feedback && playing && (
          <span data-testid="guess-feedback" data-kind={feedback.kind} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${feedback.kind === 'close' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-zinc-300'}`}>
            <AppIcon name={feedback.kind === 'close' ? 'fire' : 'close'} className="h-3.5 w-3.5" />
            {feedback.text}
          </span>
        )}
        {(localProblem || error) && <span className="ml-2 text-xs font-bold text-rose-600 dark:text-rose-300" role="alert">{localProblem ?? error}</span>}
      </div>

      {recent.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Your earlier guesses">
          {recent.map((g, i) => (
            <span key={`${i}-${g.text}`} className={`max-w-full truncate rounded-full px-2.5 py-1 text-xs font-bold ${g.kind === 'close' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-slate-100 text-slate-500 line-through dark:bg-white/5 dark:text-zinc-400'}`}>
              {g.text}
            </span>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-400 dark:text-zinc-500">{me.guessesLeft} {me.guessesLeft === 1 ? 'guess' : 'guesses'} left this round. Only you can see your guesses.</p>
    </div>
  );
};

export default EmojiCharadesGuessPanel;
