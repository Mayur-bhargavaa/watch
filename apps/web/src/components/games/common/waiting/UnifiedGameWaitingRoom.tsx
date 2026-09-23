'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Palette,
  Dices,
  Crown,
  Sparkles,
  Ticket,
  Grid,
  CircleDot,
  Users,
  Clock,
  BookOpen,
  Settings2,
  Copy,
  Check,
  Share2,
  UserPlus,
  ArrowRight,
  Play,
  Lock,
  User
} from 'lucide-react';
import { GameRoom } from '@synccinema/common';
import { GameChatMessage } from '../../../../hooks/useGameRoom';
import { WatchHeader } from '../../doodle/waiting/WatchHeader';
import { PlayerCard } from '../../doodle/waiting/PlayerCard';
import { VersusIndicator } from '../../doodle/waiting/VersusIndicator';
import { ChatPanel } from '../../doodle/waiting/ChatPanel';
import { useTheme } from '../../../../context/ThemeContext';

export type GameId =
  | 'doodle-duel'
  | 'ludo'
  | 'bingo'
  | 'tambola'
  | 'chess'
  | 'tic-tac-toe'
  | 'four-in-a-row';

interface GamePreset {
  id: GameId;
  name: string;
  tagline: string;
  annotation: string;
  icon: React.ElementType;
  iconColor: string;
  bgImage: string;
  chips: { label: string; icon: React.ElementType; color: string }[];
  rules: string[];
  maxPlayers: number;
}

export const GAME_PRESETS: Record<GameId, GamePreset> = {
  'doodle-duel': {
    id: 'doodle-duel',
    name: 'Doodle Duel',
    tagline: 'Draw it. Guess it. Switch.',
    annotation: 'Good Drawings Better Friends. ♡',
    icon: Palette,
    iconColor: '#ff2b70',
    bgImage: '/images/doodle-cozy-workspace.jpg',
    chips: [
      { label: '2 Players', icon: Users, color: '#ff2b70' },
      { label: 'Real-time', icon: Clock, color: '#0ea5e9' },
      { label: 'Creative', icon: Sparkles, color: '#f59e0b' }
    ],
    rules: [
      'One player gets a secret word and draws it.',
      'The other player guesses live in real-time.',
      'Roles switch automatically every round!',
      'Most correct guesses win the match! 🎉'
    ],
    maxPlayers: 2
  },
  ludo: {
    id: 'ludo',
    name: 'Ludo Royale',
    tagline: 'Roll six. Capture tokens. Race home.',
    annotation: 'Roll High Stay Lucky. 🎲',
    icon: Dices,
    iconColor: '#e11d48',
    bgImage: '/images/ludo-cozy-workspace.jpg',
    chips: [
      { label: '2-4 Players', icon: Users, color: '#e11d48' },
      { label: 'Real-time', icon: Clock, color: '#0ea5e9' },
      { label: 'Strategy', icon: Sparkles, color: '#f59e0b' }
    ],
    rules: [
      'Roll a 6 to release tokens onto the track.',
      'Land on opponent tokens to send them home.',
      'Navigate all tokens safely into the home triangle.',
      'First player to get all tokens home wins! 🏆'
    ],
    maxPlayers: 4
  },
  chess: {
    id: 'chess',
    name: 'Chess Masters',
    tagline: 'Think ahead. Control the center. Checkmate.',
    annotation: 'Grandmaster Moves Only. ♟️',
    icon: Crown,
    iconColor: '#8b5cf6',
    bgImage: '/images/chess-cozy-workspace.jpg',
    chips: [
      { label: '2 Players', icon: Users, color: '#8b5cf6' },
      { label: 'Real-time', icon: Clock, color: '#0ea5e9' },
      { label: 'Pure Skill', icon: Sparkles, color: '#f59e0b' }
    ],
    rules: [
      'White moves first, followed by Black.',
      'Control the center squares and develop pieces.',
      'Protect your King with castling and tactics.',
      'Deliver checkmate to claim victory! 👑'
    ],
    maxPlayers: 2
  },
  bingo: {
    id: 'bingo',
    name: 'Bingo Duel',
    tagline: 'Fill lines. Claim patterns. Shout Bingo!',
    annotation: 'Lucky Numbers Today. ✨',
    icon: Sparkles,
    iconColor: '#f43f5e',
    bgImage: '/images/bingo_cozy_romantic_bg.jpg',
    chips: [
      { label: '2 Players', icon: Users, color: '#f43f5e' },
      { label: 'Real-time', icon: Clock, color: '#0ea5e9' },
      { label: 'Instant Win', icon: Sparkles, color: '#f59e0b' }
    ],
    rules: [
      'Mark called numbers on your 5x5 grid.',
      'Complete horizontal, vertical, or diagonal rows.',
      'Complete 5 lines to complete B-I-N-G-O.',
      'First to achieve 5 lines claims the win! 🎉'
    ],
    maxPlayers: 2
  },
  tambola: {
    id: 'tambola',
    name: 'Tambola Party',
    tagline: 'Early five. Top line. Full house!',
    annotation: 'Family Fun Night. 🎟️',
    icon: Ticket,
    iconColor: '#ec4899',
    bgImage: '/images/romantic_room_ambient_bg.jpg',
    chips: [
      { label: '2-10 Players', icon: Users, color: '#ec4899' },
      { label: 'Multiplayer', icon: Clock, color: '#0ea5e9' },
      { label: 'Prizes', icon: Sparkles, color: '#f59e0b' }
    ],
    rules: [
      'Numbers 1–90 are drawn and announced live.',
      'Mark matched numbers on your 3x9 ticket.',
      'Claim Early 5, Rows, Corners, or Full House.',
      'Valid claims win instant victory points! 🎊'
    ],
    maxPlayers: 10
  },
  'tic-tac-toe': {
    id: 'tic-tac-toe',
    name: 'Tic Tac Toe',
    tagline: 'Three in a row. Block and win.',
    annotation: 'Simple Classic Fun. ❌⭕',
    icon: Grid,
    iconColor: '#0ea5e9',
    bgImage: '/images/card-tictactoe.jpg',
    chips: [
      { label: '2 Players', icon: Users, color: '#0ea5e9' },
      { label: 'Turn-based', icon: Clock, color: '#f43f5e' },
      { label: 'Quick Duel', icon: Sparkles, color: '#f59e0b' }
    ],
    rules: [
      'Take turns placing your mark (X or O).',
      'Get 3 marks in a line (horizontal, vertical, diagonal).',
      'Block your opponent before they complete 3.',
      'First to connect 3 marks wins the round! ⚡'
    ],
    maxPlayers: 2
  },
  'four-in-a-row': {
    id: 'four-in-a-row',
    name: 'Four in a Row',
    tagline: 'Drop discs. Connect four. Claim victory.',
    annotation: 'Connect & Conquer. 🔴🟡',
    icon: CircleDot,
    iconColor: '#ff2b70',
    bgImage: '/images/four-in-a-row-waiting-bg.jpg',
    chips: [
      { label: '2 Players', icon: Users, color: '#ff2b70' },
      { label: 'Turn-based', icon: Clock, color: '#0ea5e9' },
      { label: 'Gravity Duel', icon: Sparkles, color: '#f59e0b' }
    ],
    rules: [
      'Take turns dropping discs into the 7 vertical columns.',
      'Discs fall to the lowest unoccupied space.',
      'Connect 4 discs horizontally, vertically, or diagonally.',
      'First player to connect four wins! 🎯'
    ],
    maxPlayers: 2
  }
};

interface UnifiedGameWaitingRoomProps {
  gameType: GameId;
  room: GameRoom;
  myUserId: string;
  gameState?: any;
  chatMessages: GameChatMessage[];
  isMicMuted?: boolean;
  isCameraOn?: boolean;
  onToggleMic?: () => void;
  onToggleCamera?: () => void;
  onSendChat: (text: string) => void;
  onSendReaction?: (emoji: string) => void;
  onStartGame: (config?: any) => void;
  onUpdateConfig?: (config: any) => void;
  onLeave: () => void;
  customSettingsComponent?: React.ReactNode;
}

export const UnifiedGameWaitingRoom: React.FC<UnifiedGameWaitingRoomProps> = ({
  gameType,
  room,
  myUserId,
  gameState,
  chatMessages,
  isMicMuted = true,
  isCameraOn = false,
  onToggleMic = () => {},
  onToggleCamera = () => {},
  onSendChat,
  onSendReaction,
  onStartGame,
  onUpdateConfig,
  onLeave,
  customSettingsComponent
}) => {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isMyReady, setIsMyReady] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const preset = GAME_PRESETS[gameType] || GAME_PRESETS['doodle-duel'];
  const Icon = preset.icon;

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
  const maxSeats = room.maxPlayers || preset.maxPlayers || 2;
  const isMultiplayer = maxSeats > 2;

  const handleStartGame = () => {
    if (isStarting) return;
    setIsStarting(true);
    onStartGame();
  };

  const handleCopyCode = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(room.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareLink = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `Join my ${preset.name} Room!`,
        text: `Play ${preset.name} with me! Room Code: ${room.roomCode}`,
        url
      }).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="relative h-screen max-h-screen w-full flex flex-col justify-between overflow-hidden transition-colors bg-[#fdf8f6] dark:bg-[#0c0f1d] text-slate-800 dark:text-white select-none">
      {/* 1. Photorealistic Clean Background Layer (No baked containers) */}
      <div className="fixed inset-0 pointer-events-none z-0 select-none overflow-hidden">
        <img
          src={preset.bgImage}
          alt={preset.name}
          className="w-full h-full object-cover object-center opacity-65 dark:opacity-25 transition-opacity"
        />
        {/* Soft pastel overlay blending into UI */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/15 to-white/45 dark:from-[#0c0f1d]/80 dark:via-[#0c0f1d]/60 dark:to-[#0c0f1d]/85" />
        {/* Ambient bokeh glows */}
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-pink-200/25 dark:bg-pink-900/15 blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 rounded-full bg-rose-200/20 dark:bg-rose-900/10 blur-3xl" />
      </div>

      {/* 2. Main Page Container */}
      <div className="relative z-10 flex-1 flex flex-col justify-between max-w-6xl mx-auto w-full p-2.5 sm:p-3 md:px-5 md:py-3 h-full max-h-screen">
        {/* Top Header */}
        <WatchHeader
          roomCode={room.roomCode}
          playerCount={room.players.length}
          maxPlayers={preset.maxPlayers}
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

        {/* Center Main Stage (Ultra-compact, no vertical scrolling) */}
        <main className="flex-1 my-auto py-2 sm:py-3 flex flex-col lg:flex-row gap-4 sm:gap-6 items-center justify-center max-w-5xl mx-auto w-full min-h-0">
          {/* Left Column: Game Overview & How to Play */}
          <div className="w-full lg:w-[280px] xl:w-[300px] shrink-0 flex flex-col gap-3 order-2 lg:order-1">
            {/* Card 1: Game Overview */}
            <div className="relative w-full rounded-2xl sm:rounded-3xl p-3 sm:p-4 bg-white/80 dark:bg-[#121629]/80 border border-white/70 dark:border-white/10 shadow-[0_4px_20px_rgba(255,43,112,0.05)] backdrop-blur-xl overflow-hidden transition-all">
              <div className="absolute top-2.5 right-3.5 pointer-events-none select-none text-right hidden sm:block">
                <span className="font-serif italic text-[11px] font-bold text-[#ec4899] dark:text-[#f472b6] leading-tight block -rotate-3">
                  {preset.annotation}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-2.5">
                <div
                  className="w-10 h-10 rounded-xl p-0.5 shadow-xs shrink-0 flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${preset.iconColor}, #f59e0b)` }}
                >
                  <div className="w-full h-full rounded-[10px] bg-white dark:bg-[#121629] flex items-center justify-center">
                    <Icon className="w-5 h-5" style={{ color: preset.iconColor }} />
                  </div>
                </div>

                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#16132b] dark:text-white tracking-tight leading-tight">
                    {preset.name}
                  </h2>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                    {preset.tagline}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 pt-0.5">
                {preset.chips.map((chip, idx) => {
                  const ChipIcon = chip.icon;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg bg-slate-50/80 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-[10px] font-bold text-slate-600 dark:text-zinc-300"
                    >
                      <ChipIcon className="w-2.5 h-2.5" style={{ color: chip.color }} />
                      <span>{chip.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 2: How To Play */}
            <div className="relative w-full rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 bg-white/80 dark:bg-[#121629]/80 border border-white/70 dark:border-white/10 shadow-[0_4px_20px_rgba(255,43,112,0.05)] backdrop-blur-xl transition-all space-y-2">
              <div className="flex items-center gap-1.5 pb-0.5">
                <div className="w-5 h-5 rounded-lg bg-pink-100 dark:bg-pink-950/40 text-[#ff2b70] flex items-center justify-center">
                  <BookOpen className="w-3 h-3" />
                </div>
                <h3 className="text-xs sm:text-sm font-black text-[#16132b] dark:text-white tracking-tight">
                  How to Play?
                </h3>
              </div>

              <div className="space-y-1.5">
                {preset.rules.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#ff2b70] text-white font-extrabold text-[9px] flex items-center justify-center shrink-0 shadow-2xs">
                      {idx + 1}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 leading-tight">
                      {rule}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center Column: Matchmaking Title, Player Cards VS, Actions */}
          <div className="flex-1 w-full max-w-xl flex flex-col items-center justify-center gap-3 sm:gap-3.5 order-1 lg:order-2">
            {/* Status Hero Title */}
            <div className="relative text-center w-full max-w-lg mx-auto select-none pt-0 pb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-[#16132b] dark:text-white tracking-tight leading-tight">
                {hasOpponent ? (
                  <>
                    Opponent <span className="text-[#ff2b70]">Found</span>
                  </>
                ) : (
                  <>
                    Waiting for <span className="text-[#ff2b70]">Opponent</span>
                  </>
                )}
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 font-medium max-w-md mx-auto mt-0.5 leading-snug">
                {hasOpponent ? (
                  <span>Players connected! Host can start the match.</span>
                ) : (
                  <span>Match will begin when another human player joins the room.</span>
                )}
              </p>
            </div>

            {/* Player Cards (2-Player VS or Multi-player grid) */}
            {isMultiplayer ? (
              <div className="w-full grid grid-cols-2 gap-2 sm:gap-2.5">
                {Array.from({ length: maxSeats }).map((_, idx) => {
                  const p = room.players.find(player => player.seat === idx) || room.players[idx];
                  const isCurrent = p?.userId === myUserId;
                  return (
                    <div
                      key={idx}
                      className={`relative rounded-2xl p-2.5 sm:p-3 border backdrop-blur-xl flex items-center gap-3 transition-all ${
                        p
                          ? isCurrent
                            ? 'bg-gradient-to-r from-white/95 to-rose-50/50 dark:from-[#15192e]/95 dark:to-[#1a1c35]/90 border-pink-300/80 dark:border-pink-500/40 ring-1 ring-pink-300/40'
                            : 'bg-white/90 dark:bg-[#15192e]/90 border-white/70 dark:border-white/10'
                          : 'border-dashed border-slate-300 dark:border-white/15 bg-white/30 dark:bg-white/5'
                      }`}
                    >
                      {p ? (
                        <>
                          <div className="relative shrink-0">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full p-0.5 bg-gradient-to-tr from-[#ff2b70] to-amber-400 flex items-center justify-center">
                              <img
                                src={p.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.displayName || p.userId)}`}
                                alt={p.displayName}
                                className="w-full h-full rounded-full object-cover bg-white dark:bg-slate-800"
                              />
                            </div>
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1 ring-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-black text-[#16132b] dark:text-white truncate">
                                {p.displayName}
                              </span>
                              {p.userId === room.hostUserId && (
                                <Crown className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                              )}
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                              {isCurrent ? 'You' : `Player ${idx + 1}`}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-200/70 dark:bg-white/10 flex items-center justify-center shrink-0 text-slate-400">
                            <User className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 block">
                              Waiting...
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                              Player {idx + 1}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3.5 relative">
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

                <VersusIndicator isDark={isDark} />

                <PlayerCard
                  isCurrentUser={false}
                  player={opponentPlayer}
                  isHost={opponentPlayer?.userId === room.hostUserId}
                  isReady={Boolean(opponentPlayer)}
                  statusText={opponentPlayer ? 'Connected' : undefined}
                  isDark={isDark}
                />
              </div>
            )}

            {/* Launch / Start Match Button */}
            {hasOpponent && (
              <div className="w-full max-w-md mx-auto text-center select-none animate-in fade-in slide-in-from-bottom-2 duration-150">
                {isHost ? (
                  <button
                    type="button"
                    disabled={isStarting}
                    onClick={handleStartGame}
                    className={`w-full py-3 sm:py-3.5 px-6 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 text-white bg-gradient-to-r from-[#ff2b70] via-[#f43f5e] to-[#e11d48] hover:brightness-110 shadow-[0_6px_25px_rgba(255,43,112,0.35)] transition-all active:scale-[0.98] cursor-pointer ${
                      isStarting ? 'opacity-80 animate-pulse' : ''
                    }`}
                  >
                    <Play className={`w-4 h-4 fill-current ${isStarting ? 'animate-spin' : ''}`} />
                    <span>{isStarting ? 'Starting Match... 🚀' : `Start ${preset.name} 🚀`}</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-2xl bg-white/80 dark:bg-[#121629]/80 border border-white/70 dark:border-white/10 shadow-xs flex items-center justify-center gap-2 text-slate-600 dark:text-zinc-300 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#ff2b70] animate-ping" />
                    <span>Waiting for Host to start the match...</span>
                  </div>
                )}
              </div>
            )}

            {/* Room Code Card */}
            <div className="relative w-full rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 bg-white/80 dark:bg-[#121629]/80 border border-white/70 dark:border-white/10 shadow-[0_4px_20px_rgba(255,43,112,0.05)] backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 transition-all">
              <div className="text-center sm:text-left flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-400 block">
                  Room Code
                </span>
                <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-0.5">
                  <span className="text-xl sm:text-2xl font-mono font-black text-[#ff2b70] tracking-wider leading-tight">
                    {room.roomCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-[#ff2b70] transition active:scale-95 cursor-pointer"
                    title="Copy Code"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleShareLink}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2 px-5 rounded-xl bg-gradient-to-r from-[#ff2b70] to-[#f43f5e] hover:from-[#e11d48] text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{copiedLink ? 'Link Copied!' : 'Share Link'}</span>
              </button>
            </div>

            {/* Invite a Friend Pill Card */}
            <div
              onClick={handleShareLink}
              className="w-full max-w-md mx-auto rounded-full p-2 sm:p-2.5 pl-3.5 sm:pl-4 bg-white/80 dark:bg-[#121629]/80 border border-white/70 dark:border-white/10 shadow-[0_4px_20px_rgba(255,43,112,0.05)] backdrop-blur-xl flex items-center justify-between gap-3 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all active:scale-[0.99] select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-950/40 text-[#ff2b70] flex items-center justify-center shrink-0">
                  <UserPlus className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 text-left">
                  <h4 className="text-xs font-black text-[#16132b] dark:text-white leading-tight truncate">
                    Invite a Friend
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                    Share the room code and start playing together!
                  </p>
                </div>
              </div>
              <div className="w-7 h-7 rounded-full border border-pink-200 dark:border-pink-800/40 bg-pink-50 dark:bg-pink-950/30 text-[#ff2b70] flex items-center justify-center shrink-0 shadow-2xs">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </main>

        {/* Footer Subtext */}
        <div className="pointer-events-none select-none py-1 hidden sm:flex items-center justify-between text-xs text-pink-400/80 font-serif italic">
          <span>..Same Game Different Hearts ♡</span>
          <span className="not-italic text-[10px] text-slate-400 font-sans">
            Strict human-only matchmaking active.
          </span>
        </div>
      </div>

      {/* Slide-over Chat Drawer (Triggered exclusively via header chat button) */}
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

      {/* Settings Modal (Triggered exclusively via header ⚙️ gear icon) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-3xl p-5 bg-white dark:bg-[#121629] border border-white/60 dark:border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[#ff2b70]" />
                <h3 className="text-sm font-black text-[#16132b] dark:text-white">
                  {preset.name} Settings
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            {/* Custom Game Settings if provided */}
            {customSettingsComponent ? (
              customSettingsComponent
            ) : (
              <div className="space-y-3 py-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="text-slate-500 font-medium">Room Code</span>
                  <span className="font-mono font-black text-[#ff2b70]">{room.roomCode}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="text-slate-500 font-medium">Strict Anti-Bot</span>
                  <span className="text-emerald-500 font-bold">Enabled</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#ff2b70] hover:bg-[#e11d48] text-white text-xs font-black uppercase tracking-wider transition active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
