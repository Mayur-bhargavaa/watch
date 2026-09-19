'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  Volume2,
  VolumeX,
  Settings,
  X,
  Radio,
  UserPlus,
  Check,
  Crown,
  LogOut,
  Smile,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Users,
  Camera,
  MessageSquare,
  User
} from 'lucide-react';
import { MediaItem, RoomPlaybackState, Reaction } from '@synccinema/common';
import { YouTubeEmbed } from './YouTubeEmbed';
import { DirectHTML5Player } from './DirectHTML5Player';

export interface TheaterParticipant {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  stream: MediaStream | null;
  isCameraOn?: boolean;
  isMuted?: boolean;
  isSpeaking?: boolean;
  isSelf?: boolean;
  isHost?: boolean;
}

interface PixelPerfectTheaterProps {
  media: MediaItem | null;
  playbackState: RoomPlaybackState;
  isHost: boolean;
  getAuthoritativePosition: () => number;
  onHostCommand: (action: 'PLAY' | 'PAUSE' | 'SEEK', position: number) => void;
  screenStream?: MediaStream | null;
  isScreenSharing?: boolean;
  screenPresenter?: { userId: string; displayName: string } | null;
  onStartScreenShare?: () => void;
  onStopScreenShare?: () => void;
  isMicMuted?: boolean;
  isCameraOn?: boolean;
  onToggleMic?: () => void;
  onToggleCamera?: () => void;
  onLeaveRoom?: () => void;
  roomTitle?: string;
  onNavigateUrl?: (url: string) => void;
  onExitTheater: () => void;
  participants?: TheaterParticipant[];
  latestReactions?: Reaction[];
  onSendReaction?: (emoji: string, timestamp?: number) => void;
  onCopyInvite?: () => void;
  copiedInvite?: boolean;
  userAvatarUrl?: string;
  userName?: string;
  isChatOpen?: boolean;
  onToggleChat?: () => void;
  unreadCount?: number;
}

// Dedicated Theater Video Camera Preview Tile
function TheaterCamTile({
  participant,
  index,
  onToggleCamera,
  userAvatarUrl
}: {
  participant: TheaterParticipant;
  index: number;
  onToggleCamera?: () => void;
  userAvatarUrl?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasVideo = Boolean(
    participant.isCameraOn &&
    participant.stream &&
    participant.stream.getVideoTracks().length > 0 &&
    participant.stream.getVideoTracks().some((t) => t.enabled && t.readyState !== 'ended')
  );

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !participant.stream || !hasVideo) return;
    if (el.srcObject !== participant.stream) {
      el.srcObject = participant.stream;
    }
    el.muted = true;
    el.play().catch(() => {});
  }, [participant.stream, hasVideo]);

  const fallback = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(participant.displayName || `Seat${index + 1}`)}`;
  const effectiveAvatar = participant.avatarUrl || (participant.isSelf ? userAvatarUrl : null) || fallback;
  const initial = participant.displayName ? participant.displayName.trim().charAt(0).toUpperCase() : 'U';
  const avatarColors = ['#1a73e8', '#9334e6', '#00897b', '#e52592', '#f4511e', '#188038'];
  const avatarBg = avatarColors[index % avatarColors.length];

  return (
    <div
      className={`relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-[#11141c] border transition-all duration-300 shadow-lg group select-none ${
        participant.isSpeaking
          ? 'border-[#8ab4f8] ring-2 ring-[#8ab4f8]/60 shadow-[0_0_15px_rgba(138,180,248,0.4)]'
          : 'border-white/10 hover:border-white/25'
      }`}
    >
      {hasVideo ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${participant.isSelf ? '-scale-x-100' : ''}`}
          />
          {/* Live indicator */}
          <div className="absolute top-1.5 right-1.5 z-10">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>
        </>
      ) : (
        /* Camera Off - Sleek Avatar View */
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#181c28] to-[#0c0e16] relative">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg border border-white/10 overflow-hidden"
            style={{ backgroundColor: avatarBg }}
          >
            {effectiveAvatar.includes('dicebear') || !effectiveAvatar.startsWith('http') ? (
              <span className="text-sm font-black text-white uppercase tracking-wider">
                {initial}
              </span>
            ) : (
              <img src={effectiveAvatar} alt={participant.displayName} className="w-full h-full object-cover" />
            )}
          </div>
          {participant.isSelf && onToggleCamera && (
            <button
              onClick={onToggleCamera}
              className="mt-1 text-[9px] font-semibold text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-full border border-white/15 transition flex items-center gap-1"
            >
              <Camera className="w-2.5 h-2.5" />
              <span>Turn on cam</span>
            </button>
          )}
        </div>
      )}

      {/* Host Crown Badge */}
      {participant.isHost && (
        <div className="absolute top-1.5 left-1.5 bg-[#E50914] text-white text-[8px] font-black px-1.5 py-0.5 rounded-md shadow flex items-center gap-0.5 z-10 uppercase tracking-wider">
          <Crown className="w-2.5 h-2.5 fill-current" />
          <span>Host</span>
        </div>
      )}

      {/* Bottom Name & Mic status badge */}
      <div className="absolute bottom-1.5 left-1.5 bg-black/80 backdrop-blur-md text-white text-[9.5px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1.5 border border-white/10 max-w-[90%] z-10">
        {participant.isMuted ? (
          <MicOff className="w-3 h-3 text-rose-400 shrink-0" />
        ) : (
          <Mic className="w-3 h-3 text-emerald-400 shrink-0" />
        )}
        <span className="truncate">
          {participant.displayName} {participant.isSelf ? '(You)' : ''}
        </span>
      </div>
    </div>
  );
}

// Interactive Theater Empty Slot Invite Tile
function TheaterEmptyInviteSlot({
  onCopyInvite,
  copiedInvite,
  seatNumber
}: {
  onCopyInvite?: () => void;
  copiedInvite?: boolean;
  seatNumber: number;
}) {
  return (
    <div
      onClick={onCopyInvite}
      className="relative aspect-[16/10] w-full rounded-xl border border-dashed border-white/20 hover:border-white/40 bg-white/[0.03] hover:bg-white/[0.08] transition-all cursor-pointer flex flex-col items-center justify-center text-zinc-400 hover:text-white group select-none shadow-sm"
      title="Invite a friend to take this cinema seat"
    >
      <div className="w-7 h-7 rounded-full bg-white/5 group-hover:bg-white/10 border border-white/10 flex items-center justify-center mb-0.5 transition">
        {copiedInvite ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <span className="text-sm font-light text-rose-400 group-hover:scale-110 transition-transform">+</span>
        )}
      </div>
      <span className="text-[10px] font-bold tracking-wide text-zinc-300 group-hover:text-white">
        {copiedInvite ? '✓ Link Copied' : 'Invite Friend'}
      </span>
      <span className="text-[8px] text-zinc-500">Seat {seatNumber}/6</span>
    </div>
  );
}

const LIVE_REACTIONS = ['❤️', '😂', '🔥', '👏', '🎉', '🎲', '🥳', '🥺'] as const;

export function PixelPerfectTheater({
  media,
  playbackState,
  isHost,
  getAuthoritativePosition,
  onHostCommand,
  screenStream,
  isScreenSharing = false,
  screenPresenter,
  onStartScreenShare,
  onStopScreenShare,
  isMicMuted = false,
  isCameraOn = false,
  onToggleMic,
  onToggleCamera,
  onLeaveRoom,
  roomTitle = 'Netflix Watch Party',
  onNavigateUrl,
  onExitTheater,
  participants = [],
  latestReactions = [],
  onSendReaction,
  onCopyInvite,
  copiedInvite = false,
  userAvatarUrl,
  userName = 'You',
  isChatOpen = false,
  onToggleChat,
  unreadCount = 0,
}: PixelPerfectTheaterProps) {
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);

  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [newMediaUrl, setNewMediaUrl] = useState<string>('');
  const [showReactionsBar, setShowReactionsBar] = useState<boolean>(true);
  const [floatingParticles, setFloatingParticles] = useState<Array<{ id: string; emoji: string; left: number }>>([]);
  const [showSeatCams, setShowSeatCams] = useState<boolean>(true);
  const [showCamPanel, setShowCamPanel] = useState<boolean>(true);

  const lastProcessedReactionRef = useRef<string | null>(latestReactions?.[0]?.id || null);
  const theaterMountTimeRef = useRef<number>(Date.now());

  const MAX_SEATS = 6;
  const seats = Array.from({ length: MAX_SEATS }, (_, idx) => participants[idx] || null);

  // Synchronize incoming socket reactions from real people
  useEffect(() => {
    if (!latestReactions || latestReactions.length === 0) return;
    const newest = latestReactions[0];
    if (!newest) return;

    // Prevent replaying old or already-handled reactions
    if (newest.id === lastProcessedReactionRef.current) return;
    lastProcessedReactionRef.current = newest.id;

    // Filter out historical reactions from previous room visits or database load
    const rxTime = newest.serverTimestamp || new Date(newest.createdAt).getTime();
    if (rxTime && (Date.now() - rxTime > 4000 || rxTime < theaterMountTimeRef.current - 1000)) {
      return;
    }

    // Skip self to prevent duplicate since handleReact already launches it immediately
    const pIdx = participants.findIndex(p => p.userId === newest.userId);
    const isSelf = pIdx >= 0 && participants[pIdx]?.isSelf;
    if (isSelf) return;

    const particleId = `${newest.id}_${Date.now()}`;
    const leftPct = pIdx >= 0 ? 25 + (pIdx / MAX_SEATS) * 50 + (Math.random() * 6 - 3) : 30 + Math.random() * 40;

    const p = { id: particleId, emoji: newest.emoji, left: leftPct };
    setFloatingParticles(prev => [...prev.slice(-20), p]);

    const timer = setTimeout(() => {
      setFloatingParticles(prev => prev.filter(item => item.id !== particleId));
    }, 2600);
    return () => clearTimeout(timer);
  }, [latestReactions, participants]);

  // Handle local user clicking an emoji reaction
  const handleReact = (emoji: string) => {
    if (onSendReaction) {
      onSendReaction(emoji, getAuthoritativePosition());
    }
    const particleId = `local_${Date.now()}_${Math.random()}`;
    const selfIdx = participants.findIndex(p => p.isSelf);
    const leftPct = selfIdx >= 0 ? 25 + (selfIdx / MAX_SEATS) * 50 + (Math.random() * 6 - 3) : 50;

    const p = { id: particleId, emoji, left: leftPct };
    setFloatingParticles(prev => [...prev.slice(-20), p]);
    setTimeout(() => {
      setFloatingParticles(prev => prev.filter(item => item.id !== particleId));
    }, 2600);
  };

  // Screen Stream attach
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      if (screenVideoRef.current.srcObject !== screenStream) {
        screenVideoRef.current.srcObject = screenStream;
      }
      screenVideoRef.current.muted = Boolean(isScreenSharing);
      screenVideoRef.current.volume = isMuted ? 0 : volume;
      screenVideoRef.current.play().catch(() => {});
    }
  }, [screenStream, isScreenSharing, volume, isMuted]);

  const hasMediaActive = Boolean(
    screenStream ||
    (media?.sourceUrl && (media.provider as string) !== 'screen') ||
    (media?.provider === 'youtube' && media?.providerMediaId)
  );

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen bg-[#050508] flex items-center justify-center select-none overflow-hidden font-sans">
      {/* ── 1024x666 Pixel-Perfect Theater Canvas ── */}
      <div
        className="relative w-full h-full max-w-[1550px] aspect-[1024/666] flex flex-col justify-between overflow-hidden shadow-2xl"
        style={{
          backgroundImage: `url('/theater/theater_clean_backdrop.png')`,
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* ══ TOP BAR ══ */}
        <div className="relative z-30 w-full px-6 pt-4 flex items-center justify-between pointer-events-auto">
          {/* Left: Brand Logo (clean text matching normal mode, no red play button) */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={onExitTheater} title="Back to Standard View">
              <div className="flex flex-col leading-none">
                <span className="text-base sm:text-lg font-black tracking-tighter text-[#E50914] select-none">watch.</span>
                <span className="text-[7.5px] font-semibold tracking-wider text-zinc-400/80 uppercase select-none mt-0.5">watch · stitchbyte</span>
              </div>
              {roomTitle && (
                <>
                  <span className="text-zinc-600 text-sm hidden sm:inline">/</span>
                  <span className="text-xs sm:text-sm font-semibold text-white tracking-wide truncate max-w-[140px] sm:max-w-[260px]">
                    {roomTitle}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: Quick Controls & Leave Button */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Mic Toggle */}
            <button
              onClick={onToggleMic}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition shadow-md ${
                isMicMuted
                  ? 'bg-red-950/80 border-red-500/50 text-rose-400 hover:bg-red-900'
                  : 'bg-white/10 border-white/15 text-white hover:bg-white/20'
              }`}
              title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Camera Toggle */}
            <button
              onClick={onToggleCamera}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition shadow-md ${
                !isCameraOn
                  ? 'bg-red-950/80 border-red-500/50 text-rose-400 hover:bg-red-900'
                  : 'bg-white/10 border-white/15 text-white hover:bg-white/20'
              }`}
              title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
            >
              {!isCameraOn ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Chat Toggle Button */}
            {onToggleChat && (
              <button
                onClick={onToggleChat}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition border relative active:scale-95 ${
                  isChatOpen
                    ? 'bg-rose-600/30 text-rose-300 border-rose-500 ring-2 ring-rose-500/50 shadow-md shadow-rose-600/30'
                    : 'bg-white/10 text-white border-white/10 hover:bg-white/20'
                }`}
                title={isChatOpen ? 'Close Chat' : 'Open Chat & Party Games'}
              >
                <MessageSquare className="w-4 h-4" />
                {unreadCount > 0 && !isChatOpen && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black bg-amber-400 text-black flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* Members Count Badge */}
            <div className="px-2.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-white text-xs font-semibold flex items-center gap-1.5 shadow">
              <User className="w-3.5 h-3.5 text-zinc-300" />
              <span>{participants.length}/6</span>
            </div>

            {/* Red Leave Room Button */}
            <button
              onClick={onLeaveRoom}
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-[0_0_15px_rgba(225,29,72,0.5)] flex items-center gap-1.5 transition active:scale-95"
              title="Leave Room Session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          </div>
        </div>

        {/* ══ CAM PREVIEWS: 2 LEFT ══ */}
        {showCamPanel && (
          <div className="absolute left-[1%] sm:left-[1.5%] top-[10%] w-[18%] sm:w-[17.5%] max-w-[210px] flex flex-col gap-2.5 sm:gap-3 z-30 pointer-events-auto animate-in fade-in slide-in-from-left-4 duration-300">
            {/* Left Slot 1 (Seat 1) */}
            {seats[0] ? (
              <TheaterCamTile
                participant={seats[0]}
                index={0}
                onToggleCamera={onToggleCamera}
                userAvatarUrl={userAvatarUrl}
              />
            ) : (
              <TheaterEmptyInviteSlot
                onCopyInvite={onCopyInvite}
                copiedInvite={copiedInvite}
                seatNumber={1}
              />
            )}

            {/* Left Slot 2 (Seat 2) */}
            {seats[1] ? (
              <TheaterCamTile
                participant={seats[1]}
                index={1}
                onToggleCamera={onToggleCamera}
                userAvatarUrl={userAvatarUrl}
              />
            ) : (
              <TheaterEmptyInviteSlot
                onCopyInvite={onCopyInvite}
                copiedInvite={copiedInvite}
                seatNumber={2}
              />
            )}
          </div>
        )}

        {/* ══ CAM PREVIEWS: 2 RIGHT ══ */}
        {showCamPanel && (
          <div className="absolute right-[1%] sm:right-[1.5%] top-[10%] w-[18%] sm:w-[17.5%] max-w-[210px] flex flex-col gap-2.5 sm:gap-3 z-30 pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Right Slot 3 (Seat 3) */}
            {seats[2] ? (
              <TheaterCamTile
                participant={seats[2]}
                index={2}
                onToggleCamera={onToggleCamera}
                userAvatarUrl={userAvatarUrl}
              />
            ) : (
              <TheaterEmptyInviteSlot
                onCopyInvite={onCopyInvite}
                copiedInvite={copiedInvite}
                seatNumber={3}
              />
            )}

            {/* Right Slot 4 (Seat 4) */}
            {seats[3] ? (
              <TheaterCamTile
                participant={seats[3]}
                index={3}
                onToggleCamera={onToggleCamera}
                userAvatarUrl={userAvatarUrl}
              />
            ) : (
              <TheaterEmptyInviteSlot
                onCopyInvite={onCopyInvite}
                copiedInvite={copiedInvite}
                seatNumber={4}
              />
            )}
          </div>
        )}

        {/* ══ CAM PREVIEWS: 2 BOTTOM ══ */}
        {showCamPanel && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[70px] sm:bottom-[76px] flex items-center gap-3 sm:gap-5 z-30 pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Bottom Slot 5 (Seat 5) */}
            <div className="w-[145px] sm:w-[185px] md:w-[205px]">
              {seats[4] ? (
                <TheaterCamTile
                  participant={seats[4]}
                  index={4}
                  onToggleCamera={onToggleCamera}
                  userAvatarUrl={userAvatarUrl}
                />
              ) : (
                <TheaterEmptyInviteSlot
                  onCopyInvite={onCopyInvite}
                  copiedInvite={copiedInvite}
                  seatNumber={5}
                />
              )}
            </div>

            {/* Bottom Slot 6 (Seat 6) */}
            <div className="w-[145px] sm:w-[185px] md:w-[205px]">
              {seats[5] ? (
                <TheaterCamTile
                  participant={seats[5]}
                  index={5}
                  onToggleCamera={onToggleCamera}
                  userAvatarUrl={userAvatarUrl}
                />
              ) : (
                <TheaterEmptyInviteSlot
                  onCopyInvite={onCopyInvite}
                  copiedInvite={copiedInvite}
                  seatNumber={6}
                />
              )}
            </div>
          </div>
        )}

        {/* ══ THE MAIN CINEMA SCREEN (EXPANSIVE IMAX FRAME AT 19.98% x 4.55%, 59.95% w, 56.64% h) ══ */}
        <div
          className="absolute z-20 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.95)] group/screen"
          style={{
            top: '4.55%',
            left: '19.98%',
            width: '59.95%',
            height: '56.64%',
            backgroundColor: '#000000',
            border: '2px solid #141720',
            borderRadius: '4px',
            boxShadow: '0 0 50px 20px rgba(0,0,0,0.98)',
          }}
        >
          {/* Subtle Brand Watermark matching media_1789752223981.png */}
          <div className="absolute top-2.5 right-3 sm:top-3.5 sm:right-4 pointer-events-none select-none z-30 flex flex-col items-end opacity-40 group-hover/screen:opacity-80 transition-opacity">
            <span className="text-[10px] sm:text-[11px] font-black tracking-tighter text-[#E50914] leading-none">watch.</span>
            <span className="text-[6px] sm:text-[7px] font-semibold tracking-widest text-white/70 uppercase mt-0.5">watch · stitchbyte</span>
          </div>
          {/* Active Screen Stream */}
          {screenStream ? (
            <div className="relative w-full h-full bg-black flex items-center justify-center">
              <video
                ref={(el) => {
                  screenVideoRef.current = el;
                  if (el && screenStream) {
                    if (el.srcObject !== screenStream) {
                      el.srcObject = screenStream;
                    }
                    el.muted = Boolean(isScreenSharing);
                    el.volume = isMuted ? 0 : volume;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                controls={false}
                muted={Boolean(isScreenSharing)}
                className="w-full h-full object-contain"
              />
              <div className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow pointer-events-none">
                <Radio className="w-3 h-3 animate-pulse" />
                <span>LIVE SCREEN</span>
              </div>
            </div>
          ) : media?.provider === 'youtube' && media?.providerMediaId ? (
            <YouTubeEmbed
              videoId={media.providerMediaId}
              playbackState={playbackState}
              isHost={isHost}
              getAuthoritativePosition={getAuthoritativePosition}
              onHostCommand={onHostCommand}
            />
          ) : media?.sourceUrl && (media.provider as string) !== 'screen' ? (
            <DirectHTML5Player
              sourceUrl={media.sourceUrl}
              playbackState={playbackState}
              isHost={isHost}
              getAuthoritativePosition={getAuthoritativePosition}
              onHostCommand={onHostCommand}
            />
          ) : (
            /* Idle Screen matching media_1789751627638.png (Share Screen to Start Movie Party card) */
            <div className="relative w-full h-full bg-black flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none animate-fadeIn">
              <div className="max-w-[340px] sm:max-w-md w-full bg-[#121622]/95 border border-white/10 rounded-2xl p-5 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col items-center space-y-3 sm:space-y-4">
                {/* Glowing Red Icon Badge matching media_1789751627638.png */}
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-[#E50914] to-rose-600 flex items-center justify-center shadow-lg shadow-red-600/40 text-white">
                  <ScreenShare className="w-5 h-5 sm:w-7 sm:h-7" />
                </div>

                {isHost ? (
                  <>
                    <div className="space-y-1 sm:space-y-1.5">
                      <h3 className="text-sm sm:text-lg md:text-xl font-bold text-white tracking-tight">
                        Share Screen to Start Movie Party
                      </h3>
                      <p className="text-[10px] sm:text-xs text-zinc-400 leading-relaxed max-w-sm">
                        Open Netflix, Prime Video, YouTube or any movie in your browser, then share your tab or screen with everyone.
                      </p>
                    </div>

                    <div className="w-full pt-1">
                      {onStartScreenShare && (
                        <button
                          onClick={onStartScreenShare}
                          className="w-full py-2.5 sm:py-3 px-5 bg-[#E50914] hover:bg-red-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-red-600/30 transition transform active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
                        >
                          <ScreenShare className="w-4 h-4" />
                          <span>Share Screen &amp; Start</span>
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-1 sm:space-y-1.5">
                    <h3 className="text-sm sm:text-lg md:text-xl font-bold text-white tracking-tight">
                      Waiting for Host to Stream Movie
                    </h3>
                    <p className="text-[10px] sm:text-xs text-zinc-400 leading-relaxed max-w-sm">
                      The host will start sharing their screen or video stream shortly. Grab your popcorn and enjoy the party!
                    </p>
                    <div className="pt-1.5 flex items-center justify-center gap-1.5 text-rose-400 text-[11px] sm:text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                      <span>Ready &amp; waiting for broadcast...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ══ FLOATING REAL-PERSON REACTION BUBBLES ══ */}
        <style>{`
          @keyframes theaterFloatUp {
            0% {
              opacity: 0;
              transform: translateY(0px) scale(0.6) rotate(0deg);
            }
            12% {
              opacity: 1;
              transform: translateY(-40px) scale(1.3) rotate(-8deg);
            }
            30% {
              opacity: 1;
              transform: translateY(-110px) scale(1.15) rotate(8deg);
            }
            60% {
              opacity: 0.95;
              transform: translateY(-240px) scale(1.05) rotate(-5deg);
            }
            85% {
              opacity: 0.65;
              transform: translateY(-350px) scale(0.95) rotate(4deg);
            }
            100% {
              opacity: 0;
              transform: translateY(-450px) scale(0.8) rotate(0deg);
            }
          }
        `}</style>
        {floatingParticles.map((p) => (
          <div
            key={p.id}
            className="absolute z-50 pointer-events-none text-3xl sm:text-4xl select-none"
            style={{
              left: `${p.left}%`,
              bottom: '15%',
              animation: 'theaterFloatUp 2.6s cubic-bezier(0.2, 0.8, 0.4, 1) forwards',
              filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.9))',
            }}
          >
            {p.emoji}
          </div>
        ))}

        {/* ══ BOTTOM CONTROL BAR ══ */}
        <div className="relative z-30 w-full px-6 pb-4 flex items-center justify-between pointer-events-auto">
          {/* Bottom Left: Connected Status Pill */}
          <div
            className="px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-bold text-white shadow-xl"
            style={{
              backgroundColor: 'rgba(18, 20, 26, 0.88)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <div className="flex flex-col leading-none">
              <span className="text-zinc-200">Connected</span>
              <span className="text-[8px] text-zinc-400 mt-0.5 flex items-center gap-1">
                <User className="w-2.5 h-2.5 text-zinc-400" />
                <span>{participants.length}/6 in room</span>
              </span>
            </div>
          </div>

          {/* Bottom Center: Floating Capsule Control Dock */}
          <div className="relative flex flex-col items-center">
            {/* Quick Reactions Bar matching media_1789753527787.png */}
            {showReactionsBar && (
              <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-2xl bg-[#141722]/90 backdrop-blur-xl border border-white/15 shadow-[0_8px_30px_rgba(0,0,0,0.85)] mb-2.5 animate-in fade-in slide-in-from-bottom-2">
                {LIVE_REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/5 hover:bg-rose-500/25 active:scale-90 transition-all text-base sm:text-lg shrink-0 border border-white/10 hover:border-rose-400/50 flex items-center justify-center shadow-sm cursor-pointer hover:scale-115"
                    title={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Pill Dock */}
            <div
              className="px-4 py-2 rounded-full flex items-center gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
              style={{
                backgroundColor: 'rgba(18, 20, 26, 0.92)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              {/* Mic Button */}
              <button
                onClick={onToggleMic}
                className={`p-2 rounded-full transition ${
                  isMicMuted ? 'text-rose-500 bg-red-950/50' : 'text-zinc-200 hover:text-white bg-white/5'
                }`}
                title={isMicMuted ? 'Unmute' : 'Mute'}
              >
                {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
              </button>

              {/* Camera Button */}
              <button
                onClick={onToggleCamera}
                className={`p-2 rounded-full transition ${
                  !isCameraOn ? 'text-rose-500 bg-red-950/50' : 'text-zinc-200 hover:text-white bg-white/5'
                }`}
                title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
              >
                {!isCameraOn ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4 text-emerald-400" />}
              </button>

              {/* Cam Preview Toggle Button */}
              <button
                onClick={() => setShowCamPanel(p => !p)}
                className={`p-2 rounded-full transition ${
                  showCamPanel ? 'text-indigo-400 bg-indigo-950/60 ring-1 ring-indigo-500/40' : 'text-zinc-400 hover:text-white bg-white/5'
                }`}
                title={showCamPanel ? 'Hide Camera Preview Dock' : 'Show Camera Preview Dock'}
              >
                <Users className="w-4 h-4" />
              </button>

              {/* Reaction Trigger Button */}
              <button
                onClick={() => setShowReactionsBar(b => !b)}
                className={`p-2 rounded-full transition ${
                  showReactionsBar ? 'text-amber-400 bg-amber-950/50' : 'text-zinc-200 hover:text-white bg-white/5'
                }`}
                title="Live Reactions"
              >
                <Smile className="w-4 h-4" />
              </button>

              {/* Chat Toggle Button */}
              {onToggleChat && (
                <button
                  onClick={onToggleChat}
                  className={`p-2 rounded-full transition relative ${
                    isChatOpen
                      ? 'text-rose-400 bg-rose-950/60 ring-1 ring-rose-500/40'
                      : 'text-zinc-200 hover:text-white bg-white/5'
                  }`}
                  title={isChatOpen ? 'Close Chat' : 'Open Chat'}
                >
                  <MessageSquare className="w-4 h-4" />
                  {unreadCount > 0 && !isChatOpen && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] font-black bg-amber-400 text-black flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              )}

              {/* Screen Share Button */}
              <button
                onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
                className={`p-2 rounded-full transition ${
                  isScreenSharing ? 'text-emerald-400 bg-emerald-950/50' : 'text-zinc-200 hover:text-white bg-white/5'
                }`}
                title={isScreenSharing ? 'Stop Screen Share' : 'Start Screen Share'}
              >
                <ScreenShare className="w-4 h-4" />
              </button>

              {/* Exit 3D Theater button -> Normal Mode */}
              <button
                onClick={onExitTheater}
                className="px-2.5 py-1.5 rounded-full text-zinc-300 hover:text-amber-300 bg-white/10 hover:bg-white/20 border border-white/10 transition flex items-center gap-1.5 text-xs font-semibold"
                title="Exit 3D Theater (Back to Normal Mode)"
              >
                <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Normal Mode</span>
              </button>
            </div>
          </div>

          {/* Bottom Right: Volume Slider & Settings */}
          <div className="flex items-center gap-3">
            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMuted(m => !m)}
                className="text-zinc-300 hover:text-white transition"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  setIsMuted(false);
                }}
                className="w-16 h-1 bg-red-600 rounded-full appearance-none cursor-pointer accent-red-600"
              />
            </div>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
              title="Stream Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ══ SETTINGS MODAL ══ */}
        {showSettingsModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn pointer-events-auto">
            <div className="bg-[#121622] max-w-sm w-full rounded-2xl border border-white/10 p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between text-white">
                <span className="text-sm font-bold">Cinema Stream Settings</span>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1 text-zinc-400 hover:text-white rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-zinc-300 font-medium">
                  Change Media / Video URL:
                </label>
                <input
                  type="text"
                  value={newMediaUrl}
                  onChange={(e) => setNewMediaUrl(e.target.value)}
                  placeholder="Paste YouTube or direct MP4 URL..."
                  className="w-full px-3 py-2 bg-[#0A0D14] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#E50914]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-xs text-zinc-300 rounded-xl transition"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    if (onNavigateUrl && newMediaUrl.trim()) {
                      onNavigateUrl(newMediaUrl.trim());
                    }
                    setShowSettingsModal(false);
                  }}
                  className="px-4 py-1.5 bg-[#E50914] hover:bg-red-600 text-white text-xs font-bold rounded-xl transition shadow"
                >
                  Apply Video
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
