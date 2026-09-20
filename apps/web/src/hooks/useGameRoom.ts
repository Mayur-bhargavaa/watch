'use client';

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
import { WS_BASE, getStoredSession, ensureSession } from '../lib/api';

export interface GameChatMessage {
  id: string;
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  content: string;
  timestamp: number;
  replyTo?: ChatReplyTo | null;
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
}

export interface TokenMovedEvent {
  moveId?: string;
  timestamp?: number;
  seat: number;
  color: LudoColor;
  displayName: string;
  tokenId: number;
  capturedToken?: { color: LudoColor; tokenId: number };
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

export function useGameRoom(roomCode: string | null) {
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
  const [lastDoodleGuess, setLastDoodleGuess] = useState<DoodleGuess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disconnectedPlayer, setDisconnectedPlayer] = useState<{
    userId: string;
    displayName: string;
    isLeft: boolean;
    timestamp: number;
  } | null>(null);
  const [nudgeAlert, setNudgeAlert] = useState<{
    fromDisplayName: string;
    message?: string;
    timestamp: number;
  } | null>(null);
  const [rematchStatus, setRematchStatus] = useState<{
    votedUserIds: string[];
    votedCount: number;
    totalNeeded: number;
    allVoted: boolean;
  } | null>(null);
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
  const isUnmountedRef = useRef(false);
  const lastChatSendRef = useRef<number>(0);
  const myUserIdRef = useRef<string>('');
  const roomRef = useRef<GameRoom | null>(null);
  const gameStateRef = useRef<any>(null);
  const handleMessageRef = useRef<((msg: any) => void) | null>(null);

  // WebRTC & Audio/Video Call Listeners
  const signalListenersRef = useRef<Set<(fromUserId: string, signal: any) => void>>(new Set());
  const cameraListenersRef = useRef<Set<(userId: string, isCameraOn: boolean) => void>>(new Set());
  const voiceListenersRef = useRef<Set<(userId: string, isMuted: boolean) => void>>(new Set());

  // Derive my player
  const myPlayer: GameRoomPlayer | null =
    room?.players.find(p => p.userId === myUserId) || null;

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

  const connect = useCallback(async () => {
    if (!roomCode || isUnmountedRef.current) return;

    try {
      hasTerminalErrorRef.current = false;
      setConnectionStatus('CONNECTING');
      let session = getStoredSession();
      if (!session) {
        session = await ensureSession();
      }

      setMyUserId(session.user.id);
      myUserIdRef.current = session.user.id;

      // Build websocket URL
      let wsUrl = `${WS_BASE}/ws/games/${encodeURIComponent(roomCode.toUpperCase())}`;
      if (session.token) {
        wsUrl += `?token=${encodeURIComponent(session.token)}`;
      } else {
        wsUrl += `?guestId=${session.user.id}&guestName=${encodeURIComponent(session.user.displayName)}`;
      }

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (isUnmountedRef.current) return;
        setConnectionStatus('CONNECTED');
        setError(null);
      };

      socket.onmessage = (event) => {
        if (isUnmountedRef.current) return;
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

      socket.onclose = () => {
        if (isUnmountedRef.current) return;
        setConnectionStatus('DISCONNECTED');
        if (!hasTerminalErrorRef.current) {
          // Auto-reconnect after 2 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isUnmountedRef.current && roomCode && !hasTerminalErrorRef.current) {
              connect();
            }
          }, 2000);
        }
      };
    } catch (err: any) {
      if (!isUnmountedRef.current) {
        setError(err?.message || 'Failed to connect to game');
        setConnectionStatus('DISCONNECTED');
      }
    }
  }, [roomCode]);

  const handleMessage = (msg: any) => {
    switch (msg.type) {
      case 'game:sync': {
        const payload = msg.payload;
        if (payload.room) {
          setRoom(payload.room);
          if (payload.room.gameState) {
            setGameState(payload.room.gameState);
          }
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
          if (updatedRoom.gameState) {
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
          gameState: updatedState
        } = msg.payload;

        setRoom(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            status: isWinner ? 'FINISHED' : prev.status,
            players: prev.players.map(p =>
              p.userId === userId ? { ...p, isConnected: false, status: 'LEFT' as any } : p
            )
          };
        });

        const currentUserId = myUserIdRef.current || myUserId;
        const currentRoom = roomRef.current || room;
        const remainingHuman = currentRoom?.players.find(p => p.userId !== userId);
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
              winner: prev.winner || (winnerColor === 'red' ? 'R' : 'Y'),
              statusMessage: forfeitMessage || `${displayName || 'Opponent'} left the game. You are the winner! 🏆`
            };
          });
        }

        if (!isMeLeaving) {
          const winnerName = winnerDisplayName || remainingHuman?.displayName || 'You';
          const winnerId = winnerUserId || remainingHuman?.userId || currentUserId;
          const winnerCol = winnerColor || remainingHuman?.color;

          setOpponentLeftWin({
            opponentDisplayName: displayName || 'Opponent',
            winnerDisplayName: winnerName,
            winnerUserId: winnerId,
            winnerColor: winnerCol,
            message: forfeitMessage || `${displayName || 'Opponent'} has left the game. You are the winner! 🏆`
          });

          // Ensure local gameState displays this win immediately
          setGameState((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              winnerUserId: winnerId,
              winnerColor: winnerCol || prev.winnerColor,
              winner: prev.winner || (winnerCol === 'red' ? 'R' : 'Y'),
              statusMessage: forfeitMessage || `${displayName || 'Opponent'} left the game. You are the winner! 🏆`
            };
          });
        }

        setDisconnectedPlayer({
          userId,
          displayName: displayName || 'Player',
          isLeft: true,
          timestamp: Date.now()
        });
        break;
      }

      case 'game:player_disconnected': {
        const { userId, displayName } = msg.payload;
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
          timestamp: Date.now()
        });
        break;
      }

      case 'game:player_reconnected': {
        const { userId, room: updatedRoom } = msg.payload;
        if (updatedRoom) {
          setRoom(updatedRoom);
          if (updatedRoom.gameState) {
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

        if (!isFromMe && isTargetedToMe) {
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
            emoji: '🔔',
            timestamp: Date.now()
          };
          setFloatingReactions(prev => [...prev, reaction]);
          setTimeout(() => {
            setFloatingReactions(prev => prev.filter(r => r.id !== reaction.id));
          }, 3500);
        }
        break;
      }

      case 'game:rematch_status': {
        setRematchStatus(msg.payload);
        if (msg.payload?.room) {
          setRoom(msg.payload.room);
        } else {
          setRoom(prev => (prev ? { ...prev, status: 'WAITING' } : null));
        }
        setGameState(null);
        break;
      }

      case 'game:rematch_agreed': {
        setRematchStatus({
          votedUserIds: [],
          votedCount: 2,
          totalNeeded: 2,
          allVoted: true
        });
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
            remainingCount: startState.callQueue?.length ?? 89,
            timestamp: Date.now()
          });
        }
        break;
      }

      case 'game:dice_rolled': {
        const { rollId, timestamp, seat, color, displayName, diceValue, hasLegalMoves, earnedBonusRoll, gameState: nextState } = msg.payload;
        setGameState(nextState);
        setLastDiceRoll({
          rollId: rollId || `roll_${Date.now()}_${Math.random()}`,
          timestamp: timestamp || Date.now(),
          seat,
          color,
          displayName,
          diceValue,
          hasLegalMoves,
          earnedBonusRoll
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
          reachedHome,
          earnedBonusRoll,
          isWinner,
          winnerColor,
          winnerUserId
        });
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

      case 'doodle:state_sync':
      case 'doodle:role_selected': {
        const nextState = msg.payload?.gameState;
        if (nextState) {
          setGameState(nextState);
          if (nextState.phase && nextState.phase !== 'LOBBY' && nextState.phase !== 'ROLE_SELECTION') {
            setRoom(prev => (prev ? { ...prev, status: 'PLAYING', gameState: nextState } : prev));
          }
        }
        break;
      }

      case 'doodle:stroke_added': {
        const stroke = msg.payload?.stroke;
        if (stroke) {
          setLastDoodleStroke(stroke);
          setGameState((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              strokes: [...(prev.strokes || []), stroke]
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

      case 'doodle:canvas_cleared': {
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
        const { guess, gameState: nextState } = msg.payload || {};
        if (guess) setLastDoodleGuess(guess);
        if (nextState) setGameState(nextState);
        break;
      }

      case 'doodle:config_updated': {
        const { config } = msg.payload || {};
        setGameState((prev: any) => prev ? { ...prev, config } : prev);
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
        const reaction: FloatingReaction = {
          id: `react_${Date.now()}_${Math.random()}`,
          userId: msg.payload.userId,
          userName: msg.payload.userName,
          emoji: msg.payload.emoji,
          timestamp: msg.payload.timestamp
        };
        setFloatingReactions(prev => [...prev, reaction]);
        setTimeout(() => {
          setFloatingReactions(prev => prev.filter(r => r.id !== reaction.id));
        }, 3500);
        break;
      }

      case 'error:notification': {
        hasTerminalErrorRef.current = true;
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        setError(msg.payload?.message || 'Game room error');
        setConnectionStatus('DISCONNECTED');
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
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

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

  const makeTicTacToeMove = useCallback((cellIndex: number) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'game:tictactoe_move',
        payload: { cellIndex }
      })
    );
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

  const markBingoNumber = useCallback((number: number) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'bingo:mark',
        payload: { number }
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
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'doodle:stroke',
        payload: { stroke }
      })
    );
  }, []);

  const undoDoodleStroke = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'doodle:undo',
        payload: {}
      })
    );
  }, []);

  const clearDoodleCanvas = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'doodle:clear',
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
    lastDoodleGuess,
    chatMessages,
    typingUsers,
    floatingReactions,
    connectionStatus,
    error,
    disconnectedPlayer,
    nudgeAlert,
    clearNudgeAlert: () => setNudgeAlert(null),
    opponentLeftWin,
    clearOpponentLeftWin: () => setOpponentLeftWin(null),
    rollDice,
    moveToken,
    dropDisc,
    makeTicTacToeMove,
    startBingoGame,
    callNextBingoNumber,
    claimBingo,
    markBingoNumber,
    updateBingoConfig,
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
    sendNudge,
    sendLeave,
    sendChangeTheme,
    sendTyping,
    rematch,
    rematchStatus,
    sendWebRTCSignal,
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener
  };
}
