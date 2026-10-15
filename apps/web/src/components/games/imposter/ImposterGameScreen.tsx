'use client';

import React, { useState } from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { ImposterGameView } from '@synccinema/common';
import type { GameChatMessage } from '../../../hooks/useGameRoom';
import { phaseTitle } from '../../../lib/imposterView';
import { useImposterClock } from './useImposterClock';
import { ImposterTimerRing } from './ImposterTimerRing';
import { ImposterRoleCard } from './ImposterRoleCard';
import { ImposterCluePanel } from './ImposterCluePanel';
import { ImposterDiscussPanel } from './ImposterDiscussPanel';
import { ImposterVotePanel } from './ImposterVotePanel';
import { ImposterGuessPanel } from './ImposterGuessPanel';
import { ImposterResultCard } from './ImposterResultCard';
import { ImposterScoreboard } from './ImposterScoreboard';
import { ImposterFinalScreen } from './ImposterFinalScreen';
import { ImposterChat } from './ImposterChat';

interface ImposterGameScreenProps {
  view: ImposterGameView;
  myUserId: string;
  isSpectator: boolean;
  chatMessages: GameChatMessage[];
  rematchStatus: { votedUserIds?: string[]; votedCount?: number; totalNeeded?: number } | null;
  rematchUnavailable: boolean;
  actionError?: string | null;
  onSendClue: (word: string) => void;
  onReady: () => void;
  onVote: (targetUserId: string) => void;
  onGuess: (guess: string) => void;
  onSendChat: (content: string) => void;
  onRematch: () => void;
  onLeave: () => void;
  /**
   * In-room layout (video tiles + chat): when given, it replaces the built-in chat and the screen drops its own leave and
   * chat buttons (the room top bar owns them). Without it the screen is the standalone version.
   */
  sidePanel?: React.ReactNode;
}

const PHASE_HINT: Record<string, string> = {
  REVEAL: 'Memorise your role, then get ready for the clues.',
  CLUES: 'One word each. Be clever.',
  DISCUSS: 'Who is bluffing? Talk it out.',
  VOTE: 'Pick the imposter.',
  GUESS: 'The imposter has one last chance.',
  RESULT: 'The next round starts soon.'
};

/** The running game: header with timer, the panel of the current phase, role strip, scoreboard and chat. */
export const ImposterGameScreen: React.FC<ImposterGameScreenProps> = ({
  view,
  myUserId,
  isSpectator,
  chatMessages,
  rematchStatus,
  rematchUnavailable,
  actionError,
  onSendClue,
  onReady,
  onVote,
  onGuess,
  onSendChat,
  onRematch,
  onLeave,
  sidePanel
}) => {
  const clock = useImposterClock(view);
  const [chatOpen, setChatOpen] = useState(false);
  const over = view.phase === 'FINISHED' || view.phase === 'ABORTED';

  if (over) {
    const finalScreen = (
      <ImposterFinalScreen
        view={view}
        myUserId={myUserId}
        isSpectator={isSpectator}
        rematchStatus={rematchStatus}
        rematchUnavailable={rematchUnavailable}
        onRematch={onRematch}
        onLeave={onLeave}
      />
    );
    if (!sidePanel) return finalScreen;
    return (
      <div className="mx-auto grid w-full gap-3 lg:grid-cols-[1.5fr_1fr]" data-testid="imposter-screen" data-phase={view.phase}>
        <div>{finalScreen}</div>
        <aside className="space-y-3">{sidePanel}</aside>
      </div>
    );
  }

  const timed = view.phaseEndsAt !== null && view.phase !== 'RESULT';
  const showRoleStrip = !isSpectator && view.phase !== 'REVEAL' && view.phase !== 'RESULT' && Boolean(view.me?.role);
  const showChat = view.phase === 'DISCUSS' || chatOpen;

  return (
    <div className="mx-auto grid w-full gap-3 lg:grid-cols-[1.5fr_1fr]" data-testid="imposter-screen" data-phase={view.phase}>
      <div className="space-y-3">
        <header className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b]">
          {timed ? <ImposterTimerRing fraction={clock.fraction} msLeft={clock.msLeft} label={phaseTitle(view.phase)} /> : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-[#22232c] dark:text-zinc-300">
              <AppIcon name="ghost" className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Round {view.round} of {view.totalRounds}</p>
            <h1 className="truncate text-base font-bold text-zinc-900 dark:text-white sm:text-lg">{phaseTitle(view.phase)}</h1>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{view.category ? <>Category: <span className="font-semibold text-zinc-700 dark:text-zinc-200">{view.category}</span>. </> : null}{PHASE_HINT[view.phase] ?? ''}</p>
          </div>
          {!sidePanel && (
            <>
              <button
                type="button"
                onClick={() => setChatOpen((o) => !o)}
                className="relative rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-[#22232c] lg:hidden"
                aria-label={chatOpen ? 'Hide chat' : 'Show chat'}
              >
                <AppIcon name="message" className="h-4 w-4" />
              </button>
              <button type="button" onClick={onLeave} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-[#22232c]" aria-label="Leave game" title="Leave game">
                <AppIcon name="flag" className="h-4 w-4" />
              </button>
            </>
          )}
        </header>

        {showRoleStrip && <ImposterRoleCard view={view} compact />}

        <div key={view.phase} className="space-y-3 motion-safe:animate-imposter-in">

        {view.phase === 'REVEAL' && (isSpectator ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-center dark:border-white/10 dark:bg-[#14151b]">
            <AppIcon name="eye" className="mx-auto mb-2 h-6 w-6 text-zinc-500" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Players are checking their roles</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Category: <span className="font-semibold">{view.category}</span></p>
          </div>
        ) : <ImposterRoleCard view={view} />)}
        {view.phase === 'CLUES' && <ImposterCluePanel view={view} myUserId={myUserId} isSpectator={isSpectator} onSendClue={onSendClue} error={actionError} />}
        {view.phase === 'DISCUSS' && <ImposterDiscussPanel view={view} myUserId={myUserId} isSpectator={isSpectator} onReady={onReady} />}
        {view.phase === 'VOTE' && <ImposterVotePanel view={view} myUserId={myUserId} isSpectator={isSpectator} onVote={onVote} />}
        {view.phase === 'GUESS' && <ImposterGuessPanel view={view} myUserId={myUserId} isSpectator={isSpectator} onGuess={onGuess} />}
        {view.phase === 'RESULT' && <ImposterResultCard view={view} myUserId={myUserId} isSpectator={isSpectator} />}
        </div>

        {actionError && view.phase !== 'CLUES' && <p className="text-center text-xs font-semibold text-red-700 dark:text-red-300" role="alert">{actionError}</p>}
      </div>

      <aside className="space-y-3">
        <ImposterScoreboard view={view} myUserId={myUserId} showRoundPoints={view.phase === 'RESULT'} />
        {sidePanel ?? (
          <div className={`${showChat ? 'block' : 'hidden'} lg:block`}>
            <ImposterChat messages={chatMessages} myUserId={myUserId} onSend={onSendChat} readOnly={isSpectator} className="h-72" />
          </div>
        )}
      </aside>
    </div>
  );
};

export default ImposterGameScreen;
