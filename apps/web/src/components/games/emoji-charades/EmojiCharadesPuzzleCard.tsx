'use client';

import React from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { EmojiCharadesGameView } from '@synccinema/common';
import { hintLabel, hintWords, secondsLabel } from '../../../lib/emojiCharadesView';
import { EmojiCharadesTimerRing } from './EmojiCharadesTimerRing';

interface EmojiCharadesPuzzleCardProps {
  view: EmojiCharadesGameView;
  /** ms left in the phase, its 0..1 share, and the seconds until the next automatic hint */
  msLeft: number;
  fraction: number;
  hintInSeconds: number | null;
}

const DIFFICULTY_LABEL = ['', 'Easy', 'Medium', 'Hard'];

/**
 * The puzzle: a big string of emoji (this is puzzle content, so emoji characters are allowed in this folder), the masked
 * answer with the hint cells, and the timer ring. The answer itself never arrives here before the reveal.
 */
export const EmojiCharadesPuzzleCard: React.FC<EmojiCharadesPuzzleCardProps> = ({ view, msLeft, fraction, hintInSeconds }) => {
  const words = hintWords(view.hint);
  const counting = view.phase === 'COUNTDOWN';
  const level = view.difficulty ?? 0;

  return (
    <div data-testid="puzzle-card" className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/80 p-5 text-center shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#121629]/80 sm:p-7">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-left">
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
            <AppIcon name="film" className="h-3 w-3" />
            {counting ? 'Next puzzle' : view.genre ?? 'Movie or show'}
          </span>
          {!counting && level > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" title={`Difficulty: ${DIFFICULTY_LABEL[level] ?? ''}`}>
              {Array.from({ length: level }, (_, i) => <AppIcon key={i} name="star" className="h-3 w-3" />)}
              <span className="sr-only">{DIFFICULTY_LABEL[level]}</span>
            </span>
          )}
        </div>
        {!counting && view.phaseEndsAt !== null && <EmojiCharadesTimerRing fraction={fraction} msLeft={msLeft} label="Time left" />}
      </div>

      {counting ? (
        <div className="py-6" role="status" aria-live="polite">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">Round {view.round} of {view.totalRounds}</p>
          <p className="mt-2 text-7xl font-black tabular-nums text-[#16132b] dark:text-white" data-testid="countdown-number">{secondsLabel(msLeft)}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">Guess the movie or show from the emoji</p>
        </div>
      ) : (
        <>
          <div
            data-testid="emoji-row"
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-3xl bg-gradient-to-br from-violet-50 to-rose-50 px-3 py-5 dark:from-white/5 dark:to-white/[0.03]"
            role="img"
            aria-label={`Emoji puzzle with ${view.emoji?.length ?? 0} emoji`}
          >
            {(view.emoji ?? []).map((e, i) => (
              <span key={`${i}-${e}`} className="select-none text-5xl leading-none sm:text-6xl" style={{ animation: `emojiPop 400ms ${i * 90}ms both` }}>{e}</span>
            ))}
          </div>

          {view.phase === 'PLAY' && (
            <div className="mt-5" data-testid="hint-area">
              {words.length > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2" aria-label="Letters of the answer">
                  {words.map((cells, wi) => (
                    <div key={wi} className="flex items-end gap-1">
                      {cells.map((c, ci) => (
                        <span key={ci} className={`flex h-8 min-w-[1.25rem] items-center justify-center text-xl font-black ${c === '_' ? 'border-b-2 border-slate-400 text-transparent dark:border-zinc-500' : 'border-b-2 border-violet-500 text-violet-700 dark:text-violet-200'}`}>
                          {c === '_' ? '_' : c}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">No hints yet</p>
              )}
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 dark:text-zinc-400" role="status">
                <AppIcon name="idea" className="h-3.5 w-3.5 text-amber-500" />
                {hintLabel(view.hintTier)}
                {hintInSeconds !== null ? `. Next hint in ${hintInSeconds}s` : ''}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EmojiCharadesPuzzleCard;
