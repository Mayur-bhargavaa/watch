'use client';

import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Camera, VideoOff, Crown } from 'lucide-react';

export interface ParticipantStream {
  userId: string;
  displayName: string;
  stream: MediaStream | null;
  isMuted?: boolean;
  isSpeaking?: boolean;
  isSelf?: boolean;
  isHost?: boolean;
  isCameraOn?: boolean;
}

interface VideoGridProps {
  participants: ParticipantStream[];
  onCopyInvite?: () => void;
  copiedInvite?: boolean;
  onToggleSelfCamera?: () => void;
  onToggleSelfMic?: () => void;
}

// Google Meet Avatar Color Palette (curated vibrant tones for circular badges)
export const GOOGLE_MEET_AVATAR_COLORS = [
  '#1a73e8', // Google Blue
  '#9334e6', // Google Purple
  '#00897b', // Google Teal
  '#e52592', // Vibrant Pink
  '#f4511e', // Coral Red
  '#188038', // Google Emerald
  '#fbbc04', // Google Amber
  '#12b5cb', // Cyan
];

// Backwards compatibility alias
export const PARTICIPANT_PALETTE = GOOGLE_MEET_AVATAR_COLORS;

export function SmileyFace({ className = 'w-7 h-7 text-white/95' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="9" r="1.5" fill="currentColor" />
      <circle cx="16" cy="9" r="1.5" fill="currentColor" />
      <path
        d="M8 14.5C9.5 17 14.5 17 16 14.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function getParticipantAvatarColor(index: number): string {
  return GOOGLE_MEET_AVATAR_COLORS[index % GOOGLE_MEET_AVATAR_COLORS.length];
}

export function getParticipantColor(index: number): string {
  return getParticipantAvatarColor(index);
}

export function VideoGrid({
  participants,
  onCopyInvite,
  copiedInvite,
  onToggleSelfCamera,
  onToggleSelfMic
}: VideoGridProps) {
  if (participants.length === 0) {
    return null;
  }

  return (
    <div className="w-full flex items-center gap-2.5 overflow-x-auto pb-0.5 scrollbar-none">
      {participants.map((p, idx) => (
        <div key={p.userId || idx} className="flex-1 min-w-[140px] sm:min-w-[170px] max-w-[240px]">
          <MemoizedVideoTile
            participant={p}
            index={idx}
            onToggleSelfCamera={onToggleSelfCamera}
            onToggleSelfMic={onToggleSelfMic}
          />
        </div>
      ))}

      {participants.length < 6 && onCopyInvite && (
        <button
          onClick={onCopyInvite}
          className="flex-1 min-w-[120px] max-w-[170px] aspect-[16/10] sm:aspect-[16/9] rounded-xl border border-dashed border-white/20 hover:border-white/40 bg-[#202124]/50 hover:bg-[#202124]/90 transition-all duration-200 flex flex-col items-center justify-center text-zinc-300 hover:text-white select-none group shadow-md"
          title="Invite friends to this watch party (up to 6 members)"
        >
          <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-white/10 flex items-center justify-center mb-1 transition-colors">
            <span className="text-sm font-black text-rose-400 group-hover:scale-110 transition-transform">+</span>
          </div>
          <span className="text-xs font-bold tracking-wide">
            {copiedInvite ? '✓ Link Copied' : 'Invite Friends'}
          </span>
          <span className="text-[10px] text-zinc-400 mt-0.5">
            {participants.length}/6 seats
          </span>
        </button>
      )}
    </div>
  );
}

const MemoizedVideoTile = React.memo(function VideoTile({
  participant,
  index,
  onToggleSelfCamera,
  onToggleSelfMic
}: {
  participant: ParticipantStream;
  index: number;
  onToggleSelfCamera?: () => void;
  onToggleSelfMic?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasVideo = Boolean(
    participant.isCameraOn &&
      participant.stream &&
      participant.stream.getVideoTracks().length > 0 &&
      participant.stream.getVideoTracks().some((t) => t.enabled && t.readyState !== 'ended')
  );

  const onVideoAttach = React.useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node && participant.stream) {
        if (node.srcObject !== participant.stream) {
          node.srcObject = participant.stream;
        }
        node.muted = Boolean(participant.isSelf);
        if (!participant.isSelf) {
          node.volume = 1.0;
        }
        node.play().catch(() => {});
      }
    },
    [participant.stream, participant.isSelf]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !participant.stream || !hasVideo) return;

    if (video.srcObject !== participant.stream) {
      video.srcObject = participant.stream;
    }

    video.muted = Boolean(participant.isSelf);
    if (!participant.isSelf) {
      video.volume = 1.0;
    }

    video.play().catch(() => {});
  }, [participant.stream, participant.isSelf, hasVideo]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !participant.stream || hasVideo || participant.isSelf) return;

    if (audio.srcObject !== participant.stream) {
      audio.srcObject = participant.stream;
    }
    audio.play().catch(() => {});
  }, [participant.stream, participant.isSelf, hasVideo]);

  const avatarColor = getParticipantAvatarColor(index);
  const userInitial = participant.displayName ? participant.displayName.trim().charAt(0).toUpperCase() : 'U';

  return (
    <div
      className={`relative aspect-[16/10] sm:aspect-[16/9] rounded-xl overflow-hidden bg-[#202124] border transition-all duration-300 select-none shadow-lg group ${
        participant.isSpeaking
          ? 'ring-2 ring-[#8ab4f8] border-transparent shadow-[0_0_16px_rgba(138,180,248,0.5)]'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {hasVideo ? (
        <>
          {/* Live Mirrored Camera Stream (Google Meet Style) */}
          <video
            ref={onVideoAttach}
            autoPlay
            playsInline
            muted={Boolean(participant.isSelf)}
            className={`w-full h-full object-cover ${participant.isSelf ? '-scale-x-100' : ''}`}
          />

          {/* Local User Quick Action Button on Hover */}
          {participant.isSelf && onToggleSelfCamera && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelfCamera();
                }}
                className="px-2 py-1 rounded-md bg-black/70 hover:bg-red-600/90 text-white text-[10px] font-semibold backdrop-blur-md border border-white/20 transition flex items-center gap-1 shadow-lg"
                title="Turn off camera"
              >
                <VideoOff className="w-3 h-3 text-red-300" />
                <span className="hidden sm:inline">Turn off</span>
              </button>
            </div>
          )}

          {/* Green Live Indicator */}
          <div className="absolute top-2 right-2 group-hover:hidden z-10">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
        </>
      ) : (
        /* Google Meet Avatar State (No "Camera closed" text, sleek Meet design) */
        <div
          onClick={() => {
            if (participant.isSelf && onToggleSelfCamera) {
              onToggleSelfCamera();
            }
          }}
          className={`w-full h-full flex flex-col items-center justify-center relative bg-[#202124] ${
            participant.isSelf ? 'cursor-pointer' : ''
          }`}
          title={participant.isSelf ? 'Click to turn on camera preview (Google Meet style)' : ''}
        >
          {!participant.isSelf && participant.stream && (
            <audio ref={audioRef} autoPlay playsInline />
          )}

          {/* Centered Circular Avatar with Google Meet color */}
          <div
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-lg border border-white/10 transition-transform duration-300 group-hover:scale-105"
            style={{ backgroundColor: avatarColor }}
          >
            <span className="text-lg sm:text-xl font-bold text-white uppercase tracking-wider select-none">
              {userInitial}
            </span>
          </div>

          {/* Local User Click-to-Start Hover Overlay (Google Meet self-view) */}
          {participant.isSelf && onToggleSelfCamera && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 z-20">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-md">
                <Camera className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full border border-white/20">
                Turn On Camera
              </span>
            </div>
          )}
        </div>
      )}

      {/* Top Left Host Badge (Netflix Red) */}
      {participant.isHost && (
        <div className="absolute top-2 left-2 bg-[#E50914] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-md tracking-wider uppercase z-10 flex items-center gap-1">
          <Crown className="w-2.5 h-2.5 fill-current" />
          <span>Host</span>
        </div>
      )}

      {/* Bottom Left Google Meet Name & Mic Status Pill Badge */}
      <div className="absolute bottom-2 left-2 bg-[#202124]/90 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-medium px-2 py-1 rounded-md flex items-center gap-1.5 shadow-md border border-white/10 max-w-[88%] z-10 pointer-events-none">
        {participant.isMuted ? (
          <MicOff className="w-3 h-3 text-red-400 flex-shrink-0" />
        ) : (
          <Mic className="w-3 h-3 text-emerald-400 flex-shrink-0" />
        )}
        <span className="truncate max-w-[85px] sm:max-w-[120px]">
          {participant.displayName}
          {participant.isSelf ? ' (You)' : ''}
        </span>
      </div>
    </div>
  );
});

