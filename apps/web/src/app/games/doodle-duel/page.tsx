'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
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
  Moon
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useGameRoom } from '../../../hooks/useGameRoom';
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
import { DoodleSettingsModal } from '../../../components/games/doodle/DoodleSettingsModal';
import { DoodleChatDrawer } from '../../../components/games/doodle/DoodleChatDrawer';
import { GameFriendSelectorDrawer } from '../../../components/games/GameFriendSelectorDrawer';
import { createGameRoomWithPartner } from '../../../lib/api';
import { DoodleStroke, DoodleGameState, DoodleConfig } from '@synccinema/common';

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
  const [showFriendDrawer, setShowFriendDrawer] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

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
    sendVoiceState,
    sendCameraState,
    rematch,
    rematchStatus,
    opponentLeftWin
  } = useGameRoom(roomCodeParam);

  const currentUserId = myUserId || session?.user.id || '';
  const dState = gameState as DoodleGameState | null;

  // Sound FX triggers
  useEffect(() => {
    if (!soundEnabled || !lastDoodleGuess) return;
    if (lastDoodleGuess.isCorrect) {
      // Fanfare arpeggio
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
  const isLobby = !room || (!['ROUND_INTRO', 'WORD_CHOICE', 'CHOOSING_WORD', 'DRAWING', 'ROUND_RESULT', 'FINISHED'].includes(dState?.phase || '') && room.status === 'WAITING');
  const isChoosingWord = dState?.phase === 'CHOOSING_WORD' || dState?.phase === 'WORD_CHOICE';
  const isRoundIntro = dState?.phase === 'ROUND_INTRO';
  const isDrawing = dState?.phase === 'DRAWING';
  const isRoundResult = dState?.phase === 'ROUND_RESULT';
  const isFinished = room?.status === 'FINISHED' || dState?.phase === 'FINISHED';

  const handleLeave = () => {
    sendLeave();
    router.push('/games');
  };

  if (!roomCodeParam) {
    return <DoodlePreRoomLobby />;
  }

  return (
    <div className={`relative min-h-screen flex flex-col justify-between overflow-x-hidden select-none font-sans transition-colors duration-300 ${
      isDark ? 'bg-[#080a12] text-white' : 'bg-[#f8fafc] text-slate-900'
    }`}>
      {/* Background Cinematic Gradients */}
      <div className={`absolute top-0 left-1/4 w-[600px] h-[400px] blur-3xl pointer-events-none transition-opacity ${
        isDark ? 'bg-gradient-to-br from-rose-600/10 via-purple-600/5 to-transparent' : 'bg-gradient-to-br from-rose-400/10 via-purple-400/5 to-transparent'
      }`} />
      <div className={`absolute bottom-0 right-1/4 w-[600px] h-[400px] blur-3xl pointer-events-none transition-opacity ${
        isDark ? 'bg-gradient-to-tl from-violet-600/10 via-blue-600/5 to-transparent' : 'bg-gradient-to-tl from-violet-400/10 via-blue-400/5 to-transparent'
      }`} />

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
            <span className={`text-sm font-black block ${isDark ? 'text-white' : 'text-slate-900'}`}>Opponent Forfeited!</span>
            <span className="text-xs text-amber-500 font-medium">{opponentLeftWin.message}</span>
          </div>
        </div>
      )}

      {/* Top Header Bar (Matching Ludo Arena standard) */}
      <header className={`relative z-20 w-full px-4 sm:px-8 py-3.5 flex items-center justify-between border-b backdrop-blur-md transition-colors duration-300 ${
        isDark ? 'border-white/10 bg-[#080a12]/80 text-white' : 'border-slate-200 bg-white/85 text-slate-900 shadow-xs'
      }`}>
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

          <div className={`text-xs sm:text-sm font-semibold tracking-tight ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
            <span>Watch.</span> <span className="opacity-40">/</span> <span>Game Lobby</span> <span className="opacity-40">/</span> <span className="text-[#ee1d49] font-bold">Doodle Duel</span>
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

        {/* Right Actions: Theme Toggle & Settings */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className={`p-2 rounded-xl border transition active:scale-95 cursor-pointer ${
              isDark
                ? 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300 hover:text-white'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900'
            }`}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

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
      <main className={`relative z-10 flex-1 w-full flex flex-col justify-center ${isLobby && room ? 'p-0 max-w-none min-h-[calc(100vh-4rem)] relative overflow-hidden' : 'max-w-7xl mx-auto p-3 sm:p-6'}`}>
        {isLobby && room && (
          <div className="relative w-full h-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Cozy cinematic waiting room background */}
            <div
              className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat select-none pointer-events-none"
              style={{ backgroundImage: `url('/images/ludo-waiting-bg.jpg')` }}
            >
              <div className="absolute inset-0 bg-black/20 backdrop-blur-[0.5px]" />
            </div>

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

        {/* In-Game Active Match UI (3-Zone Layout) */}
        {!isLobby && dState && (
          <div className="w-full flex flex-col lg:flex-row items-stretch gap-4 sm:gap-6">
            {/* Left Zone: Drawer Info & Secret Word */}
            <div className="lg:w-64 flex flex-col gap-3 shrink-0">
              {/* Drawer Card */}
              <div className={`p-4 rounded-2xl border shadow-xl flex flex-col gap-3 transition-colors ${
                isDark ? 'bg-[#111625]/90 border-white/10' : 'bg-white/95 border-slate-200 shadow-md text-slate-900'
              }`}>
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
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center font-black text-white text-base shadow-md">
                    {dState.drawerDisplayName?.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <span className={`text-sm font-black truncate block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {dState.drawerDisplayName}
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-500">
                      {dState.scores[dState.drawerUserId] || 0} pts
                    </span>
                  </div>
                </div>

                {/* Secret Word Display for Drawer */}
                {isDrawer && dState.secretWord ? (
                  <div className="mt-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col items-center text-center">
                    <span className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                      Your Secret Word
                    </span>
                    <span className={`text-lg font-black uppercase tracking-wider mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {dState.secretWord}
                    </span>
                  </div>
                ) : (
                  <div className={`mt-2 p-3 rounded-xl border text-center ${
                    isDark ? 'bg-white/[0.03] border-white/5' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                      {dState.drawerDisplayName} is drawing the secret word!
                    </span>
                  </div>
                )}
              </div>

              {/* Guesser Summary Card */}
              <div className={`p-4 rounded-2xl border shadow-xl flex flex-col gap-3 transition-colors ${
                isDark ? 'bg-[#111625]/90 border-white/10' : 'bg-white/95 border-slate-200 shadow-md text-slate-900'
              }`}>
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
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-violet-500 to-blue-500 flex items-center justify-center font-black text-white text-base shadow-md">
                    {dState.guesserDisplayName?.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <span className={`text-sm font-black truncate block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {dState.guesserDisplayName}
                    </span>
                    <span className="text-xs font-mono font-bold text-violet-500">
                      {dState.scores[dState.guesserUserId] || 0} pts
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

              {/* Drawing Toolbar (Only rendered for Drawer during DRAWING) */}
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

            {/* Right Zone: Guess Panel */}
            <div className="lg:w-80 shrink-0 flex flex-col">
              <GuessPanel
                isDrawer={isDrawer}
                maskedWord={dState.maskedWord || '_____'}
                category={dState.category}
                guesses={dState.currentGuesses || []}
                onSendGuess={guess => sendDoodleGuess(guess)}
                onRequestHint={requestDoodleHint}
                canRequestHint={isGuesser && (dState.timeLeftSeconds ?? dState.timeRemaining ?? 60) <= 35}
                drawerDisplayName={dState.drawerDisplayName || 'Drawer'}
                guesserDisplayName={dState.guesserDisplayName || 'Guesser'}
                hasGuessedCorrectly={Boolean(
                  dState.currentGuesses?.some(g => g.isCorrect && g.userId === currentUserId)
                )}
                disabled={!isDrawing}
              />
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Social Dock */}
      <footer className="relative z-20 w-full p-4 flex justify-center">
        <DoodleBottomDock
          isMuted={isMuted}
          isCameraOn={isCameraOn}
          unreadChatCount={0}
          onToggleMic={() => {
            const next = !isMuted;
            setIsMuted(next);
            sendVoiceState(next);
          }}
          onToggleCamera={() => {
            const next = !isCameraOn;
            setIsCameraOn(next);
            sendCameraState(next);
          }}
          onToggleChat={() => setIsChatOpen(prev => !prev)}
          onSendReaction={emoji => sendReaction(emoji)}
          onOpenSettings={() => setShowSettingsModal(true)}
          onLeave={handleLeave}
        />
      </footer>

      {/* Overlays / Modal Phases */}
      {isChoosingWord && (
        <SecretWordPicker
          isDrawer={isDrawer}
          wordChoices={dState?.wordChoices}
          drawerDisplayName={dState?.drawerDisplayName || 'Drawer'}
          guesserDisplayName={dState?.guesserDisplayName || 'Guesser'}
          timeLeft={dState?.timeLeftSeconds ?? dState?.timeRemaining ?? 15}
          onChooseWord={word => chooseDoodleWord(word)}
        />
      )}

      {isRoundIntro && (
        <RoundIntro
          currentRound={dState?.currentRound ?? dState?.round ?? 1}
          totalRounds={dState?.totalRounds || dState?.config?.rounds || 6}
          drawerDisplayName={dState?.drawerDisplayName || 'Drawer'}
          guesserDisplayName={dState?.guesserDisplayName || 'Guesser'}
          isDrawer={isDrawer}
          countdown={dState?.timeLeftSeconds ?? dState?.timeRemaining ?? 3}
        />
      )}

      {isRoundResult && dState?.lastRoundSummary && (
        <RoundResultModal
          summary={dState.lastRoundSummary}
          scores={dState.scores}
          player1={{ userId: player1.userId, displayName: player1.displayName }}
          player2={{ userId: player2.userId, displayName: player2.displayName }}
          isNextRoundLast={(dState.currentRound ?? dState.round) === dState.totalRounds}
          timeLeft={dState.timeLeftSeconds ?? dState.timeRemaining ?? 5}
        />
      )}

      {isFinished && dState && (
        <DoodleVictory
          gameState={dState}
          myUserId={currentUserId}
          onRematch={rematch}
          rematchStatus={rematchStatus}
          player1={{ userId: player1.userId, displayName: player1.displayName }}
          player2={{ userId: player2.userId, displayName: player2.displayName }}
        />
      )}

      {/* Chat Drawer */}
      <DoodleChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        myUserId={currentUserId}
        onSendMessage={content => sendChat(content)}
      />

      {/* Settings Modal */}
      <DoodleSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        roomCode={roomCodeParam || room?.roomCode || 'DOODLE'}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(prev => !prev)}
        onLeaveRoom={handleLeave}
      />
    </div>
  );
}

export default function DoodleDuelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#080a12] flex flex-col items-center justify-center text-white space-y-3">
          <div className="w-10 h-10 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-zinc-400">Loading Doodle Duel...</span>
        </div>
      }
    >
      <DoodleDuelGameContent />
    </Suspense>
  );
}
