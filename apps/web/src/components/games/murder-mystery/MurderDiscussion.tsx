'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import type { MurderGameView } from '@synccinema/common';
import { MURDER_WHISPER_MAX, MURDER_WHISPERS_PER_ROUND } from '@synccinema/common';
import { AppIcon } from '../../ui/AppIcon';
import { characterNameOfUser, playerName, whisperCheck, whisperPartners, whisperTargets, whisperThread } from '../../../lib/murderMysteryView';

interface MurderDiscussionProps {
  view: MurderGameView;
  myUserId: string;
  onWhisper: (toUserId: string, text: string) => void;
  className?: string;
}

/** Private whispers: pick a player, write a short note (limited per round). Only the two of you ever see it. */
export const MurderDiscussion: React.FC<MurderDiscussionProps> = ({ view, myUserId, onWhisper, className = '' }) => {
  const me = view.me;
  const targets = whisperTargets(view, myUserId);
  const [to, setTo] = useState<string | null>(null);
  const [text, setText] = useState('');
  const scroller = useRef<HTMLDivElement | null>(null);
  const whispers = me?.whispers ?? [];
  const partners = whisperPartners(whispers, myUserId);
  const target = to && targets.some((t) => t.userId === to) ? to : null;
  const thread = whisperThread(whispers, myUserId, target);
  const left = me?.whispersLeft ?? 0;
  const check = whisperCheck(text, target, left);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [thread.length, target]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!check.ok || !target) return;
    onWhisper(target, text.trim());
    setText('');
  };

  if (!me) {
    return (
      <section data-testid="murder-whispers" className={`rounded-2xl border border-zinc-200 bg-white p-3 text-xs text-zinc-600 dark:border-white/10 dark:bg-[#14151b] dark:text-zinc-300 ${className}`}>
        <h3 className="mb-1 flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white"><AppIcon name="lock" className="h-3.5 w-3.5" />Whispers</h3>
        Whispers are private between two players. You only see the public clues and the table talk.
      </section>
    );
  }

  return (
    <section data-testid="murder-whispers" className={`flex min-h-0 flex-col rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white"><AppIcon name="lock" className="h-3.5 w-3.5 text-[#ee1d49]" />Whispers</h3>
        <span className="rounded-lg bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:bg-[#22232c] dark:text-zinc-200" data-testid="whispers-left">
          {left} of {MURDER_WHISPERS_PER_ROUND} left this round
        </span>
      </div>

      <div className="mb-2 flex flex-wrap gap-1" role="radiogroup" aria-label="Whisper to">
        {targets.length === 0 && <span className="text-xs text-zinc-500 dark:text-zinc-400">Nobody to whisper to.</span>}
        {targets.map((t) => {
          const on = target === t.userId;
          const has = partners.some((p) => p.userId === t.userId);
          return (
            <button
              key={t.userId}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setTo(t.userId)}
              className={`inline-flex h-7 max-w-full items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] ${on ? 'border-[#ee1d49] bg-[#ee1d49] text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-[#14151b] dark:text-zinc-200 dark:hover:bg-[#1b1c24]'}`}
              title={characterNameOfUser(view, t.userId)}
            >
              <span className="truncate">{t.displayName}</span>
              {has && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${on ? 'bg-white' : 'bg-[#ee1d49]'}`} aria-label="Has messages" />}
            </button>
          );
        })}
      </div>

      <div ref={scroller} className="min-h-[5rem] flex-1 space-y-1 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-white/10 dark:bg-[#1b1c24]" aria-live="polite">
        {!target && <p className="py-2 text-center text-xs text-zinc-500 dark:text-zinc-400">Pick a player to read or send whispers.</p>}
        {target && thread.length === 0 && <p className="py-2 text-center text-xs text-zinc-500 dark:text-zinc-400">No whispers with {playerName(view.players, target)} yet.</p>}
        {thread.map((w) => {
          const mine = w.fromUserId === myUserId;
          return (
            <div key={w.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] break-words rounded-xl px-2.5 py-1.5 text-xs ${mine ? 'bg-[#ee1d49] text-white' : 'border border-zinc-200 bg-white text-zinc-800 dark:border-white/10 dark:bg-[#22232c] dark:text-zinc-100'}`}>
                {w.text}
                <span className={`ml-1.5 text-[10px] ${mine ? 'text-white/80' : 'text-zinc-500 dark:text-zinc-400'}`}>R{w.round}</span>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={text}
          maxLength={MURDER_WHISPER_MAX}
          onChange={(e) => setText(e.target.value)}
          disabled={!target || left <= 0 || view.phase !== 'CLUE_ROUND'}
          aria-label="Whisper"
          placeholder={view.phase !== 'CLUE_ROUND' ? 'Whispers are open during clue rounds' : left <= 0 ? 'No whispers left this round' : target ? 'Whisper (short and secret)...' : 'Pick a player first'}
          className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 placeholder-zinc-500 focus:border-[#ee1d49] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49]/30 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-white/10 dark:bg-[#0c0d12] dark:text-white dark:placeholder-zinc-400 dark:disabled:bg-[#1b1c24]"
        />
        <button type="submit" disabled={!check.ok || view.phase !== 'CLUE_ROUND'} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ee1d49] text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-[#14151b]" aria-label="Send whisper">
          <Send className="h-4 w-4" />
        </button>
      </form>
      <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{text.length}/{MURDER_WHISPER_MAX}</p>
    </section>
  );
};

export default MurderDiscussion;
