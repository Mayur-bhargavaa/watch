'use client';

import React, { useState } from 'react';
import type { MurderGameView } from '@synccinema/common';
import { AppIcon } from '../../ui/AppIcon';
import { phaseTitle, readyProgress, roundLabel } from '../../../lib/murderMysteryView';
import { useImposterClock } from '../imposter/useImposterClock';
import { ImposterTimerRing } from '../imposter/ImposterTimerRing';
import { ImposterPlayerChip } from '../imposter/ImposterPlayerChip';
import { MurderCharacterCard, MurderCardDrawer } from './MurderCharacterCard';
import { MurderClueBoard } from './MurderClueBoard';
import { MurderDiscussion } from './MurderDiscussion';
import { MurderAccusation } from './MurderAccusation';
import { MurderResult } from './MurderResult';
import { MurderFinalScreen } from './MurderFinalScreen';
import { MurderScoring } from './MurderScoring';

interface MurderGameScreenProps {
  view: MurderGameView;
  myUserId: string;
  isSpectator: boolean;
  isHost: boolean;
  rematchStatus: { votedUserIds?: string[]; votedCount?: number; totalNeeded?: number } | null;
  rematchUnavailable: boolean;
  actionError?: string | null;
  onReady: () => void;
  onNext: () => void;
  onWhisper: (toUserId: string, text: string) => void;
  onShareClue: (clueId: string) => void;
  onAccuse: (characterId: string, motive: string) => void;
  onRematch: () => void;
  onLeave: () => void;
  /** the room's chat column */
  sidePanel: React.ReactNode;
}

const PHASE_HINT: Record<string, string> = {
  CHARACTER_REVEAL: 'Read your card. Keep it secret.',
  CLUE_ROUND: 'Compare clues, whisper, and watch for lies.',
  ACCUSATION: 'Choose the murderer. Your accusation is secret.',
  RESULT: 'The truth comes out.'
};

const BTN = 'h-8 rounded-xl px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#14151b]';

/** The running game: header with timer and round controls, the panel of the current phase, the suspects list and the side column. */
export const MurderGameScreen: React.FC<MurderGameScreenProps> = ({
  view, myUserId, isSpectator, isHost, rematchStatus, rematchUnavailable, actionError, onReady, onNext, onWhisper, onShareClue, onAccuse, onRematch, onLeave, sidePanel
}) => {
  const clock = useImposterClock(view);
  const [cardOpen, setCardOpen] = useState(false);
  const over = view.phase === 'FINAL' || view.phase === 'ABORTED';

  if (over) {
    return (
      <div className="mx-auto grid w-full gap-2.5 lg:grid-cols-[1.5fr_1fr] lg:gap-3" data-testid="murder-screen" data-phase={view.phase}>
        <MurderFinalScreen view={view} isSpectator={isSpectator} isHost={isHost} rematchStatus={rematchStatus} rematchUnavailable={rematchUnavailable} myUserId={myUserId} onRematch={onRematch} onLeave={onLeave} />
        <aside className="space-y-2.5">{sidePanel}</aside>
      </div>
    );
  }

  const timed = view.phaseEndsAt !== null;
  const me = view.me;
  const ready = readyProgress(view);
  const lastRound = view.round >= view.roundCount;

  return (
    <div className="mx-auto grid w-full gap-2.5 lg:grid-cols-[1.5fr_1fr] lg:gap-3" data-testid="murder-screen" data-phase={view.phase}>
      <div className="space-y-2.5">
        <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b]">
          {timed ? <ImposterTimerRing fraction={clock.fraction} msLeft={clock.msLeft} label={phaseTitle(view.phase)} /> : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-[#22232c] dark:text-zinc-300"><AppIcon name="search" className="h-5 w-5" /></div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{view.case?.title ?? 'Murder Mystery Night'}</p>
            <h1 className="truncate text-base font-bold text-zinc-900 dark:text-white sm:text-lg" data-testid="murder-phase-title">{roundLabel(view)}</h1>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{PHASE_HINT[view.phase] ?? ''}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {me && (
              <button type="button" onClick={() => setCardOpen(true)} data-testid="open-card" className={`${BTN} inline-flex items-center gap-1.5 border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]`}>
                <AppIcon name="glasses" className="h-3.5 w-3.5" />
                My card
              </button>
            )}
            {view.phase === 'CLUE_ROUND' && me && (
              <button type="button" onClick={onReady} disabled={me.ready} data-testid="ready-button" className={`${BTN} border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]`}>
                {me.ready ? `Ready (${ready.ready}/${ready.needed})` : `I am ready (${ready.ready}/${ready.needed})`}
              </button>
            )}
            {view.phase === 'CLUE_ROUND' && isHost && (
              <button type="button" onClick={onNext} data-testid="next-round" className={`${BTN} bg-[#ee1d49] text-white hover:bg-[#d6143c]`}>
                {lastRound ? 'Start accusations' : 'Next clue round'}
              </button>
            )}
          </div>
        </header>

        <div key={view.phase + view.round} className="space-y-2.5 motion-safe:animate-imposter-in">
          {view.phase === 'CHARACTER_REVEAL' && (me ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4">
              {view.case && <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-300"><strong className="text-zinc-900 dark:text-white">{view.case.title}.</strong> {view.case.blurb}</p>}
              <MurderCharacterCard card={me.card} />
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-center dark:border-white/10 dark:bg-[#14151b]">
              <AppIcon name="eye" className="mx-auto mb-2 h-6 w-6 text-zinc-500" />
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">The suspects are reading their cards</h2>
              {view.case && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{view.case.blurb}</p>}
            </div>
          ))}

          {view.phase === 'CLUE_ROUND' && (
            <div className="grid gap-2.5 md:grid-cols-2">
              <MurderClueBoard view={view} onShareClue={onShareClue} className="max-h-[56vh] min-h-[16rem]" />
              <MurderDiscussion view={view} myUserId={myUserId} onWhisper={onWhisper} className="max-h-[56vh] min-h-[16rem]" />
            </div>
          )}

          {view.phase === 'ACCUSATION' && (
            <div className="grid gap-2.5 md:grid-cols-2">
              <MurderAccusation view={view} onAccuse={onAccuse} />
              <MurderClueBoard view={view} onShareClue={onShareClue} className="max-h-[56vh] min-h-[14rem]" />
            </div>
          )}

          {view.phase === 'RESULT' && <MurderResult view={view} myUserId={myUserId} isSpectator={isSpectator} isHost={isHost} onNext={onNext} />}
        </div>

        {actionError && <p className="text-center text-xs font-semibold text-red-700 dark:text-red-300" role="alert">{actionError}</p>}
      </div>

      <aside className="space-y-2.5">
        <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b]" data-testid="roster">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Suspects ({view.characters.length})</h3>
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {view.characters.map((c) => {
              const p = view.players.find((pl) => pl.userId === c.userId);
              const isReady = view.phase === 'CLUE_ROUND' && view.readyUserIds.includes(c.userId);
              const accused = view.phase === 'ACCUSATION' && view.accusedUserIds.includes(c.userId);
              return (
                <li key={c.id} className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${c.withdrawn ? 'opacity-60' : ''}`} title={c.bio}>
                  <ImposterPlayerChip name={p?.displayName || c.name} avatarUrl={p?.avatarUrl} connected={p?.connected !== false} left={Boolean(p?.left)} isMe={c.userId === myUserId} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100 ${c.withdrawn ? 'line-through' : ''}`}>{c.name}</span>
                    <span className="block truncate text-[10px] text-zinc-500 dark:text-zinc-400">{c.withdrawn ? 'Left the party' : `${p?.displayName || 'Player'}${c.userId === myUserId ? ' (You)' : ''}`}</span>
                  </span>
                  {(isReady || accused) && <AppIcon name="check" className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" label={isReady ? 'Ready' : 'Accused'} />}
                </li>
              );
            })}
          </ul>
        </div>
        {sidePanel}
        <MurderScoring />
      </aside>

      <MurderCardDrawer open={cardOpen} card={me?.card ?? null} onClose={() => setCardOpen(false)} />
    </div>
  );
};

export default MurderGameScreen;
