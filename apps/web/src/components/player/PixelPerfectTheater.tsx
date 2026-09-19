'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  User,
  Palette,
  Sparkles,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { MediaItem, RoomPlaybackState, Reaction } from '@synccinema/common';
import { YouTubeEmbed } from './YouTubeEmbed';
import { DirectHTML5Player } from './DirectHTML5Player';

export interface TheaterTheme {
  id: string;
  name: string;
  category: 'cinema' | 'romantic' | 'cozy';
  bgUrl: string;
  previewUrl: string;
  accent: string;
  description: string;
}

export const THEATER_THEMES: TheaterTheme[] = [
  {
    id: 'cinema-vip',
    name: '3D VIP Cinema',
    category: 'cinema',
    bgUrl: '/theater/theater_clean_backdrop.png',
    previewUrl: '/theater/theater_clean_backdrop.png',
    accent: '#e50914',
    description: 'Front row red velvet VIP couch, glowing wooden armrests & cinema wall lights',
  },
  {
    id: 'theam1',
    name: 'Candlelit Café',
    category: 'romantic',
    bgUrl: '/theams/theam1.jpeg',
    previewUrl: '/theams/theam1.jpeg',
    accent: '#fbbf24',
    description: 'Romantic warm candlelight, rustic bricks & Paris café ambiance',
  },
  {
    id: 'theam2',
    name: 'Neon Romance',
    category: 'romantic',
    bgUrl: '/theams/theam2.jpeg',
    previewUrl: '/theams/theam2.jpeg',
    accent: '#ec4899',
    description: 'Electric pink & violet neon night with panoramic city views',
  },
  {
    id: 'theam3',
    name: 'Better Together',
    category: 'romantic',
    bgUrl: '/theams/theam3.jpeg',
    previewUrl: '/theams/theam3.jpeg',
    accent: '#8b5cf6',
    description: 'Cozy purple couch, twinkling fairy lights & wine glasses',
  },
  {
    id: 'theam4',
    name: 'Watch Together',
    category: 'romantic',
    bgUrl: '/theams/theam4.jpeg',
    previewUrl: '/theams/theam4.jpeg',
    accent: '#3b82f6',
    description: 'Dreamy starry night sky with purple heart pillows & moonlight',
  },
  {
    id: 'theam5',
    name: 'Snuggle Cinema',
    category: 'romantic',
    bgUrl: '/theams/theam5.jpeg',
    previewUrl: '/theams/theam5.jpeg',
    accent: '#f43f5e',
    description: 'Warm blanket snuggles & soft glowing lantern light',
  },
  {
    id: 'theam6',
    name: 'Velvet Night',
    category: 'romantic',
    bgUrl: '/theams/theam6.jpeg',
    previewUrl: '/theams/theam6.jpeg',
    accent: '#06b6d4',
    description: 'Midnight lounge atmosphere under soft cyan neon lights',
  },
  {
    id: 'cozy',
    name: 'Cozy Cottage',
    category: 'cozy',
    bgUrl: '/images/cozy_ludo_bg.jpg',
    previewUrl: '/images/cozy_ludo_bg.jpg',
    accent: '#e11d48',
    description: 'Sunlit wooden cottage living room with fireplace warmth',
  },
];

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
  userAvatarUrl,
  className = '',
}: {
  participant: TheaterParticipant;
  index: number;
  onToggleCamera?: () => void;
  userAvatarUrl?: string;
  className?: string;
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
      className={`relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-[#11141c] border transition-all duration-300 shadow-xl group select-none ${
        participant.isSpeaking
          ? 'border-[#8ab4f8] ring-2 ring-[#8ab4f8]/60 shadow-[0_0_15px_rgba(138,180,248,0.4)]'
          : 'border-white/15 hover:border-white/30'
      } ${className}`}
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
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#181c28] to-[#0c0e16] relative p-1">
          <div
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-lg border border-white/10 overflow-hidden"
            style={{ backgroundColor: avatarBg }}
          >
            {effectiveAvatar.includes('dicebear') || !effectiveAvatar.startsWith('http') ? (
              <span className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider">
                {initial}
              </span>
            ) : (
              <img src={effectiveAvatar} alt={participant.displayName} className="w-full h-full object-cover" />
            )}
          </div>
          {participant.isSelf && onToggleCamera && (
            <button
              onClick={onToggleCamera}
              className="mt-1 text-[7.5px] sm:text-[8.5px] font-semibold text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded-full border border-white/15 transition flex items-center gap-1 cursor-pointer"
            >
              <Camera className="w-2 sm:w-2.5 h-2 sm:h-2.5" />
              <span>Cam on</span>
            </button>
          )}
        </div>
      )}

      {/* Host Crown Badge */}
      {participant.isHost && (
        <div className="absolute top-1 left-1 bg-[#E50914] text-white text-[7px] font-black px-1 py-0.5 rounded shadow flex items-center gap-0.5 z-10 uppercase tracking-wider">
          <Crown className="w-2 h-2 fill-current" />
          <span>Host</span>
        </div>
      )}

      {/* Bottom Name & Mic status badge */}
      <div className="absolute bottom-1 left-1 right-1 bg-black/85 backdrop-blur-md text-white text-[8px] sm:text-[8.5px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 border border-white/10 z-10 truncate">
        {participant.isMuted ? (
          <MicOff className="w-2.5 h-2.5 text-rose-400 shrink-0" />
        ) : (
          <Mic className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
        )}
        <span className="truncate font-semibold">
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
  seatNumber,
  className = '',
}: {
  onCopyInvite?: () => void;
  copiedInvite?: boolean;
  seatNumber: number;
  className?: string;
}) {
  return (
    <div
      onClick={onCopyInvite}
      className={`relative aspect-[16/10] w-full rounded-xl border border-dashed border-white/20 hover:border-white/40 bg-white/[0.03] hover:bg-white/[0.08] transition-all cursor-pointer flex flex-col items-center justify-center text-zinc-400 hover:text-white group select-none shadow-md p-1 ${className}`}
      title="Invite a friend to take this cinema seat"
    >
      <div className="w-5 h-5 rounded-full bg-white/5 group-hover:bg-white/10 border border-white/10 flex items-center justify-center mb-0.5 transition">
        {copiedInvite ? (
          <Check className="w-3 h-3 text-emerald-400" />
        ) : (
          <span className="text-xs font-light text-rose-400 group-hover:scale-110 transition-transform">+</span>
        )}
      </div>
      <span className="text-[8px] sm:text-[8.5px] font-bold tracking-wide text-zinc-300 group-hover:text-white truncate max-w-full">
        {copiedInvite ? '✓ Copied' : 'Invite'}
      </span>
      <span className="text-[7px] text-zinc-500">Seat {seatNumber}/6</span>
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
  const [showReactionsBar, setShowReactionsBar] = useState<boolean>(false);
  const [floatingParticles, setFloatingParticles] = useState<Array<{ id: string; emoji: string; left: number }>>([]);
  const [showSeatCams, setShowSeatCams] = useState<boolean>(true);
  const [showCamPanel, setShowCamPanel] = useState<boolean>(true);
  type TheaterScreenSize = 'standard' | 'large' | 'imax';
  const [screenSize, setScreenSize] = useState<TheaterScreenSize>('large');

  // Theater Background Themes
  const [theaterThemeId, setTheaterThemeId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('synccinema_theater_bg_theme') || 'cinema-vip';
    }
    return 'cinema-vip';
  });
  const [showThemeModal, setShowThemeModal] = useState<boolean>(false);
  const [showFrontSeatsOverlay, setShowFrontSeatsOverlay] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('synccinema_theater_front_seats');
      return saved !== null ? saved === 'true' : false;
    }
    return false;
  });

  const currentTheaterTheme = useMemo(() => {
    return THEATER_THEMES.find(t => t.id === theaterThemeId) || THEATER_THEMES[0];
  }, [theaterThemeId]);

  const handleSelectTheme = (id: string) => {
    setTheaterThemeId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('synccinema_theater_bg_theme', id);
    }
  };

  const handleToggleFrontSeats = () => {
    setShowFrontSeatsOverlay(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('synccinema_theater_front_seats', String(next));
      }
      return next;
    });
  };

  const isImax = screenSize === 'imax';
  const isLarge = screenSize === 'large';

  const screenStyle = useMemo(() => {
    if (currentTheaterTheme.id === 'cinema-vip') {
      if (isImax) {
        return {
          top: '7.5%',
          left: '6.5%',
          width: '87%',
          height: '59%',
        };
      }
      if (isLarge) {
        return {
          top: '10.5%',
          left: '10.5%',
          width: '79%',
          height: '54%',
        };
      }
      // standard: fits directly onto the theater screen inside the background
      return {
        top: '13.8%',
        left: '14.8%',
        width: '70.4%',
        height: '48.7%',
      };
    }

    // Default for other themes
    if (isImax) {
      return {
        top: '5.8%',
        left: '3.5%',
        width: '93%',
        height: '62%',
      };
    }
    if (isLarge) {
      return {
        top: '6.8%',
        left: '7.5%',
        width: '85%',
        height: '59.5%',
      };
    }
    // standard
    return {
      top: '7.5%',
      left: '13%',
      width: '74%',
      height: '56.5%',
    };
  }, [isImax, isLarge, currentTheaterTheme.id]);

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
      {/* ── 1376x768 (16:9) Pixel-Perfect Theater Canvas ── */}
      <div
        className="relative w-full h-full max-w-[1850px] aspect-[1376/768] flex flex-col justify-between overflow-hidden shadow-2xl transition-all duration-700 ease-out"
        style={{
          backgroundImage: `url('${currentTheaterTheme.bgUrl}')`,
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Optional Front VIP Seats Overlay for custom themes */}
        {currentTheaterTheme.id !== 'cinema-vip' && showFrontSeatsOverlay && (
          <div
            className="absolute inset-0 pointer-events-none z-20 transition-opacity duration-500"
            style={{
              backgroundImage: `url('/theater/front_seats_overlay.png')`,
              backgroundSize: '100% 100%',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
        )}
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

          {/* Right: Clean Leave Button */}
          <div className="flex items-center gap-2">
            {/* Red Leave Room Button */}
            <button
              onClick={onLeaveRoom}
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-[0_0_15px_rgba(225,29,72,0.5)] flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Leave Room Session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          </div>
        </div>

        {/* ══ THE MAIN CINEMA SCREEN (DYNAMIC EXPANSIVE FRAME) ══ */}
        <div
          className="absolute z-20 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.95)] group/screen transition-all duration-300"
          style={{
            top: screenStyle.top,
            left: screenStyle.left,
            width: screenStyle.width,
            height: screenStyle.height,
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

          {/* Bottom Center: Floating Capsule Control Dock & Overlapping Cam Deck */}
          <div className="relative flex flex-col items-center">
            {/* Quick Reactions Bar */}
            {showReactionsBar && (
              <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-2xl bg-[#141722]/90 backdrop-blur-xl border border-white/15 shadow-[0_8px_30px_rgba(0,0,0,0.85)] mb-2 animate-in fade-in slide-in-from-bottom-2">
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

            {/* ══ SEPARATE CAM PREVIEW TILES (ON BOTTOM BAR, CLEAN & INDIVIDUAL) ══ */}
            {showCamPanel && (
              <div className="flex items-center justify-center mb-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
                <div className="flex items-center gap-2 sm:gap-2.5 p-1.5 sm:p-2 bg-[#0d1017]/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
                  {/* Render all occupied participant tiles cleanly separated */}
                  {participants.map((p, idx) => (
                    <div
                      key={p.userId || `seat_${idx}`}
                      className="w-24 sm:w-28 md:w-32 transition-transform duration-200 hover:scale-105"
                    >
                      <TheaterCamTile
                        participant={p}
                        index={idx}
                        onToggleCamera={onToggleCamera}
                        userAvatarUrl={userAvatarUrl}
                      />
                    </div>
                  ))}

                  {/* Show ONE invite slot for next person if room is not full */}
                  {participants.length < MAX_SEATS && (
                    <div
                      className="w-20 sm:w-24 md:w-26 transition-transform duration-200 hover:scale-105"
                    >
                      <TheaterEmptyInviteSlot
                        onCopyInvite={onCopyInvite}
                        copiedInvite={copiedInvite}
                        seatNumber={participants.length + 1}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pill Dock */}
            <div
              className="px-4 py-2 rounded-full flex items-center gap-2 sm:gap-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.85)]"
              style={{
                backgroundColor: 'rgba(18, 20, 26, 0.94)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              {/* Mic Button */}
              <button
                onClick={onToggleMic}
                className={`p-2 rounded-full transition cursor-pointer ${
                  isMicMuted ? 'text-rose-500 bg-red-950/60 ring-1 ring-red-500/40' : 'text-zinc-200 hover:text-white bg-white/5'
                }`}
                title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
              </button>

              {/* Camera Button */}
              <button
                onClick={onToggleCamera}
                className={`p-2 rounded-full transition cursor-pointer ${
                  !isCameraOn ? 'text-rose-500 bg-red-950/60 ring-1 ring-red-500/40' : 'text-zinc-200 hover:text-white bg-white/5'
                }`}
                title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
              >
                {!isCameraOn ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4 text-emerald-400" />}
              </button>

              {/* Cam Preview Deck Toggle (Overlapping bottom deck) */}
              <button
                onClick={() => setShowCamPanel(p => !p)}
                className={`px-2.5 py-1.5 rounded-full transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
                  showCamPanel
                    ? 'text-indigo-300 bg-indigo-950/70 border border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.25)]'
                    : 'text-zinc-400 hover:text-white bg-white/5 border border-white/10'
                }`}
                title={showCamPanel ? 'Hide Camera Previews' : 'Show Camera Previews'}
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[10.5px]">Cam ({participants.length})</span>
                {showCamPanel ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </button>

              {/* Reaction Trigger Button */}
              <button
                onClick={() => setShowReactionsBar(b => !b)}
                className={`p-2 rounded-full transition cursor-pointer ${
                  showReactionsBar ? 'text-amber-400 bg-amber-950/60 ring-1 ring-amber-500/40' : 'text-zinc-200 hover:text-white bg-white/5'
                }`}
                title="Live Reactions"
              >
                <Smile className="w-4 h-4" />
              </button>

              {/* Chat Toggle Button */}
              {onToggleChat && (
                <button
                  onClick={onToggleChat}
                  className={`p-2 rounded-full transition relative cursor-pointer ${
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
                className={`p-2 rounded-full transition cursor-pointer ${
                  isScreenSharing ? 'text-emerald-400 bg-emerald-950/50' : 'text-zinc-200 hover:text-white bg-white/5'
                }`}
                title={isScreenSharing ? 'Stop Screen Share' : 'Start Screen Share'}
              >
                <ScreenShare className="w-4 h-4" />
              </button>

              {/* Theater Background Theme Switcher */}
              <button
                onClick={() => setShowThemeModal(true)}
                className={`px-2.5 py-1.5 rounded-full transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
                  showThemeModal ? 'text-pink-300 bg-pink-950/70 border border-pink-500/50' : 'text-zinc-300 hover:text-pink-300 bg-white/5 border border-white/10'
                }`}
                title="Change Theater Background Theme"
              >
                <Palette className="w-3.5 h-3.5 text-pink-400" />
                <span className="hidden sm:inline text-[10.5px]">Theme</span>
              </button>

              {/* Theater Screen Size Toggle (Standard -> Large -> IMAX) */}
              <button
                onClick={() => {
                  setScreenSize(current => {
                    if (current === 'large') return 'imax';
                    if (current === 'imax') return 'standard';
                    return 'large';
                  });
                }}
                className={`px-2.5 py-1.5 rounded-full transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
                  screenSize === 'imax'
                    ? 'text-amber-300 bg-amber-950/60 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                    : screenSize === 'large'
                    ? 'text-yellow-300 bg-yellow-950/40 border border-yellow-500/30'
                    : 'text-zinc-300 hover:text-white bg-white/5 border border-white/10'
                }`}
                title="Switch Screen Size: Large (85%) • IMAX (93%) • Standard (74%)"
              >
                <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold text-[11px]">{screenSize.toUpperCase()}</span>
              </button>

              {/* Exit 3D Theater button -> Normal Mode */}
              <button
                onClick={onExitTheater}
                className="px-2.5 py-1.5 rounded-full text-zinc-300 hover:text-amber-300 bg-white/10 hover:bg-white/20 border border-white/10 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
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

        {/* ══ THEATER BACKGROUND THEMES MODAL ══ */}
        {showThemeModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 pointer-events-auto">
            <div className="bg-[#10131d]/95 max-w-2xl w-full rounded-3xl border border-white/15 p-5 sm:p-6 space-y-4 shadow-[0_20px_60px_rgba(0,0,0,0.95)] flex flex-col max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between text-white border-b border-white/10 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/30">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <span>Theater Background Themes</span>
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    </h3>
                    <p className="text-[11px] text-zinc-400">Choose your virtual cinema ambiance or romantic setting</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowThemeModal(false)}
                  className="p-1.5 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Theme Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 overflow-y-auto pr-1 py-1 max-h-[50vh] scrollbar-thin scrollbar-thumb-white/20">
                {THEATER_THEMES.map((theme) => {
                  const isSelected = theaterThemeId === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => handleSelectTheme(theme.id)}
                      className={`group relative flex flex-col rounded-2xl p-2 text-left transition-all duration-200 border cursor-pointer ${
                        isSelected
                          ? 'bg-white/10 border-pink-500 ring-2 ring-pink-500/40 shadow-lg shadow-pink-500/20 scale-[1.02]'
                          : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.07] hover:border-white/20'
                      }`}
                    >
                      {/* Image Thumbnail */}
                      <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden mb-2 bg-black">
                        <img
                          src={theme.previewUrl}
                          alt={theme.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-pink-500 text-white flex items-center justify-center shadow">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-bold text-white uppercase tracking-wider">
                          {theme.category}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex flex-col">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-pink-300' : 'text-white'}`}>
                          {theme.name}
                        </span>
                        <span className="text-[10px] text-zinc-400 line-clamp-2 leading-tight mt-0.5">
                          {theme.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Front VIP Seats Overlay Toggle for Custom Themes */}
              {currentTheaterTheme.id !== 'cinema-vip' && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 text-xs">
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">Front VIP Red Velvet Seats Overlay</span>
                    <span className="text-[10.5px] text-zinc-400">Show the front VIP sofa & illuminated armrests at the bottom</span>
                  </div>
                  <button
                    onClick={handleToggleFrontSeats}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      showFrontSeatsOverlay ? 'bg-pink-600' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        showFrontSeatsOverlay ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-zinc-400">
                <span className="text-[11px]">
                  Active: <strong className="text-white">{currentTheaterTheme.name}</strong>
                </span>
                <button
                  onClick={() => setShowThemeModal(false)}
                  className="px-5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-pink-600/30 transition active:scale-95 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
