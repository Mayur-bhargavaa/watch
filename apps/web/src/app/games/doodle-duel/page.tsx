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
import { StreakCelebrationModal } from '../../../components/streaks/StreakCelebrationModal';
import { useWebRTC, VideoGridParticipant } from '../../../hooks/useWebRTC';
import { VideoAvatar } from '../../../components/games/LudoGame';
import { getStoredSession, UserSession, getGameRoute, getGameTitle } from '../../../lib/api';
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

        {/* Top Header Bar matching Mockup */}
        <header
          className={`relative z-20 w-full px-6 sm:px-10 py-4 flex items-center justify-between border-b transition-colors duration-300 ${
            isDark
              ? 'border-white/10 bg-[#080a12]/90 text-white'
              : 'border-slate-100 bg-white/95 text-slate-900 shadow-xs'
          }`}
        >
          {/* Left: watch. Logo + Back to Games pill */}
          <div className="flex items-center gap-6">
            <div className="flex items-baseline font-black tracking-tight text-xl text-slate-900 dark:text-white select-none">
              <span>watch</span>
              <span className="text-[#f43f5e] text-2xl leading-none">.</span>
            </div>

            <button
              type="button"
              onClick={handleLeave}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition cursor-pointer active:scale-95 ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border-white/10'
                  : 'bg-slate-100/90 hover:bg-slate-200/90 text-slate-700 hover:text-slate-900 border-slate-200/60'
              }`}
              title="Back to Games"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Games</span>
            </button>
          </div>

          {/* Center Title + Subtitle */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-100 via-pink-50 to-rose-200 dark:from-rose-950/40 dark:to-pink-900/40 flex items-center justify-center text-xl shadow-xs">
              🎨
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                  Doodle Duel
                </h1>
              </div>
              <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-400 mt-1">
                Draw it. Guess it. Switch.
              </span>
            </div>
          </div>

          {/* Center-Right Timer & Round Pill */}
          {dState && !isLobby && !isFinished && (
            <DoodleGameTimer
              timeLeft={dState.timeLeftSeconds ?? dState.timeRemaining ?? 60}
              totalTime={dState.config?.drawTimeSeconds || dState.config?.drawTime || 60}
              currentRound={dState.currentRound ?? dState.round ?? 1}
              totalRounds={dState.totalRounds || dState.config?.rounds || 6}
            />
          )}

          {/* Right Header Actions: Theme, Settings, Pink Leave Button, and Handwritten Script */}
          <div className="flex items-center gap-3">
            {/* Handwriting script watermark matching mockup */}
            <div className="hidden xl:flex flex-col text-right leading-none select-none opacity-40 font-serif italic text-slate-600 dark:text-zinc-400 text-xs pr-2">
              <span>Good Drawings —</span>
              <span className="mt-0.5">Better Friends. ♡</span>
            </div>

            {/* Light / Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition active:scale-95 cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-xs'
              }`}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* Settings */}
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition active:scale-95 cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-xs'
              }`}
              title="Settings & Rules"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Pink Leave Game Button */}
            <button
              type="button"
              onClick={handleLeave}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#f43f5e]/30 bg-rose-50/70 hover:bg-rose-100/80 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-[#f43f5e] text-xs font-bold transition active:scale-95 cursor-pointer"
              title="Leave Game"
            >
              <span>→</span>
              <span>Leave Game</span>
            </button>
          </div>
        </header>

        {/* Main Container */}
        <main
          className={`relative z-10 flex-1 w-full flex flex-col justify-center ${
            isLobby && room
              ? 'p-0 max-w-none min-h-[calc(100vh-4rem)] relative overflow-hidden'
              : 'max-w-7xl mx-auto p-4 sm:p-6'
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
            <div className="w-full flex flex-col lg:flex-row items-stretch gap-5">
              {/* Left Zone: Multimedia Player Cards, Inner Prompts & Tip Card */}
              <div className="lg:w-64 flex flex-col gap-4 shrink-0">
                {/* Drawer Player Card matching mockup */}
                <div
                  className={`p-4 rounded-[24px] border shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col gap-3.5 transition-colors ${
                    isDark
                      ? 'bg-[#111625]/90 border-white/10 text-white'
                      : 'bg-white border-slate-200/90 text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#f43f5e] flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10">
                      🎨 DRAWER
                    </span>
                    {isDrawer && (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full text-[#f43f5e] bg-rose-50 dark:bg-rose-500/10">
                        YOU
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Circular Video / Avatar Feed with Pink Border */}
                    <div
                      className={`relative w-14 h-14 rounded-full overflow-hidden border-2 transition-all flex items-center justify-center bg-slate-100 shrink-0 ${
                        isDrawerSpeaking
                          ? 'ring-4 ring-emerald-400 border-emerald-400 shadow-md'
                          : 'border-rose-400 ring-2 ring-rose-100 dark:ring-rose-950'
                      }`}
                    >
                      {hasDrawerLiveVideo && drawerActiveStream ? (
                        <VideoAvatar
                          stream={drawerActiveStream}
                          isSelf={isDrawerMe}
                          displayName={dState.drawerDisplayName || 'Drawer'}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-rose-200 to-pink-300 dark:from-rose-900 dark:to-pink-950 flex flex-col items-center justify-center font-bold text-slate-700 dark:text-white text-base">
                          <span>{dState.drawerDisplayName?.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                    </div>

                    <div className="overflow-hidden flex-1">
                      <span
                        className={`text-sm font-bold truncate block ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {dState.drawerDisplayName}
                      </span>
                      <span className="text-xs font-bold text-[#f43f5e] block">
                        {dState.scores[dState.drawerUserId] || 0} pts
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                        {hasDrawerLiveVideo ? '🟢 Live Cam' : '📷 Cam Off'}
                      </span>
                    </div>
                  </div>

                  {/* Secret Word Box for Drawer (Soft Pink Box in Mockup) */}
                  {isDrawer && dState.secretWord ? (
                    <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-500/10 border border-rose-200/50 dark:border-rose-500/20 flex flex-col items-center text-center">
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-zinc-400">
                        YOUR WORD
                      </span>
                      <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
                        {dState.secretWord}
                      </span>
                      <span className="text-[10px] text-[#f43f5e] font-semibold mt-1 flex items-center gap-1">
                        💡 Draw something clear!
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 text-center">
                      <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                        {dState.drawerDisplayName} is drawing!
                      </span>
                    </div>
                  )}
                </div>

                {/* Guesser Player Card matching mockup */}
                <div
                  className={`p-4 rounded-[24px] border shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col gap-3.5 transition-colors ${
                    isDark
                      ? 'bg-[#111625]/90 border-white/10 text-white'
                      : 'bg-white border-slate-200/90 text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-500/10">
                      🧠 GUESSER
                    </span>
                    {isGuesser && (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full text-purple-600 bg-purple-50 dark:bg-purple-500/10">
                        YOU
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Circular Video / Avatar Feed with Purple Border */}
                    <div
                      className={`relative w-14 h-14 rounded-full overflow-hidden border-2 transition-all flex items-center justify-center bg-slate-100 shrink-0 ${
                        isGuesserSpeaking
                          ? 'ring-4 ring-emerald-400 border-emerald-400 shadow-md'
                          : 'border-purple-400 ring-2 ring-purple-100 dark:ring-purple-950'
                      }`}
                    >
                      {hasGuesserLiveVideo && guesserActiveStream ? (
                        <VideoAvatar
                          stream={guesserActiveStream}
                          isSelf={isGuesserMe}
                          displayName={dState.guesserDisplayName || 'Guesser'}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-purple-200 to-indigo-300 dark:from-purple-900 dark:to-indigo-950 flex flex-col items-center justify-center font-bold text-slate-700 dark:text-white text-base">
                          <span>{dState.guesserDisplayName?.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                    </div>

                    <div className="overflow-hidden flex-1">
                      <span
                        className={`text-sm font-bold truncate block ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {dState.guesserDisplayName}
                      </span>
                      <span className="text-xs font-bold text-purple-600 block">
                        {dState.scores[dState.guesserUserId] || 0} pts
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                        {hasGuesserLiveVideo ? '🟢 Live Cam' : '📷 Cam Off'}
                      </span>
                    </div>
                  </div>

                  {/* Inner Guesser Box in Mockup */}
                  <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 flex flex-col gap-0.5 text-left">
                    <span className="text-[11px] text-slate-600 dark:text-zinc-300 font-medium flex items-center gap-1.5">
                      💡 Waiting for your drawing...
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium ml-4">
                      I'm ready! 🎯
                    </span>
                  </div>
                </div>

                {/* Bottom Tip Card matching Mockup */}
                <div
                  className={`p-3.5 rounded-[20px] border shadow-xs flex items-center gap-3 transition-colors ${
                    isDark
                      ? 'bg-[#111625]/90 border-white/10 text-white'
                      : 'bg-white border-slate-200/90 text-slate-800'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-sm shrink-0">
                    💡
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                      Tip
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Simple drawings work best!
                    </span>
                  </div>
                </div>
              </div>

              {/* Center Zone: White Canvas & Floating Toolbar */}
              <div className="flex-1 flex flex-col gap-4 min-w-0">
                <div className="w-full flex-1 aspect-[4/3] max-h-[580px] min-h-[400px]">
                  <DrawingCanvas
                    isDrawer={isDrawer && isDrawing}
                    strokes={dState.strokes || []}
                    currentTool={currentTool}
                    currentColor={currentColor}
                    currentBrushSize={currentBrushSize}
                    onStrokeComplete={stroke => sendDoodleStroke(stroke)}
                    onUndo={undoDoodleStroke}
                    onClear={clearDoodleCanvas}
                    canUndo={(dState.strokes || []).length > 0}
                    disabled={!isDrawing || !isDrawer}
                    isDark={isDark}
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
                    isDark={isDark}
                  />
                )}
              </div>

              {/* Right Zone: Guesses/Chat Panel + Collapsible Game Info Card */}
              <div className="lg:w-80 shrink-0 flex flex-col gap-4">
                <div className="flex-1 min-h-[380px]">
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

                {/* Collapsible Game Info Card matching Mockup */}
                <div
                  className={`p-4 rounded-[24px] border shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col gap-3 transition-colors ${
                    isDark
                      ? 'bg-[#111625]/90 border-white/10 text-white'
                      : 'bg-white border-slate-200/90 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-2 text-slate-800 dark:text-zinc-200">
                      🎮 Game Info
                    </span>
                    <span className="text-xs text-slate-400">⌃</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-100 dark:border-white/5 text-left">
                    <div>
                      <span className="text-[9px] text-slate-400 font-medium block">Mode</span>
                      <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200">2 Players</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-medium block">Time per turn</span>
                      <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200">
                        {dState.config?.drawTimeSeconds || 60}s
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-medium block">Rounds</span>
                      <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200">
                        {dState.totalRounds || 6}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-medium block">Difficulty</span>
                      <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200">Mixed</span>
                    </div>
                  </div>
                </div>
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
