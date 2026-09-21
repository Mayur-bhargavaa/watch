'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  Settings,
  Palette,
  Brain,
  Sparkles,
  Trophy,
  AlertTriangle,
  RotateCcw,
  Sun,
  Moon,
  Mic,
  MicOff,
  Video,
  VideoOff,
  CameraOff
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useGameRoom } from '../../../hooks/useGameRoom';
import { useWebRTC, VideoGridParticipant } from '../../../hooks/useWebRTC';
import { VideoAvatar } from '../../../components/games/LudoGame';
import { getStoredSession, UserSession } from '../../../lib/api';
import { DrawingCanvas } from '../../../components/games/doodle/DrawingCanvas';
import { DrawingToolbar } from '../../../components/games/doodle/DrawingToolbar';
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
  const [currentTool, setCurrentTool] = useState<'brush' | 'eraser'>('brush');
  const [currentColor, setCurrentColor] = useState<string>('#FFFFFF');
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
    opponentLeftWin
  } = useGameRoom(roomCodeParam);

  const currentUserId = myUserId || session?.user.id || '';
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
    (!['ROUND_INTRO', 'WORD_CHOICE', 'CHOOSING_WORD', 'DRAWING', 'ROUND_RESULT', 'FINISHED'].includes(
      dState?.phase || ''
    ) &&
      room.status === 'WAITING');
  const isChoosingWord = dState?.phase === 'CHOOSING_WORD' || dState?.phase === 'WORD_CHOICE';
  const isRoundIntro = dState?.phase === 'ROUND_INTRO';
  const isDrawing = dState?.phase === 'DRAWING';
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
      className={`flex selection:bg-rose-600 selection:text-white font-sans antialiased overflow-x-hidden min-h-screen relative transition-colors duration-300 ${
        isDark ? 'bg-[#080a12] text-white' : 'bg-[#f8fafc] text-slate-900'
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
            isDark ? 'bg-black/55 backdrop-blur-[2px]' : 'bg-white/80 backdrop-blur-[2px]'
          }`}
        />
      </div>

      {/* App Content Column */}
      <div className="relative z-10 flex-1 flex flex-col justify-between min-h-screen">
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

        {/* Top Header Bar */}
        <header
          className={`relative z-20 w-full px-4 sm:px-8 py-3.5 flex items-center justify-between border-b backdrop-blur-md transition-colors duration-300 ${
            isDark
              ? 'border-white/10 bg-[#080a12]/80 text-white'
              : 'border-slate-200 bg-white/85 text-slate-900 shadow-xs'
          }`}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleLeave}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer active:scale-95 ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border-white/10'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-slate-200'
              }`}
              title="Back to Games"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Games</span>
            </button>

            <div
              className={`text-xs sm:text-sm font-semibold tracking-tight ${
                isDark ? 'text-zinc-400' : 'text-slate-500'
              }`}
            >
              <span>Watch.</span> <span className="opacity-40">/</span> <span>Game Lobby</span>{' '}
              <span className="opacity-40">/</span>{' '}
              <span className="text-[#ee1d49] font-bold">Doodle Duel</span>
            </div>
          </div>

          {/* Center Timer when in-game */}
          {dState && !isLobby && !isFinished && (
            <DoodleGameTimer
              timeLeft={dState.timeLeftSeconds ?? dState.timeRemaining ?? 60}
              totalTime={dState.config?.drawTimeSeconds || dState.config?.drawTime || 60}
              currentRound={dState.currentRound ?? dState.round ?? 1}
              totalRounds={dState.totalRounds || dState.config?.rounds || 6}
            />
          )}

          {/* Right Actions: Theme Selector, Light/Dark Toggle, Settings */}
          <div className="flex items-center gap-2">
            {/* Theme Selector Palette Button */}
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300 hover:text-white'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900'
              }`}
              title="Change Theme & Background"
            >
              <Palette className="w-4 h-4 text-rose-500" />
              <span className="hidden sm:inline text-[11px] truncate max-w-[90px]">
                {currentTheme.name.split('•')[1] || currentTheme.name.split('(')[0]}
              </span>
            </button>

            {/* Light / Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition active:scale-95 cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300 hover:text-white'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900'
              }`}
              title={isDark ? 'Switch to Clean White Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* Settings */}
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className={`p-2 rounded-xl border transition active:scale-95 cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300 hover:text-white'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900'
              }`}
              title="Settings & Rules"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Container */}
        <main
          className={`relative z-10 flex-1 w-full flex flex-col justify-center ${
            isLobby && room
              ? 'p-0 max-w-none min-h-[calc(100vh-4rem)] relative overflow-hidden'
              : 'max-w-7xl mx-auto p-3 sm:p-6'
          }`}
        >
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

          {/* In-Game Active Match UI (3-Zone Multimedia Arena) */}
          {!isLobby && dState && (
            <div className="w-full flex flex-col lg:flex-row items-stretch gap-4 sm:gap-6">
              {/* Left Zone: Multimedia Player Cards & Secret Word */}
              <div className="lg:w-64 flex flex-col gap-3 shrink-0">
                {/* Drawer Player Card */}
                <div
                  className={`p-3.5 rounded-2xl border shadow-xl flex flex-col gap-2.5 transition-colors ${
                    isDark
                      ? 'bg-[#111625]/90 border-white/10 text-white'
                      : 'bg-white/95 border-slate-200 shadow-md text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 flex items-center gap-1">
                      <Palette className="w-3.5 h-3.5" /> Drawer
                    </span>
                    {isDrawer && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-500">
                        YOU
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Live Video Avatar Feed with Camera & Speaking Indicators */}
                    <div
                      className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border-2 transition-all flex items-center justify-center bg-black/60 shrink-0 ${
                        isDrawerSpeaking
                          ? 'ring-4 ring-emerald-400 border-emerald-400 shadow-lg'
                          : 'border-rose-500/30'
                      }`}
                    >
                      {hasDrawerLiveVideo && drawerActiveStream ? (
                        <VideoAvatar
                          stream={drawerActiveStream}
                          isSelf={isDrawerMe}
                          displayName={dState.drawerDisplayName || 'Drawer'}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-rose-500 to-pink-600 flex flex-col items-center justify-center font-black text-white text-base">
                          <span>{dState.drawerDisplayName?.charAt(0).toUpperCase()}</span>
                          <CameraOff className="w-3 h-3 text-white/70 mt-0.5" />
                        </div>
                      )}

                      {/* Mic Badge */}
                      <div className="absolute bottom-1 right-1 p-1 rounded-full bg-black/70 backdrop-blur-md shadow">
                        {isDrawerMuted ? (
                          <MicOff className="w-2.5 h-2.5 text-rose-400" />
                        ) : (
                          <Mic className="w-2.5 h-2.5 text-emerald-400" />
                        )}
                      </div>
                    </div>

                    <div className="overflow-hidden flex-1">
                      <span
                        className={`text-sm font-black truncate block ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {dState.drawerDisplayName}
                      </span>
                      <span className="text-xs font-mono font-bold text-rose-500 block">
                        {dState.scores[dState.drawerUserId] || 0} pts
                      </span>
                      <span className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                        {hasDrawerLiveVideo ? '🟢 Live Cam' : '📷 Cam Off'}
                      </span>
                    </div>
                  </div>

                  {/* Secret Word Box for Drawer */}
                  {isDrawer && dState.secretWord ? (
                    <div className="mt-1 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col items-center text-center">
                      <span
                        className={`text-[9px] font-black uppercase tracking-widest ${
                          isDark ? 'text-zinc-400' : 'text-slate-500'
                        }`}
                      >
                        Your Secret Word
                      </span>
                      <span
                        className={`text-base font-black uppercase tracking-wider mt-0.5 text-rose-500`}
                      >
                        {dState.secretWord}
                      </span>
                    </div>
                  ) : (
                    <div
                      className={`mt-1 p-2.5 rounded-xl border text-center ${
                        isDark ? 'bg-white/[0.03] border-white/5' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <span
                        className={`text-[11px] font-medium ${
                          isDark ? 'text-zinc-400' : 'text-slate-500'
                        }`}
                      >
                        {dState.drawerDisplayName} is drawing!
                      </span>
                    </div>
                  )}
                </div>

                {/* Guesser Player Card */}
                <div
                  className={`p-3.5 rounded-2xl border shadow-xl flex flex-col gap-2.5 transition-colors ${
                    isDark
                      ? 'bg-[#111625]/90 border-white/10 text-white'
                      : 'bg-white/95 border-slate-200 shadow-md text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-violet-500 flex items-center gap-1">
                      <Brain className="w-3.5 h-3.5" /> Guesser
                    </span>
                    {isGuesser && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-500">
                        YOU
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Live Video Avatar Feed with Camera & Speaking Indicators */}
                    <div
                      className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border-2 transition-all flex items-center justify-center bg-black/60 shrink-0 ${
                        isGuesserSpeaking
                          ? 'ring-4 ring-emerald-400 border-emerald-400 shadow-lg'
                          : 'border-violet-500/30'
                      }`}
                    >
                      {hasGuesserLiveVideo && guesserActiveStream ? (
                        <VideoAvatar
                          stream={guesserActiveStream}
                          isSelf={isGuesserMe}
                          displayName={dState.guesserDisplayName || 'Guesser'}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-violet-500 to-blue-600 flex flex-col items-center justify-center font-black text-white text-base">
                          <span>{dState.guesserDisplayName?.charAt(0).toUpperCase()}</span>
                          <CameraOff className="w-3 h-3 text-white/70 mt-0.5" />
                        </div>
                      )}

                      {/* Mic Badge */}
                      <div className="absolute bottom-1 right-1 p-1 rounded-full bg-black/70 backdrop-blur-md shadow">
                        {isGuesserMuted ? (
                          <MicOff className="w-2.5 h-2.5 text-rose-400" />
                        ) : (
                          <Mic className="w-2.5 h-2.5 text-emerald-400" />
                        )}
                      </div>
                    </div>

                    <div className="overflow-hidden flex-1">
                      <span
                        className={`text-sm font-black truncate block ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {dState.guesserDisplayName}
                      </span>
                      <span className="text-xs font-mono font-bold text-violet-500 block">
                        {dState.scores[dState.guesserUserId] || 0} pts
                      </span>
                      <span className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                        {hasGuesserLiveVideo ? '🟢 Live Cam' : '📷 Cam Off'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Zone: Drawing Canvas & Toolbar */}
              <div className="flex-1 flex flex-col gap-3 min-w-0">
                <div className="w-full flex-1 aspect-[4/3] max-h-[560px] min-h-[360px]">
                  <DrawingCanvas
                    isDrawer={isDrawer && isDrawing}
                    strokes={dState.strokes || []}
                    currentTool={currentTool}
                    currentColor={currentColor}
                    currentBrushSize={currentBrushSize}
                    onStrokeComplete={stroke => sendDoodleStroke(stroke)}
                    disabled={!isDrawing || !isDrawer}
                  />
                </div>

                {/* Drawing Toolbar (Only for Drawer during DRAWING) */}
                {isDrawer && isDrawing && (
                  <DrawingToolbar
                    currentTool={currentTool}
                    currentColor={currentColor}
                    currentBrushSize={currentBrushSize}
                    canUndo={(dState.strokes || []).length > 0}
                    onToolChange={tool => setCurrentTool(tool)}
                    onColorChange={color => setCurrentColor(color)}
                    onBrushSizeChange={sz => setCurrentBrushSize(sz)}
                    onUndo={undoDoodleStroke}
                    onClear={clearDoodleCanvas}
                    disabled={!isDrawing}
                  />
                )}
              </div>

              {/* Right Zone: Integrated Dual-Tab Guesses & Table Chat Panel */}
              <div className="lg:w-80 shrink-0 flex flex-col">
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
                  disabled={!isDrawing}
                  isDark={isDark}
                  chatMessages={chatMessages}
                  myUserId={currentUserId}
                  onSendMessage={sendChat}
                  onSendReaction={sendReaction}
                />
              </div>
            </div>
          )}
        </main>

        {/* Floating Bottom Social Dock */}
        <footer className="relative z-20 w-full p-4 flex justify-center">
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

      {/* Drawer Secret Word Picker Modal */}
      {isChoosingWord && isDrawer && (
        <SecretWordPicker
          isDrawer={isDrawer}
          wordChoices={dState.wordChoices || []}
          drawerDisplayName={dState.drawerDisplayName || 'Drawer'}
          guesserDisplayName={dState.guesserDisplayName || 'Guesser'}
          timeLeft={dState.timeLeftSeconds ?? 15}
          onChooseWord={(word: string) => chooseDoodleWord(word)}
        />
      )}

      {/* Guesser Waiting Modal while Drawer chooses */}
      {isChoosingWord && !isDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div
            className={`p-6 rounded-3xl border shadow-2xl text-center max-w-sm w-full animate-in zoom-in-95 ${
              isDark ? 'bg-[#101424] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-500">
              <Sparkles className="w-6 h-6 animate-spin" />
            </div>
            <h3 className="text-base font-black">
              {dState.drawerDisplayName} is picking a word...
            </h3>
            <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Get your thinking cap on! The round starts soon.
            </p>
          </div>
        </div>
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
