'use client';

import { bingoErrorText } from '../lib/bingoDuelView';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameRoom,
  GameRoomPlayer,
  LudoGameState,
  LudoColor,
  ChatReplyTo,
  DoodleGameState,
  DoodleStroke,
  DoodleGuess,
  DoodleConfig,
  DoodleRole
} from '@synccinema/common';
import { WS_BASE, getStoredSession, ensureSession, recordFriendStreak, getWsTicket } from '../lib/api';
import {
  reconnectDelayMs,
  decideOnClose,
  isTerminalErrorCode,
  mapGameError,
  isValidReactionEmoji,
  sanitizeReactionEmoji,
  forfeitWinForMe,
  type GameErrorInfo
} from '../lib/gameConnection';
import {
  applySpectateParam,
  isSpectatorAllowedMessage,
  spectatorInfoFromSync,
  spectatorsFromEvent
} from '../lib/spectator';

export interface GameChatMessage {
  id: string;
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  content: string;
  timestamp: number;
  replyTo?: ChatReplyTo | null;
  /** Mafia Night only: which channel the server delivered the message on */
  channel?: 'town' | 'mafia' | 'dead';
}

export interface FloatingReaction {
  id: string;
  userId: string;
  userName: string;
  emoji: string;
  timestamp: number;
}

export interface DiceRollEvent {
  rollId?: string;
  timestamp?: number;
  seat: number;
  color: LudoColor;
  displayName: string;
  diceValue: number;
  hasLegalMoves: boolean;
  earnedBonusRoll: boolean;
  auto?: boolean;
}

export interface TokenMovedEvent {
  moveId?: string;
  timestamp?: number;
  seat: number;
  color: LudoColor;
  displayName: string;
  tokenId: number;
  capturedToken?: { color: LudoColor; tokenId: number };
  capturedTokens?: { color: LudoColor; tokenId: number }[];
  auto?: boolean;
  reachedHome?: boolean;
  earnedBonusRoll: boolean;
  isWinner: boolean;
  winnerColor?: string | null;
  winnerUserId?: string | null;
}

export interface DiscDropEvent {
  seat: number;
  color: string;
  displayName: string;
  row: number;
  col: number;
  disc: 'R' | 'Y';
  isWinner: boolean;
  isDraw: boolean;
  winningLine: [number, number][] | null;
}

export interface TicTacToeCellMarkEvent {
  seat: number;
  color: string;
  displayName: string;
  cellIndex: number;
  mark: 'X' | 'O';
  isWinner: boolean;
  isDraw: boolean;
  winningLine: [number, number, number] | null;
}

// Synthetic Web Audio API bell chime for Nudge notifications (reliable on all browsers)
function playNudgeChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    
    // Dual-tone bell chime (A5 = 880Hz, E6 = 1320Hz)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.15);
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(2640, now + 0.25);
    
    gainNode.gain.setValueAtTime(0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc1.start(now);
    osc2.start(now + 0.08);
    osc1.stop(now + 0.7);
    osc2.stop(now + 0.7);
  } catch (e) {
    console.warn('Could not play nudge chime:', e);
  }
}

function deduceGameTypeFromContext(roomCode?: string | null): string | undefined {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/games/bingo')) return 'bingo';
    if (path.includes('/games/chess')) return 'chess';
    if (path.includes('/games/doodle')) return 'doodle-duel';
    if (path.includes('/games/tic-tac-toe') || path.includes('/games/tictactoe')) return 'tic-tac-toe';
    if (path.includes('/games/four-in-a-row') || path.includes('/games/connect4')) return 'four-in-a-row';
    if (path.includes('/games/tambola')) return 'tambola';
    if (path.includes('/games/ludo')) return 'ludo';
    if (path.includes('/games/imposter')) return 'imposter';
    if (path.includes('/games/emoji-charades')) return 'emoji-charades';
    if (path.includes('/games/mafia')) return 'mafia-night';
    if (path.includes('/games/quiz-show')) return 'quiz-show';
    if (path.includes('/games/murder-mystery')) return 'murder-mystery';
    if (path.includes('/games/tournament')) return 'tournament';
  }
  const code = (roomCode || '').toUpperCase();
  if (code.startsWith('BINGO-')) return 'bingo';
  if (code.startsWith('CHESS-')) return 'chess';
  if (code.startsWith('DOODLE-')) return 'doodle-duel';
  if (code.startsWith('TIC-')) return 'tic-tac-toe';
  if (code.startsWith('FOUR-')) return 'four-in-a-row';
  if (code.startsWith('TAMBOLA-')) return 'tambola';
  if (code.startsWith('LUDO-')) return 'ludo';
  if (code.startsWith('IMPOSTER-')) return 'imposter';
  if (code.startsWith('EMOJI-')) return 'emoji-charades';
  if (code.startsWith('MAFIA-')) return 'mafia-night';
  if (code.startsWith('QUIZ-')) return 'quiz-show';
  if (code.startsWith('MURDER-')) return 'murder-mystery';
  if (code.startsWith('ARENA-')) return 'tournament';
  return undefined;
}

export function useGameRoom(roomCode: string | null, gameTypeHint?: string, options?: { create?: boolean; spectate?: boolean }) {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [roomTheme, setRoomTheme] = useState<string>('romantic');
  const [gameState, setGameState] = useState<any>(null);
  const [myUserId, setMyUserId] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<
    'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED'
  >('CONNECTING');
  const [chatMessages, setChatMessages] = useState<GameChatMessage[]>(() => {
    if (typeof window !== 'undefined' && roomCode) {
      try {
        const cached = localStorage.getItem(`synccinema_gchat_${roomCode.toUpperCase()}`);
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return [];
  });
  const [typingUsers, setTypingUsers] = useState<Record<string, { userName: string; timestamp: number }>>({});
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [lastDiceRoll, setLastDiceRoll] = useState<DiceRollEvent | null>(null);
  const [lastTokenMove, setLastTokenMove] = useState<TokenMovedEvent | null>(null);
  const [lastDiscDrop, setLastDiscDrop] = useState<DiscDropEvent | null>(null);
  const [lastTicTacToeMove, setLastTicTacToeMove] = useState<TicTacToeCellMarkEvent | null>(null);
  const [lastBingoCall, setLastBingoCall] = useState<any | null>(null);
  const [lastBingoClaimResult, setLastBingoClaimResult] = useState<any | null>(null);
  const [lastBingoConditionWon, setLastBingoConditionWon] = useState<any | null>(null);
  const [lastDoodleStroke, setLastDoodleStroke] = useState<DoodleStroke | null>(null);
  const [liveDoodleStroke, setLiveDoodleStroke] = useState<any | null>(null);
  const [lastDoodleGuess, setLastDoodleGuess] = useState<DoodleGuess | null>(null);
  const [doodleError, setDoodleError] = useState<{ code: string; message: string; ts: number } | null>(null);
  const [lastChessMove, setLastChessMove] = useState<any | null>(null);
  const [chessMoveError, setChessMoveError] = useState<string | null>(null);
  const [chessDrawOffer, setChessDrawOffer] = useState<{ fromUserId: string; fromDisplayName: string } | null>(null);
  const [chessTakebackRequest, setChessTakebackRequest] = useState<{ fromUserId: string; fromDisplayName: string } | null>(null);
  const [chessClockTick, setChessClockTick] = useState<{ whiteTimeMs: number; blackTimeMs: number; turn: 'w' | 'b' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameActionError, setGameActionError] = useState<{ code: string; message: string; action?: string; ts: number } | null>(null);
  const [gameError, setGameError] = useState<{ code: string; message: string; action?: string; ts: number } | null>(null);
  const [disconnectedPlayer, setDisconnectedPlayer] = useState<{
    userId: string;
    displayName: string;
    isLeft: boolean;
    timestamp: number;
    graceSeconds?: number;
  } | null>(null);
  // Generic server rule/authorization error (game:error). Auto-clears after a few seconds.
  // Server refused this user (NOT_A_PLAYER): terminal, no auto-reconnect.
  const [notAPlayer, setNotAPlayer] = useState(false);
  // Read-only spectator mode (server role 'spectator'); never treated as a player.
  const [isSpectator, setIsSpectator] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [spectators, setSpectators] = useState<string[]>([]);
  // Spectator seats are full (SPECTATOR_LIMIT): terminal.
  const [spectatorLimit, setSpectatorLimit] = useState(false);
  const isSpectatorRef = useRef(false);
  // Server refused a rematch (someone left): sticky until a new game starts.
  const [rematchUnavailable, setRematchUnavailable] = useState(false);
  // This tab was replaced by another tab of the same user (or the room is gone): no auto-reconnect.
  const [connectionStopped, setConnectionStopped] = useState<
    null | 'KICKED' | 'ROOM_GONE' | 'GAVE_UP' | 'AUTH_REQUIRED' | 'NOT_A_PLAYER' | 'SPECTATOR_LIMIT' | 'UPGRADE_REQUIRED'
  >(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [nudgeAlert, setNudgeAlert] = useState<{
    fromDisplayName: string;
    message?: string;
    timestamp: number;
  } | null>(null);
  const [rematchStatus, setRematchStatus] = useState<{
    requesterId?: string;
    requesterName?: string;
    votedUserIds: string[];
    votedCount: number;
    totalNeeded: number;
    allVoted: boolean;
  } | null>(null);
  const [rematchDeclined, setRematchDeclined] = useState<{
    declinerId?: string;
    declinerName?: string;
    reason?: string;
    message: string;
  } | null>(null);
  // Tournament Arena: "your match is ready" and "the organiser removed you" notices (set by tournament:* messages)
  const [tournamentMatchReady, setTournamentMatchReady] = useState<{
    matchId: string;
    roundName: string;
    game: string;
    gameNo: number;
    roomCode: string;
    joinDeadline: number | null;
    opponent: { userId: string; displayName: string; avatarUrl?: string | null } | null;
    ts: number;
  } | null>(null);
  const [tournamentKicked, setTournamentKicked] = useState<string | null>(null);
  const [ludoTurnTimer, setLudoTurnTimer] = useState<{ seat: number; userId?: string; timeoutMs: number; deadlineAt: number } | null>(null);
  const [opponentLeftWin, setOpponentLeftWin] = useState<{
    opponentDisplayName: string;
    winnerDisplayName: string;
    winnerUserId: string;
    winnerColor?: string;
    message: string;
  } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const hasTerminalErrorRef = useRef(false);
  const terminalCodeRef = useRef<string | null>(null);
  const connIdRef = useRef(0); // per-connection token: events from superseded sockets are ignored
  const attemptRef = useRef(0);
  const roomCodeRef = useRef<string | null>(roomCode);
  const gameTypeHintRef = useRef<string | undefined>(gameTypeHint);
  const optionsRef = useRef<{ create?: boolean; spectate?: boolean } | undefined>(options);
  const gameErrorTimerRef = useRef<any>(null);
  const reactionTimersRef = useRef<Set<any>>(new Set());
  const isUnmountedRef = useRef(false);
  const lastChatSendRef = useRef<number>(0);
  const myUserIdRef = useRef<string>('');
  const roomRef = useRef<GameRoom | null>(null);
  const gameStateRef = useRef<any>(null);
  const handleMessageRef = useRef<((msg: any) => void) | null>(null);
  roomCodeRef.current = roomCode;
  gameTypeHintRef.current = gameTypeHint;
  optionsRef.current = options;

  // WebRTC & Audio/Video Call Listeners
  const signalListenersRef = useRef<Set<(fromUserId: string, signal: any) => void>>(new Set());
  const cameraListenersRef = useRef<Set<(userId: string, isCameraOn: boolean) => void>>(new Set());
  const voiceListenersRef = useRef<Set<(userId: string, isMuted: boolean) => void>>(new Set());

  roomRef.current = room;
  // Derive my player
  const myPlayer: GameRoomPlayer | null = isSpectator
    ? null
    : room?.players.find(p => p.userId === myUserId) || null;

  // Derive turns and capabilities
  const isPlaying = room?.status === 'PLAYING';
  const isMyTurn =
    isPlaying &&
    gameState !== null &&
    myPlayer !== null &&
    gameState.currentTurnSeat === myPlayer.seat;

  const canRoll = Boolean(isMyTurn && gameState?.canRoll);
  const legalMoves = isMyTurn ? (gameState?.legalMoves || []) : [];
  const canMove = Boolean(isMyTurn && !gameState?.canRoll && legalMoves.length > 0);

  useEffect(() => {
    if (room?.status === 'PLAYING') setRematchUnavailable(false);
  }, [room?.status]);

  // Universal Friend Streak Celebration State
  const [streakCelebration, setStreakCelebration] = useState<{
    friendName: string;
    streakCount: number;
    isExtended: boolean;
  } | null>(null);
  const streakRecordedPairRef = useRef<Set<string>>(new Set());

  // Automatic streak tracking for ALL games
  useEffect(() => {
    const session = getStoredSession();
    // Tournament Arena: 32 opponents would be 32 requests per player; the 2-player match rooms record the streaks of the people who really play
    if (!isSpectator && room?.status === 'PLAYING' && room?.gameType !== 'tournament' && room?.players && session?.token && myUserId) {
      const today = new Date().toISOString().split('T')[0];
      const opponents = room.players.filter(
        p => p.userId && p.userId !== myUserId && !p.userId.startsWith('bot_') && !p.userId.startsWith('guest_')
      );

      for (const opp of opponents) {
        const key = `${opp.userId}_${today}`;
        if (!streakRecordedPairRef.current.has(key)) {
          streakRecordedPairRef.current.add(key);
          recordFriendStreak(session.token, opp.userId, 1)
            .then(res => {
              if (res.success && (res.status === 'EXTENDED' || res.status === 'RESET_STARTED')) {
                setStreakCelebration({
                  friendName: opp.displayName || 'Friend',
                  streakCount: res.streak.currentStreak,
                  isExtended: res.status === 'EXTENDED'
                });
              }
            })
            .catch(() => {
              // Ignore if opponent is not yet a friend
            });
        }
      }
    }
  }, [room?.status, room?.players, myUserId, isSpectator]);

  const detachSocket = useCallback(() => {
    const old = socketRef.current;
    socketRef.current = null;
    if (old) {
      old.onopen = null;
      old.onmessage = null;
      old.onerror = null;
      old.onclose = null;
      try { old.close(); } catch {}
    }
  }, []);

  const connect = useCallback(async () => {
    const code = roomCodeRef.current;
    if (!code || isUnmountedRef.current) return;
    const connId = ++connIdRef.current;
    const isStale = () => isUnmountedRef.current || connId !== connIdRef.current;

    try {
      hasTerminalErrorRef.current = false;
      terminalCodeRef.current = null;
      setConnectionStatus(attemptRef.current > 0 ? 'RECONNECTING' : 'CONNECTING');
      const session = getStoredSession();
      if (!session?.token || session.user?.isAnonymous) {
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname + window.location.search;
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        }
        setConnectionStatus('DISCONNECTED');
        setError('Authentication required. Please sign in or create an account to play.');
        return;
      }

      setMyUserId(session.user.id);
      myUserIdRef.current = session.user.id;

      // Build websocket URL
      let wsUrl = `${WS_BASE}/ws/games/${encodeURIComponent(code.toUpperCase())}`;
      const effectiveGame = gameTypeHintRef.current || deduceGameTypeFromContext(code);
      const params = new URLSearchParams();
      if (effectiveGame) {
        params.set('gameType', effectiveGame);
      }
      params.set('ticket', await getWsTicket());
      if (isStale()) return;
      if (optionsRef.current?.create !== false) params.set('create', '1'); // explicit opt-in (Ludo passes create:false)
      applySpectateParam(params, optionsRef.current?.spectate === true);
      const qs = params.toString();
      if (qs) {
        wsUrl += `?${qs}`;
      }

      detachSocket();
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      if (optionsRef.current?.spectate === true) {
        // Hard guard: a spectator socket can only ever send the read-only allow list.
        const rawSend = socket.send.bind(socket);
        socket.send = (data: any) => {
          try {
            const t = typeof data === 'string' ? JSON.parse(data)?.type : undefined;
            if (!isSpectatorAllowedMessage(t)) return;
          } catch { return; }
          rawSend(data);
        };
      }

      socket.onopen = () => {
        if (isStale()) return;
        attemptRef.current = 0;
        setReconnectAttempt(0);
        setConnectionStatus('CONNECTED');
        setError(null);
      };

      socket.onmessage = (event) => {
        if (isStale()) return;
        try {
          const msg = JSON.parse(event.data);
          const handler = handleMessageRef.current || handleMessage;
          handler(msg);
        } catch (e) {
          console.error('Failed to parse game message:', e);
        }
      };

      socket.onerror = (e) => {
        console.warn('Game WebSocket error:', e);
      };

      socket.onclose = (event: CloseEvent) => {
        if (isStale()) return;
        if (socketRef.current === socket) socketRef.current = null;
        const decision = decideOnClose(event, terminalCodeRef.current, attemptRef.current);
        if (decision.action === 'stop') {
          hasTerminalErrorRef.current = true;
          setConnectionStatus('DISCONNECTED');
          setConnectionStopped(decision.reason);
          if (decision.reason === 'NOT_A_PLAYER') setNotAPlayer(true);
          if (decision.reason === 'SPECTATOR_LIMIT') setSpectatorLimit(true);
          if (decision.reason === 'AUTH_REQUIRED' && typeof window !== 'undefined') {
            const currentPath = window.location.pathname + window.location.search;
            window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
          }
          return;
        }
        setConnectionStatus('RECONNECTING');
        const delay = reconnectDelayMs(attemptRef.current);
        attemptRef.current += 1;
        setReconnectAttempt(attemptRef.current);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isStale() && !hasTerminalErrorRef.current) {
            void connect();
          }
        }, delay);
      };
    } catch (err: any) {
      if (!isStale()) {
        // Ticket fetch / socket creation failed: retry with backoff instead of giving up forever.
        const decision = decideOnClose({}, null, attemptRef.current);
        if (decision.action === 'stop') {
          setError(err?.message || 'Failed to connect to game');
          setConnectionStatus('DISCONNECTED');
          setConnectionStopped('GAVE_UP');
          return;
        }
        setConnectionStatus('RECONNECTING');
        const delay = reconnectDelayMs(attemptRef.current);
        attemptRef.current += 1;
        setReconnectAttempt(attemptRef.current);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isStale() && !hasTerminalErrorRef.current) void connect();
        }, delay);
      }
    }
  }, [detachSocket]);

  const showGameError = useCallback((payload: any) => {
    const info = mapGameError(payload);
    setGameError({ ...info, ts: Date.now() });
    setGameActionError({ ...info, ts: Date.now() });
    if (gameErrorTimerRef.current) clearTimeout(gameErrorTimerRef.current);
    gameErrorTimerRef.current = setTimeout(() => { setGameError(null); setGameActionError(null); }, 5000);
  }, []);

  const clearGameError = useCallback(() => {
    if (gameErrorTimerRef.current) clearTimeout(gameErrorTimerRef.current);
    setGameError(null);
    setGameActionError(null);
  }, []);

  const addFloatingReaction = useCallback((reaction: FloatingReaction) => {
    setFloatingReactions(prev => [...prev.slice(-30), reaction]);
    const t = setTimeout(() => {
      reactionTimersRef.current.delete(t);
      setFloatingReactions(prev => prev.filter(r => r.id !== reaction.id));
    }, 3500);
    reactionTimersRef.current.add(t);
  }, []);

  const handleMessage = (msg: any) => {
    switch (msg.type) {
      case 'game:sync': {
        const payload = msg.payload;
        if (payload.room) {
          // game:sync is the per-player projected source of truth: replace, never merge.
          setRoom(payload.room);
          setGameState(payload.room.gameState ?? null);
          setRematchStatus(null);
        }
        {
          const info = spectatorInfoFromSync(payload);
          isSpectatorRef.current = info.isSpectator;
          setIsSpectator(info.isSpectator);
          setSpectatorCount(info.spectatorCount);
          setSpectators(info.spectators);
        }
        if (payload.theme || payload.room?.theme) {
          setRoomTheme(payload.theme || payload.room.theme);
        }
        if (payload.chatHistory && Array.isArray(payload.chatHistory)) {
          setChatMessages(prev => {
            const map = new Map<string, GameChatMessage>();
            prev.forEach(m => map.set(m.id, m));
            payload.chatHistory.forEach((m: GameChatMessage) => map.set(m.id, m));
            const merged = Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
            if (prev.length === merged.length && prev.every((m, idx) => m.id === merged[idx].id)) {
              return prev;
            }
            try {
              if (roomCode) {
                localStorage.setItem(`synccinema_gchat_${roomCode.toUpperCase()}`, JSON.stringify(merged));
              }
            } catch (e) {}
            return merged;
          });
        }
        if (payload.myUserId) {
          setMyUserId(payload.myUserId);
          myUserIdRef.current = payload.myUserId;
        }
        break;
      }

      case 'game:player_joined': {
        const { player, room: updatedRoom } = msg.payload;
        if (updatedRoom) {
          setRoom(updatedRoom);
          if (updatedRoom.gameState !== undefined) {
            setGameState(updatedRoom.gameState);
          }
        } else {
          setRoom(prev => {
            if (!prev) return prev;
            const exists = prev.players.some(p => p.userId === player.userId);
            const updatedPlayers = exists ? prev.players : [...prev.players, player];
            return { ...prev, players: updatedPlayers };
          });
        }
        break;
      }

      case 'game:player_left': {
        const {
          userId,
          displayName,
          isWinner,
          winnerUserId,
          winnerDisplayName,
          winnerColor,
          forfeitMessage,
          hostUserId,
          roomClosed,
          gameState: updatedState
        } = msg.payload;

        setRoom(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            // Quiz Show Studio: the quiz master left the lobby, the room is closed
            status: roomClosed ? 'CANCELLED' : isWinner ? 'FINISHED' : prev.status,
            hostUserId: hostUserId || prev.hostUserId,
            players: prev.players.map(p =>
              p.userId === userId ? { ...p, isConnected: false, status: 'LEFT' as any } : p
            )
          };
        });

        const currentUserId = myUserIdRef.current || myUserId;
        const isMeLeaving = userId === currentUserId;

        if (updatedState) {
          setGameState(updatedState);
        } else if (isWinner && winnerUserId) {
          setGameState((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              winnerUserId,
              winnerColor: winnerColor || prev.winnerColor,
              statusMessage: forfeitMessage || prev.statusMessage
            };
          });
        }

        // The "you win" banner only when the server says so AND the winner is me.
        if (!isSpectatorRef.current && !isMeLeaving && forfeitWinForMe(msg.payload, currentUserId)) {
          setOpponentLeftWin({
            opponentDisplayName: displayName || 'Opponent',
            winnerDisplayName: winnerDisplayName || 'You',
            winnerUserId,
            winnerColor,
            message: forfeitMessage || `${displayName || 'Opponent'} has left the game. You are the winner!`
          });
        }
        setRematchStatus(null);

        setDisconnectedPlayer({
          userId,
          displayName: displayName || 'Player',
          isLeft: true,
          timestamp: Date.now()
        });
        break;
      }

      case 'game:player_disconnected': {
        const { userId, displayName, graceSeconds } = msg.payload;
        setRoom(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            players: prev.players.map(p =>
              p.userId === userId ? { ...p, isConnected: false, status: 'DISCONNECTED' as any } : p
            )
          };
        });
        setDisconnectedPlayer({
          userId,
          displayName: displayName || 'Player',
          isLeft: false,
          timestamp: Date.now(),
          graceSeconds: typeof graceSeconds === 'number' ? graceSeconds : undefined
        });
        break;
      }

      case 'game:player_reconnected': {
        const { userId, room: updatedRoom } = msg.payload;
        if (updatedRoom) {
          setRoom(updatedRoom);
          if (updatedRoom.gameState !== undefined) {
            setGameState(updatedRoom.gameState);
          }
        } else {
          setRoom(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              players: prev.players.map(p =>
                p.userId === userId ? { ...p, isConnected: true, status: 'PLAYING' as any } : p
              )
            };
          });
        }
        setDisconnectedPlayer(prev => (prev?.userId === userId ? null : prev));
        break;
      }

      case 'game:player_nudged':
      case 'game:nudge': {
        const { fromDisplayName, fromUserId, targetUserId, message } = msg.payload || {};
        const currentUserId = myUserIdRef.current || myUserId;
        const isFromMe = Boolean(currentUserId && fromUserId === currentUserId);
        const isTargetedToMe = !targetUserId || (Boolean(currentUserId) && targetUserId === currentUserId);

        if (!isSpectatorRef.current && !isFromMe && isTargetedToMe) {
          playNudgeChime();
          setNudgeAlert({
            fromDisplayName: fromDisplayName || 'Partner',
            message: message,
            timestamp: Date.now()
          });
          try {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate([200, 100, 200]);
            }
          } catch (e) {}

          const reaction: FloatingReaction = {
            id: `react_${Date.now()}_${Math.random()}`,
            userId: fromUserId,
            userName: fromDisplayName || 'Partner',
            emoji: 'bell', // icon name (see isIconName): rendered by the game pages as an icon, not text
            timestamp: Date.now()
          };
          addFloatingReaction(reaction);
        }
        break;
      }

      case 'game:rematch_status': {
        if (isSpectatorRef.current) break;
        setRematchStatus(msg.payload);
        setRematchDeclined(null);
        // Do not wipe room status to WAITING or reset gameState - keep players on match screen
        break;
      }

      case 'game:rematch_agreed': {
        if (isSpectatorRef.current) break;
        const p = msg.payload || {};
        const total = typeof p.totalNeeded === 'number' ? p.totalNeeded : (roomRef.current?.players.filter(x => (x as any).status !== 'LEFT').length || 2);
        setRematchStatus({
          votedUserIds: Array.isArray(p.votedUserIds) ? p.votedUserIds : [],
          votedCount: typeof p.votedCount === 'number' ? p.votedCount : total,
          totalNeeded: total,
          allVoted: true
        });
        setRematchDeclined(null);
        break;
      }

      case 'game:error': {
        const gp = msg.payload || msg;
        if (gp?.code === 'SPECTATOR') {
          // Should never happen from the UI (controls are hidden): show a gentle note only.
          showGameError({ code: 'SPECTATOR', message: 'You are watching, so only players can do that.' });
          break;
        }
        if (gp?.code === 'REMATCH_UNAVAILABLE') setRematchUnavailable(true);
        showGameError(gp);
        break;
      }

      case 'game:spectators': {
        const info = spectatorsFromEvent(msg.payload);
        setSpectatorCount(info.count);
        setSpectators(info.names);
        break;
      }

      case 'game:rematch_declined': {
        if (isSpectatorRef.current) break;
        if (msg.payload?.reason === 'opponent_left') setRematchUnavailable(true);
        setRematchStatus(null);
        setRematchDeclined(msg.payload);
        break;
      }

      case 'game:theme_changed': {
        const { theme } = msg.payload;
        if (theme) {
          setRoomTheme(theme);
        }
        break;
      }

      case 'game:typing': {
        const { userId, userName, isTyping } = msg.payload;
        if (userId && userId !== myUserId) {
          setTypingUsers(prev => {
            const next = { ...prev };
            if (isTyping) {
              next[userId] = { userName: userName || 'Partner', timestamp: Date.now() };
            } else {
              delete next[userId];
            }
            return next;
          });
        }
        break;
      }

      case 'game:started': {
        const { gameState: startState, room: updatedRoom } = msg.payload;
        setRematchStatus(null);
        setRematchDeclined(null);
        setGameState(startState);
        setRoom(prev => {
          if (updatedRoom) return updatedRoom;
          return prev ? { ...prev, status: 'PLAYING', gameState: startState } : prev;
        });
        if (startState?.currentNumber !== undefined && startState?.currentNumber !== null) {
          setLastBingoCall({
            number: startState.currentNumber,
            word: startState.currentNumberWord || null,
            calledNumbers: startState.calledNumbers || [startState.currentNumber],
            remainingCount: startState.remainingCount ?? startState.callQueue?.length ?? 89,
            timestamp: Date.now()
          });
        }
        break;
      }

      case 'game:dice_rolled': {
        const { rollId, timestamp, seat, color, displayName, diceValue, hasLegalMoves, earnedBonusRoll, auto: diceAuto, gameState: nextState } = msg.payload;
        setGameState(nextState);
        setLastDiceRoll({
          rollId: rollId || `roll_${Date.now()}_${Math.random()}`,
          timestamp: timestamp || Date.now(),
          seat,
          color,
          displayName,
          diceValue,
          hasLegalMoves,
          earnedBonusRoll,
          auto: Boolean(diceAuto)
        });
        break;
      }

      case 'game:token_moved': {
        const {
          moveId,
          timestamp,
          seat,
          color,
          displayName,
          tokenId,
          capturedToken,
          capturedTokens,
          auto: moveAuto,
          reachedHome,
          earnedBonusRoll,
          isWinner,
          winnerColor,
          winnerUserId,
          gameState: nextState
        } = msg.payload;
        setGameState(nextState);
        setLastTokenMove({
          moveId: moveId || `move_${Date.now()}_${Math.random()}`,
          timestamp: timestamp || Date.now(),
          seat,
          color,
          displayName,
          tokenId,
          capturedToken,
          capturedTokens,
          auto: Boolean(moveAuto),
          reachedHome,
          earnedBonusRoll,
          isWinner,
          winnerColor,
          winnerUserId
        });
        break;
      }

      case 'game:turn_timer': {
        const p = msg.payload || {};
        if (typeof p.deadlineAt === 'number') {
          setLudoTurnTimer({ seat: p.seat, userId: p.userId, timeoutMs: p.timeoutMs, deadlineAt: p.deadlineAt });
        } else {
          setLudoTurnTimer(null);
        }
        break;
      }

      case 'game:disc_dropped': {
        const { gameState: nextState, seat, color, displayName, row, col, disc, isWinner, isDraw, winningLine } = msg.payload;
        setGameState(nextState);
        setLastDiscDrop({
          seat,
          color,
          displayName,
          row,
          col,
          disc,
          isWinner,
          isDraw,
          winningLine
        });
        break;
      }

      case 'game:cell_marked': {
        const { gameState: nextState, seat, color, displayName, cellIndex, mark, isWinner, isDraw, winningLine } = msg.payload;
        setGameState(nextState);
        setLastTicTacToeMove({
          seat,
          color,
          displayName,
          cellIndex,
          mark,
          isWinner,
          isDraw,
          winningLine
        });
        break;
      }

      case 'game:lobby_ready': {
        const { room: readyRoom } = msg.payload || {};
        if (readyRoom) {
          setRoom(readyRoom);
        }
        break;
      }

      case 'bingo:number_called': {
        const { number, word, calledNumbers, remainingCount, gameState: nextState } = msg.payload || {};
        if (nextState) setGameState(nextState);
        setLastBingoCall({
          number,
          word,
          calledNumbers,
          remainingCount,
          timestamp: Date.now()
        });
        break;
      }

      case 'bingo:number_marked': {
        const { userId, number, playerMarked, playerMarks, playerProgress, gameState: nextState } = msg.payload || {};
        if (nextState) {
          setGameState(nextState);
        } else if (userId) {
          setGameState((prev: any) => {
            if (!prev) return prev;
            const updated = { ...prev };
            if (playerMarked) {
              updated.playerMarked = {
                ...(prev.playerMarked || {}),
                [userId]: playerMarked
              };
            }
            if (playerMarks) {
              updated.playerMarks = {
                ...(prev.playerMarks || {}),
                [userId]: playerMarks
              };
            }
            if (playerProgress) {
              updated.playerProgress = {
                ...(prev.playerProgress || {}),
                [userId]: playerProgress
              };
            }
            return updated;
          });
        }
        break;
      }

      case 'bingo:claim_result': {
        const result = msg.payload;
        if (result?.gameState) setGameState(result.gameState);
        setLastBingoClaimResult({
          ...result,
          timestamp: Date.now()
        });
        break;
      }

      case 'bingo:condition_won': {
        const { condition, conditionName, userId, displayName, points, scores, gameState: nextState, isGameOver } = msg.payload || {};
        if (nextState) setGameState(nextState);
        setLastBingoConditionWon({
          condition,
          conditionName,
          userId,
          displayName,
          points,
          scores,
          isGameOver,
          timestamp: Date.now()
        });
        break;
      }

      case 'bingo:game_over': {
        const { winnerUserId, winnerDisplayName, scores, summary, gameState: nextState } = msg.payload || {};
        if (nextState) setGameState(nextState);
        setRoom(prev => prev ? { ...prev, status: 'FINISHED', gameState: nextState || prev.gameState } : prev);
        break;
      }

      case 'bingo:config_updated': {
        const { config } = msg.payload || {};
        setGameState((prev: any) => prev ? { ...prev, config } : prev);
        break;
      }

      case 'bingo:board_updated': {
        const { gameState: nextState } = msg.payload || {};
        if (nextState) setGameState(nextState);
        break;
      }

      case 'bingo:error': {
        const { code, message } = msg.payload || {};
        const text = bingoErrorText(code, message);
        if (text) setError(text);
        break;
      }

      case 'doodle:state_sync':
      case 'doodle:role_selected': {
        const nextState = msg.payload?.gameState;
        if (nextState) {
          setGameState(nextState);
          if (nextState.phase !== 'DRAWING') setLiveDoodleStroke(null);
          if (nextState.phase && nextState.phase !== 'LOBBY' && nextState.phase !== 'ROLE_SELECTION') {
            setRoom(prev => (prev ? { ...prev, status: 'PLAYING', gameState: nextState } : prev));
          }
        }
        break;
      }

      case 'doodle:live_draw': {
        const live = msg.payload?.liveStroke;
        setLiveDoodleStroke(live && typeof live === 'object' && Array.isArray(live.points) ? live : null);
        break;
      }

      case 'doodle:stroke_added': {
        setLiveDoodleStroke(null);
        const stroke = msg.payload?.stroke;
        if (stroke) {
          setLastDoodleStroke(stroke);
          setGameState((prev: any) => {
            if (!prev) return prev;
            const existing = prev.strokes || [];
            if (existing.some((s: any) => s.id === stroke.id)) {
              return prev;
            }
            return {
              ...prev,
              strokes: [...existing, stroke]
            };
          });
        }
        break;
      }

      case 'doodle:strokes_updated': {
        const strokes = msg.payload?.strokes;
        setGameState((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            strokes: strokes || []
          };
        });
        break;
      }

      case 'doodle:error': {
        const p = msg.payload || {};
        setDoodleError({ code: String(p.code || 'error'), message: String(p.message || 'Action failed'), ts: Date.now() });
        break;
      }

      case 'doodle:canvas_cleared': {
        setLiveDoodleStroke(null);
        setGameState((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            strokes: []
          };
        });
        break;
      }

      case 'doodle:guess_result': {
        const payload = msg.payload || {};
        const guessObj = payload.guess || {
          id: `guess_${Date.now()}_${Math.random()}`,
          userId: payload.userId,
          displayName: payload.displayName,
          text: payload.text || payload.guessText || '',
          guess: payload.text || payload.guessText || '',
          isCorrect: Boolean(payload.isCorrect),
          pointsAwarded: payload.pointsEarned,
          timestamp: Date.now()
        };
        setLastDoodleGuess(guessObj);
        if (payload.gameState) {
          setGameState(payload.gameState);
        } else {
          // Optimistically append guess to gameState so both players see it instantaneously
          setGameState((prev: any) => {
            if (!prev) return prev;
            const existing = prev.guesses || prev.currentGuesses || [];
            if (existing.some((g: any) => g.id === guessObj.id)) return prev;
            const updatedGuesses = [...existing, guessObj];
            return {
              ...prev,
              guesses: updatedGuesses,
              currentGuesses: updatedGuesses
            };
          });
        }
        break;
      }

      case 'doodle:config_updated': {
        const { config } = msg.payload || {};
        if (config) setGameState((prev: any) => prev ? { ...prev, config } : prev);
        break;
      }

      case 'imposter:state': {
        // Every Imposter message carries THIS player's redacted view (the server never sends the secret state to anyone)
        const { gameState: nextState, roomStatus } = msg.payload || {};
        if (nextState) {
          setGameState(nextState);
          setRoom(prev => (prev ? { ...prev, status: roomStatus || prev.status, gameState: nextState } : prev));
          if (nextState.phase === 'REVEAL' && nextState.round > 1) setRematchStatus(null);
        }
        break;
      }

      case 'mafia:state': {
        // Every Mafia Night message carries THIS player's redacted view (the server never sends the secret state to anyone)
        const { gameState: nextState, roomStatus } = msg.payload || {};
        if (nextState) {
          setGameState(nextState);
          setRoom(prev => (prev ? { ...prev, status: roomStatus || prev.status, gameState: nextState } : prev));
          if (nextState.phase === 'ROLE_REVEAL') setRematchStatus(null);
        }
        break;
      }

      case 'quiz-show:state': {
        // Every Quiz Show message carries THIS recipient's redacted view (the server never sends the correct answers early)
        const { gameState: nextState, roomStatus } = msg.payload || {};
        if (nextState) {
          setGameState(nextState);
          setRoom(prev => (prev ? { ...prev, status: roomStatus || prev.status, gameState: nextState } : prev));
          if (nextState.phase === 'INTRO' && nextState.questionIndex === 0) setRematchStatus(null);
        }
        break;
      }

      case 'tournament:state': {
        // Every Tournament Arena message carries THIS recipient's view (nothing here is secret, the server only drops its bookkeeping)
        const { gameState: nextState, roomStatus } = msg.payload || {};
        if (nextState) {
          setGameState(nextState);
          setRoom(prev => (prev ? { ...prev, status: roomStatus || prev.status, gameState: nextState } : prev));
        }
        break;
      }

      case 'tournament:match_ready': {
        const p = msg.payload || {};
        if (p.roomCode && p.matchId) setTournamentMatchReady({ ...p, ts: Date.now() });
        break;
      }

      case 'tournament:match_closed': {
        // A match room the tournament ended from outside its game (no-show, a leaver, the organiser): the game page shows the notice
        const p = msg.payload || {};
        setRoom(prev => (prev ? ({ ...prev, status: p.status === 'CANCELLED' ? 'CANCELLED' : 'FINISHED', tournamentNotice: String(p.message || '') } as any) : prev));
        break;
      }

      case 'tournament:kicked': {
        setTournamentKicked(String(msg.payload?.message || 'The organiser removed you from this tournament.'));
        break;
      }

      case 'murder-mystery:state': {
        // Every Murder Mystery message carries THIS recipient's redacted view (the server never sends other cards, clues or accusations early)
        const { gameState: nextState, roomStatus } = msg.payload || {};
        if (nextState) {
          setGameState(nextState);
          setRoom(prev => (prev ? { ...prev, status: roomStatus || prev.status, gameState: nextState } : prev));
          if (nextState.phase === 'CHARACTER_REVEAL') setRematchStatus(null);
        }
        break;
      }

      case 'emoji-charades:state': {
        // Every Emoji Charades message carries THIS player's redacted view (the server never sends the secret state to anyone)
        const { gameState: nextState, roomStatus } = msg.payload || {};
        if (nextState) {
          setGameState(nextState);
          setRoom(prev => (prev ? { ...prev, status: roomStatus || prev.status, gameState: nextState } : prev));
          if (nextState.phase === 'COUNTDOWN' && nextState.round > 1) setRematchStatus(null);
        }
        break;
      }

      case 'chess:started': {
        const { room: updatedRoom, gameState: nextState } = msg.payload || {};
        if (updatedRoom) setRoom(updatedRoom);
        if (nextState) setGameState(nextState);
        setChessDrawOffer(null);
        setChessTakebackRequest(null);
        setLastChessMove(null);
        break;
      }

      case 'chess:move_accepted': {
        const { move, gameState: nextState } = msg.payload || {};
        if (move) setLastChessMove(move);
        if (nextState) setGameState(nextState);
        setChessMoveError(null);
        setChessDrawOffer(null);
        setChessTakebackRequest(null);
        break;
      }

      case 'chess:move_rejected': {
        setChessMoveError(msg.payload?.message || 'Illegal move');
        break;
      }

      case 'chess:game_over': {
        const { gameState: nextState } = msg.payload || {};
        if (nextState) setGameState(nextState);
        setRoom(prev => prev ? { ...prev, status: 'FINISHED', gameState: nextState } : prev);
        setChessDrawOffer(null);
        setChessTakebackRequest(null);
        break;
      }

      case 'chess:clock_tick': {
        setChessClockTick(msg.payload);
        setGameState((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            whitePlayer: { ...prev.whitePlayer, timeRemainingMs: msg.payload.whiteTimeMs },
            blackPlayer: { ...prev.blackPlayer, timeRemainingMs: msg.payload.blackTimeMs },
            turn: msg.payload.turn
          };
        });
        break;
      }

      case 'chess:draw_offered': {
        setChessDrawOffer(msg.payload);
        if (msg.payload?.fromUserId) {
          setGameState((prev: any) => prev ? { ...prev, drawOfferFrom: msg.payload.fromUserId } : prev);
        }
        break;
      }

      case 'chess:draw_declined': {
        setChessDrawOffer(null);
        setGameState((prev: any) => prev ? { ...prev, drawOfferFrom: null } : prev);
        break;
      }

      case 'chess:takeback_requested': {
        setChessTakebackRequest(msg.payload);
        if (msg.payload?.fromUserId) {
          setGameState((prev: any) => prev ? { ...prev, takebackRequestFrom: msg.payload.fromUserId } : prev);
        }
        break;
      }

      case 'chess:takeback_responded': {
        setChessTakebackRequest(null);
        if (msg.payload?.gameState) {
          setGameState(msg.payload.gameState);
        } else {
          setGameState((prev: any) => prev ? { ...prev, takebackRequestFrom: null } : prev);
        }
        break;
      }

      case 'chess:config_updated': {
        if (msg.payload?.gameState) setGameState(msg.payload.gameState);
        break;
      }

      case 'game:chat_message': {
        const chat = msg.payload;
        if (!chat) break;
        setChatMessages(prev => {
          // Deduplicate by message ID
          if (chat.id && prev.some(m => m.id === chat.id)) {
            return prev;
          }
          // Deduplicate rapid identical message bursts (same user, same content within 1500ms)
          if (prev.some(m => m.userId === chat.userId && m.content === chat.content && Math.abs(m.timestamp - (chat.timestamp || 0)) < 1500)) {
            return prev;
          }
          const next = [...prev.slice(-49), chat];
          try {
            if (roomCode) {
              localStorage.setItem(`synccinema_gchat_${roomCode.toUpperCase()}`, JSON.stringify(next));
            }
          } catch (e) {}
          return next;
        });
        // Clear typing indicator for this user when message arrives
        setTypingUsers(prev => {
          if (prev[chat.userId]) {
            const next = { ...prev };
            delete next[chat.userId];
            return next;
          }
          return prev;
        });
        break;
      }

      case 'game:reaction_broadcast': {
        const emoji = sanitizeReactionEmoji(msg.payload?.emoji);
        if (!emoji) break;
        addFloatingReaction({
          id: `react_${Date.now()}_${Math.random()}`,
          userId: String(msg.payload.userId ?? ''),
          userName: String(msg.payload.userName ?? ''),
          emoji,
          timestamp: Number(msg.payload.timestamp) || Date.now()
        });
        break;
      }

      case 'error:notification': {
        const errCode: string | undefined = msg.payload?.code;
        setError(msg.payload?.message || 'Game room error');
        if (isTerminalErrorCode(errCode)) {
          // Terminal: the server closes the socket right after; do not auto-reconnect.
          hasTerminalErrorRef.current = true;
          terminalCodeRef.current = errCode || null;
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
          if (errCode === 'NOT_A_PLAYER') setNotAPlayer(true);
          if (errCode === 'SPECTATOR_LIMIT') setSpectatorLimit(true);
          setConnectionStatus('DISCONNECTED');
        } else {
          // RATE_LIMITED / JOIN_FAILED etc.: the socket stays open, surface as a transient game error.
          showGameError({ code: errCode || 'ACTION_FAILED', message: msg.payload?.message });
        }
        if (errCode === 'AUTH_REQUIRED' && typeof window !== 'undefined') {
          const currentPath = window.location.pathname + window.location.search;
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        }
        break;
      }

      case 'webrtc:signal': {
        const { fromUserId, signal } = msg.payload || {};
        if (fromUserId && signal) {
          signalListenersRef.current.forEach(listener => {
            try {
              listener(fromUserId, signal);
            } catch (err) {
              console.error('Error in WebRTC signal listener:', err);
            }
          });
        }
        break;
      }

      case 'camera:state': {
        const { userId, isCameraOn } = msg.payload || {};
        if (userId !== undefined) {
          cameraListenersRef.current.forEach(listener => {
            try {
              listener(userId, isCameraOn);
            } catch (err) {
              console.error('Error in camera state listener:', err);
            }
          });
        }
        break;
      }

      case 'voice:state': {
        const { userId, isMuted } = msg.payload || {};
        if (userId !== undefined) {
          voiceListenersRef.current.forEach(listener => {
            try {
              listener(userId, isMuted);
            } catch (err) {
              console.error('Error in voice state listener:', err);
            }
          });
        }
        break;
      }
    }
  };

  handleMessageRef.current = handleMessage;

  useEffect(() => {
    isUnmountedRef.current = false;
    // New room (or first mount): drop everything that belonged to the previous room.
    attemptRef.current = 0;
    hasTerminalErrorRef.current = false;
    terminalCodeRef.current = null;
    setReconnectAttempt(0);
    setNotAPlayer(false);
    setSpectatorLimit(false);
    setRematchUnavailable(false);
    setIsSpectator(false);
    isSpectatorRef.current = false;
    setSpectatorCount(0);
    setSpectators([]);
    setConnectionStopped(null);
    setRoom(null);
    setGameState(null);
    setError(null);
    setGameError(null);
    setGameActionError(null);
    setDisconnectedPlayer(null);
    setRematchStatus(null);
    setRematchDeclined(null);
    setOpponentLeftWin(null);
    setNudgeAlert(null);
    setTypingUsers({});
    setFloatingReactions([]);
    setLastDiceRoll(null);
    setLastTokenMove(null);
    setLastDiscDrop(null);
    setLastTicTacToeMove(null);
    setLastBingoCall(null);
    setLastBingoClaimResult(null);
    setLastBingoConditionWon(null);
    setLastDoodleStroke(null);
    setLiveDoodleStroke(null);
    setLastDoodleGuess(null);
    setLastChessMove(null);
    setChessMoveError(null);
    setChessDrawOffer(null);
    setChessTakebackRequest(null);
    setChessClockTick(null);
    setChatMessages(() => {
      if (typeof window !== 'undefined' && roomCode) {
        try {
          const cached = localStorage.getItem(`synccinema_gchat_${roomCode.toUpperCase()}`);
          if (cached) return JSON.parse(cached);
        } catch (e) {}
      }
      return [];
    });
    void connect();

    return () => {
      isUnmountedRef.current = true;
      connIdRef.current += 1; // invalidate every handler of the old socket
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (gameErrorTimerRef.current) clearTimeout(gameErrorTimerRef.current);
      reactionTimersRef.current.forEach(t => clearTimeout(t));
      reactionTimersRef.current.clear();
      detachSocket();
    };
  }, [roomCode, connect, detachSocket]);

  // Client actions
  const rollDice = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type: 'game:roll_dice' }));
  }, []);

  const moveToken = useCallback((tokenId: number) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'game:move_token',
        payload: { tokenId }
      })
    );
  }, []);

  const sendChat = useCallback((content: string, replyTo?: ChatReplyTo | null) => {
    const now = Date.now();
    if (now - lastChatSendRef.current < 350) return;
    lastChatSendRef.current = now;

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !content.trim()) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'game:chat',
        payload: { content: content.trim(), replyTo: replyTo || null }
      })
    );
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    if (!isValidReactionEmoji(emoji)) return;
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'game:reaction',
        payload: { emoji }
      })
    );
  }, []);

  const rematch = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type: 'game:rematch' }));
  }, []);

  const declineRematch = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type: 'game:rematch_decline' }));
    setRematchStatus(null);
  }, []);

  const clearRematchDeclined = useCallback(() => {
    setRematchDeclined(null);
  }, []);

  // WebRTC & Audio/Video Call Methods
  const sendWebRTCSignal = useCallback((targetUserId: string, signal: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'webrtc:signal',
        payload: { targetUserId, signal }
      })
    );
  }, []);

  const sendCameraState = useCallback((isCameraOn: boolean) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'camera:state',
        payload: { isCameraOn }
      })
    );
  }, []);

  const sendVoiceState = useCallback((isMuted: boolean) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'voice:state',
        payload: { isMuted }
      })
    );
  }, []);

  const registerWebRTCListener = useCallback((listener: (fromUserId: string, signal: any) => void) => {
    signalListenersRef.current.add(listener);
    return () => {
      signalListenersRef.current.delete(listener);
    };
  }, []);

  const registerCameraListener = useCallback((listener: (userId: string, isCameraOn: boolean) => void) => {
    cameraListenersRef.current.add(listener);
    return () => {
      cameraListenersRef.current.delete(listener);
    };
  }, []);

  const registerVoiceListener = useCallback((listener: (userId: string, isMuted: boolean) => void) => {
    voiceListenersRef.current.add(listener);
    return () => {
      voiceListenersRef.current.delete(listener);
    };
  }, []);

  const sendNudge = useCallback((targetUserId?: string, message?: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'game:nudge',
        payload: { targetUserId, message }
      })
    );
  }, []);

  const sendLeave = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    try {
      socketRef.current.send(
        JSON.stringify({
          type: 'game:leave',
          payload: {}
        })
      );
    } catch {}
  }, []);

  const dropDisc = useCallback((column: number) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'game:drop_disc',
        payload: { column }
      })
    );
  }, []);

  const makeTicTacToeMove = useCallback((cellIndex: number): boolean => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return false;
    socketRef.current.send(
      JSON.stringify({
        type: 'game:tictactoe_move',
        payload: { cellIndex }
      })
    );
    return true;
  }, []);

  const sendChangeTheme = useCallback((theme: string) => {
    setRoomTheme(theme);
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'game:change_theme',
        payload: { theme }
      })
    );
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'game:typing',
        payload: { isTyping }
      })
    );
  }, []);

  const startBingoGame = useCallback((config?: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'bingo:start',
        payload: { config }
      })
    );
  }, []);

  const callNextBingoNumber = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'bingo:call_next',
        payload: {}
      })
    );
  }, []);

  const claimBingo = useCallback((condition: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'bingo:claim',
        payload: { condition }
      })
    );
  }, []);

  const markBingoNumber = useCallback((number: number, forceMark?: boolean) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'bingo:mark',
        payload: { number, forceMark: Boolean(forceMark) }
      })
    );
  }, []);

  const toggleBingoPause = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'bingo:toggle_pause',
        payload: {}
      })
    );
  }, []);

  const startBingoNextRound = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'bingo:next_round',
        payload: {}
      })
    );
  }, []);

  const updateBingoConfig = useCallback((config: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'bingo:config_update',
        payload: { config }
      })
    );
  }, []);

  const setBingoBoard = useCallback((board: number[][]) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'bingo:set_board',
        payload: { board }
      })
    );
  }, []);

  const selectBingoNumber = useCallback((number: number) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'bingo:select_number',
        payload: { number }
      })
    );
  }, []);

  const selectDoodleRole = useCallback((drawerUserId: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'doodle:select_role',
        payload: { drawerUserId }
      })
    );
  }, []);

  const startDoodleGame = useCallback((config?: Partial<DoodleConfig>) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'doodle:start',
        payload: { config }
      })
    );
  }, []);

  const chooseDoodleWord = useCallback((word: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'doodle:choose_word',
        payload: { word }
      })
    );
  }, []);

  const sendDoodleStroke = useCallback((stroke: DoodleStroke) => {
    // Optimistically add stroke immediately so drawer sees the stroke seamlessly without delay
    setLastDoodleStroke(stroke);
    setGameState((prev: any) => {
      if (!prev) return prev;
      const existing = prev.strokes || [];
      if (existing.some((s: any) => s.id === stroke.id)) {
        return prev;
      }
      return {
        ...prev,
        strokes: [...existing, stroke]
      };
    });

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'doodle:stroke',
        payload: { stroke }
      })
    );
  }, []);

  const undoDoodleStroke = useCallback(() => {
    setGameState((prev: any) => {
      if (!prev || !prev.strokes || prev.strokes.length === 0) return prev;
      return {
        ...prev,
        strokes: prev.strokes.slice(0, -1)
      };
    });

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'doodle:undo',
        payload: {}
      })
    );
  }, []);

  const clearDoodleCanvas = useCallback(() => {
    setGameState((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        strokes: []
      };
    });

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'doodle:clear',
        payload: {}
      })
    );
  }, []);

  const sendDoodleLiveDraw = useCallback((liveStroke: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'doodle:live_draw',
        payload: { liveStroke }
      })
    );
  }, []);

  const sendDoodleDoneDrawing = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'doodle:done_drawing',
        payload: {}
      })
    );
  }, []);

  const sendDoodleGuess = useCallback((guess: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'doodle:guess',
        payload: { guess }
      })
    );
  }, []);

  const requestDoodleHint = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'doodle:request_hint',
        payload: {}
      })
    );
  }, []);

  const updateDoodleConfig = useCallback((config: Partial<DoodleConfig>) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'doodle:config_update',
        payload: { config }
      })
    );
  }, []);

  const sendImposter = useCallback((type: string, payload?: Record<string, unknown>) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type, payload: payload ?? {} }));
  }, []);

  const startImposterGame = useCallback((rounds: number) => sendImposter('imposter:start', { rounds }), [sendImposter]);
  const sendImposterClue = useCallback((word: string) => sendImposter('imposter:clue', { word }), [sendImposter]);
  const sendImposterReady = useCallback(() => sendImposter('imposter:ready'), [sendImposter]);
  const sendImposterVote = useCallback((targetUserId: string) => sendImposter('imposter:vote', { targetUserId }), [sendImposter]);
  const sendImposterGuess = useCallback((guess: string) => sendImposter('imposter:guess', { guess }), [sendImposter]);

  const startMafiaGame = useCallback(() => sendImposter('mafia:start'), [sendImposter]);
  const sendMafiaNightAction = useCallback((action: 'kill' | 'save' | 'investigate', targetUserId: string) => sendImposter('mafia:night_action', { action, targetUserId }), [sendImposter]);
  const sendMafiaReady = useCallback(() => sendImposter('mafia:ready'), [sendImposter]);
  const sendMafiaVote = useCallback((targetUserId: string) => sendImposter('mafia:vote', { targetUserId }), [sendImposter]);

  const startMurderGame = useCallback(() => sendImposter('murder-mystery:start'), [sendImposter]);
  const sendMurderPickCase = useCallback((caseId: string) => sendImposter('murder-mystery:pick_case', { caseId }), [sendImposter]);
  const sendMurderNext = useCallback(() => sendImposter('murder-mystery:next'), [sendImposter]);
  const sendMurderReady = useCallback(() => sendImposter('murder-mystery:ready'), [sendImposter]);
  const sendMurderWhisper = useCallback((toUserId: string, text: string) => sendImposter('murder-mystery:whisper', { toUserId, text }), [sendImposter]);
  const sendMurderShareClue = useCallback((clueId: string) => sendImposter('murder-mystery:share_clue', { clueId }), [sendImposter]);
  const sendMurderAccuse = useCallback((characterId: string, motive: string) => sendImposter('murder-mystery:accuse', { characterId, motive }), [sendImposter]);
  const startQuizGame = useCallback(() => sendImposter('quiz-show:start'), [sendImposter]);
  const sendQuizEdit = useCallback((payload: Record<string, unknown>) => sendImposter('quiz-show:edit', payload), [sendImposter]);
  const sendQuizAnswer = useCallback((questionId: string, optionIndex: number) => sendImposter('quiz-show:answer', { questionId, optionIndex }), [sendImposter]);
  const sendQuizBuzz = useCallback((questionId: string) => sendImposter('quiz-show:buzz', { questionId }), [sendImposter]);
  const sendQuizBuzzAnswer = useCallback((questionId: string, text: string) => sendImposter('quiz-show:buzz_answer', { questionId, text }), [sendImposter]);
  const sendQuizJudge = useCallback((questionId: string, correct: boolean) => sendImposter('quiz-show:judge', { questionId, correct }), [sendImposter]);
  const sendQuizControl = useCallback((action: 'skip' | 'reveal' | 'next' | 'end') => sendImposter('quiz-show:control', { action }), [sendImposter]);
  const quizRematch = useCallback(() => sendImposter('quiz-show:rematch'), [sendImposter]);
  const quizEditAgain = useCallback(() => sendImposter('quiz-show:edit_again'), [sendImposter]);

  const sendTournamentConfig = useCallback((payload: { game?: string; thirdPlace?: boolean; finalBestOf?: 1 | 3 }) => sendImposter('tournament:config', payload), [sendImposter]);
  const shuffleTournamentSeeds = useCallback(() => sendImposter('tournament:shuffle'), [sendImposter]);
  const kickTournamentPlayer = useCallback((userId: string) => sendImposter('tournament:kick', { userId }), [sendImposter]);
  const startTournament = useCallback(() => sendImposter('tournament:start'), [sendImposter]);
  const advanceTournamentPlayer = useCallback((matchId: string, userId: string) => sendImposter('tournament:advance', { matchId, userId }), [sendImposter]);
  const endTournament = useCallback(() => sendImposter('tournament:end'), [sendImposter]);

  const startEmojiCharadesGame = useCallback((rounds: number, mode: string = 'race') => sendImposter('emoji-charades:start', { rounds, mode }), [sendImposter]);
  const sendEmojiCharadesGuess = useCallback((guess: string) => sendImposter('emoji-charades:guess', { guess }), [sendImposter]);

  const startChessGame = useCallback((config?: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'chess:start',
        payload: { config }
      })
    );
  }, []);

  const makeChessMove = useCallback((from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'chess:move',
        payload: { from, to, promotion }
      })
    );
  }, []);

  const resignChess = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'chess:resign',
        payload: {}
      })
    );
  }, []);

  const offerChessDraw = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'chess:offer_draw',
        payload: {}
      })
    );
  }, []);

  const respondChessDraw = useCallback((accept: boolean) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'chess:draw_response',
        payload: { accept }
      })
    );
    setChessDrawOffer(null);
  }, []);

  const requestChessTakeback = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'chess:request_takeback',
        payload: {}
      })
    );
  }, []);

  const respondChessTakeback = useCallback((accept: boolean) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'chess:takeback_response',
        payload: { accept }
      })
    );
    setChessTakebackRequest(null);
  }, []);

  const updateChessConfig = useCallback((config: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'chess:config_update',
        payload: { config }
      })
    );
  }, []);

  // Periodic cleanup of stale typing indicators (> 3.5s)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        let changed = false;
        const next = { ...prev };
        for (const [uid, info] of Object.entries(next)) {
          if (now - info.timestamp > 3500) {
            delete next[uid];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  return {
    room,
    roomTheme,
    players: room?.players || [],
    gameState,
    myPlayer,
    myUserId,
    isMyTurn,
    canRoll,
    canMove,
    legalMoves,
    lastDiceRoll,
    lastTokenMove,
    lastDiscDrop,
    lastTicTacToeMove,
    lastBingoCall,
    lastBingoClaimResult,
    lastBingoConditionWon,
    lastDoodleStroke,
    liveDoodleStroke,
    lastDoodleGuess,
    doodleError,
    chatMessages,
    typingUsers,
    floatingReactions,
    connectionStatus,
    error,
    gameError,
    lastError: gameError,
    clearGameError,
    notAPlayer,
    isSpectator,
    spectatorCount,
    spectators,
    spectatorLimit,
    rematchUnavailable,
    connectionStopped,
    reconnectAttempt,
    isReconnecting: connectionStatus === 'RECONNECTING',
    disconnectedPlayer,
    nudgeAlert,
    clearNudgeAlert: () => setNudgeAlert(null),
    ludoTurnTimer,
    opponentLeftWin,
    clearOpponentLeftWin: () => setOpponentLeftWin(null),
    rollDice,
    moveToken,
    dropDisc,
    makeTicTacToeMove,
    startBingoGame,
    callNextBingoNumber,
    toggleBingoPause,
    startBingoNextRound,
    claimBingo,
    markBingoNumber,
    updateBingoConfig,
    setBingoBoard,
    selectBingoNumber,
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
    startImposterGame,
    sendImposterClue,
    sendImposterReady,
    sendImposterVote,
    sendImposterGuess,
    startMafiaGame,
    sendMafiaNightAction,
    sendMafiaReady,
    sendMafiaVote,
    startMurderGame,
    sendMurderPickCase,
    sendMurderNext,
    sendMurderReady,
    sendMurderWhisper,
    sendMurderShareClue,
    sendMurderAccuse,
    startQuizGame,
    sendQuizEdit,
    sendQuizAnswer,
    sendQuizBuzz,
    sendQuizBuzzAnswer,
    sendQuizJudge,
    sendQuizControl,
    quizRematch,
    quizEditAgain,
    sendTournamentConfig,
    shuffleTournamentSeeds,
    kickTournamentPlayer,
    startTournament,
    advanceTournamentPlayer,
    endTournament,
    tournamentMatchReady,
    clearTournamentMatchReady: () => setTournamentMatchReady(null),
    tournamentKicked,
    startEmojiCharadesGame,
    sendEmojiCharadesGuess,
    lastChessMove,
    chessMoveError,
    clearChessMoveError: () => setChessMoveError(null),
    chessDrawOffer,
    chessTakebackRequest,
    chessClockTick,
    startChessGame,
    makeChessMove,
    resignChess,
    offerChessDraw,
    respondChessDraw,
    requestChessTakeback,
    respondChessTakeback,
    updateChessConfig,
    sendChat,
    sendReaction,
    sendNudge,
    sendLeave,
    sendChangeTheme,
    sendTyping,
    rematch,
    rematchStatus,
    declineRematch,
    rematchDeclined,
    gameActionError,
    clearGameActionError: () => setGameActionError(null),
    clearRematchDeclined,
    sendWebRTCSignal,
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener,
    streakCelebration,
    clearStreakCelebration: () => setStreakCelebration(null)
  };
}
