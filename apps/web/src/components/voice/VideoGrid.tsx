'use client';

import React, { useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

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
}

export const PARTICIPANT_PALETTE = [
  '#E05375', // Pink (like Mary)
  '#6C5CE7', // Purple (like Daniel)
  '#00B894', // Emerald
  '#0984E3', // Blue
  '#E17055', // Coral
  '#FDCB6E', // Warm yellow
];

export function getParticipantColor(index: number): string {
  return PARTICIPANT_PALETTE[index % PARTICIPANT_PALETTE.length];
}

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

interface VideoGridProps {
  participants: ParticipantStream[];
  onCopyInvite?: () => void;
  copiedInvite?: boolean;
}

export function VideoGrid({ participants, onCopyInvite, copiedInvite }: VideoGridProps) {
  if (participants.length === 0) {
    return null;
  }

  return (
    <div className="w-full flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
      {participants.map((p, idx) => (
        <div key={p.userId || idx} className="flex-1 min-w-[120px] max-w-[220px]">
          <MemoizedVideoTile participant={p} index={idx} />
        </div>
      ))}

      {participants.length < 6 && onCopyInvite && (
        <button
          onClick={onCopyInvite}
          className="flex-1 min-w-[110px] max-w-[150px] aspect-[16/10] sm:aspect-[16/9] rounded-lg border border-dashed border-white/20 hover:border-white/40 bg-white/[0.02] hover:bg-white/[0.06] transition flex flex-col items-center justify-center text-zinc-400 hover:text-white select-none group"
          title="Invite friends to this watch party (up to 6 members)"
        >
          <span className="text-xs font-bold group-hover:scale-110 transition">
            {copiedInvite ? '✓ Copied' : '+ Invite'}
          </span>
          <span className="text-[10px] text-zinc-500 mt-0.5">
            {participants.length}/6 seats
          </span>
        </button>
      )}
    </div>
  );
}

const MemoizedVideoTile = React.memo(function VideoTile({
  participant,
  index
}: {
  participant: ParticipantStream;
  index: number;
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

  const tileColor = getParticipantColor(index);
  const userInitial = participant.displayName ? participant.displayName.trim().charAt(0).toUpperCase() : 'U';

  return (
    <div
      className={`relative aspect-[16/10] sm:aspect-[16/9] rounded-lg overflow-hidden bg-[#161c2b] border ${
        participant.isSpeaking
          ? 'border-emerald-400 ring-2 ring-emerald-400/60'
          : 'border-white/10'
      } shadow-md transition-all duration-200 select-none`}
    >
      {hasVideo ? (
        <video
          ref={onVideoAttach}
          autoPlay
          playsInline
          muted={Boolean(participant.isSelf)}
          className={`w-full h-full object-cover ${participant.isSelf ? '-scale-x-100' : ''}`}
        />
      ) : (
        <div
          className="w-full h-full flex flex-col items-center justify-center shadow-inner relative"
          style={{ backgroundColor: tileColor }}
        >
          {!participant.isSelf && participant.stream && (
            <audio ref={audioRef} autoPlay playsInline />
          )}
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/25 shadow-md">
            <span className="text-base sm:text-lg font-extrabold text-white uppercase tracking-wider">
              {userInitial}
            </span>
          </div>
          <span className="text-[10px] text-white/80 font-medium mt-1 tracking-tight">
            Camera closed
          </span>
        </div>
      )}

      {/* Top Left Host Badge (Netflix Red) */}
      {participant.isHost && (
        <div className="absolute top-1 left-1 bg-[#E50914] text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-sm shadow-md tracking-wide z-10">
          Host
        </div>
      )}

      {/* Bottom Left Name & Mic Status Pill Badge */}
      <div className="absolute bottom-1 left-1 bg-black/80 backdrop-blur-sm text-white text-[10px] sm:text-[11px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 shadow max-w-[90%] z-10">
        {participant.isMuted ? (
          <MicOff className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />
        ) : (
          <Mic className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
        )}
        <span className="truncate max-w-[85px] sm:max-w-[110px]">
          {participant.displayName}
        </span>
      </div>
    </div>
  );
});

