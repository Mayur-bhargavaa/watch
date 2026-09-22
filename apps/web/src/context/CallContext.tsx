'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getStoredSession } from '../lib/api';
import { ChatStore } from '../lib/chatStore';
import { CallSignaling } from '../lib/callSignaling';
import { CallRingtone } from '../lib/callRingtone';

export interface ActiveCall {
  callId: string;
  type: 'voice' | 'video';
  status: 'outgoing_ringing' | 'incoming' | 'connected' | 'ended';
  peer: {
    id: string;
    name: string;
    avatar?: string;
  };
  duration: number;
  isMuted: boolean;
  isVideoOff: boolean;
  isMinimized: boolean;
  reason?: string;
}

interface CallContextValue {
  activeCall: ActiveCall | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (peerId: string, peerName: string, peerAvatar?: string, type?: 'voice' | 'video') => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleMinimize: () => void;
  switchCallType: () => void;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to cleanup media streams
  const cleanupMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setRemoteStream(null);
    CallRingtone.stopRingtone();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoTimeoutRef.current) {
      clearTimeout(autoTimeoutRef.current);
      autoTimeoutRef.current = null;
    }
  }, []);

  // Timer for connected call duration
  useEffect(() => {
    if (activeCall?.status === 'connected') {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setActiveCall((prev) => (prev ? { ...prev, duration: prev.duration + 1 } : null));
        }, 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [activeCall?.status]);

  // Handle incoming signaling messages
  useEffect(() => {
    const unsubscribe = CallSignaling.subscribe(async (data: any) => {
      if (!data || !data.type) return;

      // 1. Incoming Call alert from someone else
      if (data.type === 'call:incoming') {
        const session = getStoredSession();
        // If already in a call, reject with busy
        if (activeCall && activeCall.status !== 'ended') {
          ChatStore.sendRawSocket({
            type: 'call:reject',
            callId: data.callId,
            callerId: data.callerId,
            reason: 'busy',
          });
          return;
        }

        // Start incoming ringing audio
        CallRingtone.startIncomingRingtone();

        // Browser push notification if tab is in background
        if (typeof document !== 'undefined' && document.hidden) {
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`📞 Incoming ${data.callType === 'video' ? 'Video' : 'Voice'} Call`, {
                body: `${data.callerName || 'A friend'} is calling you on Watch Party`,
                icon: data.callerAvatar || '/icon-192.png',
              });
            } catch {}
          }
        }

        setActiveCall({
          callId: data.callId,
          type: data.callType || 'voice',
          status: 'incoming',
          peer: {
            id: data.callerId,
            name: data.callerName || 'Friend',
            avatar: data.callerAvatar,
          },
          duration: 0,
          isMuted: false,
          isVideoOff: false,
          isMinimized: false,
        });

        // 45s timeout for unanswered incoming calls
        if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
        autoTimeoutRef.current = setTimeout(() => {
          declineCall();
        }, 45000);
      }

      // 2. Outgoing call is ringing on peer's device
      if (data.type === 'call:ringing') {
        if (activeCall && activeCall.status === 'outgoing_ringing') {
          // Keep ringing sound
        }
      }

      // 3. Peer accepted outgoing call
      if (data.type === 'call:accepted') {
        CallRingtone.stopRingtone();
        setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));

        // Create WebRTC Offer
        if (pcRef.current) {
          try {
            const offer = await pcRef.current.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await pcRef.current.setLocalDescription(offer);
            ChatStore.sendRawSocket({
              type: 'call:signal',
              callId: data.callId,
              targetUserId: activeCall?.peer.id,
              signal: { type: 'offer', sdp: offer.sdp },
            });
          } catch (err) {
            console.warn('WebRTC offer failed:', err);
          }
        }
      }

      // 4. Call ended or rejected
      if (data.type === 'call:ended') {
        CallRingtone.playCallEndBeep();
        setActiveCall((prev) =>
          prev
            ? {
                ...prev,
                status: 'ended',
                reason: data.reason === 'offline' ? 'User is currently offline' : data.reason === 'declined' ? 'Call declined' : 'Call ended',
              }
            : null
        );
        setTimeout(() => {
          cleanupMedia();
          setActiveCall(null);
        }, 1800);
      }

      // 5. WebRTC Peer Signaling (Offer / Answer / ICE Candidate)
      if (data.type === 'call:signal' && data.signal) {
        const pc = pcRef.current;
        if (!pc) return;

        try {
          if (data.signal.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.signal.sdp }));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ChatStore.sendRawSocket({
              type: 'call:signal',
              callId: data.callId,
              targetUserId: data.senderId,
              signal: { type: 'answer', sdp: answer.sdp },
            });
          } else if (data.signal.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.signal.sdp }));
          } else if (data.signal.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
          }
        } catch (err) {
          console.warn('Signal processing error:', err);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeCall, cleanupMedia]);

  // Start outgoing call
  const startCall = async (peerId: string, peerName: string, peerAvatar?: string, type: 'voice' | 'video' = 'voice') => {
    cleanupMedia();

    const session = getStoredSession();
    const myName = session?.user?.displayName || 'You';
    const myAvatar = session?.user?.avatarUrl;
    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    setActiveCall({
      callId,
      type,
      status: 'outgoing_ringing',
      peer: {
        id: peerId,
        name: peerName,
        avatar: peerAvatar,
      },
      duration: 0,
      isMuted: false,
      isVideoOff: false,
      isMinimized: false,
    });

    CallRingtone.startOutgoingRingback();

    // Acquire Media Stream
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
        });
        localStreamRef.current = stream;
        setLocalStream(stream);

        // Setup WebRTC PeerConnection
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            ChatStore.sendRawSocket({
              type: 'call:signal',
              callId,
              targetUserId: peerId,
              signal: { candidate: event.candidate.toJSON() },
            });
          }
        };
      }
    } catch (err) {
      console.warn('Could not capture camera/microphone:', err);
    }

    // Send Invite over WebSocket
    ChatStore.sendRawSocket({
      type: 'call:invite',
      callId,
      recipientId: peerId,
      callType: type,
      callerName: myName,
      callerAvatar: myAvatar,
    });

    // 40s timeout if no response
    if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
    autoTimeoutRef.current = setTimeout(() => {
      endCall();
    }, 40000);
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!activeCall || activeCall.status !== 'incoming') return;
    CallRingtone.stopRingtone();
    if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);

    const callId = activeCall.callId;
    const callerId = activeCall.peer.id;
    const type = activeCall.type;

    setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));

    // Acquire Local Media
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
        });
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            ChatStore.sendRawSocket({
              type: 'call:signal',
              callId,
              targetUserId: callerId,
              signal: { candidate: event.candidate.toJSON() },
            });
          }
        };
      }
    } catch (err) {
      console.warn('Could not acquire media on accept:', err);
    }

    // Notify caller that call is accepted
    ChatStore.sendRawSocket({
      type: 'call:accept',
      callId,
      callerId,
    });
  };

  // Decline incoming call
  const declineCall = () => {
    if (!activeCall) return;
    CallRingtone.stopRingtone();
    const callId = activeCall.callId;
    const callerId = activeCall.peer.id;

    ChatStore.sendRawSocket({
      type: 'call:reject',
      callId,
      callerId,
      reason: 'declined',
    });

    cleanupMedia();
    setActiveCall(null);
  };

  // End active or ringing call
  const endCall = () => {
    if (!activeCall) return;
    const callId = activeCall.callId;
    const targetUserId = activeCall.peer.id;

    ChatStore.sendRawSocket({
      type: 'call:end',
      callId,
      targetUserId,
      reason: 'ended',
    });

    CallRingtone.playCallEndBeep();
    setActiveCall((prev) => (prev ? { ...prev, status: 'ended', reason: 'Call ended' } : null));

    setTimeout(() => {
      cleanupMedia();
      setActiveCall(null);
    }, 1500);
  };

  // Toggle Microphone Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextState = !audioTracks[0].enabled;
        audioTracks[0].enabled = nextState;
        setActiveCall((prev) => (prev ? { ...prev, isMuted: !nextState } : null));
      }
    } else {
      setActiveCall((prev) => (prev ? { ...prev, isMuted: !prev.isMuted } : null));
    }
  };

  // Toggle Video Camera
  const toggleVideo = async () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextState = !videoTracks[0].enabled;
        videoTracks[0].enabled = nextState;
        setActiveCall((prev) => (prev ? { ...prev, isVideoOff: !nextState } : null));
      } else {
        // If started as voice and enabling video
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newTrack = videoStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(newTrack);
          if (pcRef.current) {
            pcRef.current.addTrack(newTrack, localStreamRef.current);
          }
          setActiveCall((prev) => (prev ? { ...prev, type: 'video', isVideoOff: false } : null));
        } catch {}
      }
    } else {
      setActiveCall((prev) => (prev ? { ...prev, isVideoOff: !prev.isVideoOff } : null));
    }
  };

  // Minimize / Expand call window
  const toggleMinimize = () => {
    setActiveCall((prev) => (prev ? { ...prev, isMinimized: !prev.isMinimized } : null));
  };

  // Switch between Voice and Video during call
  const switchCallType = () => {
    setActiveCall((prev) => {
      if (!prev) return null;
      const nextType = prev.type === 'voice' ? 'video' : 'voice';
      return { ...prev, type: nextType };
    });
    toggleVideo();
  };

  return (
    <CallContext.Provider
      value={{
        activeCall,
        localStream,
        remoteStream,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        toggleVideo,
        toggleMinimize,
        switchCallType,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
