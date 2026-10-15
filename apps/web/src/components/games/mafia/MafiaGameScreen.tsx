'use client';

import React from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { MafiaGameView } from '@synccinema/common';
import { deadPlayers, livingPlayers, phaseTitle, roleBadgeClass, roleLabel } from '../../../lib/mafiaView';
import { useImposterClock } from '../imposter/useImposterClock';
import { ImposterTimerRing } from '../imposter/ImposterTimerRing';
import { ImposterPlayerChip } from '../imposter/ImposterPlayerChip';
import { MafiaRolePanel } from './MafiaRolePanel';
import { MafiaNightPanel } from './MafiaNightPanel';
import { MafiaDawnCard, MafiaDayPanel, MafiaVotePanel, MafiaVoteResultCard } from './MafiaDayPanels';
import { MafiaFinalScreen } from './MafiaFinalScreen';

interface MafiaGameScreenProps {
  view: MafiaGameView;
  myUserId: string;
  isSpectator: boolean;
  rematchStatus: { votedUserIds?: string[]; votedCount?: number; totalNeeded?: number } | null;
  rematchUnavailable: boolean;
  actionError?: string | null;
  onNightAction: (action: 'kill' | 'save' | 'investigate', targetUserId: string) => void;
  onReady: () => void;
  onVote: (targetUserId: string) => void;
  onRematch: () => void;
  onLeave: () => void;
  /** the room's video strip + chat column */
  sidePanel: React.ReactNode;
}

const PHASE_HINT: Record<string, string> = {
  ROLE_REVEAL: 'Memorise your role. Night falls soon.',
  NIGHT: 'Act in secret. Everyone else sleeps.',
  DAWN: 'See what the night left behind.',
  DAY: 'Discuss and find the mafia.',
  VOTE: 'Eliminate a suspect, or skip.',
  VOTE_RESULT: 'The town has spoken.'
};

/** The running game: header with timer, the panel of the current phase, role strip, the roster and the side column. */
export const MafiaGameScreen: React.FC<MafiaGameScreenProps> = ({ view, myUserId, isSpectator, rematchStatus, rematchUnavailable, actionError, onNightAction, onReady, onVote, onRematch, onLeave, sidePanel }) => {
  const clock = useImposterClock(view);
  const over = view.phase === 'FINISHED' || view.phase === 'ABORTED';

  if (over) {
    return (
      <div className="mx-auto grid w-full gap-2.5 lg:grid-cols-[1.5fr_1fr] lg:gap-3" data-testid="mafia-screen" data-phase={view.phase}>
        <MafiaFinalScreen view={view} isSpectator={isSpectator} rematchStatus={rematchStatus} rematchUnavailable={rematchUnavailable} myUserId={myUserId} onRematch={onRematch} onLeave={onLeave} />
        <aside className="space-y-2.5">{sidePanel}</aside>
      </div>
    );
  }

  const timed = view.phaseEndsAt !== null;
  const living = livingPlayers(view);
  const dead = deadPlayers(view);

  return (
    <div className="mx-auto grid w-full gap-2.5 lg:grid-cols-[1.5fr_1fr] lg:gap-3" data-testid="mafia-screen" data-phase={view.phase}>
      <div className="space-y-2.5">
        <header className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b]">
          {timed ? <ImposterTimerRing fraction={clock.fraction} msLeft={clock.msLeft} label={phaseTitle(view.phase)} /> : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-[#22232c] dark:text-zinc-300"><AppIcon name="ghost" className="h-5 w-5" /></div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{view.round > 0 ? `Night ${view.round}` : 'Get ready'}</p>
            <h1 className="truncate text-base font-bold text-zinc-900 dark:text-white sm:text-lg">{phaseTitle(view.phase)}</h1>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{PHASE_HINT[view.phase] ?? ''}</p>
          </div>
        </header>

        {!isSpectator && view.me && view.phase !== 'ROLE_REVEAL' && <MafiaRolePanel view={view} compact />}

        <div key={view.phase} className="space-y-2.5 motion-safe:animate-imposter-in">
          {view.phase === 'ROLE_REVEAL' && (isSpectator || !view.me ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-center dark:border-white/10 dark:bg-[#14151b]">
              <AppIcon name="eye" className="mx-auto mb-2 h-6 w-6 text-zinc-500" />
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Players are checking their roles</h2>
            </div>
          ) : <MafiaRolePanel view={view} />)}
          {view.phase === 'NIGHT' && (isSpectator ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-center dark:border-white/10 dark:bg-[#14151b]">
              <AppIcon name="moon" className="mx-auto mb-2 h-6 w-6 text-zinc-500" />
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">The town sleeps</h2>
            </div>
          ) : <MafiaNightPanel view={view} myUserId={myUserId} onAction={onNightAction} />)}
          {view.phase === 'DAWN' && <MafiaDawnCard view={view} />}
          {view.phase === 'DAY' && <MafiaDayPanel view={view} myUserId={myUserId} isSpectator={isSpectator} onReady={onReady} />}
          {view.phase === 'VOTE' && <MafiaVotePanel view={view} myUserId={myUserId} isSpectator={isSpectator} onVote={onVote} />}
          {view.phase === 'VOTE_RESULT' && <MafiaVoteResultCard view={view} />}
        </div>

        {actionError && <p className="text-center text-xs font-semibold text-red-700 dark:text-red-300" role="alert">{actionError}</p>}
      </div>

      <aside className="space-y-2.5">
        <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b]" data-testid="roster">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Alive {living.length}{dead.length > 0 ? ` / Out ${dead.length}` : ''}</h3>
          <ul className="space-y-1">
            {[...living, ...dead].map((p) => (
              <li key={p.userId} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 ${p.alive && !p.left ? '' : 'opacity-70'}`}>
                <span className="flex min-w-0 items-center gap-2">
                  <ImposterPlayerChip name={p.displayName} avatarUrl={p.avatarUrl} connected={p.connected} left={p.left || !p.alive} isMe={p.userId === myUserId} size="sm" />
                  <span className={`truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100 ${p.alive ? '' : 'line-through'}`}>{p.displayName}{p.userId === myUserId ? ' (You)' : ''}</span>
                </span>
                {p.role && <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${roleBadgeClass(p.role)}`}>{roleLabel(p.role)}</span>}
              </li>
            ))}
          </ul>
        </div>
        {sidePanel}
      </aside>
    </div>
  );
};

export default MafiaGameScreen;
