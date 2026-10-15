'use client';

import React from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { MafiaGameView } from '@synccinema/common';
import { nightPickLocked, nightPrompt, nightTargets, playerName } from '../../../lib/mafiaView';
import { ImposterPlayerChip } from '../imposter/ImposterPlayerChip';

interface MafiaNightPanelProps {
  view: MafiaGameView;
  myUserId: string;
  onAction: (action: 'kill' | 'save' | 'investigate', targetUserId: string) => void;
}

const VERB = { kill: 'Attack', save: 'Protect', investigate: 'Investigate' } as const;

/** NIGHT: shows only what the player's role may do. Everybody else just sees that the town sleeps. */
export const MafiaNightPanel: React.FC<MafiaNightPanelProps> = ({ view, myUserId, onAction }) => {
  const me = view.me;
  const action = me?.alive ? me.nightAction : null;

  if (!me || !action) {
    return (
      <div data-testid="night-sleep" className="rounded-2xl border border-zinc-200 bg-white p-5 text-center dark:border-white/10 dark:bg-[#14151b]">
        <AppIcon name="moon" className="mx-auto mb-2 h-6 w-6 text-zinc-500 dark:text-zinc-400" />
        <h2 className="text-base font-bold text-zinc-900 dark:text-white">{me && !me.alive ? 'You are out of the game' : 'The town sleeps'}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          {me && !me.alive ? 'Watch from the graveyard. You can chat with the other dead players.' : 'Close your eyes. Dawn comes soon. Your mic is muted and the video is hidden while you wait.'}
        </p>
      </div>
    );
  }

  const targets = nightTargets(view, myUserId);
  const locked = nightPickLocked(view);
  const chosen = me.nightChoice;
  const mates = me.teammates.map((id) => playerName(view.players, id));

  return (
    <div className="space-y-2.5" data-testid="night-panel">
      <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{nightPrompt(action)}</h3>
          {locked && <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Choice locked</span>}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {targets.map((p) => {
            const selected = chosen === p.userId;
            const teamPick = Object.entries(me.teamChoices).some(([id, t]) => id !== myUserId && t === p.userId);
            return (
              <button
                key={p.userId}
                type="button"
                disabled={locked && !selected}
                onClick={() => { if (!locked && !selected) onAction(action, p.userId); }}
                aria-pressed={selected}
                aria-label={`${VERB[action]} ${p.displayName}`}
                className={`relative flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] disabled:cursor-default disabled:opacity-60 ${
                  selected ? 'border-[#ee1d49] bg-white ring-2 ring-[#ee1d49] dark:bg-[#1b1c24]' : 'border-zinc-200 bg-zinc-50 hover:border-zinc-400 dark:border-white/10 dark:bg-[#1b1c24] dark:hover:border-white/30'
                }`}
              >
                <ImposterPlayerChip name={p.displayName} avatarUrl={p.avatarUrl} connected={p.connected} isMe={p.userId === myUserId} />
                <span className="max-w-full truncate text-sm font-semibold text-zinc-900 dark:text-white">{p.userId === myUserId ? `${p.displayName} (You)` : p.displayName}</span>
                {teamPick && <span className="rounded-full bg-red-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">Team pick</span>}
                {selected && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#ee1d49] text-white">
                    <AppIcon name="check" className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-xs text-zinc-600 dark:text-zinc-300">
          {action === 'kill' && (mates.length > 0 ? `Your team: ${mates.join(', ')}. The most chosen player is attacked; a tie goes to the latest pick. You can change your pick until dawn.` : 'You can change your pick until dawn.')}
          {action === 'save' && (me.lastSavedUserId ? `You protected ${playerName(view.players, me.lastSavedUserId)} last night, so they are unavailable. You can choose yourself.` : 'You can choose yourself. Your choice is final.')}
          {action === 'investigate' && 'Your answer arrives at dawn. Your choice is final.'}
        </p>
      </div>
      {action === 'investigate' && me.investigations.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b]" data-testid="investigations">
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Your findings</h3>
          <ul className="space-y-1">
            {me.investigations.map((i) => (
              <li key={`${i.round}-${i.targetUserId}`} className="flex items-center justify-between rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs dark:bg-[#1b1c24]">
                <span className="font-semibold text-zinc-800 dark:text-zinc-100">Night {i.round}: {playerName(view.players, i.targetUserId)}</span>
                <span className={`rounded-md px-1.5 py-0.5 font-semibold text-white ${i.isMafia ? 'bg-red-700' : 'bg-emerald-700'}`}>{i.isMafia ? 'Mafia' : 'Not mafia'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MafiaNightPanel;
