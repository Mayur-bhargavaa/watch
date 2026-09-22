'use client';

import React, { useRef, useEffect } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Minimize2,
  Maximize2,
  Volume2,
} from 'lucide-react';
import { useCall } from '../../context/CallContext';
import { ModalPortal } from './ModalPortal';

export const ActiveCallOverlay: React.FC = () => {
  const {
    activeCall,
    localStream,
    remoteStream,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleMinimize,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Attach local media stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeCall?.isVideoOff, activeCall?.type]);

  // Attach remote media stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, activeCall?.status]);

  if (!activeCall) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // --- STATE 1: INCOMING CALL PROMPT ---
  if (activeCall.status === 'incoming') {
    return (
      <ModalPortal>
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 p-6 flex flex-col items-center text-center shadow-2xl animate-in zoom-in-95">
            {/* Pulsing Ringing Avatar */}
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-full bg-[#ee1d49]/30 animate-ping" />
              <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center font-bold text-3xl text-zinc-300 ring-4 ring-[#ee1d49] relative shadow-lg">
                {activeCall.peer.avatar ? (
                  <img
                    src={activeCall.peer.avatar}
                    alt={activeCall.peer.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  activeCall.peer.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <span className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 ring-4 ring-zinc-900 flex items-center justify-center text-white">
                {activeCall.type === 'video' ? (
                  <Video className="w-3.5 h-3.5" />
                ) : (
                  <Phone className="w-3.5 h-3.5" />
                )}
              </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-1">{activeCall.peer.name}</h3>
            <p className="text-xs text-rose-400 font-semibold mb-8 flex items-center gap-1.5 animate-pulse">
              <span>
                Incoming {activeCall.type === 'video' ? 'Video' : 'Voice'} Call...
              </span>
            </p>

            {/* Accept & Decline Action Buttons */}
            <div className="flex items-center justify-center gap-8 w-full">
              {/* Decline Button */}
              <button
                type="button"
                onClick={declineCall}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <div className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-transform active:scale-95">
                  <PhoneOff className="w-6 h-6" />
                </div>
                <span className="text-xs text-zinc-400 group-hover:text-zinc-200">Decline</span>
              </button>

              {/* Accept Button */}
              <button
                type="button"
                onClick={acceptCall}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 transition-transform active:scale-95 animate-bounce">
                  {activeCall.type === 'video' ? (
                    <Video className="w-6 h-6" />
                  ) : (
                    <Phone className="w-6 h-6" />
                  )}
                </div>
                <span className="text-xs text-zinc-400 group-hover:text-zinc-200 font-bold">Accept</span>
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
    );
  }

  // --- STATE 2: MINIMIZED FLOATING CALL WIDGET (Multitasking) ---
  if (activeCall.isMinimized) {
    return (
      <ModalPortal>
        <div
          onClick={toggleMinimize}
          className="fixed bottom-6 right-6 z-[300] flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/95 border border-zinc-700 text-white shadow-2xl backdrop-blur-md cursor-pointer hover:bg-zinc-850 transition animate-in slide-in-from-bottom-5"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center font-bold text-sm ring-2 ring-[#ee1d49]">
            {activeCall.peer.avatar ? (
              <img
                src={activeCall.peer.avatar}
                alt={activeCall.peer.name}
                className="w-full h-full object-cover"
              />
            ) : (
              activeCall.peer.name.slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="text-left">
            <p className="text-xs font-bold truncate max-w-[100px]">{activeCall.peer.name}</p>
            <p className="text-[10px] text-emerald-400 font-mono">
              {activeCall.status === 'connected'
                ? formatDuration(activeCall.duration)
                : 'Ringing...'}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              endCall();
            }}
            className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow cursor-pointer ml-1"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </ModalPortal>
    );
  }

  // --- STATE 3: FULL SCREEN / ACTIVE CALL OVERLAY ---
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-lg flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
        <div className="relative w-full max-w-xl h-[80vh] max-h-[640px] rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col justify-between">
          {/* Top Bar with Info & Minimize */}
          <div className="flex items-center justify-between p-4 z-20">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center text-xs font-bold text-white">
                {activeCall.peer.avatar ? (
                  <img
                    src={activeCall.peer.avatar}
                    alt={activeCall.peer.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  activeCall.peer.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="text-left">
                <h4 className="text-sm font-bold text-white leading-tight">
                  {activeCall.peer.name}
                </h4>
                <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  {activeCall.status === 'connected' ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{formatDuration(activeCall.duration)}</span>
                    </>
                  ) : activeCall.status === 'ended' ? (
                    <span className="text-red-400">{activeCall.reason || 'Call Ended'}</span>
                  ) : (
                    <span className="text-amber-400 animate-pulse">Ringing...</span>
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleMinimize}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="Minimize call"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Center Stage: Video or Voice Visualizer */}
          <div className="flex-1 w-full relative flex items-center justify-center overflow-hidden">
            {activeCall.type === 'video' && activeCall.status === 'connected' ? (
              /* Remote Video Feed */
              <div className="w-full h-full relative flex items-center justify-center bg-black">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
                {/* Fallback if remote video track is paused */}
                {!remoteStream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-zinc-950">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center font-bold text-3xl text-zinc-300 ring-4 ring-zinc-700 mb-3">
                      {activeCall.peer.avatar ? (
                        <img
                          src={activeCall.peer.avatar}
                          alt={activeCall.peer.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        activeCall.peer.name.slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <p className="text-sm font-semibold text-white">Camera is off or connecting...</p>
                  </div>
                )}

                {/* Self PiP Video Preview in corner */}
                <div className="absolute bottom-4 right-4 w-28 sm:w-36 h-36 sm:h-48 rounded-2xl overflow-hidden bg-zinc-800 border-2 border-white/20 shadow-2xl z-20">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {activeCall.isVideoOff && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white text-[10px] font-bold">
                      Camera Off
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Voice Call Screen / Ringing State */
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <div className="relative mb-6">
                  {activeCall.status === 'connected' && (
                    <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping duration-1000" />
                  )}
                  {activeCall.status === 'outgoing_ringing' && (
                    <div className="absolute inset-0 rounded-full bg-[#ee1d49]/30 animate-ping duration-1000" />
                  )}
                  <div className="w-32 h-32 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center font-bold text-4xl text-zinc-300 ring-4 ring-[#ee1d49]/50 shadow-2xl relative">
                    {activeCall.peer.avatar ? (
                      <img
                        src={activeCall.peer.avatar}
                        alt={activeCall.peer.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      activeCall.peer.name.slice(0, 1).toUpperCase()
                    )}
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">{activeCall.peer.name}</h3>
                <p className="text-sm text-zinc-400 font-medium mb-4">
                  {activeCall.status === 'connected'
                    ? 'Call in progress'
                    : activeCall.status === 'ended'
                    ? activeCall.reason || 'Call ended'
                    : 'Calling... Waiting for answer'}
                </p>

                {/* Simulated Audio Wave visualizer */}
                {activeCall.status === 'connected' && (
                  <div className="flex items-center gap-1.5 h-8">
                    {[35, 60, 90, 45, 75, 100, 50, 80, 40, 65, 85].map((h, i) => (
                      <span
                        key={i}
                        className="w-1 rounded-full bg-[#ee1d49] animate-pulse"
                        style={{
                          height: `${activeCall.isMuted ? 8 : h}%`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Dock Control Bar */}
          <div className="p-4 sm:p-6 bg-zinc-950/80 border-t border-zinc-800/80 z-20 flex items-center justify-center gap-3 sm:gap-4">
            {/* Mute Mic */}
            <button
              type="button"
              onClick={toggleMute}
              className={`p-3 sm:p-3.5 rounded-full transition cursor-pointer ${
                activeCall.isMuted
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={activeCall.isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {activeCall.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Video Camera Toggle */}
            <button
              type="button"
              onClick={toggleVideo}
              className={`p-3 sm:p-3.5 rounded-full transition cursor-pointer ${
                activeCall.isVideoOff
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={activeCall.isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {activeCall.isVideoOff ? (
                <VideoOff className="w-5 h-5" />
              ) : (
                <Video className="w-5 h-5" />
              )}
            </button>

            {/* Hangup / End Call Button */}
            <button
              type="button"
              onClick={endCall}
              className="px-6 py-3 sm:py-3.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-red-600/30 transition active:scale-95 cursor-pointer ml-2"
              title="End call"
            >
              <PhoneOff className="w-5 h-5" />
              <span>End</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
