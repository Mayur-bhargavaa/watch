'use client';

import React, { useState } from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { GameRoom } from '@synccinema/common';
import { IMPOSTER_MAX_PLAYERS, IMPOSTER_MIN_PLAYERS, IMPOSTER_ROUND_OPTIONS } from '@synccinema/common';
import { startCheck } from '../../../lib/imposterView';
import { ImposterPlayerChip } from './ImposterPlayerChip';
import { ImposterChat } from './ImposterChat';
import type { GameChatMessage } from '../../../hooks/useGameRoom';

interface ImposterLobbyProps {
  room: GameRoom;
  myUserId: string;
  chatMessages: GameChatMessage[];
  /** friends picker (the page owns the drawer) */
  onInviteFriends: () => void;
  onStart: (rounds: number) => void;
  onSendChat: (content: string) => void;
  onLeave: () => void;
  error?: string | null;
}

/** Waiting room: invite code and link, player list, round count (host) and the Start button. */
export const ImposterLobby: React.FC<ImposterLobbyProps> = ({ room, myUserId, chatMessages, onInviteFriends, onStart, onSendChat, onLeave, error }) => {
  const [rounds, setRounds] = useState<number>(IMPOSTER_ROUND_OPTIONS[0]);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const isHost = room.hostUserId === myUserId;
  const players = room.players.filter((p) => p.status !== 'LEFT');
  const connected = players.filter((p) => p.isConnected).length;
  const minPlayers = room.minPlayers || IMPOSTER_MIN_PLAYERS;
  const check = startCheck(isHost, connected, minPlayers);

  const copy = async (what: 'code' | 'link') => {
    try {
      const value = what === 'code' ? room.roomCode : `${window.location.origin}/games/imposter?room=${encodeURIComponent(room.roomCode)}`;
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 2500);
    } catch { /* clipboard blocked: the code is on screen */ }
  };

  const slots = Array.from({ length: Math.max(room.maxPlayers, minPlayers) }, (_, i) => players[i] ?? null);

  return (
    <div className="mx-auto grid w-full gap-3 lg:grid-cols-[1.3fr_1fr]" data-testid="imposter-lobby">
      <div className="space-y-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Imposter lobby</p>
              <h1 className="mt-0.5 text-lg font-bold text-zinc-900 dark:text-white">Waiting for players</h1>
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">{minPlayers} to {IMPOSTER_MAX_PLAYERS} players{minPlayers < IMPOSTER_MIN_PLAYERS ? ' (test mode)' : ''}. Share the code and start when everyone is in.</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200" title="Hosted with a VIP Pass">
              <AppIcon name="crown" className="h-3 w-3" />
              VIP
            </span>
          </div>

          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-[#1b1c24]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Room code</p>
            <p className="mt-0.5 break-all font-mono text-xl font-bold tracking-wider text-zinc-900 dark:text-white" data-testid="room-code">{room.roomCode}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button type="button" onClick={() => void copy('code')} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]">
                <AppIcon name={copied === 'code' ? 'check' : 'key'} className="h-3.5 w-3.5" />
                {copied === 'code' ? 'Copied' : 'Copy code'}
              </button>
              <button type="button" onClick={() => void copy('link')} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]">
                <AppIcon name={copied === 'link' ? 'check' : 'link'} className="h-3.5 w-3.5" />
                {copied === 'link' ? 'Copied' : 'Copy invite link'}
              </button>
              <button type="button" onClick={onInviteFriends} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#ee1d49] px-3 text-xs font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#14151b]">
                <AppIcon name="users" className="h-3.5 w-3.5" />
                Invite friends
              </button>
            </div>
          </div>

          <h2 className="mb-2 mt-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <span>Players</span>
            <span className="text-[11px] font-medium normal-case tracking-normal text-zinc-500 dark:text-zinc-400">{players.length} of {room.maxPlayers} joined, {connected} online</span>
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {slots.map((p, i) =>
              p ? (
                <li key={p.userId} className="flex flex-col items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-2.5 text-center dark:border-white/10 dark:bg-[#1b1c24]">
                  <ImposterPlayerChip name={p.displayName} avatarUrl={p.avatarUrl} isHost={p.userId === room.hostUserId} isMe={p.userId === myUserId} connected={p.isConnected} />
                  <span className="w-full truncate text-xs font-semibold text-zinc-900 dark:text-white">{p.displayName}{p.userId === myUserId ? ' (you)' : ''}</span>
                </li>
              ) : (
                <li key={`empty-${i}`} className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-300 px-2 py-2.5 text-center text-zinc-500 dark:border-white/15 dark:text-zinc-400">
                  <AppIcon name="users" className="h-[18px] w-[18px]" />
                  <span className="text-[11px] font-medium">{i < minPlayers ? 'Needed' : 'Open seat'}</span>
                </li>
              )
            )}
          </ul>

          {isHost && (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Rounds</p>
              <div className="inline-flex rounded-xl bg-zinc-100 p-0.5 dark:bg-[#22232c]" role="radiogroup" aria-label="Number of rounds">
                {IMPOSTER_ROUND_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rounds === n}
                    onClick={() => setRounds(n)}
                    className={`h-8 rounded-lg px-4 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] ${rounds === n ? 'bg-white text-zinc-900 ring-1 ring-zinc-200 dark:bg-[#ee1d49] dark:text-white dark:ring-0' : 'text-zinc-600 dark:text-zinc-300'}`}
                  >
                    {n} rounds
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">Each round has 2 clue rounds, a discussion and a vote.</p>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={!check.ok}
              onClick={() => onStart(rounds)}
              className="h-10 flex-1 rounded-xl bg-[#ee1d49] px-5 text-sm font-semibold text-white transition-colors duration-150 enabled:hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-[#14151b]"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <AppIcon name="play" className="h-4 w-4" />
                {isHost ? 'Start game' : 'Waiting for the host'}
              </span>
            </button>
            <button type="button" onClick={onLeave} className="h-10 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]">
              Leave
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400" role="status">{check.reason}</p>
          {error && <p className="mt-2 text-xs font-semibold text-red-700 dark:text-red-300" role="alert">{error}</p>}
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4">
          <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <AppIcon name="ghost" className="h-4 w-4" />
            How to play
          </h2>
          <ol className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
            <li><span className="font-semibold text-zinc-900 dark:text-white">1.</span> Everyone sees a category. All but one player also see the secret word.</li>
            <li><span className="font-semibold text-zinc-900 dark:text-white">2.</span> Give one-word clues, twice around. Do not say the word!</li>
            <li><span className="font-semibold text-zinc-900 dark:text-white">3.</span> Discuss, then vote for who you think is bluffing.</li>
            <li><span className="font-semibold text-zinc-900 dark:text-white">4.</span> Caught? The imposter gets one last guess at the word.</li>
          </ol>
        </div>
        <ImposterChat messages={chatMessages} myUserId={myUserId} onSend={onSendChat} className="h-72" />
      </div>
    </div>
  );
};

export default ImposterLobby;
