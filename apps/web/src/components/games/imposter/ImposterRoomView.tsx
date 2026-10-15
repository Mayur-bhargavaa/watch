'use client';

import React, { useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Moon, Sun, Settings, ChevronUp, ChevronDown } from 'lucide-react';
import type { ChatReplyTo, ImposterGameView } from '@synccinema/common';
import { AppIcon } from '../../ui/AppIcon';
import { ReactionGlyph } from '../../ui/ReactionGlyph';
import { AlertModal } from '../../ui/AlertModal';
import { SpectatorBanner } from '../common/SpectatorBanner';
import { VideoGrid, type ParticipantStream } from '../../voice/VideoGrid';
import { useTheme } from '../../../context/ThemeContext';
import { GAME_ROOM_THEMES } from '../../../lib/gameRoomThemes';
import { phaseTitle } from '../../../lib/imposterView';
import type { FloatingReaction, GameChatMessage } from '../../../hooks/useGameRoom';
import { ImposterGameScreen } from './ImposterGameScreen';
import { ImposterRoomChat } from './ImposterRoomChat';

export interface ImposterRoomMedia {
  participants: ParticipantStream[];
  isMicMuted: boolean;
  isCameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  notice: string | null;
  onClearNotice: () => void;
}

interface ImposterRoomViewProps {
  roomCode: string;
  view: ImposterGameView;
  myUserId: string;
  isSpectator: boolean;
  spectatorCount: number;
  spectators: string[];
  chatMessages: GameChatMessage[];
  typingNames: string[];
  floatingReactions: FloatingReaction[];
  media: ImposterRoomMedia;
  themeId: string;
  onSelectTheme: (id: string) => void;
  rematchStatus: { votedUserIds?: string[]; votedCount?: number; totalNeeded?: number } | null;
  rematchUnavailable: boolean;
  actionError?: string | null;
  onSendClue: (word: string) => void;
  onReady: () => void;
  onVote: (targetUserId: string) => void;
  onGuess: (guess: string) => void;
  onSendChat: (content: string, replyTo?: ChatReplyTo | null) => void;
  onSendReaction: (emoji: string) => void;
  onTyping: (isTyping: boolean) => void;
  onRematch: () => void;
  /** actually leaves the room (the confirmation is asked here) */
  onLeave: () => void;
}

const BTN_BASE = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] sm:h-9 sm:w-9';
const BTN_IDLE = 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-white/10 dark:bg-[#14151b] dark:text-zinc-300 dark:hover:bg-[#1b1c24] dark:hover:text-white';

/**
 * The Ludo-like room around the Imposter phase panels: top bar (leave with confirmation, room code, round, mic, camera,
 * chat, theme, settings), the live video strip, the chat side panel and floating reactions.
 */
export const ImposterRoomView: React.FC<ImposterRoomViewProps> = ({
  roomCode,
  view,
  myUserId,
  isSpectator,
  spectatorCount,
  spectators,
  chatMessages,
  typingNames,
  floatingReactions,
  media,
  themeId,
  onSelectTheme,
  rematchStatus,
  rematchUnavailable,
  actionError,
  onSendClue,
  onReady,
  onVote,
  onGuess,
  onSendChat,
  onSendReaction,
  onTyping,
  onRematch,
  onLeave
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [videoOpen, setVideoOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const over = view.phase === 'FINISHED' || view.phase === 'ABORTED';

  const sidePanel = (
    <>
      <div className={`${chatOpen ? 'block' : 'hidden'}`}>
        <ImposterRoomChat
          messages={chatMessages}
          myUserId={myUserId}
          onSend={onSendChat}
          onReact={onSendReaction}
          onTyping={onTyping}
          typingNames={typingNames}
          readOnly={isSpectator}
          className="h-72 lg:h-80"
          onClose={() => setChatOpen(false)}
        />
      </div>
      {!chatOpen && (
        <button type="button" onClick={() => setChatOpen(true)} className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-900 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]">
          <AppIcon name="message" className="h-4 w-4 text-zinc-500" />
          Open chat
        </button>
      )}
    </>
  );

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-2.5 sm:gap-3" data-testid="imposter-room">
      {/* TOP BAR */}
      <header className="sticky top-2 z-30 flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 dark:border-white/10 dark:bg-[#14151b] sm:px-3">
        <button
          type="button"
          onClick={() => (isSpectator ? onLeave() : setConfirmLeave(true))}
          className={`${BTN_BASE} ${BTN_IDLE} w-auto gap-1.5 px-2.5 text-xs font-semibold sm:px-3.5`}
          title="Leave Match"
        >
          <AppIcon name="flag" className="h-4 w-4" />
          <span className="hidden sm:inline">Leave Match</span>
        </button>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <span className="hidden items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-[11px] text-zinc-600 dark:border-white/10 dark:bg-[#1b1c24] dark:text-zinc-300 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Room: <strong className="font-semibold text-zinc-900 dark:text-white">{roomCode}</strong>
          </span>
          <span className="truncate rounded-lg bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:bg-[#22232c] dark:text-zinc-200" data-testid="topbar-phase">
            {over ? phaseTitle(view.phase) : `Round ${view.round}/${view.totalRounds} - ${phaseTitle(view.phase)}`}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {!isSpectator && (
            <>
              <button
                type="button"
                onClick={media.onToggleMic}
                className={`${BTN_BASE} ${media.isMicMuted ? BTN_IDLE : 'border-emerald-600 bg-emerald-600 text-white'}`}
                title={media.isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                aria-pressed={!media.isMicMuted}
                aria-label={media.isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {media.isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={media.onToggleCamera}
                className={`${BTN_BASE} ${media.isCameraOn ? 'border-[#ee1d49] bg-[#ee1d49] text-white' : BTN_IDLE}`}
                title={media.isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
                aria-pressed={media.isCameraOn}
                aria-label={media.isCameraOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {media.isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setChatOpen((o) => !o)}
            className={`${BTN_BASE} ${chatOpen ? 'border-[#ee1d49] bg-[#ee1d49] text-white' : BTN_IDLE}`}
            title="Toggle Chat"
            aria-label="Toggle chat"
            aria-pressed={chatOpen}
          >
            <AppIcon name="message" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className={`${BTN_BASE} ${BTN_IDLE} hidden md:flex`}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Theme`}
            aria-label="Switch light or dark theme"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-amber-600" />}
          </button>
          <button type="button" onClick={() => setSettingsOpen(true)} className={`${BTN_BASE} ${BTN_IDLE}`} title="Settings" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {isSpectator && (
        <SpectatorBanner count={spectatorCount} names={spectators} onLeave={onLeave} status={`Round ${view.round} of ${view.totalRounds}`} />
      )}

      {/* LIVE VIDEO STRIP (players only; it stays mounted when hidden so voice keeps playing) */}
      {!isSpectator && media.participants.length > 0 && (
        <section aria-label="Live video" data-testid="video-strip" className="rounded-xl border border-white/10 bg-[#14151b] p-1.5">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Call ({media.participants.length})
            </span>
            <button type="button" onClick={() => setVideoOpen((o) => !o)} className="rounded-lg p-1 text-zinc-300 transition-colors duration-150 hover:bg-[#22232c] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49]" title={videoOpen ? 'Hide video tiles' : 'Show video tiles'} aria-label={videoOpen ? 'Hide video tiles' : 'Show video tiles'}>
              {videoOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className={videoOpen ? 'block' : 'hidden'}>
            <VideoGrid participants={media.participants} isCompact onToggleSelfCamera={media.onToggleCamera} onToggleSelfMic={media.onToggleMic} />
          </div>
        </section>
      )}

      <ImposterGameScreen
        view={view}
        myUserId={myUserId}
        isSpectator={isSpectator}
        chatMessages={chatMessages}
        rematchStatus={rematchStatus}
        rematchUnavailable={rematchUnavailable}
        actionError={actionError}
        onSendClue={onSendClue}
        onReady={onReady}
        onVote={onVote}
        onGuess={onGuess}
        onSendChat={onSendChat}
        onRematch={onRematch}
        onLeave={onLeave}
        sidePanel={sidePanel}
      />

      {/* FLOATING REACTIONS */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] h-1/2" aria-hidden="true">
        {floatingReactions.map((r) => (
          <div key={r.id} className="absolute bottom-20 left-1/2 flex -translate-x-1/2 animate-float-up flex-col items-center">
            <span className="text-4xl"><ReactionGlyph value={r.emoji} /></span>
            <span className="mt-0.5 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-white">{r.userName}</span>
          </div>
        ))}
      </div>

      {/* LEAVE CONFIRMATION */}
      <AlertModal
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Leave Match?"
        message="Are you sure you want to leave this game? You will disconnect from the match and return to the lounge."
        type="warning"
        confirmText="Leave Match"
        cancelText="Stay & Play"
        onConfirm={() => {
          setConfirmLeave(false);
          onLeave();
        }}
      />

      {/* DEVICE NOTICE (camera or microphone blocked) */}
      {media.notice && (
        <AlertModal isOpen onClose={media.onClearNotice} title="Device Notice" message={media.notice} type="warning" confirmText="Understood" />
      )}

      {/* SETTINGS: room theme */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Room settings" onClick={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#14151b]">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-white/5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white">
                <Settings className="h-4 w-4 text-zinc-500" />
                Imposter Settings
              </h3>
              <button type="button" onClick={() => setSettingsOpen(false)} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-[#22232c] dark:hover:text-white" aria-label="Close settings">
                <AppIcon name="close" className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-[#1b1c24]">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-white">
                <AppIcon name="palette" className="h-4 w-4 text-zinc-500" />
                Room Theme
              </div>
              <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pr-1">
                {GAME_ROOM_THEMES.map((t) => {
                  const selected = t.id === themeId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectTheme(t.id)}
                      aria-pressed={selected}
                      className={`group relative flex flex-col items-center overflow-hidden rounded-xl border text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] ${selected ? 'border-[#ee1d49] ring-2 ring-[#ee1d49]' : 'border-zinc-200 hover:border-zinc-400 dark:border-white/10 dark:hover:border-white/30'}`}
                    >
                      <span className="relative block h-16 w-full overflow-hidden bg-black/50">
                        <img src={t.bgUrl} alt="" className="h-full w-full object-cover" />
                        {selected && (
                          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#ee1d49] text-white">
                            <AppIcon name="check" className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                      </span>
                      <span className="w-full truncate border-t border-zinc-200 bg-white px-1.5 py-1 text-center text-[10px] font-semibold text-zinc-900 dark:border-white/10 dark:bg-[#14151b] dark:text-white">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <button type="button" onClick={() => setSettingsOpen(false)} className="h-9 w-full rounded-xl bg-[#ee1d49] text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#14151b]">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImposterRoomView;
