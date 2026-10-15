'use client';

import React from 'react';
import type { GameRoom, TournamentConfig, TournamentGameView } from '@synccinema/common';
import { TOURNAMENT_MAX_PLAYERS, TOURNAMENT_MIN_PLAYERS } from '@synccinema/common';
import { lobbyPlayers, startCheck } from '../../../lib/tournamentView';
import type { GameChatMessage } from '../../../hooks/useGameRoom';
import type { ParticipantStream } from '../../voice/VideoGrid';
import { UnifiedGameWaitingRoom } from '../common/waiting/UnifiedGameWaitingRoom';
import { TournamentOrganiserPanel, TournamentPlayerLobbyPanel } from './TournamentLobbyPanel';

interface TournamentWaitingRoomProps {
  room: GameRoom;
  /** this recipient's lobby view */
  view: TournamentGameView | null;
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
  onConfig: (patch: Partial<TournamentConfig>) => void;
  onShuffle: () => void;
  onKick: (userId: string) => void;
  onLeave: () => void;
  error?: string | null;
}

/**
 * The Tournament Arena waiting lobby: the shared lobby every game uses, in its solid group-lobby form, with the organiser's panel under it
 * for the organiser and "Waiting for the organiser" for the players.
 */
export const TournamentWaitingRoom: React.FC<TournamentWaitingRoomProps> = ({
  room, view, myUserId, chatMessages, isMicMuted, isCameraOn, onToggleMic, onToggleCamera, videoParticipants,
  onSendChat, onSendReaction, onInviteFriends, onStart, onConfig, onShuffle, onKick, onLeave, error
}) => {
  const isHost = room.hostUserId === myUserId;
  const players = lobbyPlayers(room.players, room.hostUserId, view?.seedOrder);
  const connected = players.filter((p) => p.isConnected !== false).length;
  const min = view?.minPlayers ?? TOURNAMENT_MIN_PLAYERS;
  const check = startCheck(isHost, players.length, connected, min);
  const organiserName = room.players.find((p) => p.userId === room.hostUserId)?.displayName || 'The organiser';

  return (
    <UnifiedGameWaitingRoom
      gameType="tournament"
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
        minPlayers: min,
        maxPlayers: TOURNAMENT_MAX_PLAYERS,
        readyCount: connected,
        canStart: check.ok,
        startHint: check.reason,
        error: isHost ? null : error,
        subtitle: `You need at least ${min} players besides the organiser (up to ${TOURNAMENT_MAX_PLAYERS}). Share the code and start when everyone is in.`,
        onInviteFriends,
        hideEmptySeats: true,
        hostLabel: 'Organiser',
        waitingForHostText: 'Waiting for the organiser to start the tournament...',
        lobbyPanel: isHost
          ? <TournamentOrganiserPanel view={view} players={players} onConfig={onConfig} onShuffle={onShuffle} onKick={onKick} error={error} />
          : <TournamentPlayerLobbyPanel view={view} players={players} organiserName={organiserName} />
      }}
    />
  );
};

export default TournamentWaitingRoom;
