'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameRoom, DoodleConfig } from '@synccinema/common';
import { GameChatMessage } from '../../../../hooks/useGameRoom';
import { WatchHeader } from './WatchHeader';
import { GameOverview } from './GameOverview';
import { HowToPlay } from './HowToPlay';
import { MatchmakingStatus } from './MatchmakingStatus';
import { PlayerCard } from './PlayerCard';
import { VersusIndicator } from './VersusIndicator';
import { RoomCodeCard } from './RoomCodeCard';
import { InviteFriend } from './InviteFriend';
import { ReadyState } from './ReadyState';
import { ChatPanel } from './ChatPanel';
import { DoodleSettingsModal } from '../DoodleSettingsModal';
import { useTheme } from '../../../../context/ThemeContext';

interface DoodleWaitingPageProps {
  room: GameRoom;
  myUserId: string;
  gameState: any;
  chatMessages: GameChatMessage[];
  connectionStatus: string;
  isMicMuted: boolean;
  isCameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onSendChat: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  onUpdateConfig: (partial: Partial<DoodleConfig>) => void;
  onStartGame: (config?: any) => void;
  onLeave: () => void;
}

export const DoodleWaitingPage: React.FC<DoodleWaitingPageProps> = ({
  room,
  myUserId,
  gameState,
  chatMessages,
  connectionStatus,
  isMicMuted,
  isCameraOn,
  onToggleMic,
  onToggleCamera,
  onSendChat,
  onSendReaction,
  onUpdateConfig,
  onStartGame,
  onLeave
}) => {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isMyReady, setIsMyReady] = useState(true);

  // If match status changes to PLAYING, route to the play arena immediately
  useEffect(() => {
    if (room.status === 'PLAYING') {
      router.push(`/games/doodle-duel/play?room=${encodeURIComponent(room.roomCode)}`);
    }
  }, [room.status, room.roomCode, router]);

  // Identify players
  const myPlayer = room.players.find(p => p.userId === myUserId) || {
    userId: myUserId,
    displayName: 'You',
    avatarUrl: '',
    seat: 0,
    isConnected: true
  };

  const opponentPlayer = room.players.find(p => p.userId !== myUserId) || null;
  const isHost = room.hostUserId === myUserId;
  const hasOpponent = Boolean(opponentPlayer);

  const config = (room as any).doodleConfig || gameState?.config || {
    rounds: 6,
    drawTimeSeconds: 60,
    difficulty: 'mixed',
    humanOnly: true
  };

  const handleStartDuel = () => {
    if (isStarting) return;
    setIsStarting(true);
    onStartGame(config);
    router.push(`/games/doodle-duel/play?room=${encodeURIComponent(room.roomCode)}`);
  };

  const handleInviteFriend = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/games/doodle-duel?room=${encodeURIComponent(room.roomCode)}`;
    if (navigator.share) {
      navigator.share({
        title: 'Join my Doodle Duel Room!',
        text: `Join my Doodle Duel room: ${room.roomCode}`,
        url
      }).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(url);
    alert('Room invite link copied to clipboard!');
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden transition-colors bg-[#fdf8f6] dark:bg-[#0c0f1d] text-slate-800 dark:text-white">
      {/* Warm creative workspace ambient background matching reference image */}
      <div className="fixed inset-0 pointer-events-none z-0 select-none overflow-hidden">
        {/* Subtle photo layer */}
        <img
          src="/images/doodle-cozy-workspace.jpg"
          alt="Cozy Creative Workspace"
          className="w-full h-full object-cover object-center opacity-30 dark:opacity-15 blur-[1px] transition-opacity"
        />

        {/* Soft pastel gradients blending photo into UI */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#fff7f9]/85 via-[#fff8f6]/75 to-[#fdf2f4]/90 dark:from-[#0c0f1d]/90 dark:via-[#0c0f1d]/80 dark:to-[#090b16]/95 backdrop-blur-[2px]" />

        {/* Ambient bokeh glows */}
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-pink-200/30 dark:bg-pink-900/15 blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 rounded-full bg-rose-200/25 dark:bg-rose-900/10 blur-3xl" />
        <div className="absolute -bottom-20 left-1/4 w-96 h-96 rounded-full bg-amber-100/30 dark:bg-amber-950/10 blur-3xl" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 flex-1 flex flex-col justify-between max-w-6xl mx-auto w-full p-2.5 sm:p-3 md:px-5 md:py-3 h-full max-h-screen">
        {/* 1. Header */}
        <WatchHeader
          roomCode={room.roomCode}
          playerCount={room.players.length}
          maxPlayers={2}
          isMicMuted={isMicMuted}
          isCameraOn={isCameraOn}
          unreadChatCount={0}
          isDark={isDark}
          onToggleMic={onToggleMic}
          onToggleCamera={onToggleCamera}
          onToggleChat={() => setIsChatOpen(prev => !prev)}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setShowSettingsModal(true)}
          onLeaveGame={onLeave}
          onBackToGames={() => router.push('/games')}
        />

        {/* 2. Main Layout matching Reference UI (Single Screen No-Scroll) */}
        <main className="flex-1 my-auto py-2 sm:py-3 flex flex-col lg:flex-row gap-4 sm:gap-6 items-center justify-center max-w-5xl mx-auto w-full min-h-0">
          {/* Left Column: Game Info, How to Play */}
          <div className="w-full lg:w-[280px] xl:w-[300px] shrink-0 flex flex-col gap-3 order-2 lg:order-1">
            <GameOverview isDark={isDark} />
            <HowToPlay isDark={isDark} />
          </div>

          {/* Center Column: Matchmaking, Player Cards, VS, Room Code, Invite */}
          <div className="flex-1 w-full max-w-xl flex flex-col items-center justify-center gap-3 sm:gap-3.5 order-1 lg:order-2">
            {/* Status title banner */}
            <MatchmakingStatus
              hasOpponent={hasOpponent}
              bothReady={hasOpponent && isMyReady}
              humanOnly={config.humanOnly !== false}
              isDark={isDark}
            />

            {/* Player Cards & VS Indicator */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3.5 relative">
              {/* Left Card: You (Host or Player) */}
              <PlayerCard
                isCurrentUser={true}
                player={myPlayer}
                isHost={isHost}
                isReady={isMyReady}
                canToggleReady={hasOpponent && !isHost}
                onToggleReady={() => setIsMyReady(prev => !prev)}
                statusText={hasOpponent ? (isMyReady ? 'Ready' : 'Not Ready') : 'Waiting for opponent...'}
                isDark={isDark}
              />

              {/* VS Indicator */}
              <VersusIndicator isDark={isDark} />

              {/* Right Card: Opponent */}
              <PlayerCard
                isCurrentUser={false}
                player={opponentPlayer}
                isHost={opponentPlayer?.userId === room.hostUserId}
                isReady={Boolean(opponentPlayer)}
                statusText={opponentPlayer ? 'Connected' : undefined}
                isDark={isDark}
              />
            </div>

            {/* Ready State / Launch Duel Button */}
            <ReadyState
              hasOpponent={hasOpponent}
              isHost={isHost}
              isStarting={isStarting}
              onStartGame={handleStartDuel}
              isDark={isDark}
            />

            {/* Room Code & Share Card */}
            <RoomCodeCard roomCode={room.roomCode} isDark={isDark} />

            {/* Invite a Friend Pill Button */}
            <InviteFriend onInvite={handleInviteFriend} isDark={isDark} />
          </div>
        </main>

        {/* Hand-drawn watermark bottom-left */}
        <div className="pointer-events-none select-none py-1 hidden sm:flex items-center justify-between text-xs text-pink-400/80 font-serif italic">
          <span>..Same Game Different Hearts ♡</span>
          <span className="not-italic text-[10px] text-slate-400 font-sans">
            Click ⚙️ Settings in header to customize rounds & draw time.
          </span>
        </div>
      </div>

      {/* Slide-over Chat Drawer for Tablet / Mobile */}
      <ChatPanel
        room={room}
        chatMessages={chatMessages}
        myUserId={myUserId}
        onSendMessage={onSendChat}
        onSendReaction={onSendReaction}
        isDrawerMode={true}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        isDark={isDark}
      />

      {/* Room & Game Settings Modal (Accessible via Settings Gear in Header) */}
      <DoodleSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        roomCode={room.roomCode}
        config={config}
        isHost={isHost}
        onUpdateConfig={onUpdateConfig}
        onLeaveRoom={onLeave}
        isDark={isDark}
      />
    </div>
  );
};
