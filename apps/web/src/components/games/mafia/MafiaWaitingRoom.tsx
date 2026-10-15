'use client';

import React from 'react';
import type { GameRoom } from '@synccinema/common';
import { MAFIA_MAX_PLAYERS, MAFIA_MIN_PLAYERS } from '@synccinema/common';
import { startCheck } from '../../../lib/mafiaView';
import type { GameChatMessage } from '../../../hooks/useGameRoom';
import type { ParticipantStream } from '../../voice/VideoGrid';
import { UnifiedGameWaitingRoom } from '../common/waiting/UnifiedGameWaitingRoom';

interface MafiaWaitingRoomProps {
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
  onStart: () => void;
  onLeave: () => void;
  error?: string | null;
}

/** The Mafia Night waiting lobby: the shared lobby every game uses, in its solid group-lobby form (5 to 10 players, host starts). */
export const MafiaWaitingRoom: React.FC<MafiaWaitingRoomProps> = ({
  room, myUserId, chatMessages, isMicMuted, isCameraOn, onToggleMic, onToggleCamera, videoParticipants,
  onSendChat, onSendReaction, onInviteFriends, onStart, onLeave, error
}) => {
  const isHost = room.hostUserId === myUserId;
  const players = room.players.filter((p) => p.status !== 'LEFT');
  const connected = players.filter((p) => p.isConnected).length;
  const minPlayers = room.minPlayers || MAFIA_MIN_PLAYERS;
  const check = startCheck(isHost, connected, minPlayers);
  const maxPlayers = Math.max(room.maxPlayers || MAFIA_MAX_PLAYERS, minPlayers);

  return (
    <UnifiedGameWaitingRoom
      gameType="mafia-night"
      room={room}
      myUserId={myUserId}
      chatMessages={chatMessages}
      isMicMuted={isMicMuted}
      isCameraOn={isCameraOn}
      onToggleMic={onToggleMic}
      onToggleCamera={onToggleCamera}
      onSendChat={onSendChat}
      onSendReaction={onSendReaction}
      onStartGame={() => onStart()}
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
        subtitle: `${minPlayers} to ${MAFIA_MAX_PLAYERS} players${minPlayers < MAFIA_MIN_PLAYERS ? ' (test mode)' : ''}. Share the code and start when everyone is in.`,
        onInviteFriends
      }}
    />
  );
};

export default MafiaWaitingRoom;
