'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { RoomMember } from '@synccinema/common';

export interface VideoGridParticipant {
  userId: string;
  displayName: string;
  stream: MediaStream | null;
  isMuted?: boolean;
  isSpeaking?: boolean;
  isSelf?: boolean;
  isCameraOn?: boolean;
}

interface UseWebRTCOptions {
  myUserId: string;
  members: RoomMember[];
  screenPresenter: { userId: string; displayName: string } | null;
  sendWebRTCSignal: (targetUserId: string, signal: any) => void;
  sendScreenState: (isSharing: boolean) => void;
  sendCameraState: (isCameraOn: boolean) => void;
  sendVoiceState: (isMuted: boolean) => void;
  registerWebRTCListener: (listener: (fromUserId: string, signal: any) => void) => () => void;
  registerCameraListener: (listener: (userId: string, isCameraOn: boolean) => void) => () => void;
  registerVoiceListener: (listener: (userId: string, isMuted: boolean) => void) => () => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// Canvas-based animated video stream fallback when camera hardware is missing or permissions blocked (Google Meet style)
function createFallbackVideoStream(label: string): MediaStream {
  if (typeof document === 'undefined') return new MediaStream();
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new MediaStream();

    let frame = 0;
    const draw = () => {
      frame++;
      // Google Meet charcoal dark background with subtle radial gradient
      const grad = ctx.createRadialGradient(320, 180, 40, 320, 180, 260);
      grad.addColorStop(0, '#2b303c');
      grad.addColorStop(1, '#181a20');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 360);

      // Speaking wave pulse ring (Google Meet blue)
      const pulse = Math.sin(frame * 0.08) * 6;
      ctx.beginPath();
      ctx.arc(320, 155, 62 + pulse, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(138, 180, 248, 0.4)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Google Meet Avatar circle
      ctx.beginPath();
      ctx.arc(320, 155, 58, 0, Math.PI * 2);
      ctx.fillStyle = '#1a73e8';
      ctx.fill();

      // Bold initial
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 50px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((label[0] || 'Y').toUpperCase(), 320, 153);

      // Google Meet bottom status pill
      ctx.fillStyle = 'rgba(32, 33, 36, 0.9)';
      const pillWidth = 170;
      const pillHeight = 32;
      const pillX = 320 - pillWidth / 2;
      const pillY = 250;
      const pillRadius = 16;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillRadius);
      } else {
        ctx.rect(pillX, pillY, pillWidth, pillHeight);
      }
      ctx.fill();

      // Live green dot
      ctx.fillStyle = '#34a853';
      ctx.beginPath();
      ctx.arc(pillX + 22, pillY + 16, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('Meet Cam Preview', pillX + 36, pillY + 16);

      requestAnimationFrame(draw);
    };
    draw();

    const captureStream = (canvas as any).captureStream || (canvas as any).webkitCaptureStream;
    if (typeof captureStream === 'function') {
      const stream = captureStream.call(canvas, 24);
      if (stream && stream.getVideoTracks().length > 0) {
        return stream;
      }
    }
  } catch (err) {
    console.warn('Fallback video generation error:', err);
  }
  return new MediaStream();
}

// Silent AudioContext destination stream fallback for mic
function createSilentAudioStream(): MediaStream {
  try {
    if (typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const oscillator = ctx.createOscillator();
        const dst = oscillator.connect(ctx.createMediaStreamDestination());
        oscillator.start();
        const stream = (dst as any).stream;
        if (stream && stream.getAudioTracks().length > 0) {
          stream.getAudioTracks().forEach((t: MediaStreamTrack) => { t.enabled = false; });
          return stream;
        }
      }
    }
  } catch {}
  return new MediaStream();
}

export function useWebRTC({
  myUserId,
  members,
  screenPresenter,
  sendWebRTCSignal,
  sendScreenState,
  sendCameraState,
  sendVoiceState,
  registerWebRTCListener,
  registerCameraListener,
  registerVoiceListener
}: UseWebRTCOptions) {
  // --- Screen Share State ---
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);

  // Screen peer connections: peerId -> RTCPeerConnection
  const screenPeerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingScreenCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localScreenRef = useRef<MediaStream | null>(null);
  localScreenRef.current = localScreenStream;

  // --- Live Camera & Mic State ---
  const [localUserStream, setLocalUserStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState<boolean>(false);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(true);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [remoteUserStreams, setRemoteUserStreams] = useState<Map<string, MediaStream>>(new Map());
  const [remoteCameraStates, setRemoteCameraStates] = useState<Map<string, boolean>>(new Map());
  const [remoteMuteStates, setRemoteMuteStates] = useState<Map<string, boolean>>(new Map());

  // User camera/mic peer connections: peerId -> RTCPeerConnection
  const userPeerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingUserCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());
  const localUserRef = useRef<MediaStream | null>(null);
  localUserRef.current = localUserStream;

  // ---------------------------------------------------------------------------
  // 1. Live Camera & Voice Mesh
  // ---------------------------------------------------------------------------

  const closeUserPeerConnection = useCallback((peerId: string) => {
    const pc = userPeerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
      userPeerConnectionsRef.current.delete(peerId);
    }
    makingOfferRef.current.delete(peerId);
    ignoreOfferRef.current.delete(peerId);
    pendingUserCandidatesRef.current.delete(peerId);
    setRemoteUserStreams(prev => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  // Initiate Camera/Mic WebRTC Call to a Peer
  const initiateUserCall = useCallback(
    async (peerId: string, stream: MediaStream) => {
      if (!peerId || !myUserId || peerId === myUserId) return;
      if (makingOfferRef.current.get(peerId)) return;

      try {
        let pc = userPeerConnectionsRef.current.get(peerId);
        if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
          pc = new RTCPeerConnection(RTC_CONFIG);
          userPeerConnectionsRef.current.set(peerId, pc);

          pc.ontrack = (event) => {
            const peerStream = (event.streams && event.streams[0]) ? event.streams[0] : null;
            if (event.track && event.track.kind === 'video') {
              setRemoteCameraStates(prev => new Map(prev).set(peerId, true));
              event.track.onunmute = () => {
                setRemoteCameraStates(prev => new Map(prev).set(peerId, true));
              };
              event.track.onmute = () => {
                setRemoteCameraStates(prev => new Map(prev).set(peerId, false));
              };
              event.track.onended = () => {
                setRemoteCameraStates(prev => new Map(prev).set(peerId, false));
              };
            }

            setRemoteUserStreams(prev => {
              const existing = prev.get(peerId);
              const tracks = existing ? existing.getTracks() : [];
              if (event.track && !tracks.some(t => t.id === event.track.id)) {
                tracks.push(event.track);
              }
              if (peerStream) {
                peerStream.getTracks().forEach(t => {
                  if (!tracks.some(existingT => existingT.id === t.id)) {
                    tracks.push(t);
                  }
                });
              }
              return new Map(prev).set(peerId, new MediaStream(tracks));
            });
          };

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              sendWebRTCSignal(peerId, {
                type: 'candidate',
                candidate: event.candidate.toJSON(),
                streamKind: 'user'
              });
            }
          };

          pc.oniceconnectionstatechange = () => {
            if (pc && (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed')) {
              closeUserPeerConnection(peerId);
            }
          };
        }

        // Attach local tracks with low-latency encoding parameters using transceivers
        const transceivers = pc.getTransceivers();
        stream.getTracks().forEach((track) => {
          const matchingTransceiver = transceivers.find(
            t => t.receiver.track.kind === track.kind || t.sender.track?.kind === track.kind
          );
          if (matchingTransceiver) {
            matchingTransceiver.sender.replaceTrack(track).catch(() => {});
            matchingTransceiver.direction = 'sendrecv';
          } else {
            try {
              const sender = pc!.addTrack(track, stream);
              if (track.kind === 'video') {
                try {
                  const params = sender.getParameters();
                  if (!params.encodings || params.encodings.length === 0) {
                    params.encodings = [{}];
                  }
                  params.encodings[0].maxBitrate = 350_000;
                  params.encodings[0].maxFramerate = 24;
                  params.degradationPreference = 'maintain-framerate';
                  sender.setParameters(params).catch(() => {});
                } catch {}
              }
            } catch (e) {
              console.warn(`Could not add track ${track.kind}:`, e);
            }
          }
        });

        // Only create offer if connection is stable
        if (pc.signalingState !== 'stable') {
          return;
        }

        makingOfferRef.current.set(peerId, true);
        try {
          const offer = await pc.createOffer();
          if (pc.signalingState !== 'stable') return;
          await pc.setLocalDescription(offer);

          sendWebRTCSignal(peerId, {
            type: 'offer',
            sdp: pc.localDescription,
            streamKind: 'user'
          });
        } finally {
          makingOfferRef.current.set(peerId, false);
        }
      } catch (err) {
        console.error(`Failed to initiate user call to ${peerId}:`, err);
      }
    },
    [myUserId, sendWebRTCSignal]
  );

  // Toggle Camera
  const toggleCamera = useCallback(async () => {
    const nextCameraOn = !isCameraOn;
    setIsCameraOn(nextCameraOn);
    sendCameraState(nextCameraOn);

    try {
      let stream = localUserRef.current;
      if (nextCameraOn) {
        const hasLiveVideo = Boolean(
          stream &&
          stream.getVideoTracks().length > 0 &&
          stream.getVideoTracks().some(t => t.readyState === 'live')
        );

        if (!hasLiveVideo) {
          let camStream: MediaStream | null = null;
          // 1. Attempt real webcam acquisition (Try HD first, then generic fallback)
          if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
            try {
              camStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 }, facingMode: 'user' },
                audio: false
              });
            } catch (err1) {
              console.warn('HD camera acquisition failed, trying generic video constraint:', err1);
              try {
                camStream = await navigator.mediaDevices.getUserMedia({
                  video: true,
                  audio: false
                });
              } catch (err2: any) {
                console.warn('Real camera acquisition failed:', err2);
                setMediaNotice('Camera permission needed or webcam unavailable. Showing animated Google Meet preview.');
              }
            }
          }

          // 2. Fallback to animated virtual stream if real webcam is blocked/missing
          if (!camStream || camStream.getVideoTracks().length === 0) {
            camStream = createFallbackVideoStream('You');
          }

          const existingAudio = stream ? stream.getAudioTracks().filter(t => t.readyState === 'live') : [];
          const newVideo = camStream.getVideoTracks();
          newVideo.forEach(t => { t.enabled = true; });

          const combinedStream = new MediaStream([...newVideo, ...existingAudio]);
          localUserRef.current = combinedStream;
          setLocalUserStream(combinedStream);
          stream = combinedStream;
        } else {
          stream!.getVideoTracks().forEach(t => { t.enabled = true; });
          setLocalUserStream(new MediaStream(stream!.getTracks()));
        }

        // Update video transceiver / track on all active peer connections
        const activeVideoTrack = stream?.getVideoTracks().find(t => t.readyState === 'live');
        if (activeVideoTrack) {
          userPeerConnectionsRef.current.forEach((pc, peerId) => {
            const videoTransceiver = pc.getTransceivers().find(
              t => t.receiver.track.kind === 'video' || t.sender.track?.kind === 'video'
            );
            if (videoTransceiver) {
              videoTransceiver.sender.replaceTrack(activeVideoTrack).catch(() => {});
              videoTransceiver.direction = 'sendrecv';
            } else {
              try {
                pc.addTrack(activeVideoTrack, stream!);
              } catch {}
            }
            if (pc.signalingState === 'stable' && !makingOfferRef.current.get(peerId)) {
              makingOfferRef.current.set(peerId, true);
              pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                  sendWebRTCSignal(peerId, {
                    type: 'offer',
                    sdp: pc.localDescription,
                    streamKind: 'user'
                  });
                })
                .catch(() => {})
                .finally(() => {
                  makingOfferRef.current.set(peerId, false);
                });
            }
          });
        }
      } else {
        // Turning camera OFF
        if (stream) {
          stream.getVideoTracks().forEach(t => {
            t.enabled = false;
            try { t.stop(); } catch {}
          });
          const remainingAudio = stream.getAudioTracks().filter(t => t.readyState === 'live');
          const nextStream = remainingAudio.length > 0 ? new MediaStream(remainingAudio) : null;
          localUserRef.current = nextStream;
          setLocalUserStream(nextStream);
        }

        userPeerConnectionsRef.current.forEach((pc) => {
          const videoTransceiver = pc.getTransceivers().find(
            t => t.receiver.track.kind === 'video' || t.sender.track?.kind === 'video'
          );
          if (videoTransceiver) {
            videoTransceiver.sender.replaceTrack(null).catch(() => {});
          }
        });
      }

      // Fanout active stream to all connected peers
      const activeStream = localUserRef.current;
      if (activeStream) {
        members.forEach((m) => {
          if (m.userId && m.userId !== myUserId && m.isConnected) {
            initiateUserCall(m.userId, activeStream);
          }
        });
      }
    } catch (err) {
      console.warn('Camera toggle error:', err);
    }
  }, [isCameraOn, members, myUserId, sendCameraState, initiateUserCall, sendWebRTCSignal]);

  // Toggle Mic
  const toggleMic = useCallback(async () => {
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    sendVoiceState(nextMuted);

    try {
      let stream = localUserRef.current;
      if (!nextMuted) {
        // User wants to UNMUTE
        const hasLiveAudio = Boolean(
          stream &&
          stream.getAudioTracks().length > 0 &&
          stream.getAudioTracks().some(t => t.readyState === 'live')
        );

        if (!hasLiveAudio) {
          let micStream: MediaStream | null = null;
          if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
            try {
              micStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: false
              });
            } catch (err: any) {
              console.warn('Real mic acquisition failed:', err);
              setMediaNotice('Microphone permission denied or device not found.');
            }
          }

          if (!micStream || micStream.getAudioTracks().length === 0) {
            micStream = createSilentAudioStream();
          }

          const existingVideo = stream ? stream.getVideoTracks().filter(t => t.readyState === 'live') : [];
          const newAudio = micStream.getAudioTracks();
          newAudio.forEach(t => { t.enabled = true; });

          const combinedStream = new MediaStream([...existingVideo, ...newAudio]);
          localUserRef.current = combinedStream;
          setLocalUserStream(combinedStream);
          stream = combinedStream;
        } else {
          stream!.getAudioTracks().forEach(t => { t.enabled = true; });
          setLocalUserStream(new MediaStream(stream!.getTracks()));
        }

        // Update audio transceiver on active peer connections
        const activeAudioTrack = stream?.getAudioTracks().find(t => t.readyState === 'live');
        if (activeAudioTrack) {
          userPeerConnectionsRef.current.forEach((pc, peerId) => {
            const audioTransceiver = pc.getTransceivers().find(
              t => t.receiver.track.kind === 'audio' || t.sender.track?.kind === 'audio'
            );
            if (audioTransceiver) {
              audioTransceiver.sender.replaceTrack(activeAudioTrack).catch(() => {});
              audioTransceiver.direction = 'sendrecv';
            } else {
              try {
                pc.addTrack(activeAudioTrack, stream!);
              } catch {}
            }
            if (pc.signalingState === 'stable' && !makingOfferRef.current.get(peerId)) {
              makingOfferRef.current.set(peerId, true);
              pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                  sendWebRTCSignal(peerId, {
                    type: 'offer',
                    sdp: pc.localDescription,
                    streamKind: 'user'
                  });
                })
                .catch(() => {})
                .finally(() => {
                  makingOfferRef.current.set(peerId, false);
                });
            }
          });
        }
      } else {
        // User wants to MUTE
        if (stream) {
          stream.getAudioTracks().forEach(t => { t.enabled = false; });
          setLocalUserStream(new MediaStream(stream.getTracks()));
        }
      }

      // Fanout active stream to all connected peers
      const activeStream = localUserRef.current;
      if (activeStream) {
        members.forEach((m) => {
          if (m.userId && m.userId !== myUserId && m.isConnected) {
            initiateUserCall(m.userId, activeStream);
          }
        });
      }
    } catch (err) {
      console.warn('Microphone toggle error:', err);
    }
  }, [isMicMuted, members, myUserId, sendVoiceState, initiateUserCall, sendWebRTCSignal]);

  // ---------------------------------------------------------------------------
  // 2. Screen Share WebRTC Mesh Helpers
  // ---------------------------------------------------------------------------

  const closeScreenPeerConnection = useCallback((peerId: string) => {
    const pc = screenPeerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
      screenPeerConnectionsRef.current.delete(peerId);
    }
    pendingScreenCandidatesRef.current.delete(peerId);
  }, []);

  const closeAllScreenConnections = useCallback(() => {
    screenPeerConnectionsRef.current.forEach((pc) => {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
    });
    screenPeerConnectionsRef.current.clear();
    pendingScreenCandidatesRef.current.clear();
  }, []);

  // Prune disconnected peers and connect user call to new peers joining the room
  useEffect(() => {
    const activePeerIds = new Set(
      members
        .filter((m) => m.userId && m.userId !== myUserId && m.isConnected !== false)
        .map((m) => m.userId)
    );

    // Clean up peer connections for members who have left
    userPeerConnectionsRef.current.forEach((_, peerId) => {
      if (!activePeerIds.has(peerId)) {
        closeUserPeerConnection(peerId);
      }
    });
    screenPeerConnectionsRef.current.forEach((_, peerId) => {
      if (!activePeerIds.has(peerId)) {
        closeScreenPeerConnection(peerId);
      }
    });

    // Connect to newly joined peers if local stream exists
    if (localUserStream && myUserId) {
      members.forEach((m) => {
        if (m.userId && m.userId !== myUserId && m.isConnected !== false && !userPeerConnectionsRef.current.has(m.userId)) {
          initiateUserCall(m.userId, localUserStream);
        }
      });
    }
  }, [members, localUserStream, myUserId, initiateUserCall, closeUserPeerConnection, closeScreenPeerConnection]);

  const initiateScreenShare = useCallback(
    async (peerId: string, stream: MediaStream) => {
      if (!peerId || !myUserId || peerId === myUserId) return;
      try {
        closeScreenPeerConnection(peerId);

        const pc = new RTCPeerConnection(RTC_CONFIG);
        screenPeerConnectionsRef.current.set(peerId, pc);

        stream.getTracks().forEach((track) => {
          const sender = pc.addTrack(track, stream);
          if (track.kind === 'video') {
            try {
              const params = sender.getParameters();
              if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
              }
              params.encodings[0].maxBitrate = 2_500_000;
              params.encodings[0].maxFramerate = 30;
              params.degradationPreference = 'maintain-framerate';
              sender.setParameters(params).catch(() => {});
            } catch {}
          }
        });

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendWebRTCSignal(peerId, {
              type: 'candidate',
              candidate: event.candidate.toJSON(),
              streamKind: 'screen'
            });
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        sendWebRTCSignal(peerId, {
          type: 'offer',
          sdp: pc.localDescription,
          streamKind: 'screen'
        });
      } catch (err) {
        console.error(`Failed to initiate screen share with peer ${peerId}:`, err);
      }
    },
    [myUserId, closeScreenPeerConnection, sendWebRTCSignal]
  );

  const stopScreenShare = useCallback(() => {
    if (localScreenRef.current) {
      localScreenRef.current.getTracks().forEach((t) => t.stop());
      setLocalScreenStream(null);
    }
    sendScreenState(false);
    closeAllScreenConnections();
  }, [sendScreenState, closeAllScreenConnections]);

  const startScreenShare = useCallback(async () => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
      } catch {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
      }

      setLocalScreenStream(stream);
      sendScreenState(true);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }

      if (myUserId) {
        members.forEach((m) => {
          if (m.userId && m.userId !== myUserId && m.isConnected) {
            initiateScreenShare(m.userId, stream);
          }
        });
      }
    } catch (err) {
      console.warn('Screen share canceled or denied:', err);
    }
  }, [members, myUserId, sendScreenState, initiateScreenShare, stopScreenShare]);

  useEffect(() => {
    if (!localScreenStream || !myUserId) return;
    members.forEach((m) => {
      if (m.userId && m.userId !== myUserId && m.isConnected && !screenPeerConnectionsRef.current.has(m.userId)) {
        initiateScreenShare(m.userId, localScreenStream);
      }
    });
  }, [members, localScreenStream, myUserId, initiateScreenShare]);

  useEffect(() => {
    if (!screenPresenter) {
      setRemoteScreenStream(null);
      if (!localScreenStream) {
        closeAllScreenConnections();
      }
    }
  }, [screenPresenter, localScreenStream, closeAllScreenConnections]);

  // ---------------------------------------------------------------------------
  // 3. WebRTC Signaling Dispatcher (Polite Peer Pattern)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const unregisterSignal = registerWebRTCListener(async (fromUserId, signal) => {
      if (!signal || !fromUserId || !myUserId || fromUserId === myUserId) return;

      const isScreen = signal.streamKind === 'screen';
      const connections = isScreen ? screenPeerConnectionsRef : userPeerConnectionsRef;
      const pendingCandidates = isScreen ? pendingScreenCandidatesRef : pendingUserCandidatesRef;

      try {
        if (signal.type === 'offer') {
          let pc = connections.current.get(fromUserId);

          if (isScreen) {
            closeScreenPeerConnection(fromUserId);
            pc = new RTCPeerConnection(RTC_CONFIG);
            connections.current.set(fromUserId, pc);

            pc.ontrack = (event) => {
              if (event.streams && event.streams[0]) {
                setRemoteScreenStream(event.streams[0]);
              }
            };

            pc.onicecandidate = (event) => {
              if (event.candidate) {
                sendWebRTCSignal(fromUserId, {
                  type: 'candidate',
                  candidate: event.candidate.toJSON(),
                  streamKind: 'screen'
                });
              }
            };
          } else {
            // User camera/mic call
            if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
              pc = new RTCPeerConnection(RTC_CONFIG);
              connections.current.set(fromUserId, pc);

              pc.ontrack = (event) => {
                const peerStream = (event.streams && event.streams[0]) ? event.streams[0] : null;
                if (event.track && event.track.kind === 'video') {
                  setRemoteCameraStates(prev => new Map(prev).set(fromUserId, true));
                  event.track.onunmute = () => {
                    setRemoteCameraStates(prev => new Map(prev).set(fromUserId, true));
                  };
                  event.track.onmute = () => {
                    setRemoteCameraStates(prev => new Map(prev).set(fromUserId, false));
                  };
                  event.track.onended = () => {
                    setRemoteCameraStates(prev => new Map(prev).set(fromUserId, false));
                  };
                }

                setRemoteUserStreams(prev => {
                  const existing = prev.get(fromUserId);
                  const tracks = existing ? existing.getTracks() : [];
                  if (event.track && !tracks.some(t => t.id === event.track.id)) {
                    tracks.push(event.track);
                  }
                  if (peerStream) {
                    peerStream.getTracks().forEach(t => {
                      if (!tracks.some(existingT => existingT.id === t.id)) {
                        tracks.push(t);
                      }
                    });
                  }
                  return new Map(prev).set(fromUserId, new MediaStream(tracks));
                });
              };

              pc.onicecandidate = (event) => {
                if (event.candidate) {
                  sendWebRTCSignal(fromUserId, {
                    type: 'candidate',
                    candidate: event.candidate.toJSON(),
                    streamKind: 'user'
                  });
                }
              };
            }

            // Polite peer glare resolution
            const isPolite = myUserId.localeCompare(fromUserId) > 0;
            const offerCollision = Boolean(makingOfferRef.current.get(fromUserId)) || pc.signalingState !== 'stable';
            ignoreOfferRef.current.set(fromUserId, !isPolite && offerCollision);

            if (ignoreOfferRef.current.get(fromUserId)) {
              console.log(`[WebRTC] Glare collision: impolite peer ${myUserId} ignoring offer from ${fromUserId}`);
              return;
            }

            if (offerCollision && isPolite) {
              console.log(`[WebRTC] Glare collision: polite peer ${myUserId} rolling back for ${fromUserId}`);
              try {
                await pc.setLocalDescription({ type: 'rollback' });
              } catch (e) {
                console.warn('Rollback error:', e);
              }
            }

            // Attach local tracks if receiver also has them using transceivers
            if (localUserRef.current) {
              const transceivers = pc.getTransceivers();
              localUserRef.current.getTracks().forEach((track) => {
                const matching = transceivers.find(
                  t => t.receiver.track.kind === track.kind || t.sender.track?.kind === track.kind
                );
                if (matching) {
                  matching.sender.replaceTrack(track).catch(() => {});
                  matching.direction = 'sendrecv';
                } else {
                  try {
                    pc!.addTrack(track, localUserRef.current!);
                  } catch (e) {
                    console.warn(`Could not add track:`, e);
                  }
                }
              });
            }
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          const pending = pendingCandidates.current.get(fromUserId) || [];
          for (const cand of pending) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (err) {
              console.warn('Error adding queued ICE candidate:', err);
            }
          }
          pendingCandidates.current.delete(fromUserId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          sendWebRTCSignal(fromUserId, {
            type: 'answer',
            sdp: pc.localDescription,
            streamKind: isScreen ? 'screen' : 'user'
          });
        } else if (signal.type === 'answer') {
          if (ignoreOfferRef.current.get(fromUserId)) {
            ignoreOfferRef.current.set(fromUserId, false);
            return;
          }

          const pc = connections.current.get(fromUserId);
          if (pc && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            const pending = pendingCandidates.current.get(fromUserId) || [];
            for (const cand of pending) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (err) {
                console.warn('Error adding queued candidate:', err);
              }
            }
            pendingCandidates.current.delete(fromUserId);
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          const pc = connections.current.get(fromUserId);
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (err) {
              if (!ignoreOfferRef.current.get(fromUserId)) {
                console.warn('Error adding ICE candidate:', err);
              }
            }
          } else {
            const list = pendingCandidates.current.get(fromUserId) || [];
            list.push(signal.candidate);
            pendingCandidates.current.set(fromUserId, list);
          }
        }
      } catch (err) {
        console.error('Error in WebRTC signal dispatch:', err);
      }
    });

    const unregisterCamera = registerCameraListener((userId, cameraOn) => {
      setRemoteCameraStates(prev => new Map(prev).set(userId, cameraOn));
    });

    const unregisterVoice = registerVoiceListener((userId, muted) => {
      setRemoteMuteStates(prev => new Map(prev).set(userId, muted));
    });

    return () => {
      unregisterSignal();
      unregisterCamera();
      unregisterVoice();
    };
  }, [
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener,
    myUserId,
    closeScreenPeerConnection,
    sendWebRTCSignal
  ]);

  // Clean up on unmount
  const stopAllMediaTracks = useCallback(() => {
    stopScreenShare();
    if (localUserRef.current) {
      localUserRef.current.getTracks().forEach((t) => t.stop());
      localUserRef.current = null;
    }
    setLocalUserStream(null);
    setIsCameraOn(false);
    setIsMicMuted(true);
    userPeerConnectionsRef.current.forEach((pc) => pc.close());
    userPeerConnectionsRef.current.clear();
    setRemoteUserStreams(new Map());
  }, [stopScreenShare]);

  const stopAllMediaTracksRef = useRef(stopAllMediaTracks);
  stopAllMediaTracksRef.current = stopAllMediaTracks;

  useEffect(() => {
    return () => {
      stopAllMediaTracksRef.current();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 4. Compute Participant Video Tiles for VideoGrid
  // ---------------------------------------------------------------------------

  const videoGridParticipants = useMemo<VideoGridParticipant[]>(() => {
    const participants: VideoGridParticipant[] = [];

    // Local participant tile
    const localHasLiveVideo = Boolean(
      isCameraOn &&
      localUserStream &&
      localUserStream.getVideoTracks().length > 0 &&
      localUserStream.getVideoTracks().some(t => t.enabled && t.readyState !== 'ended')
    );

    participants.push({
      userId: myUserId || 'me',
      displayName: 'You',
      stream: localUserStream,
      isMuted: isMicMuted,
      isSpeaking: false,
      isSelf: true,
      isCameraOn: localHasLiveVideo
    });

    // Remote tiles: from members list
    members.forEach((m) => {
      if (!m.userId || m.userId === myUserId) return;
      const stream = remoteUserStreams.get(m.userId) || null;
      const cameraFlag = remoteCameraStates.get(m.userId);
      const hasLiveVideoTrack = Boolean(
        stream &&
        stream.getVideoTracks().length > 0 &&
        stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live' && !t.muted)
      );
      const peerCameraOn = cameraFlag === true || (cameraFlag !== false && hasLiveVideoTrack);
      const peerMuted = remoteMuteStates.get(m.userId) ?? true;

      participants.push({
        userId: m.userId,
        displayName: m.displayName || 'Partner',
        stream,
        isMuted: peerMuted,
        isSpeaking: false,
        isSelf: false,
        isCameraOn: peerCameraOn
      });
    });

    // Remote tiles: from active streams not in members list
    remoteUserStreams.forEach((stream, peerId) => {
      if (!peerId || peerId === myUserId) return;
      if (participants.some(p => p.userId === peerId)) return;
      const cameraFlag = remoteCameraStates.get(peerId);
      const hasLiveVideoTrack = Boolean(
        stream &&
        stream.getVideoTracks().length > 0 &&
        stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live' && !t.muted)
      );
      participants.push({
        userId: peerId,
        displayName: 'Partner',
        stream,
        isMuted: remoteMuteStates.get(peerId) ?? true,
        isSpeaking: false,
        isSelf: false,
        isCameraOn: cameraFlag === true || hasLiveVideoTrack
      });
    });

    return participants;
  }, [
    localUserStream,
    isCameraOn,
    isMicMuted,
    remoteUserStreams,
    members,
    remoteCameraStates,
    remoteMuteStates,
    myUserId
  ]);

  return {
    // Screen share
    screenStream: localScreenStream || remoteScreenStream,
    isScreenSharing: Boolean(localScreenStream),
    screenPresenter,
    startScreenShare,
    stopScreenShare,
    // Camera & Voice
    isCameraOn,
    isMicMuted,
    mediaNotice,
    clearMediaNotice: () => setMediaNotice(null),
    localUserStream,
    remoteCameraStates,
    toggleCamera,
    toggleMic,
    stopAllMediaTracks,
    videoGridParticipants,
    activeSpeakerCount: videoGridParticipants.filter(p => !p.isMuted).length
  };
}
