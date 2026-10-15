'use client';

import React from 'react';
import type { GameRoom, MurderGameView } from '@synccinema/common';
import { MURDER_MAX_PLAYERS, MURDER_MIN_PLAYERS, MURDER_RANDOM_CASE } from '@synccinema/common';
import { AppIcon } from '../../ui/AppIcon';
import { startCheck } from '../../../lib/murderMysteryView';
import type { GameChatMessage } from '../../../hooks/useGameRoom';
import type { ParticipantStream } from '../../voice/VideoGrid';
import { UnifiedGameWaitingRoom } from '../common/waiting/UnifiedGameWaitingRoom';

interface MurderWaitingRoomProps {
  room: GameRoom;
  /** this recipient's lobby view (case choice + the catalogue) */
  view: MurderGameView | null;
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
  onPickCase: (caseId: string) => void;
  onLeave: () => void;
  error?: string | null;
}

const CARD = 'rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4';

/** The host's case picker (3 cases + random, with the blurb of the choice) or "Waiting for the host" for the players. */
export const MurderCasePanel: React.FC<{ view: MurderGameView | null; isHost: boolean; hostName: string; onPickCase: (caseId: string) => void; error?: string | null }> = ({ view, isHost, hostName, onPickCase, error }) => {
  const cases = view?.cases ?? [];
  const choice = view?.caseChoice || MURDER_RANDOM_CASE;
  const picked = cases.find((c) => c.id === choice) ?? null;
  const options = [...cases.map((c) => ({ id: c.id, title: c.title })), { id: MURDER_RANDOM_CASE, title: 'Surprise me' }];

  if (!isHost) {
    return (
      <div className={CARD} data-testid="murder-case-wait">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-[#22232c] dark:text-zinc-300">
            <AppIcon name="clock" className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Waiting for the host</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              {hostName} picks the case: {picked ? picked.title : 'a surprise case'}.
            </p>
          </div>
        </div>
        {picked && <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{picked.blurb}</p>}
      </div>
    );
  }

  return (
    <div className={CARD} data-testid="murder-case-picker">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white">
          <AppIcon name="search" className="h-4 w-4 text-[#ee1d49]" />
          Choose the case
        </h3>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Each case takes about 20 to 25 minutes</span>
      </div>
      <div role="radiogroup" aria-label="Case" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {options.map((o) => {
          const on = o.id === choice;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPickCase(o.id)}
              className={`flex h-10 items-center justify-between gap-2 rounded-xl border px-3 text-left text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] ${on ? 'border-[#ee1d49] bg-[#ee1d49] text-white' : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-[#14151b] dark:text-zinc-100 dark:hover:bg-[#1b1c24]'}`}
            >
              <span className="truncate">{o.title}</span>
              {on && <AppIcon name="check" className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />}
            </button>
          );
        })}
      </div>
      <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700 dark:border-white/10 dark:bg-[#1b1c24] dark:text-zinc-200" data-testid="murder-case-blurb">
        {picked ? (
          <>
            <p className="mb-0.5 text-sm font-bold text-zinc-900 dark:text-white">{picked.title}</p>
            <p className="mb-1 text-zinc-500 dark:text-zinc-400">{picked.tagline}</p>
            <p>{picked.blurb}</p>
            <p className="mt-1 font-semibold text-zinc-800 dark:text-zinc-100">Victim: {picked.victimName}</p>
          </>
        ) : (
          <p>The server will pick one of the {cases.length || 3} cases when you start. Nobody can know which.</p>
        )}
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-red-700 dark:text-red-300" role="alert">{error}</p>}
    </div>
  );
};

/**
 * The Murder Mystery Night waiting lobby: the shared lobby every game uses, in its solid group-lobby form (6 to 12 players,
 * host starts), with the case picker under it for the host and a "Waiting for the host" panel for the players.
 */
export const MurderWaitingRoom: React.FC<MurderWaitingRoomProps> = ({
  room, view, myUserId, chatMessages, isMicMuted, isCameraOn, onToggleMic, onToggleCamera, videoParticipants,
  onSendChat, onSendReaction, onInviteFriends, onStart, onPickCase, onLeave, error
}) => {
  const isHost = room.hostUserId === myUserId;
  const players = room.players.filter((p) => p.status !== 'LEFT');
  const connected = players.filter((p) => p.isConnected).length;
  const minPlayers = room.minPlayers || MURDER_MIN_PLAYERS;
  const check = startCheck(isHost, connected, minPlayers);
  const maxPlayers = Math.max(room.maxPlayers || MURDER_MAX_PLAYERS, minPlayers);
  const hostName = room.players.find((p) => p.userId === room.hostUserId)?.displayName || 'The host';

  return (
    <UnifiedGameWaitingRoom
      gameType="murder-mystery"
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
        error: isHost ? null : error,
        subtitle: `${minPlayers} to ${MURDER_MAX_PLAYERS} players${minPlayers < MURDER_MIN_PLAYERS ? ' (test mode)' : ''}. The host is a suspect too. Share the code and start when everyone is in.`,
        onInviteFriends,
        lobbyPanel: <MurderCasePanel view={view} isHost={isHost} hostName={hostName} onPickCase={onPickCase} error={isHost ? error : null} />
      }}
    />
  );
};

export default MurderWaitingRoom;
