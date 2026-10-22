'use client';

import React from 'react';
import type { GameRoom } from '@synccinema/common';
import { CLASH_DEFAULT_RULES, CLASH_TURN_SECONDS } from '@synccinema/common';
import type { ClashRules } from '@synccinema/common';
import type { GameChatMessage } from '../../../hooks/useGameRoom';
import { UnifiedGameWaitingRoom } from '../common/waiting/UnifiedGameWaitingRoom';

interface Props {
  room: GameRoom;
  myUserId: string;
  chatMessages: GameChatMessage[];
  ready: string[];
  rules: ClashRules | null;
  onSendChat: (content: string) => void;
  onSendReaction: (emoji: string) => void;
  onInviteFriends: () => void;
  onReady: (ready: boolean) => void;
  onConfig: (rules: Partial<ClashRules>) => void;
  onStart: () => void;
  onLeave: () => void;
  error?: string | null;
}

const turnLabel = (s: number | null) => (s === null ? 'No timer' : `${s}s`);

/**
 * The Color Clash lobby: the shared lobby every game uses, plus a ready check, the rule profile (the host changes it, everybody
 * sees it) and the start rule (2 to 4 connected players, all ready).
 */
export const ClashWaitingRoom: React.FC<Props> = ({ room, myUserId, chatMessages, ready, rules, onSendChat, onSendReaction, onInviteFriends, onReady, onConfig, onStart, onLeave, error }) => {
  const isHost = room.hostUserId === myUserId;
  const players = room.players.filter((p) => p.status !== 'LEFT');
  const present = players.filter((p) => p.isConnected !== false);
  const isReady = (id: string) => id === room.hostUserId || ready.includes(id);
  const readyPresent = present.filter((p) => isReady(p.userId));
  const waitingNames = present.filter((p) => !isReady(p.userId)).map((p) => p.displayName);
  const canStart = isHost && present.length >= 2 && present.length <= 4 && waitingNames.length === 0;
  const hint = !isHost ? null : present.length < 2 ? 'Need at least 2 players' : waitingNames.length > 0 ? `Waiting for ${waitingNames.join(', ')}` : 'Everyone is ready';
  const r = rules ?? CLASH_DEFAULT_RULES;
  const mineReady = isReady(myUserId);

  const toggle = (label: string, on: boolean, key: keyof ClashRules, hintText: string) => (
    <button
      key={String(key)}
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={!isHost}
      onClick={() => onConfig({ [key]: !on } as Partial<ClashRules>)}
      className={`flex items-center justify-between gap-2 w-full rounded-xl border px-3 py-2 text-left text-xs transition ${on ? 'border-[#ee1d49]/50 bg-[#ee1d49]/10' : 'border-zinc-200 dark:border-white/10'} ${isHost ? 'cursor-pointer' : 'cursor-default opacity-90'}`}
    >
      <span><span className="block font-bold text-zinc-900 dark:text-white">{label}</span><span className="block text-[10px] text-zinc-500 dark:text-zinc-400">{hintText}</span></span>
      <span className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition ${on ? 'bg-[#ee1d49]' : 'bg-zinc-300 dark:bg-zinc-600'}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${on ? 'translate-x-4' : ''}`} /></span>
    </button>
  );

  const extra = (
    <div className="mb-3 space-y-3 text-left" data-testid="clash-lobby-extra">
      <button
        type="button"
        onClick={() => onReady(!mineReady)}
        disabled={isHost}
        aria-pressed={mineReady}
        className={`h-10 w-full rounded-xl text-sm font-bold transition ${mineReady ? 'bg-emerald-500 text-black' : 'bg-[#ee1d49] text-white'} ${isHost ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
      >
        {isHost ? 'You are ready (host)' : mineReady ? 'Ready! Tap to cancel' : "I'm ready"}
      </button>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400" aria-live="polite">{readyPresent.length} of {present.length} ready</p>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b]">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">House rules {isHost ? '' : '(set by the host)'}</p>
        <div className="mb-2 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Turn timer">
          <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 mr-1">Turn timer</span>
          {CLASH_TURN_SECONDS.map((s) => (
            <button key={String(s)} type="button" role="radio" aria-checked={r.turnSeconds === s} disabled={!isHost} onClick={() => onConfig({ turnSeconds: s })} className={`h-7 rounded-lg px-2.5 text-[11px] font-semibold ${r.turnSeconds === s ? 'bg-[#ee1d49] text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-[#22232c] dark:text-zinc-300'} ${isHost ? 'cursor-pointer' : 'cursor-default'}`}>{turnLabel(s)}</button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {toggle('Challenge Wild Draw Four', r.drawFourChallenge, 'drawFourChallenge', r.drawFourChallenge ? 'The next player may challenge it' : 'Only legal with no card of the active colour')}
          {toggle('Draw when you could play', r.voluntaryDraw, 'voluntaryDraw', 'You may draw even with a playable card')}
          {toggle('Play the card you drew', r.playDrawnCard, 'playDrawnCard', 'A playable drawn card can be played at once')}
          <button type="button" role="switch" aria-checked={r.reverseTwoPlayers === 'skip'} aria-label="Reverse acts like Skip with two players" disabled={!isHost} onClick={() => onConfig({ reverseTwoPlayers: r.reverseTwoPlayers === 'skip' ? 'normal' : 'skip' })} className={`flex items-center justify-between gap-2 w-full rounded-xl border px-3 py-2 text-left text-xs ${r.reverseTwoPlayers === 'skip' ? 'border-[#ee1d49]/50 bg-[#ee1d49]/10' : 'border-zinc-200 dark:border-white/10'} ${isHost ? 'cursor-pointer' : 'cursor-default opacity-90'}`}>
            <span><span className="block font-bold text-zinc-900 dark:text-white">Reverse = Skip with 2 players</span><span className="block text-[10px] text-zinc-500 dark:text-zinc-400">Otherwise it is a normal turn</span></span>
            <span className={`h-5 w-9 shrink-0 rounded-full p-0.5 ${r.reverseTwoPlayers === 'skip' ? 'bg-[#ee1d49]' : 'bg-zinc-300 dark:bg-zinc-600'}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${r.reverseTwoPlayers === 'skip' ? 'translate-x-4' : ''}`} /></span>
          </button>
        </div>
        <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400">Missing the Last Card call costs {r.lastCardPenalty} cards. No stacking of Draw cards.</p>
      </div>
    </div>
  );

  return (
    <UnifiedGameWaitingRoom
      gameType="color-clash"
      room={room}
      myUserId={myUserId}
      chatMessages={chatMessages}
      onSendChat={onSendChat}
      onSendReaction={onSendReaction}
      onStartGame={onStart}
      onLeave={onLeave}
      groupLobby={{
        minPlayers: 2,
        maxPlayers: Math.min(4, Math.max(2, room.maxPlayers || 4)),
        readyCount: readyPresent.length,
        canStart,
        startHint: hint,
        error,
        subtitle: `2 to ${Math.min(4, room.maxPlayers || 4)} players. Share the code, get ready, and the host starts.`,
        onInviteFriends,
        extraControls: extra
      }}
    />
  );
};
export default ClashWaitingRoom;
