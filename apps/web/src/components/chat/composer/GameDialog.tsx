'use client';

import React, { useState } from 'react';
import { Gamepad2, Loader2, X } from 'lucide-react';
import type { ChatGamePayload } from '@/types/chat';
import { ensureSession, getStoredSession } from '@/lib/api';
import { DialogShell, SECONDARY_BTN } from './DialogShell';
import { GAME_OPTIONS, createGameInvite } from './gameInvite';

interface Props {
  onSend: (game: ChatGamePayload) => void;
  onClose: () => void;
  onError: (message: string) => void;
}

export const GameDialog: React.FC<Props> = ({ onSend, onClose, onError }) => {
  const [selected, setSelected] = useState<string>('ludo');
  const [creating, setCreating] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const session = getStoredSession() || (await ensureSession());
      onSend(await createGameInvite(selected, session));
      onClose();
    } catch (err) {
      console.error('Failed to create game challenge:', err);
      onError('Could not create the game invite. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <DialogShell label="Invite to game" onClose={onClose} onSubmit={submit} panelClassName="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-amber-500" />
          <span>Invite to Game</span>
        </h3>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400">Choose Game</label>
        <div className="grid grid-cols-2 gap-2">
          {GAME_OPTIONS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelected(g.id)}
              aria-pressed={selected === g.id}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition text-left cursor-pointer ${
                selected === g.id
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-[#ee1d49] text-[#ee1d49]'
                  : 'bg-slate-100 dark:bg-zinc-800 border-transparent text-slate-700 dark:text-zinc-300'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onClose} disabled={creating} className={SECONDARY_BTN}>Cancel</button>
        <button
          type="submit"
          disabled={creating}
          className="flex-1 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {creating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Creating...</span>
            </>
          ) : (
            <span>Send Invite</span>
          )}
        </button>
      </div>
    </DialogShell>
  );
};
