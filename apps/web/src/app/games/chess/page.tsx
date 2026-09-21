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
import { ChessGameEnd } from '../../../components/games/chess/ChessGameEnd';
import { ChessReview } from '../../../components/games/chess/ChessReview';
import { ChessMoveHistory } from '../../../components/games/chess/ChessMoveHistory';
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
  ChessColor
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
  const [boardTheme, setBoardTheme] = useState<'wood' | 'slate' | 'charcoal'>('wood');

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
    chessMoveError
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

  // Rematch action
  const handleRematch = () => {
    setRematchRequested(true);
    rematch();
  };

  // Reset rematch state when game starts anew
  useEffect(() => {
    if (gameState?.status === 'ACTIVE' || gameState?.status === 'CHECK') {
      setRematchRequested(false);
    }
  }, [gameState?.status]);

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
    return (
      <>
        <ChessWaitingRoom
          room={room}
          myUserId={effectiveUserId}
          config={chessConfig}
          onStartGame={() => startChessGame(chessConfig)}
          onUpdateConfig={cfg => {
            setChessConfig(cfg);
            updateChessConfig(cfg);
          }}
          onLeave={handleLeave}
          onInviteFriend={() => setShowFriendDrawer(true)}
          onStartPractice={() => {
            setIsPracticeMode(true);
            setPracticeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
            setPracticeTurn('w');
            setPracticeLastMove(null);
            setPracticeCheck(false);
            setPracticeCheckSquare(undefined);
            setPracticeCheckmate(false);
          }}
          onRematch={handleRematch}
          rematchStatus={rematchStatus}
        />

        <GameFriendSelectorDrawer
          isOpen={showFriendDrawer}
          onClose={() => setShowFriendDrawer(false)}
          token={session?.token}
          gameTitle="Chess"
          onSelectFriend={() => setShowFriendDrawer(false)}
        />
      </>
    );
  }

  // Active or Finished Game View
  const isGameOver = gameState?.status && ['CHECKMATE', 'DRAW', 'STALEMATE', 'TIMEOUT', 'RESIGNED', 'ABANDONED', 'COMPLETED'].includes(gameState.status);
  const isMyTurn = gameState?.turn === playerColor;

  return (
    <div className="relative min-h-screen bg-[#08070d] text-white flex flex-col select-none font-sans overflow-x-hidden">
      
      {/* Background ambient lighting */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[160px]" />
      </div>

      {/* Top Header */}
      <header className="relative z-20 h-14 sm:h-16 border-b border-white/10 px-3 sm:px-6 flex items-center justify-between bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleLeave}
            className="flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-bold transition border border-white/10 active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Leave</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
            <span className="text-amber-400 text-sm">♟</span>
            <span className="text-white font-extrabold tracking-wide">Chess</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400 font-mono">{room.roomCode}</span>
          </div>
        </div>

        {/* Video / Audio Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={toggleCamera}
            className={`p-2 sm:p-2.5 rounded-xl border transition cursor-pointer active:scale-95 ${
              isCameraOn
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
            }`}
            title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
          >
            {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={toggleMic}
            className={`p-2 sm:p-2.5 rounded-xl border transition cursor-pointer active:scale-95 ${
              !isMicMuted
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
            }`}
            title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setShowChatPanel(prev => !prev)}
            className={`p-2 sm:p-2.5 rounded-xl border transition cursor-pointer active:scale-95 ${
              showChatPanel
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
            }`}
            title="Toggle Match Chat"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Game Layout */}
      <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center p-2 sm:p-4 md:p-6 gap-4 sm:gap-6 max-w-7xl mx-auto w-full">
        
        {/* Left Side (Opponent Card & Left Controls) */}
        <div className="w-full lg:w-72 flex flex-row lg:flex-col justify-between items-center lg:items-stretch gap-3 order-1 lg:order-1">
          {/* Opponent Player Card */}
          <div className="w-full">
            {opponentPlayerInfo && gameState && (
              <ChessPlayerCard
                player={opponentPlayerInfo}
                isCurrentTurn={gameState.turn === opponentPlayerInfo.color}
                isMe={false}
                capturedPieces={gameState.capturedPieces?.[opponentPlayerInfo.color === 'w' ? 'white' : 'black'] || []}
                opponentCapturedPieces={gameState.capturedPieces?.[playerColor === 'w' ? 'white' : 'black'] || []}
              />
            )}
          </div>

          {/* Quick Actions (Resign, Draw, Takeback) */}
          {!isGameOver && (
            <div className="hidden lg:flex flex-col gap-2 p-3 bg-[#110f1c]/80 border border-white/10 rounded-2xl">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider px-1">
                Match Actions
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => offerChessDraw()}
                  disabled={!isMyTurn}
                  className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 border border-white/10 text-xs font-bold text-zinc-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Handshake className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Offer Draw</span>
                </button>

                <button
                  type="button"
                  onClick={() => requestChessTakeback()}
                  disabled={gameState?.moves?.length === 0}
                  className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 border border-white/10 text-xs font-bold text-zinc-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Takeback</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowResignModal(true)}
                className="w-full py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Resign Game</span>
              </button>
            </div>
          )}
        </div>

        {/* Center: The Chess Board (Hero Focus) */}
        <div className="w-full max-w-[540px] flex flex-col items-center justify-center order-2 lg:order-2">
          {/* Turn / Mode Status Banner */}
          <div className={`w-full mb-2.5 p-3 rounded-2xl flex items-center justify-between border transition-all ${
            isGameOver
              ? 'bg-zinc-800/80 border-white/10 text-zinc-300'
              : isPracticeMode
                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-200'
                : isMyTurn
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className={`w-3 h-3 rounded-full shrink-0 ${
                isGameOver
                  ? 'bg-zinc-500'
                  : isPracticeMode
                    ? 'bg-indigo-400'
                    : isMyTurn
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-amber-400 animate-ping'
              }`} />
              <div>
                <div className="text-xs font-black tracking-wide flex items-center gap-1.5">
                  {isGameOver ? (
                    <span>Match Over · {gameState?.winnerReason || 'Completed'}</span>
                  ) : isPracticeMode ? (
                    <span>🎮 Solo Practice · {practiceTurn === 'w' ? 'White' : 'Black'} to Move</span>
                  ) : isMyTurn ? (
                    <span>👑 YOUR TURN · Move {playerColor === 'w' ? 'White' : 'Black'} Pieces</span>
                  ) : (
                    <span>⏳ OPPONENT&apos;S TURN · {gameState?.turn === 'w' ? 'White' : 'Black'} is Thinking...</span>
                  )}
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  {isGameOver ? (
                    'Review moves below or request a rematch'
                  ) : isPracticeMode ? (
                    'Free play mode. Click any piece to move both White and Black sides.'
                  ) : isMyTurn ? (
                    'Click any of your pieces to show legal moves, then click a target square.'
                  ) : (
                    'The board will unlock automatically once your opponent moves.'
                  )}
                </div>
              </div>
            </div>

            {isPracticeMode && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowFriendDrawer(true)}
                  className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-[11px] font-bold text-amber-300 transition border border-amber-500/30 cursor-pointer"
                >
                  Invite
                </button>
                <button
                  type="button"
                  onClick={() => setIsPracticeMode(false)}
                  className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-bold text-white transition border border-white/10 cursor-pointer"
                >
                  Lobby
                </button>
              </div>
            )}
          </div>

          {/* Server Move Error Toast if any */}
          {chessMoveError && (
            <div className="w-full mb-2.5 p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2 animate-shake">
              <span className="text-sm">⚠️</span>
              <span>{chessMoveError}</span>
            </div>
          )}

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
            />
          )}

          {/* Quick Floating Reaction Bar */}
          <div className="flex items-center gap-2 mt-3 p-1.5 rounded-2xl bg-[#141220]/80 border border-white/10 backdrop-blur-md">
            {['👏', '🔥', '🧠', '😱', '👑', '💀'].map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSendReaction(emoji)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 hover:scale-110 active:scale-95 transition flex items-center justify-center text-sm cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Right Side (My Player Card & Move History / Chat) */}
        <div className="w-full lg:w-72 flex flex-col gap-3 order-3 lg:order-3">
          {/* My Player Card */}
          {myPlayerInfo && gameState && (
            <ChessPlayerCard
              player={myPlayerInfo}
              isCurrentTurn={gameState.turn === myPlayerInfo.color}
              isMe={true}
              capturedPieces={gameState.capturedPieces?.[playerColor === 'w' ? 'white' : 'black'] || []}
              opponentCapturedPieces={gameState.capturedPieces?.[playerColor === 'w' ? 'black' : 'white'] || []}
            />
          )}

          {/* Mobile Resign / Draw Bar */}
          {!isGameOver && (
            <div className="flex lg:hidden items-center gap-2 w-full">
              <button
                type="button"
                onClick={() => offerChessDraw()}
                disabled={!isMyTurn}
                className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-zinc-300 flex items-center justify-center gap-1.5"
              >
                <Handshake className="w-3.5 h-3.5 text-indigo-400" />
                <span>Draw</span>
              </button>
              <button
                type="button"
                onClick={() => requestChessTakeback()}
                className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-zinc-300 flex items-center justify-center gap-1.5"
              >
                <Undo2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Takeback</span>
              </button>
              <button
                type="button"
                onClick={() => setShowResignModal(true)}
                className="flex-1 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-300 flex items-center justify-center gap-1.5"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Resign</span>
              </button>
            </div>
          )}

          {/* Move History / Chat Panel */}
          {showChatPanel ? (
            <div className="flex flex-col h-64 sm:h-80 bg-[#120f20]/90 border border-white/10 rounded-2xl p-3 shadow-inner">
              <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
                <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  Live Duel Chat
                </span>
                <button
                  type="button"
                  onClick={() => setShowChatPanel(false)}
                  className="text-zinc-400 hover:text-white p-1"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Messages list */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-500 italic text-[11px]">
                    No messages yet. Send good luck!
                  </div>
                ) : (
                  chatMessages.map(msg => (
                    <div
                      key={msg.id}
                      className={`p-2 rounded-xl max-w-[85%] ${
                        msg.userId === effectiveUserId
                          ? 'ml-auto bg-amber-500/20 text-amber-200 border border-amber-500/30'
                          : 'mr-auto bg-white/5 text-zinc-200 border border-white/10'
                      }`}
                    >
                      <span className="text-[10px] font-bold block opacity-75">{msg.userName}</span>
                      <span>{msg.content}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Message input */}
              <form onSubmit={handleSendChat} className="pt-2 border-t border-white/10 flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={e => setChatMessage(e.target.value)}
                  placeholder="Chat with opponent..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-black text-xs transition"
                >
                  Send
                </button>
              </form>
            </div>
          ) : (
            <ChessMoveHistory
              moves={gameState?.moves || []}
              className="h-64 sm:h-80"
            />
          )}

          {/* Game Review button (if ended) */}
          {isGameOver && (
            <button
              type="button"
              onClick={() => setShowReviewModal(true)}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>Review Completed Game</span>
            </button>
          )}
        </div>

      </main>

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

      {/* Game End Modal */}
      {isGameOver && gameState && (
        <ChessGameEnd
          gameState={gameState}
          myUserId={effectiveUserId}
          onRematch={handleRematch}
          onReview={() => setShowReviewModal(true)}
          onLeave={handleLeave}
          rematchRequested={rematchRequested}
        />
      )}

      {/* Review Modal */}
      {showReviewModal && gameState && (
        <ChessReview
          gameState={gameState}
          onClose={() => setShowReviewModal(false)}
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
