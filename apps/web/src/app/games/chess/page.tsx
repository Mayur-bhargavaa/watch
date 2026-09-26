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
  RotateCcw,
  Video,
  VideoOff,
  Mic,
  MicOff,
  MessageSquare,
  X as CloseIcon,
  Flag,
  Handshake,
  Undo2,
  Swords,
  Clock,
  Eye
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useGameRoom } from '../../../hooks/useGameRoom';
import { useWebRTC } from '../../../hooks/useWebRTC';
import { VideoAvatar } from '../../../components/games/LudoGame';
import {
  getStoredSession,
  UserSession,
  getGameRoute,
  getGameTitle,
  createGameRoom,
  getUserMe,
  getUserPartner,
  connectUserPartner,
  WS_BASE
} from '../../../lib/api';
import { GameFriendSelectorDrawer } from '../../../components/games/GameFriendSelectorDrawer';
import { ChessBoard } from '../../../components/games/chess/ChessBoard';
import { ChessPlayerCard } from '../../../components/games/chess/ChessPlayerCard';
import { ChessWaitingRoom } from '../../../components/games/chess/ChessWaitingRoom';
import { UnifiedGameWaitingRoom } from '../../../components/games/common/waiting/UnifiedGameWaitingRoom';
import { ChessGameEnd } from '../../../components/games/chess/ChessGameEnd';
import { PartyPoppers } from '../../../components/games/common/PartyPoppers';
import { ChessReview } from '../../../components/games/chess/ChessReview';
import { StreakCelebrationModal } from '../../../components/streaks/StreakCelebrationModal';
import { ChessHeader } from '../../../components/games/chess/ChessHeader';
import { ChessLeftPanel } from '../../../components/games/chess/ChessLeftPanel';
import { ChessCallingModal } from '../../../components/games/chess/ChessCallingModal';
import { ChessChatDrawer } from '../../../components/games/chess/ChessChatDrawer';
import { ChessPlayersPanel } from '../../../components/games/chess/ChessPlayersPanel';
import { ChessInfoDrawer } from '../../../components/games/chess/ChessInfoDrawer';

import {
  ChessResignModal,
  ChessDrawOfferModal,
  ChessTakebackModal
} from '../../../components/games/chess/ChessModals';
import { Chess } from 'chess.js';
import {
  ChessGameState,
  ChessGameConfig,
  DEFAULT_CHESS_CONFIG,
  ChessColor,
  CHESS_TIME_PRESETS
} from '@synccinema/common';

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

function ChessGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomCodeParam = searchParams.get('room');

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [session, setSession] = useState<UserSession | null>(null);
  const [showFriendDrawer, setShowFriendDrawer] = useState(false);
  const [showResignModal, setShowResignModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [chessConfig, setChessConfig] = useState<ChessGameConfig>(DEFAULT_CHESS_CONFIG);
  const [rematchRequested, setRematchRequested] = useState(false);

  // Solo Practice Mode state
  const [isPracticeMode, setIsPracticeMode] = useState<boolean>(false);
  const [practiceFen, setPracticeFen] = useState<string>('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [practiceTurn, setPracticeTurn] = useState<ChessColor>('w');
  const [practiceLastMove, setPracticeLastMove] = useState<{ from: string; to: string } | null>(null);
  const [practiceCheck, setPracticeCheck] = useState<boolean>(false);
  const [practiceCheckSquare, setPracticeCheckSquare] = useState<string | undefined>(undefined);
  const [practiceCheckmate, setPracticeCheckmate] = useState<boolean>(false);

  // Chat bar state
  const [chatMessage, setChatMessage] = useState('');
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  const [boardTheme, setBoardTheme] = useState<'wood' | 'slate' | 'charcoal'>('wood');
  const [showHints, setShowHints] = useState<boolean>(true);
  const [isCallClosed, setIsCallClosed] = useState<boolean>(false);

  // Load session
  useEffect(() => {
    const stored = getStoredSession();
    if (stored) {
      setSession(stored);
    }
  }, []);

  // Game Room hook
  const {
    room,
    gameState: rawGameState,
    myUserId: hookUserId,
    myPlayer,
    error: roomError,
    chatMessages,
    floatingReactions,
    sendChat,
    sendReaction,
    sendLeave,
    sendWebRTCSignal,
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener,
    makeChessMove,
    resignChess,
    offerChessDraw,
    respondChessDraw,
    requestChessTakeback,
    respondChessTakeback,
    startChessGame,
    updateChessConfig,
    rematch,
    rematchStatus,
    chessDrawOffer,
    chessTakebackRequest,
    lastChessMove,
    chessMoveError,
    streakCelebration,
    clearStreakCelebration
  } = useGameRoom(roomCodeParam || null);

  const gameState = rawGameState as ChessGameState | null;
  const effectiveUserId = hookUserId || session?.user?.id || '';
  const displayName = session?.user?.displayName || 'Grandmaster';

  // WebRTC Members mapped
  const webRTCMembers = useMemo(() => {
    return (room?.players || []).map(p => ({
      userId: p.userId,
      name: p.displayName,
      avatarUrl: p.avatarUrl || null,
      isHost: p.userId === room?.hostUserId
    }));
  }, [room?.players, room?.hostUserId]);

  // WebRTC Setup
  const {
    localUserStream,
    isCameraOn,
    isMicMuted,
    videoGridParticipants,
    toggleCamera,
    toggleMic
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

  // Auto create room if none supplied
  useEffect(() => {
    if (!roomCodeParam && !isCreatingRoom && session?.token) {
      setIsCreatingRoom(true);
      createGameRoom(session.token, 'chess', 2)
        .then(res => {
          router.replace(`/games/chess?room=${res.room.roomCode}`);
        })
        .catch(err => {
          console.error('Failed to create chess room:', err);
          setIsCreatingRoom(false);
        });
    }
  }, [roomCodeParam, isCreatingRoom, session?.token, router]);

  // Determine current player's color
  const myPlayerInfo = useMemo(() => {
    if (isPracticeMode) {
      return {
        userId: effectiveUserId || 'practice_player',
        displayName: `${displayName} (Solo)`,
        avatarUrl: session?.user?.avatarUrl || null,
        color: practiceTurn,
        timeRemainingMs: 600000
      };
    }
    if (!gameState) return null;
    if (effectiveUserId) {
      if (gameState.whitePlayer?.userId === effectiveUserId) return gameState.whitePlayer;
      if (gameState.blackPlayer?.userId === effectiveUserId) return gameState.blackPlayer;
    }
    // Fallback: room player seats
    if (room?.players && room.players.length > 0) {
      const idx = room.players.findIndex(p => p.userId === effectiveUserId);
      if (idx === 0) return gameState.whitePlayer;
      if (idx === 1) return gameState.blackPlayer;
    }
    return gameState.whitePlayer;
  }, [gameState, effectiveUserId, room?.players, isPracticeMode, practiceTurn, displayName, session?.user?.avatarUrl]);

  const playerColor: ChessColor = isPracticeMode ? practiceTurn : (myPlayerInfo?.color || 'w');

  // Opponent player info
  const opponentPlayerInfo = useMemo(() => {
    if (isPracticeMode) {
      return {
        userId: 'practice_pass_and_play',
        displayName: 'Pass & Play (Local)',
        avatarUrl: null,
        color: (practiceTurn === 'w' ? 'b' : 'w') as ChessColor,
        timeRemainingMs: 600000
      };
    }
    if (!gameState) return null;
    if (effectiveUserId) {
      if (gameState.whitePlayer?.userId !== effectiveUserId) return gameState.whitePlayer;
      if (gameState.blackPlayer?.userId !== effectiveUserId) return gameState.blackPlayer;
    }
    return playerColor === 'w' ? gameState.blackPlayer : gameState.whitePlayer;
  }, [gameState, effectiveUserId, playerColor, isPracticeMode, practiceTurn]);

  // White and Black players for presentation
  const whitePlayer = gameState?.whitePlayer || null;
  const blackPlayer = gameState?.blackPlayer || null;

  // Board Flip Orientation state
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  useEffect(() => {
    if (!isPracticeMode) {
      setIsFlipped(playerColor === 'b');
    }
  }, [playerColor, isPracticeMode]);

  // Handle move emission (Practice vs Multiplayer)
  const handleMove = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    if (isPracticeMode) {
      try {
        const c = new Chess(practiceFen);
        const res = c.move({ from: from as any, to: to as any, promotion: promotion || 'q' });
        if (res) {
          const nextFen = c.fen();
          setPracticeFen(nextFen);
          const nextTurn = c.turn() as ChessColor;
          setPracticeTurn(nextTurn);
          setPracticeLastMove({ from, to });
          setPracticeCheck(c.inCheck());
          setPracticeCheckmate(c.isCheckmate());

          if (c.inCheck()) {
            const board = c.board();
            for (let r = 0; r < 8; r++) {
              for (let f = 0; f < 8; f++) {
                const sq = board[r][f];
                if (sq && sq.type === 'k' && sq.color === nextTurn) {
                  setPracticeCheckSquare(`${['a','b','c','d','e','f','g','h'][f]}${8 - r}`);
                }
              }
            }
          } else {
            setPracticeCheckSquare(undefined);
          }
        }
      } catch (err) {
        console.error('Solo practice move error:', err);
      }
      return;
    }
    makeChessMove(from, to, promotion);
  };

  // Handle quick reactions
  const handleSendReaction = (emoji: string) => {
    sendReaction(emoji);
  };

  // Handle chat submission
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    sendChat(chatMessage.trim());
    setChatMessage('');
  };

  // Leave game handler
  const handleLeave = () => {
    sendLeave();
    router.push('/games');
  };

  // State for celebration poppers and delayed rematch modal
  const [showPartyPoppers, setShowPartyPoppers] = useState(false);
  const [showDelayedWinModal, setShowDelayedWinModal] = useState(false);

  // Active or Finished Game State (Declared before any early returns)
  const isGameOver = Boolean(
    !isPracticeMode &&
      gameState?.status &&
      ['CHECKMATE', 'DRAW', 'STALEMATE', 'TIMEOUT', 'RESIGNED', 'ABANDONED', 'COMPLETED'].includes(gameState.status) &&
      !rematchStatus?.allVoted
  );

  const currentGameId = gameState?.gameId || '';

  // Reset celebration & win modal when game restarts, gameId changes, or rematch is agreed
  useEffect(() => {
    if (gameState?.status === 'ACTIVE' || gameState?.status === 'CHECK' || rematchStatus?.allVoted) {
      setRematchRequested(false);
      setShowDelayedWinModal(false);
      setShowPartyPoppers(false);
    }
  }, [gameState?.status, currentGameId, rematchStatus?.allVoted]);

  // Handle game end poppers and 3-second delayed rematch modal
  useEffect(() => {
    if (isGameOver) {
      setShowPartyPoppers(true);
      const timer = setTimeout(() => {
        setShowDelayedWinModal(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowPartyPoppers(false);
      setShowDelayedWinModal(false);
    }
  }, [isGameOver, currentGameId]);

  // Rematch action
  const handleRematch = () => {
    if (isPracticeMode) {
      setPracticeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      setPracticeTurn('w');
      setPracticeCheck(false);
      setPracticeCheckSquare(undefined);
      setPracticeCheckmate(false);
      setPracticeLastMove(null);
      setShowDelayedWinModal(false);
      setShowPartyPoppers(false);
      return;
    }
    setRematchRequested(true);
    rematch();
  };

  // If loading
  if (!room) {
    return (
      <div className="min-h-screen bg-[#07070b] flex flex-col items-center justify-center text-white select-none">
        <div className="w-12 h-12 rounded-2xl border-2 border-amber-500 border-t-transparent animate-spin mb-4" />
        <span className="text-sm font-bold text-zinc-400">Loading Chess Arena...</span>
      </div>
    );
  }

  // Waiting Room state (before game starts)
  const isLobby = !isPracticeMode && (room.status === 'WAITING' || gameState?.status === 'WAITING' || !gameState);
  if (isLobby) {
    const isHost = room.hostUserId === effectiveUserId;
    const chessSettingsNode = (
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-400 mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#ff2b70]" />
            <span>Time Control Preset</span>
          </h4>
          {!isHost && (
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mb-2">
              Only the room host can change the time control.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'rapid-10-5', label: '10 min + 5s', desc: 'Rapid' },
                { id: 'blitz-3-2', label: '3 min + 2s', desc: 'Blitz' },
                { id: 'bullet-1-0', label: '1 min', desc: 'Bullet' },
                { id: 'classical-30-0', label: '30 min', desc: 'Classical' }
              ] as const
            ).map(preset => {
              const isSelected = chessConfig.presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={!isHost}
                  onClick={() => {
                    const presetDef = (CHESS_TIME_PRESETS as any)[preset.id];
                    if (!presetDef) return;
                    const newCfg: ChessGameConfig = {
                      ...chessConfig,
                      presetId: preset.id,
                      baseTimeMs: presetDef.baseTimeMs,
                      incrementMs: presetDef.incrementMs
                    };
                    setChessConfig(newCfg);
                    updateChessConfig(newCfg);
                  }}
                  className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'bg-pink-50 dark:bg-pink-950/40 border-pink-400 dark:border-pink-500/80 text-[#ff2b70] ring-1 ring-pink-400/50'
                      : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:bg-slate-100'
                  } ${!isHost ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <span className="text-xs font-bold leading-tight">{preset.label}</span>
                  <span className="text-[10px] opacity-75 uppercase tracking-wide mt-0.5">{preset.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );

    return (
      <UnifiedGameWaitingRoom
        gameType="chess"
        room={room}
        myUserId={effectiveUserId}
        gameState={gameState}
        chatMessages={chatMessages}
        isMicMuted={isMicMuted}
        isCameraOn={isCameraOn}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onSendChat={sendChat}
        onSendReaction={sendReaction}
        onStartGame={() => startChessGame(chessConfig)}
        onUpdateConfig={cfg => {
          setChessConfig(cfg);
          updateChessConfig(cfg);
        }}
        onLeave={handleLeave}
        customSettingsComponent={chessSettingsNode}
      />
    );
  }

  // Active or Finished Game View
  const isMyTurn = gameState?.turn === playerColor;

  return (
    <div
      className="relative h-screen overflow-hidden text-white flex flex-col select-none font-sans"
      style={{ backgroundImage: 'url(/images/chess-cozy-workspace.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 z-0 bg-[#16132b]/65 backdrop-blur-[1px]" />

      {/* Top Header */}
      <ChessHeader
        roomCode={room.roomCode}
        playerCount={room.players?.length || 2}
        isMicMuted={isMicMuted}
        isCameraOn={isCameraOn}
        isChatOpen={showChatPanel}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onToggleChat={() => setShowChatPanel(prev => !prev)}
        onOpenInfo={() => setShowInfoPanel(prev => !prev)}
        isInfoOpen={showInfoPanel}
        onOpenSettings={() => {}}
        onLeave={handleLeave}
        isCallClosed={isCallClosed}
        onOpenCall={() => setIsCallClosed(false)}
        chatCount={chatMessages.length}
      />

      {/* Main Game Layout (fills remaining viewport height, no scroll, with top space) */}
      <main className="relative z-10 flex-1 min-h-0 max-w-[1530px] w-full mx-auto px-3 sm:px-5 lg:px-6 pt-3 sm:pt-4 pb-3 sm:pb-4 flex flex-col">
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_300px] xl:grid-cols-[300px_minmax(0,1fr)_320px] items-stretch gap-3 lg:gap-5 w-full">

          {/* Left Column: Branding + Game Actions */}
          <div className="min-h-0 overflow-y-auto overflow-x-hidden hidden lg:block">
            <ChessLeftPanel
              onOfferDraw={() => offerChessDraw()}
              onRequestTakeback={() => requestChessTakeback()}
              onResign={() => setShowResignModal(true)}
              isDrawDisabled={isGameOver || !isMyTurn}
              isTakebackDisabled={isGameOver || (gameState?.moves?.length || 0) === 0}
              isResignDisabled={isGameOver}
            />
          </div>

          {/* Center Column: Turn Banner + ChessBoard + Controls */}
          <div className="min-h-0 flex flex-col items-center justify-start max-w-[620px] mx-auto w-full overflow-y-auto overflow-x-hidden">
            
            {/* Turn Status Banner + Flip Board (Single Black Glass Row) */}
            <div className="w-full mb-2 p-3 rounded-[20px] flex items-center justify-between border border-white/15 bg-[#120f1d]/90 text-white backdrop-blur-md shadow-lg shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-3 h-3 rounded-full shrink-0 ${
                  isGameOver
                    ? 'bg-white/50'
                    : isPracticeMode
                      ? 'bg-purple-400'
                      : isMyTurn
                        ? 'bg-[#ff2b70] animate-pulse'
                        : 'bg-amber-400 animate-ping'
                }`} />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black tracking-tight flex items-center gap-1.5 truncate">
                    {isGameOver ? (
                      <span>Match Over · {gameState?.winnerReason || 'Completed'}</span>
                    ) : isPracticeMode ? (
                      <span>Solo Practice · {practiceTurn === 'w' ? 'White' : 'Black'} to Move</span>
                    ) : isMyTurn ? (
                      <span>👑 Your Turn — Move {playerColor === 'w' ? 'White' : 'Black'} Pieces</span>
                    ) : (
                      <span>⏳ Opponent&apos;s Turn — {gameState?.turn === 'w' ? 'White' : 'Black'} is thinking...</span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/50 mt-0.5 truncate">
                    {isGameOver ? (
                      'Review moves or request a rematch'
                    ) : isPracticeMode ? (
                      'Free play mode. Click any piece to play.'
                    ) : isMyTurn ? (
                      'Click a piece to show legal moves, then click target square.'
                    ) : (
                      'The board will unlock automatically once your opponent moves.'
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Flip Board Button */}
              <div className="flex items-center gap-2 shrink-0">
                {isPracticeMode && (
                  <button
                    type="button"
                    onClick={() => setShowFriendDrawer(true)}
                    className="hidden sm:inline-flex px-2.5 py-1 rounded-xl bg-[#ff2b70] hover:bg-[#e11d48] text-[11px] font-bold text-white transition shadow-xs cursor-pointer"
                  >
                    Invite
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFlipped(prev => !prev)}
                  className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  title="Flip Board Perspective"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#ff2b70]" />
                  <span>Flip Board ({isFlipped ? 'Black' : 'White'})</span>
                </button>
              </div>
            </div>

            {/* Chess Error Toast */}
            {chessMoveError && (
              <div className="w-full mb-2 p-2.5 rounded-xl bg-rose-900/50 border border-rose-400/40 text-rose-200 text-xs font-bold flex items-center gap-2 shrink-0">
                <span>⚠️</span>
                <span>{chessMoveError}</span>
              </div>
            )}

            {/* Mobile Top Player Bar (lg:hidden) */}
            <div className="w-full lg:hidden mb-2 p-2.5 rounded-2xl bg-white dark:bg-[#191527] border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#ff2b70]/20 flex items-center justify-center font-bold text-xs text-[#ff2b70]">
                  {((isFlipped ? whitePlayer : blackPlayer)?.displayName?.[0] || (isFlipped ? 'W' : 'B')).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block truncate">
                    {isFlipped ? 'White' : 'Black'}
                  </span>
                  <span className="text-xs font-black text-slate-900 dark:text-white truncate block max-w-[120px]">
                    {(isFlipped ? whitePlayer : blackPlayer)?.displayName || (isPracticeMode ? (isFlipped ? 'White' : 'Black') : 'Waiting...')}
                  </span>
                </div>
              </div>
              <div className={`px-2 py-1 rounded-lg font-mono font-bold text-xs ${
                (isFlipped ? gameState?.turn === 'w' : gameState?.turn === 'b')
                  ? 'bg-[#ff2b70] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300'
              }`}>
                {((isFlipped ? whitePlayer : blackPlayer)?.timeRemainingMs !== undefined) ? `${Math.floor(((isFlipped ? whitePlayer : blackPlayer)?.timeRemainingMs || 600000) / 60000)}:${Math.floor((((isFlipped ? whitePlayer : blackPlayer)?.timeRemainingMs || 600000) % 60000) / 1000).toString().padStart(2, '0')}` : '10:00'}
              </div>
            </div>

            {/* Chessboard Hero */}
            {(gameState || isPracticeMode) && (
              <ChessBoard
                fen={isPracticeMode ? practiceFen : gameState!.fen}
                turn={isPracticeMode ? practiceTurn : gameState!.turn}
                playerColor={playerColor}
                inCheck={isPracticeMode ? practiceCheck : gameState!.inCheck}
                checkSquare={isPracticeMode ? practiceCheckSquare : gameState!.checkSquare}
                lastMove={isPracticeMode ? practiceLastMove : (lastChessMove ? { from: lastChessMove.from, to: lastChessMove.to } : null)}
                onMove={handleMove}
                disabled={isGameOver || !isMyTurn}
                isCheckmate={isPracticeMode ? practiceCheckmate : (gameState?.status === 'CHECKMATE')}
                theme={boardTheme}
                isPracticeMode={isPracticeMode}
                showHints={showHints}
                isFlipped={isFlipped}
              />
            )}

            {/* Mobile Bottom Player & Actions Bar (lg:hidden) */}
            <div className="w-full lg:hidden mt-2 space-y-2">
              <div className="p-2.5 rounded-2xl bg-white dark:bg-[#191527] border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#ff2b70]/20 flex items-center justify-center font-bold text-xs text-[#ff2b70]">
                    {((isFlipped ? blackPlayer : whitePlayer)?.displayName?.[0] || (isFlipped ? 'B' : 'W')).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block truncate">
                      {isFlipped ? 'Black' : 'White'} (You)
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate block max-w-[120px]">
                      {(isFlipped ? blackPlayer : whitePlayer)?.displayName || displayName}
                    </span>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-lg font-mono font-bold text-xs ${
                  (isFlipped ? gameState?.turn === 'b' : gameState?.turn === 'w')
                    ? 'bg-[#ff2b70] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300'
                }`}>
                  {((isFlipped ? blackPlayer : whitePlayer)?.timeRemainingMs !== undefined) ? `${Math.floor(((isFlipped ? blackPlayer : whitePlayer)?.timeRemainingMs || 600000) / 60000)}:${Math.floor((((isFlipped ? blackPlayer : whitePlayer)?.timeRemainingMs || 600000) % 60000) / 1000).toString().padStart(2, '0')}` : '10:00'}
                </div>
              </div>

              {/* Mobile Quick Action Buttons */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => offerChessDraw()}
                  disabled={isGameOver || !isMyTurn}
                  className="py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 font-bold text-xs text-center disabled:opacity-40 transition cursor-pointer"
                >
                  🤝 Draw
                </button>
                <button
                  type="button"
                  onClick={() => requestChessTakeback()}
                  disabled={isGameOver || (gameState?.moves?.length || 0) === 0}
                  className="py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 font-bold text-xs text-center disabled:opacity-40 transition cursor-pointer"
                >
                  ↩️ Takeback
                </button>
                <button
                  type="button"
                  onClick={() => setShowResignModal(true)}
                  disabled={isGameOver}
                  className="py-2 px-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-xs text-center disabled:opacity-40 transition cursor-pointer"
                >
                  🏳️ Resign
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Players Panel & Board Controls */}
          <div className="min-h-0 overflow-y-auto overflow-x-hidden hidden lg:block">
            <ChessPlayersPanel
              whitePlayer={
                isPracticeMode
                  ? {
                      userId: 'practice_w',
                      displayName: `${displayName} (White)`,
                      avatarUrl: session?.user?.avatarUrl || null,
                      color: 'w',
                      timeRemainingMs: 600000
                    }
                  : whitePlayer
              }
              blackPlayer={
                isPracticeMode
                  ? {
                      userId: 'practice_b',
                      displayName: 'Solo Black',
                      avatarUrl: null,
                      color: 'b',
                      timeRemainingMs: 600000
                    }
                  : blackPlayer
              }
              turn={isPracticeMode ? practiceTurn : (gameState?.turn || 'w')}
              myUserId={effectiveUserId}
              showHints={showHints}
              onToggleHints={setShowHints}
              onSendReaction={handleSendReaction}
              isGameOver={isGameOver}
              onReview={() => setShowReviewModal(true)}
            />
          </div>

        </div>
      </main>

      {/* Slide-over Game Info Drawer */}
      <ChessInfoDrawer
        isOpen={showInfoPanel}
        onClose={() => setShowInfoPanel(false)}
        roomCode={room.roomCode}
        timeControl={chessConfig?.presetId ? `${chessConfig.presetId}` : '10 min'}
        increment={`${Math.floor((chessConfig?.incrementMs || 0) / 1000)} sec`}
        gameType="Casual"
        moves={gameState?.moves || []}
      />

      {/* Floating Moveable & Rotatable Video Call PIP Window */}
      <ChessCallingModal
        videoGridParticipants={videoGridParticipants}
        isMicMuted={isMicMuted}
        isCameraOn={isCameraOn}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onToggleChat={() => setShowChatPanel(prev => !prev)}
        isChatOpen={showChatPanel}
        isOpen={!isCallClosed}
        onClose={() => setIsCallClosed(true)}
      />

      {/* Slide-over Match Chat Drawer */}
      <ChessChatDrawer
        isOpen={showChatPanel}
        onClose={() => setShowChatPanel(false)}
        messages={chatMessages}
        myUserId={effectiveUserId}
        onSendMessage={text => sendChat(text)}
        onSendReaction={handleSendReaction}
      />


      {/* Floating Reactions Overlay */}
      {floatingReactions && floatingReactions.map(r => (
        <div
          key={r.id}
          className="fixed pointer-events-none z-50 text-3xl animate-bounce"
          style={{
            bottom: '20%',
            left: `${25 + Math.random() * 50}%`,
            transition: 'all 2s ease-out'
          }}
        >
          {r.emoji}
        </div>
      ))}

      {/* WebRTC Video Feeds for In-Call Avatars */}
      {videoGridParticipants && videoGridParticipants.filter(p => !p.isSelf && p.stream).map(p => (
        <div key={p.userId} className="hidden">
          {p.stream && <RemoteAudioPlayer stream={p.stream} />}
        </div>
      ))}

      {/* Resign Modal */}
      <ChessResignModal
        isOpen={showResignModal}
        onConfirm={() => {
          resignChess();
          setShowResignModal(false);
        }}
        onCancel={() => setShowResignModal(false)}
      />

      {/* Draw Offer Modal */}
      {chessDrawOffer && (
        <ChessDrawOfferModal
          isOpen={true}
          fromDisplayName={chessDrawOffer.fromDisplayName || 'Opponent'}
          onAccept={() => respondChessDraw(true)}
          onDecline={() => respondChessDraw(false)}
        />
      )}

      {/* Takeback Request Modal */}
      {chessTakebackRequest && (
        <ChessTakebackModal
          isOpen={true}
          fromDisplayName={chessTakebackRequest.fromDisplayName || 'Opponent'}
          onAccept={() => respondChessTakeback(true)}
          onDecline={() => respondChessTakeback(false)}
        />
      )}

      {/* 1. Grand Party Poppers Celebration (Fires Immediately inside Game) */}
      {showPartyPoppers && <PartyPoppers />}

      {/* Game End Modal (Appears After 3s Delay) */}
      {isGameOver && showDelayedWinModal && gameState && (
        <ChessGameEnd
          gameState={gameState}
          myUserId={effectiveUserId}
          onRematch={handleRematch}
          onReview={() => setShowReviewModal(true)}
          onLeave={handleLeave}
          rematchRequested={rematchRequested}
          rematchStatus={rematchStatus}
        />
      )}

      {/* Review Modal */}
      {showReviewModal && gameState && (
        <ChessReview
          gameState={gameState}
          onClose={() => setShowReviewModal(false)}
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

export default function ChessGamePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07070b] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent animate-spin rounded-full" />
      </div>
    }>
      <ChessGameContent />
    </Suspense>
  );
}
