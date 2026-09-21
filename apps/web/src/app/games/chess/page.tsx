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

  const userId = session?.user?.id || '';
  const displayName = session?.user?.displayName || 'Grandmaster';

  // Game Room hook
  const {
    room,
    gameState: rawGameState,
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
    lastChessMove
  } = useGameRoom(roomCodeParam || null);

  const gameState = rawGameState as ChessGameState | null;

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
    myUserId: userId,
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
    if (!gameState || !userId) return null;
    if (gameState.whitePlayer?.userId === userId) return gameState.whitePlayer;
    if (gameState.blackPlayer?.userId === userId) return gameState.blackPlayer;
    return null;
  }, [gameState, userId]);

  const playerColor: ChessColor = myPlayerInfo?.color || 'w';

  // Opponent player info
  const opponentPlayerInfo = useMemo(() => {
    if (!gameState || !userId) return null;
    if (gameState.whitePlayer?.userId !== userId) return gameState.whitePlayer;
    if (gameState.blackPlayer?.userId !== userId) return gameState.blackPlayer;
    return null;
  }, [gameState, userId]);

  // White and Black players for presentation
  const whitePlayer = gameState?.whitePlayer || null;
  const blackPlayer = gameState?.blackPlayer || null;

  // Handle move emission
  const handleMove = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
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

  // If loading or waiting room
  if (!room) {
    return (
      <div className="min-h-screen bg-[#07070b] flex flex-col items-center justify-center text-white select-none">
        <div className="w-12 h-12 rounded-2xl border-2 border-amber-500 border-t-transparent animate-spin mb-4" />
        <span className="text-sm font-bold text-zinc-400">Loading Chess Arena...</span>
      </div>
    );
  }

  // Waiting Room state (before game starts)
  const isLobby = room.status === 'WAITING' || gameState?.status === 'WAITING' || !gameState;
  if (isLobby) {
    return (
      <>
        <ChessWaitingRoom
          room={room}
          myUserId={userId}
          config={chessConfig}
          onStartGame={() => startChessGame(chessConfig)}
          onUpdateConfig={cfg => {
            setChessConfig(cfg);
            updateChessConfig(cfg);
          }}
          onLeave={handleLeave}
          onInviteFriend={() => setShowFriendDrawer(true)}
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
          {gameState && (
            <ChessBoard
              fen={gameState.fen}
              turn={gameState.turn}
              playerColor={playerColor}
              inCheck={gameState.inCheck}
              checkSquare={gameState.checkSquare}
              lastMove={lastChessMove ? { from: lastChessMove.from, to: lastChessMove.to } : null}
              onMove={handleMove}
              disabled={isGameOver || !isMyTurn}
              isCheckmate={gameState.status === 'CHECKMATE'}
              theme={boardTheme}
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
                        msg.userId === userId
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
          myUserId={userId}
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
