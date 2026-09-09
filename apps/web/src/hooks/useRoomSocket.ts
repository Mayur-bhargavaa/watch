'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomMember,
  RoomPlaybackState,
  Reaction,
  ChatMessage,
  Role,
  WSMessage,
  ClockSyncSample,
  aggregateClockOffset,
  calculateAuthoritativePosition
} from '@synccinema/common';
import { API_BASE, WS_BASE, getStoredSession, ensureSession } from '../lib/api';

export interface RoomSocketState {
  connectionStatus: 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';
  room: Room | null;
  members: RoomMember[];
  myRole: Role;
  clockOffsetMs: number;
  rttMs: number;
  chatMessages: ChatMessage[];
  latestReactions: Reaction[];
  screenPresenter: { userId: string; displayName: string } | null;
  myUserId: string;
  error: string | null;
  typingUsers: string[];
}

export function useRoomSocket(slug: string) {
  const [state, setState] = useState<RoomSocketState>({
    connectionStatus: 'CONNECTING',
    room: null,
    members: [],
    myRole: 'PARTICIPANT',
    clockOffsetMs: 0,
    rttMs: 0,
    chatMessages: [],
    latestReactions: [],
    screenPresenter: null,
    myUserId: '',
    error: null,
    typingUsers: []
  });

  const signalListenersRef = useRef<Set<(fromUserId: string, signal: any) => void>>(new Set());
  const cameraListenersRef = useRef<Set<(userId: string, isCameraOn: boolean) => void>>(new Set());
  const voiceListenersRef = useRef<Set<(userId: string, isMuted: boolean) => void>>(new Set());
  const gameListenersRef = useRef<Set<(senderId: string, payload: any) => void>>(new Set());
  const countdownListenersRef = useRef<Set<() => void>>(new Set());
  const typingTimeoutsRef = useRef<Map<string, any>>(new Map());
  const socketRef = useRef<WebSocket | null>(null);
  const syncSamplesRef = useRef<ClockSyncSample[]>([]);
  const pingIntervalRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const isLeavingRef = useRef<boolean>(false);
  const isUnmountedRef = useRef<boolean>(false);

  const getAuthoritativeServerTime = useCallback(() => {
    return Date.now() + state.clockOffsetMs;
  }, [state.clockOffsetMs]);

  const getAuthoritativePosition = useCallback(() => {
    if (!state.room) return 0;
    return calculateAuthoritativePosition(state.room.playbackState, getAuthoritativeServerTime());
  }, [state.room, getAuthoritativeServerTime]);

  const send = useCallback((type: string, payload: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const msg: WSMessage = {
        type,
        roomId: state.room?.id || slug,
        timestamp: Date.now(),
        payload
      };
      socketRef.current.send(JSON.stringify(msg));
    }
  }, [state.room, slug]);

  const sendPlaybackCommand = useCallback((action: 'PLAY' | 'PAUSE' | 'SEEK', position: number) => {
    if (!state.room) return;
    send('playback:command', {
      action,
      position,
      version: state.room.playbackState.version
    });
  }, [state.room, send]);

  const sendReaction = useCallback((code: string, emoji: string, mediaTimestamp: number) => {
    send('reaction:send', {
      code,
      emoji,
      mediaTimestamp
    });
  }, [send]);

  const sendChatMessage = useCallback((content: string, mediaTimestamp?: number | null) => {
    send('chat:send', {
      content,
      mediaTimestamp
    });
  }, [send]);

  const deleteChatMessage = useCallback((messageId: string) => {
    send('chat:delete', { messageId });
  }, [send]);

  const sendTyping = useCallback((isTyping: boolean) => {
    send('chat:typing', { isTyping });
  }, [send]);

  const updatePresenceState = useCallback((status: 'ONLINE' | 'CONNECTING' | 'WATCHING' | 'AWAY') => {
    send('presence:state', { status });
  }, [send]);

  const sendMediaChange = useCallback((
    sourceUrl: string,
    title: string,
    provider: any,
    providerMediaId?: string
  ) => {
    send('media:change', {
      sourceUrl,
      title,
      provider,
      providerMediaId,
      durationSeconds: 0
    });
  }, [send]);

  const transferHost = useCallback((targetUserId: string) => {
    send('host:transfer', { targetUserId });
  }, [send]);

  const sendVoiceSignal = useCallback((targetUserId: string, signal: any) => {
    send('voice:signal', { targetUserId, signal });
  }, [send]);

  const sendWebRTCSignal = useCallback((targetUserId: string, signal: any) => {
    send('webrtc:signal', { targetUserId, signal });
  }, [send]);

  const sendScreenState = useCallback((isSharing: boolean) => {
    send('screen:state', { isSharing });
  }, [send]);

  const registerWebRTCListener = useCallback((listener: (fromUserId: string, signal: any) => void) => {
    signalListenersRef.current.add(listener);
    return () => {
      signalListenersRef.current.delete(listener);
    };
  }, []);

  const sendCameraState = useCallback((isCameraOn: boolean) => {
    send('camera:state', { isCameraOn });
  }, [send]);

  const sendVoiceState = useCallback((isMuted: boolean) => {
    send('voice:state', { isMuted });
  }, [send]);

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

  const sendGameAction = useCallback((payload: any) => {
    send('game:action', payload);
  }, [send]);

  const registerGameListener = useCallback((listener: (senderId: string, payload: any) => void) => {
    gameListenersRef.current.add(listener);
    return () => {
      gameListenersRef.current.delete(listener);
    };
  }, []);

  const sendCountdownStart = useCallback(() => {
    send('countdown:start', {});
  }, [send]);

  const sendRoomTheme = useCallback((themeId: string) => {
    send('room:theme', { themeId });
  }, [send]);

  const registerCountdownListener = useCallback((listener: () => void) => {
    countdownListenersRef.current.add(listener);
    return () => {
      countdownListenersRef.current.delete(listener);
    };
  }, []);

  const leaveRoom = useCallback(() => {
    isLeavingRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify({
          type: 'room:leave',
          roomId: slug,
          timestamp: Date.now(),
          payload: {}
        }));
      } catch {}
      try {
        socketRef.current.close(1000, 'User left');
      } catch {}
    }
  }, [slug]);

  const endRoomForAll = useCallback(() => {
    isLeavingRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify({
          type: 'room:end',
          roomId: slug,
          timestamp: Date.now(),
          payload: {}
        }));
      } catch {}
    }
  }, [slug]);

  // Connect WebSocket
  const connect = useCallback(() => {
    if (!slug) return;
    setState(s => ({ ...s, connectionStatus: s.room ? 'RECONNECTING' : 'CONNECTING' }));

    const session = getStoredSession();
    let tokenParam = '';
    if (session?.token) {
      tokenParam = `token=${session.token}`;
      setState(s => ({ ...s, myUserId: session.user.id }));
    } else if (typeof window !== 'undefined') {
      let storedGuestName = localStorage.getItem('synccinema_guest_name');
      if (!storedGuestName) {
        storedGuestName = `Viewer_${Math.floor(Math.random() * 9000 + 1000)}`;
        localStorage.setItem('synccinema_guest_name', storedGuestName);
      }
      let storedGuestId = localStorage.getItem('synccinema_guest_id');
      if (!storedGuestId) {
        storedGuestId = `guest_${Math.random().toString(36).substring(2, 10)}`;
        localStorage.setItem('synccinema_guest_id', storedGuestId);
      }
      setState(s => ({ ...s, myUserId: s.myUserId || storedGuestId }));
      tokenParam = `guestId=${encodeURIComponent(storedGuestId)}&guestName=${encodeURIComponent(storedGuestName)}`;
    }
    const wsUrl = `${WS_BASE}/ws/rooms/${slug}?${tokenParam}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setState(s => ({ ...s, connectionStatus: 'CONNECTED', error: null }));
      // Request immediate authoritative state snapshot
      ws.send(JSON.stringify({
        type: 'room:get_state',
        roomId: slug,
        timestamp: Date.now(),
        payload: {}
      }));

      // Run initial clock synchronization burst
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'sync:ping',
              roomId: slug,
              timestamp: Date.now(),
              payload: { t1: Date.now() }
            }));
          }
        }, i * 250);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage<any>;
        switch (msg.type) {
          case 'sync:pong': {
            const t2 = Date.now();
            const sample: ClockSyncSample = {
              clientSentTime: msg.payload.t1,
              serverTime: msg.payload.serverTime,
              clientReceivedTime: t2
            };
            syncSamplesRef.current.push(sample);
            if (syncSamplesRef.current.length > 10) {
              syncSamplesRef.current.shift();
            }
            const agg = aggregateClockOffset(syncSamplesRef.current);
            setState(s => ({ ...s, clockOffsetMs: agg.offset, rttMs: agg.roundTripTime }));
            break;
          }

          case 'room:state': {
            const payload = msg.payload;
            const activeOnly = (payload.members || []).filter((m: any) => m.isConnected !== false);
            setState(s => ({
              ...s,
              room: payload.room,
              members: activeOnly,
              myRole: payload.myRole,
              myUserId: payload.myUserId || s.myUserId,
              chatMessages: payload.recentChat || [],
              latestReactions: payload.recentReactions || [],
              screenPresenter: payload.activeScreenPresenter || null
            }));
            break;
          }

          case 'screen:state': {
            const { isSharing, presenterId, presenterName } = msg.payload;
            setState(s => ({
              ...s,
              screenPresenter: isSharing && presenterId ? { userId: presenterId, displayName: presenterName || 'Host' } : null
            }));
            break;
          }

          case 'webrtc:signal':
          case 'voice:signal': {
            const { fromUserId, signal } = msg.payload;
            signalListenersRef.current.forEach(listener => {
              try {
                listener(fromUserId, signal);
              } catch (err) {
                console.error('Error in WebRTC signal listener:', err);
              }
            });
            break;
          }

          case 'camera:state': {
            const { userId, isCameraOn } = msg.payload;
            cameraListenersRef.current.forEach(listener => {
              try {
                listener(userId, isCameraOn);
              } catch (err) {
                console.error('Error in camera state listener:', err);
              }
            });
            break;
          }

          case 'voice:state': {
            const { userId, isMuted } = msg.payload;
            voiceListenersRef.current.forEach(listener => {
              try {
                listener(userId, isMuted);
              } catch (err) {
                console.error('Error in voice state listener:', err);
              }
            });
            break;
          }

          case 'playback:update': {
            const { playbackState } = msg.payload;
            setState(s => {
              if (!s.room) return s;
              return {
                ...s,
                room: {
                  ...s.room,
                  playbackState
                }
              };
            });
            break;
          }

          case 'room:theme': {
            const { themeId } = msg.payload;
            setState(s => {
              if (!s.room) return s;
              return {
                ...s,
                room: {
                  ...s.room,
                  themeId
                }
              };
            });
            break;
          }

          case 'reaction:broadcast': {
            const reaction = msg.payload as Reaction;
            setState(s => ({
              ...s,
              latestReactions: [reaction, ...s.latestReactions.slice(0, 49)]
            }));
            break;
          }

          case 'chat:message': {
            const chatMsg = msg.payload as ChatMessage;
            setState(s => ({
              ...s,
              chatMessages: [...s.chatMessages, chatMsg]
            }));
            break;
          }

          case 'chat:deleted': {
            const { messageId } = msg.payload;
            setState(s => ({
              ...s,
              chatMessages: s.chatMessages.filter(c => c.id !== messageId)
            }));
            break;
          }

          case 'chat:typing': {
            const { userId, userName, isTyping } = msg.payload;
            setState(s => {
              if (userId === s.myUserId) return s;
              const name = userName || 'Viewer';
              const existingTimer = typingTimeoutsRef.current.get(userId);
              if (existingTimer) {
                clearTimeout(existingTimer);
                typingTimeoutsRef.current.delete(userId);
              }

              if (isTyping) {
                const timer = setTimeout(() => {
                  setState(curr => ({
                    ...curr,
                    typingUsers: curr.typingUsers.filter(u => u !== name)
                  }));
                  typingTimeoutsRef.current.delete(userId);
                }, 3000);
                typingTimeoutsRef.current.set(userId, timer);

                if (!s.typingUsers.includes(name)) {
                  return { ...s, typingUsers: [...s.typingUsers, name] };
                }
                return s;
              } else {
                return {
                  ...s,
                  typingUsers: s.typingUsers.filter(u => u !== name)
                };
              }
            });
            break;
          }

          case 'presence:state_update': {
            const { userId, status } = msg.payload;
            setState(s => ({
              ...s,
              members: s.members.map(m => m.userId === userId ? { ...m, status } : m)
            }));
            break;
          }

          case 'presence:update': {
            const { member, status } = msg.payload;
            setState(s => {
              let updatedMembers = [...s.members];
              if (status === 'DISCONNECTED' || status === 'LEFT') {
                return {
                  ...s,
                  members: updatedMembers.filter(m => m.userId !== member.userId)
                };
              }
              const idx = updatedMembers.findIndex(m => m.userId === member.userId);
              if (status === 'JOINED' || status === 'RECONNECTED') {
                if (idx >= 0) {
                  updatedMembers[idx] = member;
                } else {
                  updatedMembers.push(member);
                }
              }
              return { ...s, members: updatedMembers.filter(m => m.isConnected !== false) };
            });
            break;
          }

          case 'media:updated': {
            const { media, playbackState } = msg.payload;
            setState(s => {
              if (!s.room) return s;
              return {
                ...s,
                room: {
                  ...s.room,
                  currentMedia: media,
                  playbackState
                }
              };
            });
            break;
          }

          case 'host:update': {
            const { newHostId } = msg.payload;
            const mySession = getStoredSession();
            const amINewHost = mySession?.user.id === newHostId;
            setState(s => ({
              ...s,
              myRole: amINewHost ? 'HOST' : (s.myRole === 'HOST' ? 'PARTICIPANT' : s.myRole),
              room: s.room ? { ...s.room, hostId: newHostId } : null,
              members: s.members.map(m => ({
                ...m,
                role: m.userId === newHostId ? 'HOST' : (m.role === 'HOST' ? 'PARTICIPANT' : m.role)
              }))
            }));
            break;
          }

          case 'error:notification': {
            setState(s => ({ ...s, error: msg.payload.message }));
            break;
          }

          case 'game:action': {
            gameListenersRef.current.forEach(listener => listener(msg.senderId || '', msg.payload));
            break;
          }

          case 'partner:ping': {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('stitchbyte:partner-ping', { detail: msg.payload }));
            }
            break;
          }

          case 'countdown:start': {
            countdownListenersRef.current.forEach(listener => {
              try {
                listener();
              } catch (err) {
                console.error('Error in countdown listener:', err);
              }
            });
            break;
          }

          case 'room:ended': {
            isLeavingRef.current = true;
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            setState(s => ({
              ...s,
              error: msg.payload?.message || 'The host has ended the watch party.'
            }));
            break;
          }
        }
      } catch (err) {
        console.error('Failed to parse WS incoming message:', err);
      }
    };

    ws.onclose = (event: CloseEvent) => {
      setState(s => ({ ...s, connectionStatus: 'DISCONNECTED' }));
      // Do NOT reconnect if room capacity was reached or room ended or intentional leave
      if (event.code === 1008 || event.reason === 'ROOM_CAPACITY_REACHED') {
        isLeavingRef.current = true;
        setState(s => ({
          ...s,
          error: s.error || 'This watch party is full (6/6 participants limit reached).'
        }));
        return;
      }
      // ONLY attempt auto-reconnect if NOT an intentional leave AND component is still mounted
      if (!isLeavingRef.current && !isUnmountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isLeavingRef.current && !isUnmountedRef.current) {
            connect();
          }
        }, 2000);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket connection error:', err);
      ws.close();
    };
  }, [slug]);

  useEffect(() => {
    // 1. Instant HTTP fetch to guarantee immediate UI render
    fetch(`${API_BASE}/api/rooms/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error('Room not found');
        return res.json();
      })
      .then(data => {
        if (data && data.room) {
          setState(s => ({
            ...s,
            room: s.room || data.room,
            members: s.members.length > 0 ? s.members : data.members || []
          }));
        }
      })
      .catch(err => {
        console.warn('Initial HTTP fetch error:', err);
      });

    // 2. Connect real-time WebSocket
    connect();

    // Recurring clock ping every 25 seconds
    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'sync:ping',
          roomId: slug,
          timestamp: Date.now(),
          payload: { t1: Date.now() }
        }));
      }
    }, 25000);

    const handleBeforeUnload = () => {
      isLeavingRef.current = true;
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(JSON.stringify({
            type: 'room:leave',
            roomId: slug,
            timestamp: Date.now(),
            payload: {}
          }));
          socketRef.current.close(1000, 'Tab closed');
        } catch {}
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('pagehide', handleBeforeUnload);
    }

    return () => {
      isUnmountedRef.current = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('pagehide', handleBeforeUnload);
      }
      clearInterval(pingIntervalRef.current);
      clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        try {
          if (socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
              type: 'room:leave',
              roomId: slug,
              timestamp: Date.now(),
              payload: {}
            }));
          }
          socketRef.current.close(1000, 'Component unmounted');
        } catch {}
      }
    };
  }, [connect, slug]);

  return {
    ...state,
    getAuthoritativeServerTime,
    getAuthoritativePosition,
    sendPlaybackCommand,
    sendReaction,
    sendChatMessage,
    deleteChatMessage,
    sendTyping,
    updatePresenceState,
    sendMediaChange,
    transferHost,
    sendVoiceSignal,
    sendWebRTCSignal,
    sendScreenState,
    registerWebRTCListener,
    sendCameraState,
    sendVoiceState,
    registerCameraListener,
    registerVoiceListener,
    sendGameAction,
    registerGameListener,
    sendCountdownStart,
    registerCountdownListener,
    sendRoomTheme,
    leaveRoom,
    endRoomForAll
  };
}
