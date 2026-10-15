'use client';

import React, { useState } from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { GameRoom } from '@synccinema/common';
import { EMOJI_CHARADES_MAX_PLAYERS, EMOJI_CHARADES_MIN_PLAYERS, EMOJI_CHARADES_MODES, EMOJI_CHARADES_ROUND_OPTIONS } from '@synccinema/common';
import { startCheck } from '../../../lib/emojiCharadesView';
import { ImposterPlayerChip } from '../imposter/ImposterPlayerChip';
import { ImposterChat } from '../imposter/ImposterChat';
import type { GameChatMessage } from '../../../hooks/useGameRoom';

interface EmojiCharadesLobbyProps {
  room: GameRoom;
  myUserId: string;
  chatMessages: GameChatMessage[];
  /** friends picker (the page owns the drawer) */
  onInviteFriends: () => void;
  onStart: (rounds: number, mode: string) => void;
  onSendChat: (content: string) => void;
  onLeave: () => void;
  error?: string | null;
}

const MODE_LABEL: Record<string, string> = { race: 'Race' };

/** Waiting room: invite code and link, player list, round count and mode (host) and the Start button. */
export const EmojiCharadesLobby: React.FC<EmojiCharadesLobbyProps> = ({ room, myUserId, chatMessages, onInviteFriends, onStart, onSendChat, onLeave, error }) => {
  const [rounds, setRounds] = useState<number>(EMOJI_CHARADES_ROUND_OPTIONS[0]);
  const [mode, setMode] = useState<string>(EMOJI_CHARADES_MODES[0]);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const isHost = room.hostUserId === myUserId;
  const players = room.players.filter((p) => p.status !== 'LEFT');
  const connected = players.filter((p) => p.isConnected).length;
  const check = startCheck(isHost, connected);

  const copy = async (what: 'code' | 'link') => {
    try {
      const value = what === 'code' ? room.roomCode : `${window.location.origin}/games/emoji-charades?room=${encodeURIComponent(room.roomCode)}`;
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 2500);
    } catch { /* clipboard blocked: the code is on screen */ }
  };

  const slots = Array.from({ length: Math.max(room.maxPlayers, EMOJI_CHARADES_MIN_PLAYERS) }, (_, i) => players[i] ?? null);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[1.3fr_1fr]" data-testid="emoji-charades-lobby">
      <div className="space-y-4">
        <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#121629]/80 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">Emoji Charades lobby</p>
              <h1 className="mt-1 text-2xl font-black text-[#16132b] dark:text-white sm:text-3xl">Waiting for players</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">{EMOJI_CHARADES_MIN_PLAYERS} to {EMOJI_CHARADES_MAX_PLAYERS} players. Share the code and start when everyone is in.</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" title="Hosted with a VIP Pass">
              <AppIcon name="crown" className="h-3 w-3" />
              VIP
            </span>
          </div>

          <div className="mt-5 rounded-2xl bg-gradient-to-r from-violet-600 to-[#ff2b70] p-4 text-white">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Room code</p>
            <p className="mt-1 break-all font-mono text-2xl font-black tracking-wider sm:text-3xl" data-testid="room-code">{room.roomCode}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void copy('code')} className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-bold hover:bg-white/30">
                <AppIcon name={copied === 'code' ? 'check' : 'key'} className="h-3.5 w-3.5" />
                {copied === 'code' ? 'Copied' : 'Copy code'}
              </button>
              <button type="button" onClick={() => void copy('link')} className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-bold hover:bg-white/30">
                <AppIcon name={copied === 'link' ? 'check' : 'link'} className="h-3.5 w-3.5" />
                {copied === 'link' ? 'Copied' : 'Copy invite link'}
              </button>
              <button type="button" onClick={onInviteFriends} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-black text-violet-700 hover:bg-white/90">
                <AppIcon name="users" className="h-3.5 w-3.5" />
                Invite friends
              </button>
            </div>
          </div>

          <h2 className="mb-3 mt-6 flex items-center justify-between text-sm font-black uppercase tracking-wider text-[#16132b] dark:text-white">
            <span>Players</span>
            <span className="text-xs font-bold normal-case tracking-normal text-slate-500 dark:text-zinc-400">{players.length} of {room.maxPlayers} joined, {connected} online</span>
          </h2>
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {slots.map((p, i) =>
              p ? (
                <li key={p.userId} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/70 px-2 py-3 text-center dark:border-white/10 dark:bg-white/5">
                  <ImposterPlayerChip name={p.displayName} avatarUrl={p.avatarUrl} isHost={p.userId === room.hostUserId} isMe={p.userId === myUserId} connected={p.isConnected} />
                  <span className="w-full truncate text-xs font-bold text-[#16132b] dark:text-white">{p.displayName}{p.userId === myUserId ? ' (you)' : ''}</span>
                </li>
              ) : (
                <li key={`empty-${i}`} className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-300/80 px-2 py-3 text-center text-slate-400 dark:border-white/15 dark:text-zinc-500">
                  <AppIcon name="users" className="h-5 w-5" />
                  <span className="text-[11px] font-semibold">{i < EMOJI_CHARADES_MIN_PLAYERS ? 'Needed' : 'Open seat'}</span>
                </li>
              )
            )}
          </ul>

          {isHost && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">Rounds</p>
                <div className="inline-flex rounded-2xl bg-slate-100 p-1 dark:bg-white/10" role="radiogroup" aria-label="Number of rounds">
                  {EMOJI_CHARADES_ROUND_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rounds === n}
                      onClick={() => setRounds(n)}
                      className={`rounded-xl px-5 py-2 text-sm font-black transition ${rounds === n ? 'bg-white text-violet-700 shadow dark:bg-violet-600 dark:text-white' : 'text-slate-500 dark:text-zinc-300'}`}
                    >
                      {n} rounds
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">Mode</p>
                <div className="inline-flex rounded-2xl bg-slate-100 p-1 dark:bg-white/10" role="radiogroup" aria-label="Game mode">
                  {EMOJI_CHARADES_MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={mode === m}
                      onClick={() => setMode(m)}
                      className={`rounded-xl px-5 py-2 text-sm font-black transition ${mode === m ? 'bg-white text-violet-700 shadow dark:bg-violet-600 dark:text-white' : 'text-slate-500 dark:text-zinc-300'}`}
                    >
                      {MODE_LABEL[m] ?? m}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 sm:col-span-2">Race mode: everyone guesses at the same time. 60 seconds per puzzle, hints appear on their own.</p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={!check.ok}
              onClick={() => onStart(rounds, mode)}
              className="flex-1 rounded-2xl bg-gradient-to-r from-violet-600 to-[#ff2b70] px-5 py-3.5 text-sm font-black text-white shadow transition enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <AppIcon name="play" className="h-4 w-4" />
                {isHost ? 'Start game' : 'Waiting for the host'}
              </span>
            </button>
            <button type="button" onClick={onLeave} className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
              Leave
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400" role="status">{check.reason}</p>
          {error && <p className="mt-2 text-xs font-bold text-rose-600 dark:text-rose-300" role="alert">{error}</p>}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#121629]/80">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[#16132b] dark:text-white">
            <AppIcon name="popcorn" className="h-4 w-4 text-violet-500" />
            How to play
          </h2>
          <ol className="space-y-2 text-sm text-slate-600 dark:text-zinc-300">
            <li><span className="font-black text-[#16132b] dark:text-white">1.</span> A string of emoji hints at a movie or a show. Everyone sees it at the same time.</li>
            <li><span className="font-black text-[#16132b] dark:text-white">2.</span> Type your guess. Only you see what you typed, and a near miss says so close.</li>
            <li><span className="font-black text-[#16132b] dark:text-white">3.</span> Letter hints appear after 20 and 40 seconds, but each one costs points.</li>
            <li><span className="font-black text-[#16132b] dark:text-white">4.</span> Solve it fast for a speed bonus. The first to solve gets extra points.</li>
          </ol>
        </div>
        <ImposterChat messages={chatMessages} myUserId={myUserId} onSend={onSendChat} className="h-72" />
      </div>
    </div>
  );
};

export default EmojiCharadesLobby;
