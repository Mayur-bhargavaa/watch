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
        if (!stream || stream.getVideoTracks().length === 0 || stream.getVideoTracks().every(t => t.readyState === 'ended')) {
          let camStream: MediaStream;
          try {
            camStream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } },
              audio: !isMicMuted
            });
          } catch {
            // Fallback to video only if audio device fails or permission is denied
            camStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
          }
          camStream.getAudioTracks().forEach(t => { t.enabled = !isMicMuted; });
          camStream.getVideoTracks().forEach(t => { t.enabled = true; });
          stream = camStream;
          localUserRef.current = camStream;
          setLocalUserStream(camStream);
        } else {
          stream.getVideoTracks().forEach(t => { t.enabled = true; });
          setLocalUserStream(new MediaStream(stream.getTracks()));
        }

        // Immediately update video transceiver on all active peer connections
        const activeVideoTrack = stream.getVideoTracks().find(t => t.readyState === 'live');
        if (activeVideoTrack) {
          userPeerConnectionsRef.current.forEach((pc) => {
            const videoTransceiver = pc.getTransceivers().find(
              t => t.receiver.track.kind === 'video' || t.sender.track?.kind === 'video'
            );
            if (videoTransceiver) {
              videoTransceiver.sender.replaceTrack(activeVideoTrack).catch(() => {});
              videoTransceiver.direction = 'sendrecv';
            }
          });
        }
      } else {
        if (stream) {
          stream.getVideoTracks().forEach(t => {
            t.enabled = false;
            try { t.stop(); } catch {}
          });
          const remaining = stream.getAudioTracks().filter(t => t.readyState === 'live');
          const nextStream = remaining.length > 0 ? new MediaStream(remaining) : null;
          localUserRef.current = nextStream;
          setLocalUserStream(nextStream);
        }

        // Replace video track with null on video transceivers so receiver does not display frozen frame
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
      if (myUserId && activeStream) {
        members.forEach((m) => {
          if (m.userId && m.userId !== myUserId && m.isConnected) {
            initiateUserCall(m.userId, activeStream);
          }
        });
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      setIsCameraOn(false);
      sendCameraState(false);
    }
  }, [isCameraOn, isMicMuted, members, myUserId, sendCameraState, initiateUserCall]);

  // Toggle Mic
  const toggleMic = useCallback(async () => {
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    sendVoiceState(nextMuted);

    try {
      let stream = localUserRef.current;
      if (!stream || stream.getAudioTracks().length === 0) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: isCameraOn ? { width: { ideal: 640 }, height: { ideal: 360 } } : false,
          audio: true
        });
        stream.getAudioTracks().forEach(t => { t.enabled = !nextMuted; });
        stream.getVideoTracks().forEach(t => { t.enabled = isCameraOn; });
        localUserRef.current = stream;
        setLocalUserStream(stream);
      } else {
        stream.getAudioTracks().forEach(t => { t.enabled = !nextMuted; });
        setLocalUserStream(new MediaStream(stream.getTracks()));
      }

      // Fanout to all connected peers
      if (myUserId && stream) {
        members.forEach((m) => {
          if (m.userId && m.userId !== myUserId && m.isConnected) {
            initiateUserCall(m.userId, stream!);
          }
        });
      }
    } catch (err) {
      console.warn('Microphone access denied or unavailable:', err);
    }
  }, [isMicMuted, isCameraOn, members, myUserId, sendVoiceState, initiateUserCall]);

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

  useEffect(() => {
    return () => {
      stopAllMediaTracks();
    };
  }, [stopAllMediaTracks]);

  // ---------------------------------------------------------------------------
  // 4. Compute Participant Video Tiles for VideoGrid
  // ---------------------------------------------------------------------------

  const videoGridParticipants = useMemo<VideoGridParticipant[]>(() => {
    const participants: VideoGridParticipant[] = [];

    // Local tile
    if (localUserStream && isCameraOn) {
      participants.push({
        userId: myUserId || 'me',
        displayName: 'You (Camera)',
        stream: localUserStream,
        isMuted: isMicMuted,
        isSpeaking: false,
        isSelf: true,
        isCameraOn: true
      });
    }

    // Remote tiles
    remoteUserStreams.forEach((stream, peerId) => {
      if (!peerId || peerId === myUserId) return; // Strict guard against self loopback
      const member = members.find(m => m.userId === peerId);
      const cameraFlag = remoteCameraStates.get(peerId);
      const hasLiveVideoTrack = Boolean(
        stream &&
        stream.getVideoTracks().length > 0 &&
        stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live' && !t.muted)
      );
      // Camera is ON if explicitly true OR (not explicitly false and has a live video track)
      const peerCameraOn = cameraFlag === true || (cameraFlag !== false && hasLiveVideoTrack);
      const peerMuted = remoteMuteStates.get(peerId) ?? false;

      participants.push({
        userId: peerId,
        displayName: member?.displayName || 'Partner',
        stream,
        isMuted: peerMuted,
        isSpeaking: false,
        isSelf: false,
        isCameraOn: peerCameraOn
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
    localUserStream,
    remoteCameraStates,
    toggleCamera,
    toggleMic,
    stopAllMediaTracks,
    videoGridParticipants,
    activeSpeakerCount: videoGridParticipants.filter(p => !p.isMuted).length
  };
}
