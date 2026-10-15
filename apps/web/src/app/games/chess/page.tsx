'use client';

import { ReactionGlyph } from '../../../components/ui/ReactionGlyph';
import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { AppIcon } from '../../../components/ui/AppIcon';
import { useRouter, useSearchParams } from 'next/navigation';
import { SpectatorBanner } from '../../../components/games/common/SpectatorBanner';
import { TournamentMatchBanner } from '../../../components/games/common/TournamentMatchBanner';
import { NewGameWithOpponent } from '../../../components/games/common/NewGameWithOpponent';
import { isSpectateRequested } from '../../../lib/spectator';
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
import { interpolateChessClocks, isChessClockRunning, formatChessClockMs } from '../../../lib/chessClock';
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
  const spectateMode = isSpectateRequested(searchParams.get('spectate'));

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [session, setSession] = useState<UserSession | null>(null);
  const [showResignModal, setShowResignModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [chessConfig, setChessConfig] = useState<ChessGameConfig>(DEFAULT_CHESS_CONFIG);
  const [rematchRequested, setRematchRequested] = useState(false);

  // Chat bar state
  const [chatMessage, setChatMessage] = useState('');
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  const [boardTheme, setBoardTheme] = useState<'wood' | 'slate' | 'charcoal'>('wood');
  const [showHints, setShowHints] = useState<boolean>(true);
  const [isCallClosed, setIsCallClosed] = useState<boolean>(true);

  // Auto-close call PIP on mobile screen so board is clear, keep open on large desktop
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsCallClosed(window.innerWidth < 1024);
    }
  }, []);

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
    chessMoveError,
    clearChessMoveError,
    gameActionError,
    clearGameActionError,
    streakCelebration,
    clearStreakCelebration,
    isSpectator,
    spectatorCount,
    spectators,
    rematchUnavailable
  } = useGameRoom(roomCodeParam || null, undefined, { spectate: spectateMode });

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
    if (!gameState || isSpectator) return null;
    if (effectiveUserId) {
      if (gameState.whitePlayer?.userId === effectiveUserId) return gameState.whitePlayer;
      if (gameState.blackPlayer?.userId === effectiveUserId) return gameState.blackPlayer;
    }
    // Not seated: never treated as White.
    return null;
  }, [gameState, effectiveUserId, isSpectator]);

  // Spectator = server role (read-only); never derived locally.
  const playerColor: ChessColor = myPlayerInfo?.color || 'w';

  // Opponent player info
  const opponentPlayerInfo = useMemo(() => {
    if (!gameState || isSpectator) return null;
    if (effectiveUserId) {
      if (gameState.whitePlayer?.userId !== effectiveUserId) return gameState.whitePlayer;
      if (gameState.blackPlayer?.userId !== effectiveUserId) return gameState.blackPlayer;
    }
    return playerColor === 'w' ? gameState.blackPlayer : gameState.whitePlayer;
  }, [gameState, effectiveUserId, playerColor, isSpectator]);

  // White and Black players for presentation
  const whitePlayerRaw = gameState?.whitePlayer || null;
  const blackPlayerRaw = gameState?.blackPlayer || null;

  // Board Flip Orientation state
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  // Server-authoritative clocks: re-base on every server value, interpolate visually only.
  const clockBaseRef = useRef({ whiteMs: 0, blackMs: 0, turn: 'w' as ChessColor, at: 0 });
  const [clockNow, setClockNow] = useState<number>(0);
  const srvWhiteMs = gameState?.whitePlayer?.timeRemainingMs ?? 0;
  const srvBlackMs = gameState?.blackPlayer?.timeRemainingMs ?? 0;
  const srvTurn = (gameState?.turn || 'w') as ChessColor;
  const srvStatus = gameState?.status;
  const srvMoveCount = gameState?.moves?.length || 0;
  const clockRunning = isChessClockRunning(srvStatus, srvTurn, srvMoveCount);
  clockBaseRef.current = (() => {
    const b = clockBaseRef.current;
    if (b.whiteMs !== srvWhiteMs || b.blackMs !== srvBlackMs || b.turn !== srvTurn || b.at === 0) {
      return { whiteMs: srvWhiteMs, blackMs: srvBlackMs, turn: srvTurn, at: Date.now() };
    }
    return b;
  })();
  useEffect(() => {
    if (!clockRunning) return;
    const id = setInterval(() => setClockNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [clockRunning]);
  const liveClocks = interpolateChessClocks(
    clockBaseRef.current,
    (clockNow || Date.now()) - clockBaseRef.current.at,
    clockRunning
  );
  const whiteDisplay = whitePlayerRaw ? { ...whitePlayerRaw, timeRemainingMs: liveClocks.whiteMs } : null;
  const blackDisplay = blackPlayerRaw ? { ...blackPlayerRaw, timeRemainingMs: liveClocks.blackMs } : null;

  const whitePlayer = whiteDisplay;
  const blackPlayer = blackDisplay;

  // Show server errors (rejected moves / actions) briefly
  useEffect(() => {
    if (!gameActionError) return;
    const t = setTimeout(() => clearGameActionError(), 5000);
    return () => clearTimeout(t);
  }, [gameActionError, clearGameActionError]);
  useEffect(() => {
    if (!chessMoveError) return;
    const t = setTimeout(() => clearChessMoveError(), 5000);
    return () => clearTimeout(t);
  }, [chessMoveError, clearChessMoveError]);

  useEffect(() => {
    setIsFlipped(playerColor === 'b');
  }, [playerColor]);

  // Handle move emission (spectators never move)
  const handleMove = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    if (isSpectator) return;
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
    if (isSpectator) return;
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
  // Spectators never see the waiting room (the server only admits them to a started game).
  const isLobby = !isSpectator && (room.status === 'WAITING' || gameState?.status === 'WAITING' || !gameState);
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
                    const presetDef = CHESS_TIME_PRESETS.find(pr => pr.id === preset.id);
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
  const isMyTurn = !isSpectator && gameState?.turn === playerColor;
  const cfg = gameState?.config;
  const allowDraw = cfg?.allowDrawOffers !== false;
  const allowTakeback = cfg?.allowTakeback !== false;
  const drawPending = !!gameState?.drawOfferFrom;
  const takebackPending = !!gameState?.takebackRequestFrom;
  const nameOf = (uid: string | null | undefined) =>
    gameState?.whitePlayer?.userId === uid ? gameState?.whitePlayer?.displayName : gameState?.blackPlayer?.displayName;
  // Offers come from authoritative game state; the offerer never gets Accept/Decline.
  const incomingDrawFrom =
    !isGameOver && !isSpectator && gameState?.drawOfferFrom && gameState.drawOfferFrom !== effectiveUserId
      ? gameState.drawOfferFrom
      : null;
  const incomingTakebackFrom =
    !isGameOver && !isSpectator && gameState?.takebackRequestFrom && gameState.takebackRequestFrom !== effectiveUserId
      ? gameState.takebackRequestFrom
      : null;
  const drawDisabled = isGameOver || isSpectator || !allowDraw || drawPending;
  const takebackDisabled = isGameOver || isSpectator || !allowTakeback || takebackPending || (gameState?.moves?.length || 0) === 0;
  const resignDisabled = isGameOver || isSpectator;
  const shownError = chessMoveError || gameActionError?.message || null;
  const opponentLeftRoom = !isSpectator && room.players.some(p => p.userId !== effectiveUserId && (p.status as string) === 'LEFT');
  const showNewGame = !isSpectator && (opponentLeftRoom || rematchUnavailable);
  const chessOpponent = room.players.find(p => p.userId !== effectiveUserId) || null;
  const spectatorStatus = isGameOver
    ? (gameState?.winnerReason || 'Game over')
    : `${gameState?.turn === 'w' ? 'White' : 'Black'} to move`;

  return (
    <div
      className="relative min-h-[100dvh] h-[100dvh] w-full max-w-full overflow-hidden text-white flex flex-col select-none font-sans"
      style={{ backgroundImage: 'url(/images/chess-cozy-workspace.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 z-0 bg-[#16132b]/65 backdrop-blur-[1px]" />

      {/* Top Header */}
      <ChessHeader
        roomCode={room.roomCode}
        playerCount={room.players?.length || 2}
        isSpectator={isSpectator}
        isMicMuted={isMicMuted}
        isCameraOn={isCameraOn}
        isChatOpen={showChatPanel}
        onToggleMic={toggleMic}
        onToggleCamera={() => {
          void toggleCamera();
          if (!isCameraOn) {
            setIsCallClosed(false);
          }
        }}
        onToggleChat={() => setShowChatPanel(prev => !prev)}
        onOpenInfo={() => setShowInfoPanel(prev => !prev)}
        isInfoOpen={showInfoPanel}
        onOpenSettings={() => {}}
        onLeave={handleLeave}
        isCallClosed={isCallClosed}
        onToggleCall={() => setIsCallClosed(prev => !prev)}
        onOpenCall={() => setIsCallClosed(false)}
        chatCount={chatMessages.length}
      />

      {/* Main Game Layout (fills remaining viewport height, no scroll, with top space) */}
      <main className="relative z-10 flex-1 min-h-0 max-w-[1530px] w-full max-w-full mx-auto px-2 xs:px-3 sm:px-5 lg:px-6 pt-1.5 sm:pt-4 pb-2 sm:pb-4 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_300px] xl:grid-cols-[300px_minmax(0,1fr)_320px] items-stretch gap-2.5 lg:gap-5 w-full max-w-full min-w-0">

          {/* Left Column: Branding + Game Actions */}
          <div className="min-h-0 overflow-y-auto overflow-x-hidden hidden lg:block">
            {!isSpectator && <ChessLeftPanel
              onOfferDraw={() => offerChessDraw()}
              onRequestTakeback={() => requestChessTakeback()}
              onResign={() => setShowResignModal(true)}
              isDrawDisabled={drawDisabled}
              isTakebackDisabled={takebackDisabled}
              isResignDisabled={resignDisabled}
            />}
          </div>

          {/* Center Column: Turn Banner + ChessBoard + Controls */}
          <div className="min-h-0 flex flex-col items-center justify-start max-w-[620px] mx-auto w-full max-w-full min-w-0 overflow-y-auto overflow-x-hidden px-0.5">
            
            <TournamentMatchBanner room={room} className="w-full mb-1.5 sm:mb-2 shrink-0" />
            {isSpectator && (
              <SpectatorBanner
                className="w-full mb-1.5 sm:mb-2 shrink-0"
                count={spectatorCount}
                names={spectators}
                status={spectatorStatus}
                onLeave={handleLeave}
              />
            )}

            {/* Turn Status Banner + Flip Board (Single Black Glass Row) */}
            <div className="w-full mb-1.5 sm:mb-2 p-2 sm:p-3 rounded-2xl sm:rounded-[20px] flex items-center justify-between border border-white/15 bg-[#120f1d]/90 text-white backdrop-blur-md shadow-lg shrink-0 gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <span className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0 ${
                  isGameOver
                    ? 'bg-white/50'
                    : isMyTurn
                        ? 'bg-[#ff2b70] animate-pulse'
                        : 'bg-amber-400 animate-ping'
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-black tracking-tight flex items-center gap-1.5 truncate">
                    {isGameOver ? (
                      <span>Match Over · {gameState?.winnerReason || 'Completed'}</span>
                    ) : isSpectator ? (
                      <span>Watching · {gameState?.turn === 'w' ? 'White' : 'Black'} to move</span>
                    ) : isMyTurn ? (
                      <span>Your Turn — Move {playerColor === 'w' ? 'White' : 'Black'} Pieces</span>
                    ) : (
                      <span>Opponent&apos;s Turn — {gameState?.turn === 'w' ? 'White' : 'Black'} is thinking...</span>
                    )}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-white/50 mt-0.5 truncate hidden xs:block">
                    {isGameOver ? (
                      'Review moves or request a rematch'
                    ) : isSpectator ? (
                      'Read-only view. The board updates as the players move.'
                    ) : isMyTurn ? (
                      'Click a piece to show legal moves, then click target square.'
                    ) : (
                      'The board will unlock automatically once your opponent moves.'
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Flip Board Button */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFlipped(prev => !prev)}
                  className="py-1 px-2.5 sm:py-1.5 sm:px-3 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 text-[11px] sm:text-xs font-bold text-white flex items-center gap-1 sm:gap-1.5 transition cursor-pointer shadow-xs shrink-0"
                  title="Flip Board Perspective"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#ff2b70] shrink-0" />
                  <span>Flip<span className="hidden sm:inline"> Board ({isFlipped ? 'Black' : 'White'})</span></span>
                </button>
              </div>
            </div>

            {/* Chess Error Toast */}
            {shownError && (
              <div className="w-full mb-2 p-2.5 rounded-xl bg-rose-900/50 border border-rose-400/40 text-rose-200 text-xs font-bold flex items-center gap-2 shrink-0">
                <AppIcon name="warning" className="w-4 h-4" />
                <span>{shownError}</span>
              </div>
            )}

            {/* Mobile Top Player Bar (lg:hidden) */}
            <div className="w-full lg:hidden mb-1.5 sm:mb-2 p-2 sm:p-2.5 rounded-2xl bg-white dark:bg-[#191527] border border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#ff2b70]/20 flex items-center justify-center font-bold text-xs text-[#ff2b70] shrink-0">
                  {((isFlipped ? whitePlayer : blackPlayer)?.displayName?.[0] || (isFlipped ? 'W' : 'B')).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block truncate">
                    {isFlipped ? 'White' : 'Black'}
                  </span>
                  <span className="text-xs font-black text-slate-900 dark:text-white truncate block">
                    {(isFlipped ? whitePlayer : blackPlayer)?.displayName || 'Waiting...'}
                  </span>
                </div>
              </div>
              <div className={`px-2 py-1 rounded-lg font-mono font-bold text-xs shrink-0 ${
                (isFlipped ? gameState?.turn === 'w' : gameState?.turn === 'b')
                  ? 'bg-[#ff2b70] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300'
              }`}>
                {formatChessClockMs((isFlipped ? whitePlayer : blackPlayer)?.timeRemainingMs)}
              </div>
            </div>

            {/* Chessboard Hero */}
            {gameState && (
              <ChessBoard
                fen={gameState.fen}
                turn={gameState.turn}
                playerColor={playerColor}
                inCheck={gameState.inCheck}
                checkSquare={gameState.checkSquare}
                lastMove={gameState.lastMove ? { from: gameState.lastMove.from, to: gameState.lastMove.to } : null}
                onMove={handleMove}
                disabled={isGameOver || !isMyTurn || isSpectator}
                isCheckmate={gameState.status === 'CHECKMATE'}
                theme={boardTheme}
                isSpectator={isSpectator}
                showHints={showHints}
                isFlipped={isFlipped}
              />
            )}

            {/* Mobile Bottom Player & Actions Bar (lg:hidden) */}
            <div className="w-full lg:hidden mt-1.5 sm:mt-2 space-y-1.5 sm:space-y-2 shrink-0">
              <div className="p-2 sm:p-2.5 rounded-2xl bg-white dark:bg-[#191527] border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#ff2b70]/20 flex items-center justify-center font-bold text-xs text-[#ff2b70] shrink-0">
                    {((isFlipped ? blackPlayer : whitePlayer)?.displayName?.[0] || (isFlipped ? 'B' : 'W')).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block truncate">
                      {isFlipped ? 'Black' : 'White'}{!isSpectator && (isFlipped ? 'b' : 'w') === playerColor ? ' (You)' : ''}
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate block">
                      {(isFlipped ? blackPlayer : whitePlayer)?.displayName || 'Waiting...'}
                    </span>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-lg font-mono font-bold text-xs shrink-0 ${
                  (isFlipped ? gameState?.turn === 'b' : gameState?.turn === 'w')
                    ? 'bg-[#ff2b70] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300'
                }`}>
                  {formatChessClockMs((isFlipped ? blackPlayer : whitePlayer)?.timeRemainingMs)}
                </div>
              </div>

              {/* Mobile Quick Action Buttons (hidden for spectators) */}
              <div className={`grid grid-cols-3 gap-1.5 sm:gap-2 pt-0.5 ${isSpectator ? 'hidden' : ''}`}>
                <button
                  type="button"
                  onClick={() => offerChessDraw()}
                  disabled={drawDisabled}
                  className="py-1.5 sm:py-2 px-1 sm:px-2.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 font-bold text-[11px] sm:text-xs text-center disabled:opacity-40 transition cursor-pointer truncate"
                >
                  Draw
                </button>
                <button
                  type="button"
                  onClick={() => requestChessTakeback()}
                  disabled={takebackDisabled}
                  className="py-1.5 sm:py-2 px-1 sm:px-2.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 font-bold text-[11px] sm:text-xs text-center disabled:opacity-40 transition cursor-pointer truncate"
                >
                  <Undo2 className="w-3 h-3 inline mr-1" />Takeback
                </button>
                <button
                  type="button"
                  onClick={() => setShowResignModal(true)}
                  disabled={resignDisabled}
                  className="py-1.5 sm:py-2 px-1 sm:px-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-[11px] sm:text-xs text-center disabled:opacity-40 transition cursor-pointer truncate"
                >
                  Resign
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Players Panel & Board Controls */}
          <div className="min-h-0 overflow-y-auto overflow-x-hidden hidden lg:block">
            <ChessPlayersPanel
              whitePlayer={whitePlayer}
              blackPlayer={blackPlayer}
              turn={gameState?.turn || 'w'}
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
        timeControl={`${Math.round(((gameState?.config?.baseTimeMs ?? chessConfig?.baseTimeMs ?? 600000)) / 60000)} min`}
        increment={`${Math.floor(((gameState?.config?.incrementMs ?? chessConfig?.incrementMs ?? 0)) / 1000)} sec`}
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
        readOnly={isSpectator}
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
          <ReactionGlyph value={r.emoji} />
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
      {incomingDrawFrom && (
        <ChessDrawOfferModal
          isOpen={true}
          fromDisplayName={nameOf(incomingDrawFrom) || chessDrawOffer?.fromDisplayName || 'Opponent'}
          onAccept={() => respondChessDraw(true)}
          onDecline={() => respondChessDraw(false)}
        />
      )}

      {/* Takeback Request Modal */}
      {incomingTakebackFrom && (
        <ChessTakebackModal
          isOpen={true}
          fromDisplayName={nameOf(incomingTakebackFrom) || chessTakebackRequest?.fromDisplayName || 'Opponent'}
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
          isSpectator={isSpectator}
          rematchUnavailable={showNewGame}
          newGameSlot={showNewGame ? (
            <NewGameWithOpponent
              gameType="chess"
              opponentUserId={chessOpponent?.userId}
              opponentName={chessOpponent?.displayName}
              className="w-full py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-amber-500/30 cursor-pointer active:scale-95"
            />
          ) : undefined}
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
