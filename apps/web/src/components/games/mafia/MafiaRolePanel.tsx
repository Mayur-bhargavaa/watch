'use client';

import React, { useState } from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { MafiaGameView, MafiaRole } from '@synccinema/common';
import { playerName, roleBadgeClass, roleLabel } from '../../../lib/mafiaView';

const ROLE_ICON: Record<MafiaRole, string> = { mafia: 'skull', doctor: 'shield', detective: 'search', villager: 'users' };
const ROLE_TEXT: Record<MafiaRole, string> = {
  mafia: 'Each night, agree with your team on one player to remove. By day, blend in and stay out of the vote.',
  doctor: 'Each night, protect one player from the mafia. You may protect yourself, but not the same player two nights in a row.',
  detective: 'Each night, investigate one player. At dawn you privately learn whether they are in the mafia.',
  villager: 'You have no night action. Listen, discuss and vote out the mafia.'
};

/** The private role card (big at the reveal, a thin strip afterwards). Only ever drawn from `view.me`, which is the recipient's own role. */
export const MafiaRolePanel: React.FC<{ view: Pick<MafiaGameView, 'me' | 'players'>; compact?: boolean }> = ({ view, compact = false }) => {
  const [hidden, setHidden] = useState(false);
  const me = view.me;
  if (!me) return null;
  const mates = me.teammates.map((id) => playerName(view.players, id));

  if (compact) {
    return (
      <div data-testid="role-strip" className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#14151b]">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${roleBadgeClass(hidden ? null : me.role)}`}>
          <AppIcon name={hidden ? 'eye' : ROLE_ICON[me.role]} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 text-sm text-zinc-900 dark:text-white">
          {hidden ? <span className="font-semibold">Role hidden</span> : (
            <span>
              You are <span className="font-bold">{roleLabel(me.role)}</span>
              {!me.alive && <span className="text-zinc-600 dark:text-zinc-300"> (out of the game)</span>}
              {mates.length > 0 && <span className="text-zinc-600 dark:text-zinc-300">. Team: {mates.join(', ')}</span>}
            </span>
          )}
        </div>
        <button type="button" onClick={() => setHidden((h) => !h)} className="rounded-lg p-1.5 text-zinc-600 transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:text-zinc-300 dark:hover:bg-[#22232c]" aria-label={hidden ? 'Show my role' : 'Hide my role'} title={hidden ? 'Show my role' : 'Hide my role'}>
          <AppIcon name="eye" className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div data-testid="role-card" className={`rounded-2xl p-4 text-center sm:p-5 ${hidden ? 'bg-zinc-800 text-white' : roleBadgeClass(me.role)}`}>
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-white/25">
        <AppIcon name={hidden ? 'eye' : ROLE_ICON[me.role]} className="h-5 w-5" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/85">Your secret role</p>
      {hidden ? (
        <h2 className="mt-1 text-2xl font-bold">Role hidden</h2>
      ) : (
        <>
          <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">{roleLabel(me.role)}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/90">{ROLE_TEXT[me.role]}</p>
          {me.role === 'mafia' && (
            <p className="mx-auto mt-2 max-w-sm rounded-lg border border-white/25 px-3 py-1.5 text-sm font-semibold">
              {mates.length > 0 ? `Your team: ${mates.join(', ')}` : 'You are the only mafia member.'}
            </p>
          )}
        </>
      )}
      <button type="button" onClick={() => setHidden((h) => !h)} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/30 px-3 text-xs font-semibold transition-colors duration-150 hover:bg-black/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
        <AppIcon name="eye" className="h-4 w-4" />
        {hidden ? 'Show' : 'Hide'}
      </button>
    </div>
  );
};

export default MafiaRolePanel;
