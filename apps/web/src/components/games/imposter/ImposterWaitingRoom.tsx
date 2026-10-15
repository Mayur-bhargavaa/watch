'use client';

import React, { useState } from 'react';
import type { GameRoom } from '@synccinema/common';
import { IMPOSTER_MAX_PLAYERS, IMPOSTER_MIN_PLAYERS, IMPOSTER_ROUND_OPTIONS } from '@synccinema/common';
import { startCheck } from '../../../lib/imposterView';
import type { GameChatMessage } from '../../../hooks/useGameRoom';
import type { ParticipantStream } from '../../voice/VideoGrid';
import { UnifiedGameWaitingRoom } from '../common/waiting/UnifiedGameWaitingRoom';

interface ImposterWaitingRoomProps {
  room: GameRoom;
  myUserId: string;
  chatMessages: GameChatMessage[];
  isMicMuted: boolean;
  isCameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  videoParticipants: ParticipantStream[];
  onSendChat: (content: string) => void;
  onSendReaction: (emoji: string) => void;
  onInviteFriends: () => void;
  onStart: (rounds: number) => void;
  onLeave: () => void;
  error?: string | null;
}

/**
 * The Imposter waiting lobby: the same shared lobby every game uses (UnifiedGameWaitingRoom, the one Ludo shows), plus the
 * Imposter specifics: the host's round count, the start rule (min players, from the room) and the VIP chip (in the preset).
 */
export const ImposterWaitingRoom: React.FC<ImposterWaitingRoomProps> = ({
  room,
  myUserId,
  chatMessages,
  isMicMuted,
  isCameraOn,
  onToggleMic,
  onToggleCamera,
  videoParticipants,
  onSendChat,
  onSendReaction,
  onInviteFriends,
  onStart,
  onLeave,
  error
}) => {
  const [rounds, setRounds] = useState<number>(IMPOSTER_ROUND_OPTIONS[0]);
  const isHost = room.hostUserId === myUserId;
  const players = room.players.filter((p) => p.status !== 'LEFT');
  const connected = players.filter((p) => p.isConnected).length;
  const minPlayers = room.minPlayers || IMPOSTER_MIN_PLAYERS;
  const check = startCheck(isHost, connected, minPlayers);
  const maxPlayers = Math.max(room.maxPlayers || IMPOSTER_MAX_PLAYERS, minPlayers);

  const roundPicker = isHost ? (
    <div className="mb-3 rounded-2xl border border-zinc-200 bg-white p-3 text-left dark:border-white/10 dark:bg-[#14151b]" data-testid="round-picker">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Rounds</p>
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
  ) : null;

  return (
    <UnifiedGameWaitingRoom
      gameType="imposter"
      room={room}
      myUserId={myUserId}
      chatMessages={chatMessages}
      isMicMuted={isMicMuted}
      isCameraOn={isCameraOn}
      onToggleMic={onToggleMic}
      onToggleCamera={onToggleCamera}
      onSendChat={onSendChat}
      onSendReaction={onSendReaction}
      onStartGame={() => onStart(rounds)}
      onLeave={onLeave}
      videoParticipants={videoParticipants}
      surface="solid"
      groupLobby={{
        minPlayers,
        maxPlayers,
        readyCount: connected,
        canStart: check.ok,
        startHint: check.reason,
        error,
        subtitle: `${minPlayers} to ${IMPOSTER_MAX_PLAYERS} players${minPlayers < IMPOSTER_MIN_PLAYERS ? ' (test mode)' : ''}. Share the code and start when everyone is in.`,
        onInviteFriends,
        extraControls: roundPicker
      }}
    />
  );
};

export default ImposterWaitingRoom;
