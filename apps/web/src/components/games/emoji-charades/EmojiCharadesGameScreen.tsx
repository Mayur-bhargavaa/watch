'use client';

import React, { useState } from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { EmojiCharadesGameView } from '@synccinema/common';
import type { GameChatMessage } from '../../../hooks/useGameRoom';
import { phaseTitle } from '../../../lib/emojiCharadesView';
import { ImposterChat } from '../imposter/ImposterChat';
import { useEmojiCharadesClock } from './useEmojiCharadesClock';
import { EmojiCharadesTimerRing } from './EmojiCharadesTimerRing';
import { EmojiCharadesPuzzleCard } from './EmojiCharadesPuzzleCard';
import { EmojiCharadesGuessPanel } from './EmojiCharadesGuessPanel';
import { EmojiCharadesSolvedStrip } from './EmojiCharadesSolvedStrip';
import { EmojiCharadesRevealCard } from './EmojiCharadesRevealCard';
import { EmojiCharadesScoreboard } from './EmojiCharadesScoreboard';
import { EmojiCharadesFinalScreen } from './EmojiCharadesFinalScreen';

interface EmojiCharadesGameScreenProps {
  view: EmojiCharadesGameView;
  myUserId: string;
  isSpectator: boolean;
  chatMessages: GameChatMessage[];
  rematchStatus: { votedUserIds?: string[]; votedCount?: number; totalNeeded?: number } | null;
  rematchUnavailable: boolean;
  actionError?: string | null;
  onGuess: (guess: string) => void;
  onSendChat: (content: string) => void;
  onRematch: () => void;
  onLeave: () => void;
}

const PHASE_HINT: Record<string, string> = {
  COUNTDOWN: 'The puzzle appears in a moment.',
  PLAY: 'Everyone guesses at the same time.',
  REVEAL: 'The next round starts soon.'
};

/** The running game: header with timer, the panel of the current phase, who solved, scoreboard and chat. */
export const EmojiCharadesGameScreen: React.FC<EmojiCharadesGameScreenProps> = ({
  view,
  myUserId,
  isSpectator,
  chatMessages,
  rematchStatus,
  rematchUnavailable,
  actionError,
  onGuess,
  onSendChat,
  onRematch,
  onLeave
}) => {
  const clock = useEmojiCharadesClock(view);
  const [chatOpen, setChatOpen] = useState(false);
  const over = view.phase === 'FINAL' || view.phase === 'ABORTED';

  if (over) {
    return (
      <EmojiCharadesFinalScreen
        view={view}
        myUserId={myUserId}
        isSpectator={isSpectator}
        rematchStatus={rematchStatus}
        rematchUnavailable={rematchUnavailable}
        onRematch={onRematch}
        onLeave={onLeave}
      />
    );
  }

  const playing = view.phase === 'PLAY';
  const chatLocked = playing && Boolean(view.me?.solved);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[1.5fr_1fr]" data-testid="emoji-charades-screen" data-phase={view.phase}>
      <div className="space-y-4">
        <header className="flex items-center gap-4 rounded-3xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#121629]/80">
          {view.phase === 'REVEAL' ? (
            <EmojiCharadesTimerRing fraction={clock.fraction} msLeft={clock.msLeft} label="Next round" />
          ) : (
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-slate-100 text-violet-600 dark:bg-white/10 dark:text-violet-300">
              <AppIcon name="popcorn" className="h-7 w-7" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">Round {view.round} of {view.totalRounds}</p>
            <h1 className="truncate text-xl font-black text-[#16132b] dark:text-white sm:text-2xl">{phaseTitle(view.phase)}</h1>
            <p className="truncate text-xs text-slate-500 dark:text-zinc-400">{PHASE_HINT[view.phase] ?? ''}</p>
          </div>
          <button
            type="button"
            onClick={() => setChatOpen((o) => !o)}
            className="relative rounded-full p-2.5 text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10 lg:hidden"
            aria-label={chatOpen ? 'Hide chat' : 'Show chat'}
          >
            <AppIcon name="message" className="h-5 w-5" />
          </button>
          <button type="button" onClick={onLeave} className="rounded-full p-2.5 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-white/10" aria-label="Leave game" title="Leave game">
            <AppIcon name="flag" className="h-5 w-5" />
          </button>
        </header>

        {view.phase !== 'REVEAL' && <EmojiCharadesPuzzleCard view={view} msLeft={clock.msLeft} fraction={clock.fraction} hintInSeconds={clock.hintInSeconds} />}
        {view.phase === 'REVEAL' && <EmojiCharadesRevealCard view={view} myUserId={myUserId} isSpectator={isSpectator} msLeft={clock.msLeft} />}

        {playing && <EmojiCharadesGuessPanel view={view} isSpectator={isSpectator} onGuess={onGuess} error={actionError} />}
        {playing && <EmojiCharadesSolvedStrip view={view} myUserId={myUserId} />}
        {view.phase === 'COUNTDOWN' && <EmojiCharadesSolvedStrip view={view} myUserId={myUserId} />}

        {actionError && !playing && <p className="text-center text-xs font-bold text-rose-600 dark:text-rose-300" role="alert">{actionError}</p>}
      </div>

      <aside className="space-y-4">
        <EmojiCharadesScoreboard view={view} myUserId={myUserId} showRoundPoints={view.phase === 'REVEAL'} />
        <div className={`${chatOpen ? 'block' : 'hidden'} lg:block`}>
          {chatLocked ? (
            <div className="flex h-72 flex-col items-center justify-center rounded-3xl border border-white/60 bg-white/80 p-6 text-center shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#121629]/80" data-testid="chat-locked">
              <AppIcon name="lock" className="mb-2 h-7 w-7 text-violet-500" />
              <p className="text-sm font-black text-[#16132b] dark:text-white">Chat is locked</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">You solved it. Chat opens again when the round ends, so nobody gets the answer from you.</p>
            </div>
          ) : (
            <ImposterChat messages={chatMessages} myUserId={myUserId} onSend={onSendChat} readOnly={isSpectator} className="h-72" />
          )}
        </div>
      </aside>
    </div>
  );
};

export default EmojiCharadesGameScreen;
