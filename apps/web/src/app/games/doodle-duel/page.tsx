'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronUp,
  Settings,
  Palette,
  Brain,
  Trophy,
  AlertTriangle,
  RotateCcw,
  Sun,
  Moon,
  Mic,
  MicOff,
  Video,
  VideoOff,
  CameraOff,
  Pencil,
  Clock,
  Users,
  Layers,
  BarChart3,
  ArrowRight,
  MessageCircle,
  Info
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useGameRoom } from '../../../hooks/useGameRoom';
import { StreakCelebrationModal } from '../../../components/streaks/StreakCelebrationModal';
import { useWebRTC, VideoGridParticipant } from '../../../hooks/useWebRTC';
import { VideoAvatar } from '../../../components/games/LudoGame';
import { getStoredSession, UserSession, getGameRoute, getGameTitle } from '../../../lib/api';
import { DrawingCanvas } from '../../../components/games/doodle/DrawingCanvas';
import { DrawingToolbar, DoodleToolType } from '../../../components/games/doodle/DrawingToolbar';
import { SecretWordPicker } from '../../../components/games/doodle/SecretWordPicker';
import { GuessPanel } from '../../../components/games/doodle/GuessPanel';
import { DoodleGameTimer } from '../../../components/games/doodle/DoodleGameTimer';
import { RoundIntro } from '../../../components/games/doodle/RoundIntro';
import { RoundResultModal } from '../../../components/games/doodle/RoundResultModal';
import { DoodleVictory } from '../../../components/games/doodle/DoodleVictory';
import { DoodleLobby } from '../../../components/games/doodle/DoodleLobby';
import { DoodlePreRoomLobby } from '../../../components/games/doodle/DoodlePreRoomLobby';
import { DoodleBottomDock } from '../../../components/games/doodle/DoodleBottomDock';
import { DoodleSettingsModal, DOODLE_THEMES, BoardTheme } from '../../../components/games/doodle/DoodleSettingsModal';
import { DoodleChatDrawer } from '../../../components/games/doodle/DoodleChatDrawer';
import { DoodleStroke, DoodleGameState, DoodleConfig } from '@synccinema/common';

// Remote Audio Receiver to Hear Connected Players
const RemoteAudioPlayer = React.memo(function RemoteAudioPlayer({
  stream
}: {
  stream: MediaStream | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !stream) return;
    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }
    audio.volume = 1.0;
    audio.play().catch(() => {});
  }, [stream]);

  if (!stream) return null;
  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
});

// Synthetic sound chimes for game events
function playTone(freq: number, duration: number, type: OscillatorType = 'sine') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function DoodleDuelGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomCodeParam = searchParams.get('room');

  const [session, setSession] = useState<UserSession | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Board Theme State (persisted & synced with game room)
  const [selectedTheme, setSelectedTheme] = useState<string>('romantic');

  // Drawing Tools State
  const [currentTool, setCurrentTool] = useState<DoodleToolType>('brush');
  const [currentColor, setCurrentColor] = useState<string>('#18181b');
  const [currentBrushSize, setCurrentBrushSize] = useState<number>(7);

  // Load session
  useEffect(() => {
    const s = getStoredSession();
    if (s && s.token) {
      setSession(s);
    }
  }, []);

  // Restore saved local board theme
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('doodle_theme_id');
      if (saved && DOODLE_THEMES.some(t => t.id === saved)) {
        setSelectedTheme(saved);
      }
    }
  }, []);

  const {
    room,
    players,
    gameState,
    myPlayer,
    myUserId,
    lastDoodleStroke,
    liveDoodleStroke,
    lastDoodleGuess,
    chatMessages,
    floatingReactions,
    connectionStatus,
    roomTheme,
    sendChangeTheme,
    selectDoodleRole,
    startDoodleGame,
    chooseDoodleWord,
    sendDoodleStroke,
    sendDoodleLiveDraw,
    sendDoodleDoneDrawing,
    undoDoodleStroke,
    clearDoodleCanvas,
    sendDoodleGuess,
    requestDoodleHint,
    updateDoodleConfig,
    sendChat,
    sendReaction,
    sendLeave,
    sendWebRTCSignal,
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener,
    rematch,
    rematchStatus,
    opponentLeftWin,
    streakCelebration,
    clearStreakCelebration
  } = useGameRoom(roomCodeParam);

  // Cross-game redirect guard
  useEffect(() => {
    if (roomCodeParam) {
      const code = roomCodeParam.trim().toUpperCase();
      if (!code.startsWith('DOODLE-') && (code.startsWith('BINGO-') || code.startsWith('LUDO-') || code.startsWith('TIC-') || code.startsWith('FOUR-'))) {
        router.replace(getGameRoute(undefined, roomCodeParam));
        return;
      }
    }
    if (room?.gameType && room.gameType !== 'doodle-duel' && room?.roomCode) {
      router.replace(getGameRoute(room.gameType, room.roomCode));
    }
  }, [roomCodeParam, room?.gameType, room?.roomCode, router]);

  // currentUserId: prefer WebSocket-confirmed userId, then React session state,
  // then read directly from localStorage as a synchronous fallback (avoids race where
  // session useState hasn't loaded yet when WORD_CHOICE modal needs to render).
  const storedSessionId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    try { return JSON.parse(localStorage.getItem('synccinema_session') || '{}')?.user?.id || ''; } catch { return ''; }
  }, []);
  const currentUserId = myUserId || session?.user.id || storedSessionId || '';
  const dState = gameState as DoodleGameState | null;

  // Sync theme when room sends roomTheme
  useEffect(() => {
    if (roomTheme && DOODLE_THEMES.some(t => t.id === roomTheme)) {
      setSelectedTheme(roomTheme);
    }
  }, [roomTheme]);

  const handleSelectTheme = (themeId: string) => {
    setSelectedTheme(themeId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('doodle_theme_id', themeId);
    }
    sendChangeTheme(themeId);
  };

  const currentTheme = useMemo(() => {
    return DOODLE_THEMES.find(t => t.id === selectedTheme) || DOODLE_THEMES[0];
  }, [selectedTheme]);

  // WebRTC Audio/Video Integration
  const webRTCMembers = useMemo(() => {
    return (room?.players || []).map(p => ({
      userId: p.userId,
      displayName: p.displayName,
      isHost: p.seat === 0,
      isConnected: p.isConnected !== false,
      joinedAt: ''
    }));
  }, [room?.players]);

  const {
    isCameraOn,
    isMicMuted,
    localUserStream,
    toggleCamera,
    toggleMic,
    videoGridParticipants
  } = useWebRTC({
    myUserId: currentUserId,
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

  const participantStreamsByUserId = useMemo(() => {
    const map: Record<string, VideoGridParticipant> = {};
    for (const p of videoGridParticipants) {
      map[p.userId] = p;
    }
    const localP = videoGridParticipants.find(p => p.isSelf);
    if (localP) {
      if (currentUserId) map[currentUserId] = localP;
      if (myPlayer?.userId) map[myPlayer.userId] = localP;
      map['me'] = localP;
    }
    return map;
  }, [videoGridParticipants, currentUserId, myPlayer]);

  // Sound FX triggers
  useEffect(() => {
    if (!soundEnabled || !lastDoodleGuess) return;
    if (lastDoodleGuess.isCorrect) {
      playTone(523.25, 0.15); // C5
      setTimeout(() => playTone(659.25, 0.15), 100); // E5
      setTimeout(() => playTone(783.99, 0.3), 200); // G5
    } else if (lastDoodleGuess.isClose) {
      playTone(440, 0.15);
    }
  }, [lastDoodleGuess, soundEnabled]);

  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  // Determine roles
  const isDrawer = Boolean(dState && dState.drawerUserId === currentUserId);
  const isGuesser = Boolean(dState && dState.guesserUserId === currentUserId);

  const player1 = players[0] || {
    userId: dState?.drawerUserId || 'p1',
    displayName: dState?.drawerDisplayName || 'Player 1'
  };
  const player2 = players[1] || {
    userId: dState?.guesserUserId || 'p2',
    displayName: dState?.guesserDisplayName || 'Player 2'
  };

  const isHost = room?.hostUserId === currentUserId;
  const isLobby =
    !room ||
    !dState ||
    dState.phase === 'LOBBY' ||
    dState.phase === 'ROLE_SELECTION' ||
    !['ROUND_INTRO', 'WORD_CHOICE', 'CHOOSING_WORD', 'DRAWING', 'GUESSING', 'ROUND_RESULT', 'FINISHED'].includes(
      dState.phase || ''
    );
  // Show word picker for all matching phase names (be generous in case server uses different casing)
  const isChoosingWord =
    dState?.phase === 'CHOOSING_WORD' ||
    dState?.phase === 'WORD_CHOICE' ||
    (dState?.phase as string)?.toUpperCase() === 'WORD_CHOICE' ||
    (dState?.phase as string)?.toUpperCase() === 'CHOOSING_WORD';
  const isRoundIntro = dState?.phase === 'ROUND_INTRO';
  const isDrawing = dState?.phase === 'DRAWING';
  const isGuessing = dState?.phase === 'GUESSING';
  const isRoundResult = dState?.phase === 'ROUND_RESULT';
  const isFinished = room?.status === 'FINISHED' || dState?.phase === 'FINISHED';

  const handleLeave = () => {
    sendLeave();
    router.push('/games');
  };

  // Participant streams for Drawer and Guesser
  const drawerUserId = dState?.drawerUserId || '';
  const guesserUserId = dState?.guesserUserId || '';

  const drawerParticipant = drawerUserId ? participantStreamsByUserId[drawerUserId] : null;
  const guesserParticipant = guesserUserId ? participantStreamsByUserId[guesserUserId] : null;

  const isDrawerMe = Boolean(drawerUserId && drawerUserId === currentUserId);
  const isGuesserMe = Boolean(guesserUserId && guesserUserId === currentUserId);

  const drawerActiveStream = isDrawerMe
    ? localUserStream || drawerParticipant?.stream
    : drawerParticipant?.stream;
  const drawerCameraOn = isDrawerMe ? isCameraOn : Boolean(drawerParticipant?.isCameraOn);
  const hasDrawerLiveVideo = Boolean(
    drawerCameraOn &&
      drawerActiveStream &&
      drawerActiveStream.getVideoTracks().length > 0 &&
      drawerActiveStream.getVideoTracks().some(t => t.enabled && t.readyState !== 'ended')
  );

  const guesserActiveStream = isGuesserMe
    ? localUserStream || guesserParticipant?.stream
    : guesserParticipant?.stream;
  const guesserCameraOn = isGuesserMe ? isCameraOn : Boolean(guesserParticipant?.isCameraOn);
  const hasGuesserLiveVideo = Boolean(
    guesserCameraOn &&
      guesserActiveStream &&
      guesserActiveStream.getVideoTracks().length > 0 &&
      guesserActiveStream.getVideoTracks().some(t => t.enabled && t.readyState !== 'ended')
  );

  const isDrawerMuted = isDrawerMe ? isMicMuted : Boolean(drawerParticipant?.isMuted);
  const isGuesserMuted = isGuesserMe ? isMicMuted : Boolean(guesserParticipant?.isMuted);

  const isDrawerSpeaking = Boolean(drawerParticipant?.isSpeaking);
  const isGuesserSpeaking = Boolean(guesserParticipant?.isSpeaking);

  if (!roomCodeParam) {
    return <DoodlePreRoomLobby />;
  }

  return (
    <div
      className={`flex flex-col selection:bg-[#ff3864] selection:text-white font-sans antialiased overflow-x-hidden min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden relative transition-colors duration-300 ${
        isDark ? 'bg-[#080a12] text-white' : 'bg-[#faf8fb] text-slate-900'
      }`}
    >
      {/* Remote Audio Players */}
      {!isDrawerMe && drawerParticipant?.stream && (
        <RemoteAudioPlayer stream={drawerParticipant.stream} />
      )}
      {!isGuesserMe && guesserParticipant?.stream && (
        <RemoteAudioPlayer stream={guesserParticipant.stream} />
      )}

      {/* Atmospheric Board Theme Background */}
      <div
        className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat transition-all duration-700 select-none"
        style={{ backgroundImage: `url('${currentTheme.bgUrl}')` }}
      >
        <div
          className={`absolute inset-0 transition-colors duration-500 ${
            isDark ? 'bg-black/60 backdrop-blur-[2px]' : 'bg-[#faf8fb]/85 backdrop-blur-[2px]'
          }`}
        />
      </div>

      {/* App Content Column */}
      <div className="relative z-10 flex-1 flex flex-col justify-between min-h-screen lg:h-screen lg:max-h-screen overflow-hidden">
        {/* Floating Reaction Emojis */}
        <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
          {floatingReactions.map(r => (
            <div
              key={r.id}
              className="absolute bottom-24 text-4xl animate-in fade-in slide-in-from-bottom-20 duration-1000"
              style={{
                left: `${30 + (Math.sin(r.timestamp) + 1) * 20}%`,
                animation: 'floatUp 2.5s ease-out forwards'
              }}
            >
              {r.emoji}
            </div>
          ))}
        </div>

        {/* Opponent Left / Forfeit Toast */}
        {opponentLeftWin && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 p-4 rounded-2xl bg-amber-500/20 border border-amber-500/40 backdrop-blur-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-200">
            <Trophy className="w-6 h-6 text-amber-400" />
            <div className="text-left">
              <span className={`text-sm font-black block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Opponent Forfeited!
              </span>
              <span className="text-xs text-amber-500 font-medium">{opponentLeftWin.message}</span>
            </div>
          </div>
        )}

        {/* Top Navigation Bar matching Mockup */}
        <header
          className={`relative z-20 w-full px-4 sm:px-8 py-3 flex items-center justify-between border-b transition-colors duration-300 ${
            isDark
              ? 'border-white/10 bg-[#080a12]/95 text-white'
              : 'border-slate-100 bg-white/95 text-slate-900 shadow-xs'
          }`}
        >
          {/* Left: watch. Logo + Back to Games pill */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-baseline font-black tracking-tight text-xl text-slate-900 dark:text-white select-none">
              <span>watch</span>
              <span className="text-[#ff3864] text-2xl leading-none">.</span>
            </div>

            <button
              type="button"
              onClick={handleLeave}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold transition cursor-pointer active:scale-95 ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border-white/10'
                  : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border-slate-200 shadow-2xs'
              }`}
              title="Back to Games"
            >
              <ChevronLeft className="w-4 h-4 text-slate-500" />
              <span>Back to Games</span>
            </button>
          </div>

          {/* Center: Icon, Title, Subtitle, Round Pill & Circular Timer */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-pink-100 via-rose-50 to-amber-100 dark:from-rose-950/40 dark:to-pink-900/40 flex items-center justify-center text-xl shadow-xs shrink-0">
              🎨
            </div>
            <div className="flex flex-col text-left">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                Doodle Duel
              </h1>
              <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 dark:text-zinc-400 mt-1">
                Draw it. Guess it. Switch.
              </span>
            </div>

            {/* Round Pill & Circular Timer */}
            {dState && !isLobby && !isFinished && (
              <div className="ml-2 sm:ml-4 flex items-center">
                <DoodleGameTimer
                  timeLeft={dState.timeLeftSeconds ?? dState.timeRemaining ?? 60}
                  totalTime={
                    dState.phase === 'GUESSING'
                      ? dState.config?.guessTime || 60
                      : dState.config?.drawTimeSeconds || dState.config?.drawTime || 60
                  }
                  currentRound={dState.currentRound ?? dState.round ?? 1}
                  totalRounds={dState.totalRounds || dState.config?.rounds || 6}
                  phase={dState.phase}
                />
              </div>
            )}
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Mic Toggle */}
            <button
              type="button"
              onClick={toggleMic}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition active:scale-95 cursor-pointer ${
                isMicMuted
                  ? 'bg-rose-50 text-[#ff3864] border-rose-200 dark:bg-rose-500/20 dark:border-rose-500/40'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60 dark:bg-white/10 dark:text-zinc-200 dark:border-white/10'
              }`}
              title={isMicMuted ? 'Unmute' : 'Mute'}
            >
              {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Camera Toggle */}
            <button
              type="button"
              onClick={toggleCamera}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition active:scale-95 cursor-pointer ${
                !isCameraOn
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60 dark:bg-white/10 dark:text-zinc-200 dark:border-white/10'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:border-emerald-500/40'
              }`}
              title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
            >
              {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>

            {/* Chat Toggle (Pink Filled Button in Mockup) */}
            <button
              type="button"
              onClick={() => setIsChatOpen(prev => !prev)}
              className="w-9 h-9 rounded-xl bg-[#ff2b70] hover:bg-[#e6005c] active:scale-95 text-white flex items-center justify-center shadow-xs transition cursor-pointer"
              title="Open Chat"
            >
              <MessageCircle className="w-4 h-4" />
            </button>

            {/* Light / Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition active:scale-95 cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200/60 text-slate-700'
              }`}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* Settings */}
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition active:scale-95 cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200/60 text-slate-700'
              }`}
              title="Settings & Rules"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Leave Game Button (Pink Gradient Pill) */}
            <button
              type="button"
              onClick={handleLeave}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff3864] to-[#e6005c] hover:brightness-105 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm ml-1"
              title="Leave Game"
            >
              <ArrowRight className="w-4 h-4" />
              <span className="hidden sm:inline">Leave Game</span>
            </button>
          </div>
        </header>

        {/* Main Arena Container */}
        <main className="relative z-10 flex-1 w-full max-w-[1520px] mx-auto p-2 sm:p-3 lg:p-4 flex flex-col justify-between min-h-0">
          {isLobby && room && (
            <div className="relative w-full h-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
              <DoodleLobby
                room={room}
                gameState={dState!}
                myUserId={currentUserId}
                isHost={isHost}
                rematchStatus={rematchStatus}
                onRematch={rematch}
                onSelectRole={drawerId => selectDoodleRole(drawerId)}
                onStartGame={cfg => startDoodleGame(cfg)}
                onUpdateConfig={cfg => updateDoodleConfig(cfg)}
              />
            </div>
          )}

          {/* In-Game Active Match UI (3-Zone Arena) */}
          {!isLobby && dState && (
            <div className="w-full flex-1 flex flex-col lg:flex-row items-stretch gap-3 sm:gap-4 min-h-0">
              {/* Left Zone: Player Cards & Pro Tip */}
              <div className="w-full lg:w-72 shrink-0 flex flex-col justify-between gap-3 min-h-0">
                {/* 1. Drawer Player Card matching mockup */}
                <div className="p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-[#111625] border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(240,160,200,0.08)] flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-500 text-sm">👑</span>
                      <span className="text-[11px] font-black uppercase tracking-wider text-[#ff3864]">
                        DRAWER
                      </span>
                    </div>
                    {isDrawer && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#ffeef3] text-[#ff3864]">
                        YOU
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Avatar / Video */}
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-[#ff3864] ring-2 ring-pink-100 dark:ring-rose-950 shrink-0">
                      {hasDrawerLiveVideo && drawerActiveStream ? (
                        <VideoAvatar
                          stream={drawerActiveStream}
                          isSelf={isDrawerMe}
                          displayName={dState.drawerDisplayName || 'Drawer'}
                        />
                      ) : (
                        <img
                          src={
                            players.find(p => p.userId === dState.drawerUserId)?.avatarUrl ||
                            (players.find(p => p.userId === dState.drawerUserId) as any)?.photoURL ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                              dState.drawerDisplayName || 'Mayur'
                            )}&accessories=round&top=shortFlat&clothing=graphicShirt`
                          }
                          alt={dState.drawerDisplayName || 'Drawer'}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="overflow-hidden flex-1">
                      <span className="text-sm font-extrabold text-[#1e1435] dark:text-white truncate block">
                        {dState.drawerDisplayName ||
                          players.find(p => p.userId === dState.drawerUserId)?.displayName ||
                          'Player 1'}
                      </span>
                      <span className="text-xs font-bold text-[#ff3864] block">
                        {dState.scores[dState.drawerUserId] || 0} pts
                      </span>
                    </div>
                  </div>

                  {/* Sub-card inner prompt matching mockup */}
                  <div className="p-2.5 rounded-2xl bg-[#fff5f8] dark:bg-rose-500/10 border border-[#ffe4ec] dark:border-rose-500/20 flex items-center gap-2.5">
                    <Pencil className="w-4 h-4 text-[#ff3864] shrink-0" />
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-[#ff3864]">
                        You are drawing!
                      </span>
                      <span className="text-[10px] text-[#8a80a0] dark:text-zinc-400">
                        Show your creativity ✨
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Guesser Player Card matching mockup */}
                <div className="p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-[#111625] border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(240,160,200,0.08)] flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-purple-600 text-sm">👓</span>
                      <span className="text-[11px] font-black uppercase tracking-wider text-purple-600">
                        GUESSER
                      </span>
                    </div>
                    {isGuesser && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-600">
                        YOU
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Avatar / Video */}
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-purple-400 ring-2 ring-purple-100 dark:ring-purple-950 shrink-0">
                      {hasGuesserLiveVideo && guesserActiveStream ? (
                        <VideoAvatar
                          stream={guesserActiveStream}
                          isSelf={isGuesserMe}
                          displayName={dState.guesserDisplayName || 'Guesser'}
                        />
                      ) : (
                        <img
                          src={
                            players.find(p => p.userId === dState.guesserUserId)?.avatarUrl ||
                            (players.find(p => p.userId === dState.guesserUserId) as any)?.photoURL ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                              dState.guesserDisplayName || 'Guesser'
                            )}&top=longStraight&clothing=shirtCrewNeck`
                          }
                          alt={dState.guesserDisplayName || 'Guesser'}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="overflow-hidden flex-1">
                      <span className="text-sm font-extrabold text-[#1e1435] dark:text-white truncate block">
                        {dState.guesserDisplayName ||
                          players.find(p => p.userId === dState.guesserUserId)?.displayName ||
                          'Player 2'}
                      </span>
                      <span className="text-xs font-bold text-purple-600 block">
                        {dState.scores[dState.guesserUserId] || 0} pts
                      </span>
                    </div>
                  </div>

                  {/* Sub-card inner prompt matching mockup */}
                  <div className="p-2.5 rounded-2xl bg-[#f8f7ff] dark:bg-purple-500/10 border border-[#eeebff] dark:border-purple-500/20 flex items-center gap-2.5">
                    <span className="text-sm">💡</span>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-[#1e1435] dark:text-white">
                        Guess what they're drawing!
                      </span>
                      <span className="text-[10px] text-[#8a80a0] dark:text-zinc-400">
                        Type your guess below ••
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Pro Tip Card matching mockup */}
                <div className="p-3 px-3.5 rounded-2xl bg-white dark:bg-[#111625] border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(240,160,200,0.08)] flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                    <span className="text-sm">💡</span>
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-extrabold text-[#1e1435] dark:text-white">
                      Pro Tip
                    </span>
                    <span className="text-[11px] text-[#8a80a0] dark:text-zinc-400 leading-snug">
                      Keep it simple. Fun drawings get the best guesses!
                    </span>
                  </div>
                </div>
              </div>

              {/* Center Zone: Floating Toolbar ON TOP + Canvas */}
              <div className="flex-1 flex flex-col justify-between gap-2.5 min-w-0 min-h-0">
                {/* Floating Toolbar ON TOP of Canvas */}
                <DrawingToolbar
                  currentTool={currentTool}
                  currentColor={currentColor}
                  currentBrushSize={currentBrushSize}
                  canUndo={(dState.strokes || []).length > 0}
                  canRedo={false}
                  onToolChange={tool => setCurrentTool(tool)}
                  onColorChange={color => setCurrentColor(color)}
                  onBrushSizeChange={sz => setCurrentBrushSize(sz)}
                  onUndo={undoDoodleStroke}
                  onClear={clearDoodleCanvas}
                  disabled={!isDrawing || !isDrawer}
                  isDark={isDark}
                />

                {/* Canvas Card */}
                <div className="w-full flex-1 min-h-[360px]">
                  <DrawingCanvas
                    isDrawer={isDrawer}
                    strokes={dState.strokes || []}
                    currentTool={currentTool}
                    currentColor={currentColor}
                    currentBrushSize={currentBrushSize}
                    onStrokeComplete={stroke => sendDoodleStroke(stroke)}
                    onLiveDraw={live => sendDoodleLiveDraw(live)}
                    liveDrawingStroke={liveDoodleStroke}
                    onUndo={undoDoodleStroke}
                    onClear={clearDoodleCanvas}
                    onBrushSizeChange={sz => setCurrentBrushSize(sz)}
                    onDoneDrawing={sendDoodleDoneDrawing}
                    canUndo={(dState.strokes || []).length > 0}
                    disabled={!isDrawing || !isDrawer}
                    phase={dState.phase}
                    drawerName={dState.drawerDisplayName}
                    guesserName={dState.guesserDisplayName}
                    timeRemaining={dState.timeLeftSeconds ?? dState.timeRemaining ?? 60}
                    isDark={isDark}
                  />
                </div>
              </div>

              {/* Right Zone: Guesses/Chat Panel + Collapsible Game Info Card */}
              <div className="w-full lg:w-80 shrink-0 flex flex-col justify-between gap-3 min-h-0">
                <div className="flex-1 min-h-[340px]">
                  <GuessPanel
                    isDrawer={isDrawer}
                    maskedWord={dState.maskedWord || '_____'}
                    category={dState.category}
                    guesses={dState.currentGuesses || []}
                    onSendGuess={guess => sendDoodleGuess(guess)}
                    onRequestHint={requestDoodleHint}
                    canRequestHint={
                      isGuesser && (dState.timeLeftSeconds ?? dState.timeRemaining ?? 60) <= 35
                    }
                    drawerDisplayName={dState.drawerDisplayName || 'Drawer'}
                    guesserDisplayName={dState.guesserDisplayName || 'Guesser'}
                    hasGuessedCorrectly={Boolean(
                      dState.currentGuesses?.some(g => g.isCorrect && g.userId === currentUserId)
                    )}
                    disabled={!isDrawing && !isGuessing}
                    isDark={isDark}
                    chatMessages={chatMessages}
                    myUserId={currentUserId}
                    onSendMessage={sendChat}
                    onSendReaction={sendReaction}
                  />
                </div>

                {/* Collapsible Game Info Card matching Mockup */}
                <div className="bg-white dark:bg-[#111625] rounded-3xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(240,160,200,0.08)] flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4.5 h-4.5 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-700 dark:text-zinc-300">
                        <Info className="w-3 h-3" />
                      </div>
                      <span className="text-xs font-extrabold text-[#1e1435] dark:text-white">Game Info</span>
                    </div>
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
                  </div>

                  <div className="flex flex-col gap-2 pt-1 border-t border-slate-100 dark:border-white/5">
                    {/* Mode */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shadow-2xs">
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Mode</span>
                      </div>
                      <span className="text-xs font-bold text-[#1e1435] dark:text-white">2 Players</span>
                    </div>

                    {/* Time per turn */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-pink-50 text-pink-500 flex items-center justify-center shadow-2xs">
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Time per turn</span>
                      </div>
                      <span className="text-xs font-bold text-[#1e1435] dark:text-white">
                        {dState.config?.drawTimeSeconds || 60} seconds
                      </span>
                    </div>

                    {/* Total Rounds */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center shadow-2xs">
                          <Layers className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Total Rounds</span>
                      </div>
                      <span className="text-xs font-bold text-[#1e1435] dark:text-white">
                        {dState.totalRounds || 6}
                      </span>
                    </div>

                    {/* Difficulty */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center shadow-2xs">
                          <BarChart3 className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Difficulty</span>
                      </div>
                      <span className="text-xs font-bold text-[#1e1435] dark:text-white">Mixed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Floating Bottom Social Dock - only shown during active match so it does not overlap the lobby start button */}
        {!isLobby && (
          <footer className="relative z-20 w-full p-2.5 sm:p-3 flex justify-center">
            <DoodleBottomDock
              isMuted={isMicMuted}
              isCameraOn={isCameraOn}
              unreadChatCount={0}
              onToggleMic={toggleMic}
              onToggleCamera={toggleCamera}
              onToggleChat={() => setIsChatOpen(prev => !prev)}
              onSendReaction={emoji => sendReaction(emoji)}
              onOpenSettings={() => setShowSettingsModal(true)}
              onLeave={handleLeave}
              isDark={isDark}
            />
          </footer>
        )}

        {/* Hand-drawn Doodles & Romantic Quote Background Watermarks matching mockup */}
        <div className="fixed bottom-4 left-6 pointer-events-none select-none z-0 hidden lg:block">
          <div className="font-serif italic text-sm sm:text-base text-[#8d4b88]/80 leading-tight">
            Good Drawings<br />Better Friends. ♡
          </div>
          <div className="text-pink-400 text-sm mt-1 flex gap-2">
            <span>✦</span>
            <span className="text-xs">✰</span>
          </div>
        </div>

        <div className="fixed bottom-4 right-6 pointer-events-none select-none z-0 hidden lg:block">
          <div className="relative inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-pink-200/70 to-rose-200/70 rounded-md -rotate-3 shadow-2xs">
            <span className="font-serif italic text-xs font-bold text-[#ff2b70]">
              Same Game, Different Hearts ♡
            </span>
          </div>
        </div>
      </div>

      {/* Slide-over Full Chat Drawer (Toggleable from bottom dock anytime) */}
      <DoodleChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        myUserId={currentUserId}
        onSendMessage={sendChat}
        isDark={isDark}
      />

      {/* Settings Modal (Theme Selection, Sound, Rules, Leave) */}
      <DoodleSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        roomCode={roomCodeParam || ''}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(prev => !prev)}
        onLeaveRoom={handleLeave}
        selectedTheme={selectedTheme}
        onSelectTheme={handleSelectTheme}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      {/* In-Game Round Intro Modal */}
      {isRoundIntro && (
        <RoundIntro
          currentRound={dState.currentRound ?? dState.round ?? 1}
          totalRounds={dState.totalRounds || dState.config?.rounds || 6}
          drawerDisplayName={dState.drawerDisplayName || 'Drawer'}
          guesserDisplayName={dState.guesserDisplayName || 'Guesser'}
          isDrawer={isDrawer}
          countdown={dState.timeLeftSeconds ?? 3}
        />
      )}

      {/* Secret Word Picker Modal - shown for drawer (to pick) and guesser (to wait) during WORD_CHOICE */}
      {isChoosingWord && dState && (
        <SecretWordPicker
          isDrawer={isDrawer}
          wordChoices={dState.wordChoices || []}
          drawerDisplayName={dState.drawerDisplayName || players.find(p => p.userId === dState.drawerUserId)?.displayName || 'Drawer'}
          guesserDisplayName={dState.guesserDisplayName || players.find(p => p.userId === dState.guesserUserId)?.displayName || 'Guesser'}
          timeLeft={dState.timeLeftSeconds ?? 30}
          totalTime={30}
          onChooseWord={(word: string) => chooseDoodleWord(word)}
        />
      )}

      {/* Round Result Modal */}
      {isRoundResult && (
        <RoundResultModal
          summary={
            dState.lastRoundSummary || {
              round: dState.currentRound ?? dState.round ?? 1,
              word: dState.secretWord || '',
              category: dState.category || 'General',
              drawerUserId: dState.drawerUserId,
              drawerName: dState.drawerDisplayName || 'Drawer',
              drawerPoints: 0,
              guesserUserId: dState.guesserUserId,
              guesserName: dState.guesserDisplayName || 'Guesser',
              guesserPoints: 0,
              guessedCorrectly: false,
              timeTaken: 0,
              pointsEarned: 0
            }
          }
          scores={dState.scores || {}}
          player1={player1}
          player2={player2}
          timeLeft={dState.timeLeftSeconds ?? 5}
        />
      )}

      {/* Victory / Game Over Screen */}
      {isFinished && dState && (
        <DoodleVictory
          gameState={dState}
          myUserId={currentUserId}
          onRematch={rematch}
          rematchStatus={rematchStatus}
          player1={player1}
          player2={player2}
        />
      )}

      {/* Snapchat-Style Friend Streak Celebration Modal */}
      {streakCelebration && (
        <StreakCelebrationModal
          isOpen={!!streakCelebration}
          onClose={clearStreakCelebration}
          friendName={streakCelebration.friendName}
          streakCount={streakCelebration.streakCount}
          isExtended={streakCelebration.isExtended}
        />
      )}
    </div>
  );
}

export default function DoodleDuelGamePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#080a12] text-white">
          <div className="animate-spin w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <DoodleDuelGameContent />
    </Suspense>
  );
}
