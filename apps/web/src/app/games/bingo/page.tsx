'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  Settings,
  Users,
  Trophy,
  Sparkles,
  Share2,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw,
  Video,
  VideoOff,
  Mic,
  MicOff,
  MessageSquare,
  Palette,
  GripHorizontal,
  Minus,
  X as CloseIcon,
  Flame,
  Zap,
  Volume2,
  VolumeX,
  ShieldAlert
} from 'lucide-react';
import { useGameRoom } from '../../../hooks/useGameRoom';
import { useWebRTC } from '../../../hooks/useWebRTC';
import { VideoAvatar } from '../../../components/games/LudoGame';
import { DynamicThemeEffects } from '../../../components/theme/DynamicThemeEffects';
import {
  getStoredSession,
  UserSession,
  createGameRoomWithPartner,
  getGameRoute,
  getGameTitle,
  createGameRoom
} from '../../../lib/api';
import { GameFriendSelectorDrawer } from '../../../components/games/GameFriendSelectorDrawer';
import { BingoDuelLobby } from '../../../components/games/bingo-duel/BingoDuelLobby';
import { BingoDuelWaitingRoom } from '../../../components/games/bingo-duel/BingoDuelWaitingRoom';
import { BingoDuelNumberCaller } from '../../../components/games/bingo-duel/BingoDuelNumberCaller';
import { BingoDuelBoard } from '../../../components/games/bingo-duel/BingoDuelBoard';
import { BingoPlayerDuelCard } from '../../../components/games/bingo-duel/BingoPlayerDuelCard';
import { BingoDuelClaimButton } from '../../../components/games/bingo-duel/BingoDuelClaimButton';
import { BingoDuelWinModal } from '../../../components/games/bingo-duel/BingoDuelWinModal';
import { BingoBottomDock } from '../../../components/games/bingo/BingoBottomDock';
import { BingoChatDrawer } from '../../../components/games/bingo/BingoChatDrawer';
import {
  BingoDuelConfig,
  BingoDuelGameState,
  BingoDuelPatternProgress,
  DEFAULT_BINGO_DUEL_CONFIG
} from '@synccinema/common';

export interface BoardTheme {
  id: string;
  name: string;
  bgUrl: string;
  accent: string;
  gridBorder: string;
  cellBg: string;
}

const THEMES: BoardTheme[] = [
  {
    id: 'duel-neon',
    name: 'Neon Duel',
    bgUrl: '/theams/theam2.jpeg',
    accent: '#6366f1',
    gridBorder: 'border-indigo-500/30',
    cellBg: 'bg-indigo-950/20'
  },
  {
    id: 'cozy',
    name: 'Cozy Cottage',
    bgUrl: '/images/cozy_ludo_bg.jpg',
    accent: '#f43f5e',
    gridBorder: 'border-rose-500/20',
    cellBg: 'bg-rose-950/20'
  },
  {
    id: 'theam1',
    name: 'Candlelit Café',
    bgUrl: '/theams/theam1.jpeg',
    accent: '#fbbf24',
    gridBorder: 'border-amber-500/20',
    cellBg: 'bg-amber-950/20'
  },
  {
    id: 'theam3',
    name: 'Better Together',
    bgUrl: '/theams/theam3.jpeg',
    accent: '#8b5cf6',
    gridBorder: 'border-purple-500/20',
    cellBg: 'bg-purple-950/20'
  },
  {
    id: 'theam4',
    name: 'Watch Together',
    bgUrl: '/theams/theam4.jpeg',
    accent: '#3b82f6',
    gridBorder: 'border-blue-500/20',
    cellBg: 'bg-blue-950/20'
  }
];

function RemoteAudioPlayer({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !stream) return;
    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }
    audio.play().catch(() => {});
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
}

function BingoDuelGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomCodeParam = searchParams.get('room');

  const [session, setSession] = useState<UserSession | null>(null);
  const [showFriendDrawer, setShowFriendDrawer] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [activeTheme, setActiveTheme] = useState<string>('duel-neon');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [duelConfig, setDuelConfig] = useState<BingoDuelConfig>(DEFAULT_BINGO_DUEL_CONFIG);

  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  // Claim Feedback Toast
  const [claimToast, setClaimToast] = useState<{
    valid: boolean;
    message: string;
    timestamp: number;
  } | null>(null);

  // Load user session
  useEffect(() => {
    const s = getStoredSession();
    if (s && s.token) {
      setSession(s);
    }
  }, []);

  const {
    room,
    players,
    gameState: rawGameState,
    myPlayer,
    myUserId,
    lastBingoCall,
    lastBingoClaimResult,
    lastBingoConditionWon,
    chatMessages,
    floatingReactions,
    connectionStatus,
    startBingoGame,
    callNextBingoNumber,
    toggleBingoPause,
    startBingoNextRound,
    claimBingo,
    markBingoNumber,
    updateBingoConfig,
    sendChat,
    sendReaction,
    sendLeave,
    sendVoiceState,
    sendCameraState,
    rematch,
    rematchStatus,
    declineRematch,
    rematchDeclined,
    clearRematchDeclined,
    sendWebRTCSignal,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener
  } = useGameRoom(roomCodeParam);

  const gameState = rawGameState as BingoDuelGameState | null;

  // Cross-game redirect guard: only permit BINGO- rooms and gameType === 'bingo'
  useEffect(() => {
    if (roomCodeParam) {
      const code = roomCodeParam.trim().toUpperCase();
      if (!code.startsWith('BINGO-') && (code.startsWith('TAMBOLA-') || code.startsWith('LUDO-') || code.startsWith('TIC-') || code.startsWith('FOUR-') || code.startsWith('DOODLE-'))) {
        router.replace(getGameRoute(undefined, roomCodeParam));
        return;
      }
    }
    if (room?.gameType && room.gameType !== 'bingo' && room?.roomCode) {
      router.replace(getGameRoute(room.gameType, room.roomCode));
    }
  }, [roomCodeParam, room?.gameType, room?.roomCode, router]);

  const effectiveUserId = myUserId || session?.user.id || '';

  // Determine players
  const me = players.find(p => p.userId === effectiveUserId) || players[0];
  const opponent = players.find(p => p.userId !== me?.userId);

  const isHost = room?.hostUserId === effectiveUserId;
  const isPlaying = room && room.status === 'PLAYING' && gameState !== null;
  const isRoundOver = gameState?.phase === 'ROUND_OVER';
  const isFinished = room && (room.status === 'FINISHED' || gameState?.phase === 'FINISHED');

  // Web Speech API Voice Caller for Bingo Duel
  const lastSpokenNumberRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isPlaying) return;
    if (duelConfig.voiceCaller && lastBingoCall?.number && lastBingoCall.number !== lastSpokenNumberRef.current) {
      lastSpokenNumberRef.current = lastBingoCall.number;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(
            `${lastBingoCall.number}`
          );
          utterance.rate = 1.0;
          utterance.pitch = 1.1;
          window.speechSynthesis.speak(utterance);
        } catch {
          // ignore speech synthesis errors
        }
      }
    }
  }, [isPlaying, duelConfig.voiceCaller, lastBingoCall?.number]);

  // WebRTC Floating PIP Call Window Setup
  const webRTCMembers = useMemo(() => {
    return players.map(p => ({
      userId: p.userId,
      name: p.displayName,
      avatarUrl: p.avatarUrl || null,
      isHost: p.userId === room?.hostUserId
    }));
  }, [players, room?.hostUserId]);

  const {
    isCameraOn,
    isMicMuted,
    localUserStream,
    toggleCamera,
    toggleMic,
    videoGridParticipants
  } = useWebRTC({
    myUserId: effectiveUserId,
    members: webRTCMembers as any,
    screenPresenter: null,
    sendWebRTCSignal,
    sendScreenState: () => {},
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener
  });

  // Draggable Floating Video Call Window State
  const [isPipMinimized, setIsPipMinimized] = useState(false);
  const [isPipClosed, setIsPipClosed] = useState(false);
  const [pipPosition, setPipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && pipPosition === null) {
      if (window.innerWidth >= 1024) {
        setPipPosition({ x: 32, y: 140 });
      } else {
        setPipPosition({ x: 16, y: Math.max(100, window.innerHeight - 170) });
      }
    }
  }, [pipPosition]);

  const handlePipMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (isPipClosed) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setIsDraggingPip(true);
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: pipPosition?.x || 32,
      initialY: pipPosition?.y || 140
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragStartRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const deltaX = clientX - dragStartRef.current.startX;
      const deltaY = clientY - dragStartRef.current.startY;

      const newX = Math.max(8, Math.min(window.innerWidth - 240, dragStartRef.current.initialX + deltaX));
      const newY = Math.max(64, Math.min(window.innerHeight - 120, dragStartRef.current.initialY + deltaY));

      setPipPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      dragStartRef.current = null;
      setIsDraggingPip(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, []);

  // Sync config from gameState when active
  useEffect(() => {
    if (gameState?.config) {
      setDuelConfig(gameState.config);
    }
  }, [gameState?.config]);

  // Show claim result feedback toast
  useEffect(() => {
    if (lastBingoClaimResult) {
      setClaimToast({
        valid: lastBingoClaimResult.valid,
        message: lastBingoClaimResult.message,
        timestamp: Date.now()
      });
      const timer = setTimeout(() => setClaimToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [lastBingoClaimResult]);

  // Handle leave room
  const handleLeave = () => {
    sendLeave();
    router.push('/games');
  };

  const handleCreateRoom = async () => {
    if (!session?.token) {
      router.push('/login');
      return;
    }
    try {
      setIsCreatingRoom(true);
      const res = await createGameRoom(session.token, 'bingo', 2);
      if (res?.room?.roomCode) {
        router.push(`/games/bingo?room=${res.room.roomCode}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinRoom = (code: string) => {
    router.push(`/games/bingo?room=${encodeURIComponent(code)}`);
  };

  const currentTheme = useMemo(() => {
    return THEMES.find(t => t.id === activeTheme) || THEMES[0];
  }, [activeTheme]);

  // Participants for call
  const callParticipants = useMemo(() => {
    const list = [...videoGridParticipants];
    if (opponent && !list.some(p => p.userId === opponent.userId)) {
      list.push({
        userId: opponent.userId,
        displayName: opponent.displayName,
        stream: null,
        isMuted: true,
        isSelf: false,
        isCameraOn: false
      });
    }
    return list;
  }, [videoGridParticipants, opponent]);

  // 1. NO ROOM PARAM -> Render Bingo Duel Lobby
  if (!roomCodeParam) {
    return (
      <div className="min-h-screen bg-[#070913] text-white flex flex-col justify-between relative overflow-hidden">
        {/* Dynamic Background Effects */}
        <div
          className="fixed inset-0 bg-cover bg-center opacity-15 pointer-events-none transition-all duration-700"
          style={{ backgroundImage: `url(${currentTheme.bgUrl})` }}
        />
        <div className="fixed inset-0 bg-gradient-to-b from-[#070913]/90 via-[#070913]/95 to-[#070913] pointer-events-none" />

        {/* Top Header */}
        <header className="relative z-20 px-4 sm:px-8 py-4 flex items-center justify-between border-b border-white/10 backdrop-blur-md">
          <button
            type="button"
            onClick={() => router.push('/games')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Games Hub</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Bingo Duel (1–25)
            </span>
          </div>
        </header>

        {/* Lobby Content */}
        <main className="relative z-10 flex-1 flex items-center justify-center">
          <BingoDuelLobby
            session={session}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onSelectPartner={() => setShowFriendDrawer(true)}
            isCreating={isCreatingRoom}
            isJoining={isJoiningRoom}
          />
        </main>

        <GameFriendSelectorDrawer
          isOpen={showFriendDrawer}
          onClose={() => setShowFriendDrawer(false)}
          token={session?.token}
          gameTitle="Bingo Duel"
          onSelectFriend={async friend => {
            try {
              const res = await createGameRoomWithPartner('bingo', friend.friendUser.id);
              if (res?.room?.roomCode) {
                router.push(`/games/bingo?room=${res.room.roomCode}`);
              }
            } catch (e) {
              console.error(e);
            }
          }}
        />
      </div>
    );
  }

  // 2. ROOM WAITING / READY -> Render Waiting Room
  if (!isPlaying && !isFinished && room) {
    return (
      <div className="min-h-screen bg-[#070913] text-white flex flex-col justify-between relative overflow-hidden">
        <div
          className="fixed inset-0 bg-cover bg-center opacity-15 pointer-events-none transition-all duration-700"
          style={{ backgroundImage: `url(${currentTheme.bgUrl})` }}
        />
        <div className="fixed inset-0 bg-gradient-to-b from-[#070913]/90 via-[#070913]/95 to-[#070913] pointer-events-none" />

        {/* Top Header */}
        <header className="relative z-20 px-4 sm:px-8 py-4 flex items-center justify-between border-b border-white/10 backdrop-blur-md">
          <button
            type="button"
            onClick={handleLeave}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Leave</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Duel Matchmaking
            </span>
          </div>
        </header>

        <main className="relative z-10 flex-1 flex items-center justify-center">
          <BingoDuelWaitingRoom
            room={room}
            players={players}
            myUserId={effectiveUserId}
            isHost={isHost}
            config={duelConfig}
            onUpdateConfig={partial => {
              setDuelConfig(prev => ({ ...prev, ...partial }));
              updateBingoConfig(partial);
            }}
            onStartGame={() => startBingoGame(duelConfig)}
            onSelectPartner={() => setShowFriendDrawer(true)}
          />
        </main>

        <GameFriendSelectorDrawer
          isOpen={showFriendDrawer}
          onClose={() => setShowFriendDrawer(false)}
          token={session?.token}
          gameTitle="Bingo Duel"
          onSelectFriend={async friend => {
            try {
              const res = await createGameRoomWithPartner('bingo', friend.friendUser.id);
              if (res?.room?.roomCode) {
                router.push(`/games/bingo?room=${res.room.roomCode}`);
              }
            } catch (e) {
              console.error(e);
            }
          }}
        />
      </div>
    );
  }

  // 3. IN GAME OR FINISHED -> Main Arena Layout
  const myBoard = gameState?.boards?.[effectiveUserId] || [];
  const myMarks = gameState?.playerMarks?.[effectiveUserId] || [];
  const myProgress = gameState?.playerProgress?.[effectiveUserId];
  const myWins = gameState?.roundsWon?.[effectiveUserId] || 0;

  const opponentUserId = opponent?.userId || '';
  const opponentMarks = gameState?.playerMarks?.[opponentUserId] || [];
  const opponentProgress = gameState?.playerProgress?.[opponentUserId];
  const opponentWins = gameState?.roundsWon?.[opponentUserId] || 0;

  // Penalty countdown
  const now = Date.now();
  const penaltyUntil = gameState?.falseBingoPenaltyUntil?.[effectiveUserId] || 0;
  const penaltySeconds = Math.max(0, Math.ceil((penaltyUntil - now) / 1000));

  const winningIndices = gameState?.phase === 'ROUND_OVER' || gameState?.phase === 'FINISHED'
    ? (lastBingoConditionWon?.winningIndices || lastBingoClaimResult?.winningIndices)
    : undefined;

  return (
    <div className="min-h-screen bg-[#070913] text-white flex flex-col justify-between relative overflow-x-hidden select-none">
      {/* Dynamic Background Effects */}
      <div
        className="fixed inset-0 bg-cover bg-center opacity-15 pointer-events-none transition-all duration-700"
        style={{ backgroundImage: `url(${currentTheme.bgUrl})` }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-[#070913]/90 via-[#070913]/95 to-[#070913] pointer-events-none" />

      {/* Audio listeners for remote audio streams */}
      {videoGridParticipants.map(
        p => p.stream && !p.isSelf && <RemoteAudioPlayer key={p.userId} stream={p.stream} />
      )}

      {/* Floating Reaction Bubbles */}
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
        {floatingReactions.map(r => (
          <div
            key={r.id}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 text-4xl animate-bounce"
            style={{
              left: `${45 + (r.timestamp % 15)}%`,
              animationDuration: '1.2s'
            }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-20 px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLeave}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Leave</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
              {room?.roomCode}
            </span>
            {gameState && gameState.targetRounds > 1 && (
              <span className="text-xs font-bold text-pink-300 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                Round {gameState.currentRound}
              </span>
            )}
          </div>
        </div>

        {/* Right Header Options */}
        <div className="flex items-center gap-2">
          {/* Theme Palette Button */}
          <button
            type="button"
            onClick={() => setShowThemeModal(true)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition"
            title="Change Theme"
          >
            <Palette className="w-4 h-4" />
          </button>

          {/* Sound / Voice Caller Toggle */}
          <button
            type="button"
            onClick={() => setDuelConfig(prev => ({ ...prev, voiceCaller: !prev.voiceCaller }))}
            className={`p-2 rounded-xl border transition ${
              duelConfig.voiceCaller
                ? 'bg-indigo-600/30 border-indigo-400 text-indigo-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
            title="Voice Caller"
          >
            {duelConfig.voiceCaller ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Duel Content Area */}
      <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto px-4 py-4 sm:py-6 flex flex-col justify-between gap-4">
        {/* 1. Visual Number Caller (numbers 1-25) */}
        <BingoDuelNumberCaller
          currentNumber={gameState?.currentNumber || null}
          currentNumberWord={gameState?.currentNumberWord || null}
          lastCalledNumbers={gameState?.lastCalledNumbers || []}
          calledNumbersCount={gameState?.calledNumbers?.length || 0}
          remainingCount={gameState?.callQueue?.length || 0}
          isPaused={Boolean(gameState?.callingPaused)}
          isHost={isHost}
          voiceCallerEnabled={Boolean(duelConfig.voiceCaller)}
          onToggleVoiceCaller={() => setDuelConfig(p => ({ ...p, voiceCaller: !p.voiceCaller }))}
          onTogglePause={toggleBingoPause}
          onCallNextManually={callNextBingoNumber}
          isManualMode={duelConfig.autoCallSpeed === 0}
        />

        {/* 2. Player Duel Status Header: You vs Opponent */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <BingoPlayerDuelCard
            displayName={me?.displayName || 'You'}
            avatarUrl={me?.avatarUrl}
            userId={effectiveUserId}
            isMe={true}
            marksCount={myMarks.length}
            progress={myProgress}
            roundsWon={myWins}
            targetRounds={gameState?.targetRounds || 1}
            isHost={isHost}
          />
          <BingoPlayerDuelCard
            displayName={opponent?.displayName || 'Opponent'}
            avatarUrl={opponent?.avatarUrl}
            userId={opponentUserId}
            isMe={false}
            marksCount={opponentMarks.length}
            progress={opponentProgress}
            roundsWon={opponentWins}
            targetRounds={gameState?.targetRounds || 1}
            isHost={!isHost}
          />
        </div>

        {/* 3. Authoritative 5x5 Bingo Board */}
        <div className="my-auto py-2">
          {myBoard.length > 0 ? (
            <BingoDuelBoard
              board={myBoard}
              playerMarks={myMarks}
              calledNumbers={gameState?.calledNumbers || []}
              winningIndices={winningIndices}
              onCellClick={(num) => markBingoNumber(num)}
              disabled={isFinished || isRoundOver}
            />
          ) : (
            <div className="text-center p-8 bg-slate-900/50 rounded-3xl border border-white/10">
              <span className="text-sm text-slate-400">Loading your 5×5 duel board...</span>
            </div>
          )}
        </div>

        {/* 4. Action Claim Button */}
        <div className="pt-2">
          <BingoDuelClaimButton
            onClaim={() => claimBingo('bingo')}
            isCompleted={Boolean(myProgress?.isCompleted)}
            penaltySeconds={penaltySeconds}
            patternName={myProgress?.completedPatternName || duelConfig.pattern}
            disabled={isFinished || isRoundOver}
          />
        </div>
      </main>

      {/* Claim Toast Feedback */}
      {claimToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 duration-200">
          <div
            className={`px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border font-bold text-xs sm:text-sm backdrop-blur-xl ${
              claimToast.valid
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
            }`}
          >
            {claimToast.valid ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span>{claimToast.message}</span>
          </div>
        </div>
      )}

      {/* Floating WebRTC PIP Call Window (Draggable) */}
      {!isPipClosed && pipPosition && (
        <div
          ref={dragStartRef as any}
          style={{ transform: `translate3d(${pipPosition.x}px, ${pipPosition.y}px, 0)` }}
          className={`fixed top-0 left-0 z-40 transition-shadow ${
            isDraggingPip ? 'cursor-grabbing shadow-2xl' : 'cursor-grab'
          }`}
        >
          <div className="bg-[#0b0d17]/95 border border-indigo-500/30 rounded-2xl p-2 backdrop-blur-xl shadow-2xl w-48 sm:w-56">
            {/* Header / Drag Handle */}
            <div
              onMouseDown={handlePipMouseDown}
              onTouchStart={handlePipMouseDown}
              className="flex items-center justify-between px-2 py-1 mb-1.5 border-b border-white/5 select-none"
            >
              <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-300">
                <GripHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span>Call Window</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsPipMinimized(p => !p)}
                  className="p-0.5 hover:text-white text-slate-400"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsPipClosed(true)}
                  className="p-0.5 hover:text-white text-slate-400"
                >
                  <CloseIcon className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Video Streams */}
            {!isPipMinimized && (
              <div className="grid grid-cols-2 gap-1.5">
                {callParticipants.slice(0, 2).map(p => (
                  <div key={p.userId} className="relative aspect-video rounded-xl overflow-hidden bg-black/60 border border-white/5">
                    {p.stream && p.isCameraOn ? (
                      <video
                        ref={v => {
                          if (v && p.stream && v.srcObject !== p.stream) {
                            v.srcObject = p.stream;
                          }
                        }}
                        autoPlay
                        playsInline
                        muted={p.isSelf}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-1">
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.userId}`}
                          alt={p.displayName}
                          className="w-7 h-7 rounded-full object-cover border border-white/20"
                        />
                        <span className="text-[9px] text-slate-400 truncate max-w-[60px] mt-1 font-semibold">
                          {p.displayName}
                        </span>
                      </div>
                    )}
                    {p.isMuted && (
                      <div className="absolute bottom-1 right-1 p-0.5 rounded-full bg-rose-500/80 text-white">
                        <MicOff className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Floating Control Dock */}
      <footer className="relative z-30 pb-4 pt-2">
        <BingoBottomDock
          isMuted={isMicMuted}
          isCameraOn={isCameraOn}
          unreadChatCount={chatMessages.length}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
          onToggleChat={() => setIsChatOpen(p => !p)}
          onSendReaction={sendReaction}
          onOpenSettings={() => {}}
        />
      </footer>

      {/* Chat Drawer */}
      <BingoChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        myUserId={effectiveUserId}
        onSendMessage={sendChat}
      />

      {/* Round & Match Victory Modal */}
      {(isRoundOver || isFinished) && gameState && (
        <BingoDuelWinModal
          isMatchOver={gameState.phase === 'FINISHED'}
          isRoundOver={gameState.phase === 'ROUND_OVER'}
          winnerDisplayName={
            gameState.winnerDisplayName ||
            lastBingoConditionWon?.displayName ||
            'Player'
          }
          isWinnerMe={
            (gameState.winnerUserId || lastBingoConditionWon?.userId) === effectiveUserId
          }
          currentRound={gameState.currentRound}
          targetRounds={gameState.targetRounds}
          myWins={myWins}
          opponentWins={opponentWins}
          roundHistory={gameState.roundHistory}
          isHost={isHost}
          onNextRound={startBingoNextRound}
          onRematch={rematch}
          onLeave={handleLeave}
          rematchStatus={rematchStatus}
        />
      )}

      {/* Theme Selector Modal */}
      {showThemeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-400" />
                Select Board Theme
              </h3>
              <button
                type="button"
                onClick={() => setShowThemeModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setActiveTheme(t.id);
                    setShowThemeModal(false);
                  }}
                  className={`p-3 rounded-2xl border text-left flex flex-col gap-2 transition ${
                    activeTheme === t.id
                      ? 'border-indigo-400 bg-indigo-500/20'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div
                    className="w-full h-12 rounded-xl bg-cover bg-center border border-white/10"
                    style={{ backgroundImage: `url(${t.bgUrl})` }}
                  />
                  <span className="text-xs font-bold text-white truncate">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BingoDuelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070913] flex items-center justify-center text-white">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-indigo-500 animate-ping" />
            <span className="text-sm font-bold text-slate-300">Loading Bingo Duel...</span>
          </div>
        </div>
      }
    >
      <BingoDuelGameContent />
    </Suspense>
  );
}
