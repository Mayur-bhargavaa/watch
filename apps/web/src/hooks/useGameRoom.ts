'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameRoom,
  GameRoomPlayer,
  LudoGameState,
  LudoColor
} from '@synccinema/common';
import { WS_BASE, getStoredSession, ensureSession } from '../lib/api';

export interface GameChatMessage {
  id: string;
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  content: string;
  timestamp: number;
}

export interface FloatingReaction {
  id: string;
  userId: string;
  userName: string;
  emoji: string;
  timestamp: number;
}

export interface DiceRollEvent {
  seat: number;
  color: LudoColor;
  displayName: string;
  diceValue: number;
  hasLegalMoves: boolean;
  earnedBonusRoll: boolean;
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

export function useGameRoom(roomCode: string | null) {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [myUserId, setMyUserId] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<
    'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED'
  >('CONNECTING');
  const [chatMessages, setChatMessages] = useState<GameChatMessage[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [lastDiceRoll, setLastDiceRoll] = useState<DiceRollEvent | null>(null);
  const [lastDiscDrop, setLastDiscDrop] = useState<DiscDropEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disconnectedPlayer, setDisconnectedPlayer] = useState<{
    userId: string;
    displayName: string;
    isLeft: boolean;
    timestamp: number;
  } | null>(null);
  const [nudgeAlert, setNudgeAlert] = useState<{
    fromDisplayName: string;
    timestamp: number;
  } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const hasTerminalErrorRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const lastChatSendRef = useRef<number>(0);

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
          handleMessage(msg);
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
        if (payload.myUserId) {
          setMyUserId(payload.myUserId);
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
        const { userId, displayName } = msg.payload;
        setRoom(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            players: prev.players.map(p =>
              p.userId === userId ? { ...p, isConnected: false, status: 'LEFT' as any } : p
            )
          };
        });
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

      case 'game:nudge': {
        const { fromDisplayName, fromUserId, targetUserId } = msg.payload;
        if (!targetUserId || targetUserId === myUserId) {
          setNudgeAlert({
            fromDisplayName: fromDisplayName || 'Partner',
            timestamp: Date.now()
          });
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

      case 'game:started': {
        const { gameState: startState, room: updatedRoom } = msg.payload;
        setGameState(startState);
        setRoom(prev => {
          if (updatedRoom) return updatedRoom;
          return prev ? { ...prev, status: 'PLAYING', gameState: startState } : prev;
        });
        break;
      }

      case 'game:dice_rolled': {
        const { seat, color, displayName, diceValue, hasLegalMoves, earnedBonusRoll, gameState: nextState } = msg.payload;
        setGameState(nextState);
        setLastDiceRoll({
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
        const { gameState: nextState } = msg.payload;
        setGameState(nextState);
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
          return [...prev.slice(-49), chat];
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

  const sendChat = useCallback((content: string) => {
    const now = Date.now();
    if (now - lastChatSendRef.current < 350) return;
    lastChatSendRef.current = now;

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !content.trim()) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'game:chat',
        payload: { content: content.trim() }
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

  const sendNudge = useCallback((targetUserId?: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'game:nudge',
        payload: { targetUserId }
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

  return {
    room,
    players: room?.players || [],
    gameState,
    myPlayer,
    myUserId,
    isMyTurn,
    canRoll,
    canMove,
    legalMoves,
    lastDiceRoll,
    lastDiscDrop,
    chatMessages,
    floatingReactions,
    connectionStatus,
    error,
    disconnectedPlayer,
    nudgeAlert,
    rollDice,
    moveToken,
    dropDisc,
    sendChat,
    sendReaction,
    sendNudge,
    sendLeave,
    rematch,
    sendWebRTCSignal,
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener
  };
}
