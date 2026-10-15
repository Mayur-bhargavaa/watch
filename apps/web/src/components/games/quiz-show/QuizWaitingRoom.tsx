'use client';

import React from 'react';
import type { GameRoom, QuizGameView } from '@synccinema/common';
import { QUIZ_MAX_PLAYERS } from '@synccinema/common';
import { startCheck } from '../../../lib/quizShowView';
import type { GameChatMessage } from '../../../hooks/useGameRoom';
import type { ParticipantStream } from '../../voice/VideoGrid';
import { UnifiedGameWaitingRoom } from '../common/waiting/UnifiedGameWaitingRoom';
import { QuizBuilderPanel, QuizPlayerLobbyPanel } from './QuizBuilderPanel';

interface QuizWaitingRoomProps {
  room: GameRoom;
  /** this recipient's lobby view (the host's carries the draft quiz with its answers) */
  view: QuizGameView | null;
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
  onEdit: (payload: Record<string, unknown>) => void;
  onLeave: () => void;
  error?: string | null;
}

/**
 * The Quiz Show Studio waiting lobby: the shared lobby every game uses, in its solid group-lobby form, with the quiz builder under it
 * for the host and a "Waiting for the host" panel for the players.
 */
export const QuizWaitingRoom: React.FC<QuizWaitingRoomProps> = ({
  room, view, myUserId, chatMessages, isMicMuted, isCameraOn, onToggleMic, onToggleCamera, videoParticipants,
  onSendChat, onSendReaction, onInviteFriends, onStart, onEdit, onLeave, error
}) => {
  const isHost = room.hostUserId === myUserId;
  const players = room.players.filter((p) => p.status !== 'LEFT' && p.userId !== room.hostUserId);
  const connectedPlayers = players.filter((p) => p.isConnected).length;
  const questionCount = view?.questionCount ?? 0;
  const check = startCheck(isHost, connectedPlayers, questionCount);
  const hostName = room.players.find((p) => p.userId === room.hostUserId)?.displayName || 'The host';

  return (
    <UnifiedGameWaitingRoom
      gameType="quiz-show"
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
        minPlayers: 1,
        maxPlayers: QUIZ_MAX_PLAYERS,
        readyCount: connectedPlayers,
        canStart: check.ok,
        startHint: check.reason,
        error: isHost ? null : error,
        subtitle: `You need at least one player besides the host (up to ${QUIZ_MAX_PLAYERS}). Share the code and start when everyone is in.`,
        onInviteFriends,
        hideEmptySeats: true,
        lobbyPanel: isHost
          ? <QuizBuilderPanel draft={view?.draft ?? []} onEdit={onEdit} error={error} />
          : <QuizPlayerLobbyPanel questionCount={questionCount} hostName={hostName} />
      }}
    />
  );
};

export default QuizWaitingRoom;
