'use client';

import { useState, useRef, useEffect } from 'react';
import {
  MediaItem,
  RoomPlaybackState,
  formatSecondsToTimestamp
} from '@synccinema/common';
import { YouTubeEmbed } from './YouTubeEmbed';
import { DirectHTML5Player } from './DirectHTML5Player';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  PictureInPicture2,
  Settings,
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  X,
  Radio
} from 'lucide-react';

function playCountdownTone(freq: number, duration = 0.2) {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

interface CinemaPlayerProps {
  media: MediaItem | null;
  playbackState: RoomPlaybackState;
  isHost: boolean;
  rttMs: number;
  clockOffsetMs: number;
  getAuthoritativePosition: () => number;
  onHostCommand: (action: 'PLAY' | 'PAUSE' | 'SEEK', position: number) => void;
  screenStream?: MediaStream | null;
  isScreenSharing?: boolean;
  screenPresenter?: { userId: string; displayName: string } | null;
  onStartScreenShare?: () => void;
  onStopScreenShare?: () => void;
  // Embedded Call Controls
  isMicMuted?: boolean;
  isCameraOn?: boolean;
  onToggleMic?: () => void;
  onToggleCamera?: () => void;
  onLeaveRoom?: () => void;
  roomTitle?: string;
  onNavigateUrl?: (url: string) => void;
  countdownActive?: boolean;
  onCountdownFinished?: () => void;
  onStartParty?: () => void;
}

export function CinemaPlayer({
  media,
  playbackState,
  isHost,
  getAuthoritativePosition,
  onHostCommand,
  screenStream,
  isScreenSharing,
  screenPresenter,
  onStartScreenShare,
  onStopScreenShare,
  isMicMuted = false,
  isCameraOn = false,
  onToggleMic,
  onToggleCamera,
  onLeaveRoom,
  roomTitle,
  onNavigateUrl,
  countdownActive = false,
  onCountdownFinished,
  onStartParty
}: CinemaPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const mainVideoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(playbackState.state === 'PLAYING');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(media?.durationSeconds || 0);
  const [isAudioBlocked, setIsAudioBlocked] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [newMediaUrl, setNewMediaUrl] = useState<string>('');
  const [countdownStep, setCountdownStep] = useState<number | 'START' | null>(null);

  // Synchronized 3-2-1 Countdown Timer & Sounds
  useEffect(() => {
    if (!countdownActive) {
      setCountdownStep(null);
      return;
    }

    setCountdownStep(3);
    playCountdownTone(440);

    const step2 = setTimeout(() => {
      setCountdownStep(2);
      playCountdownTone(554);
    }, 1000);

    const step1 = setTimeout(() => {
      setCountdownStep(1);
      playCountdownTone(659);
    }, 2000);

    const stepStart = setTimeout(() => {
      setCountdownStep('START');
      playCountdownTone(880, 0.4);
    }, 3000);

    const stepEnd = setTimeout(() => {
      setCountdownStep(null);
      if (onCountdownFinished) onCountdownFinished();
    }, 3800);

    return () => {
      clearTimeout(step2);
      clearTimeout(step1);
      clearTimeout(stepStart);
      clearTimeout(stepEnd);
    };
  }, [countdownActive, onCountdownFinished]);

  const hasRealCustomVideo = Boolean(
    media?.sourceUrl &&
    !media.sourceUrl.includes('TearsOfSteel') &&
    !media.sourceUrl.includes('dQw4w9WgXcQ') &&
    (media.provider as string) !== 'screen'
  );
  const activeVideoUrl = hasRealCustomVideo ? media!.sourceUrl : '';

  // Playback state synchronization from server
  useEffect(() => {
    const isPlaybackPlaying = playbackState.state === 'PLAYING';
    setIsPlaying(isPlaybackPlaying);
    if (mainVideoRef.current) {
      if (isPlaybackPlaying) {
        mainVideoRef.current.play().catch(() => {});
      } else {
        mainVideoRef.current.pause();
      }
    }
  }, [playbackState.state, playbackState.version]);

  // Position drift synchronization for participants
  useEffect(() => {
    if (!mainVideoRef.current || isHost) return;
    const authPos = getAuthoritativePosition();
    if (Math.abs(mainVideoRef.current.currentTime - authPos) > 1.5) {
      mainVideoRef.current.currentTime = authPos;
    }
  }, [getAuthoritativePosition, isHost]);

  // Handle Screen Stream attachment
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
      screenVideoRef.current.muted = Boolean(isScreenSharing);
      screenVideoRef.current
        .play()
        .then(() => {
          setIsAudioBlocked(false);
        })
        .catch((err) => {
          console.warn('Autoplay prevented on screen stream:', err);
          if (!isScreenSharing) {
            setIsAudioBlocked(true);
          }
        });
    }
  }, [screenStream, isScreenSharing]);

  // Periodic position update for scrub bar
  useEffect(() => {
    const interval = setInterval(() => {
      const authPos = mainVideoRef.current ? mainVideoRef.current.currentTime : getAuthoritativePosition();
      setCurrentTime(authPos);
    }, 500);

    return () => clearInterval(interval);
  }, [getAuthoritativePosition]);

  const handleTogglePlay = () => {
    const nextState = isPlaying ? 'PAUSE' : 'PLAY';
    const authPos = mainVideoRef.current ? mainVideoRef.current.currentTime : getAuthoritativePosition();
    setIsPlaying(!isPlaying);
    if (mainVideoRef.current) {
      if (nextState === 'PLAY') {
        mainVideoRef.current.play().catch(() => {});
      } else {
        mainVideoRef.current.pause();
      }
    }
    if (isHost) {
      onHostCommand(nextState, authPos);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isHost || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetPos = pct * duration;
    setCurrentTime(targetPos);
    if (mainVideoRef.current) {
      mainVideoRef.current.currentTime = targetPos;
    }
    onHostCommand('SEEK', targetPos);
  };

  const handleSkip10 = (deltaSeconds: number) => {
    if (!isHost) return;
    const nextTime = Math.max(0, Math.min(duration || 7200, currentTime + deltaSeconds));
    setCurrentTime(nextTime);
    if (mainVideoRef.current) {
      mainVideoRef.current.currentTime = nextTime;
    }
    onHostCommand('SEEK', nextTime);
  };

  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (mainVideoRef.current) {
      mainVideoRef.current.muted = newMuted;
    }
    if (screenVideoRef.current && !isScreenSharing) {
      screenVideoRef.current.muted = newMuted;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (mainVideoRef.current) {
      mainVideoRef.current.volume = val;
      mainVideoRef.current.muted = val === 0;
    }
    if (screenVideoRef.current && !isScreenSharing) {
      screenVideoRef.current.volume = val;
      screenVideoRef.current.muted = val === 0;
    }
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const handleTogglePiP = async () => {
    const target = screenVideoRef.current || mainVideoRef.current;
    if (!target) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await target.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP failed:', err);
    }
  };

  const handleEnableAudio = () => {
    if (screenVideoRef.current) {
      screenVideoRef.current.muted = false;
      screenVideoRef.current.play().then(() => {
        setIsAudioBlocked(false);
      });
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remainingTimeStr =
    duration > 0
      ? `-${formatSecondsToTimestamp(Math.max(0, duration - currentTime))}`
      : '-1:40:35';

  const movieTitle = media?.title || roomTitle || 'Watch Party';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-0 bg-black rounded-xl overflow-hidden shadow-2xl group select-none flex flex-col justify-between"
    >
      {/* 1. Video Canvas / Media Stage (100% Real Video & Screen Stream) */}
      <div className="relative w-full flex-1 min-h-0 bg-black overflow-hidden flex items-center justify-center">
        {/* Subtle Brand Watermark */}
        <div className="absolute top-3.5 right-4 pointer-events-none select-none z-20 flex flex-col items-end opacity-35 hover:opacity-70 transition-opacity">
          <span className="text-[11px] font-black tracking-tighter text-[#E50914] leading-none">watch.</span>
          <span className="text-[7px] font-semibold tracking-widest text-white/70 uppercase mt-0.5">stitchbyte watchparty</span>
        </div>

        {screenStream ? (
          /* Live Screen Sharing Viewport */
          <div className="relative w-full h-full bg-black flex items-center justify-center">
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              controls={false}
              muted={Boolean(isScreenSharing)}
              className="w-full h-full object-contain"
            />

            <div className="absolute top-3 left-3 bg-emerald-600/90 text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center space-x-1.5 shadow-lg pointer-events-none z-20">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>
                LIVE SCREEN:{' '}
                {isScreenSharing
                  ? 'You (Broadcasting Screen & Audio)'
                  : screenPresenter?.displayName || 'Host'}
              </span>
            </div>

            {isAudioBlocked && !isScreenSharing && (
              <button
                onClick={handleEnableAudio}
                className="absolute top-3 right-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg flex items-center space-x-1.5 transition z-30 animate-bounce"
              >
                <Volume2 className="w-4 h-4" />
                <span>Click to Unmute Audio</span>
              </button>
            )}
          </div>
        ) : media?.provider === 'youtube' && media?.providerMediaId ? (
          /* Synced YouTube Player */
          <div className="relative w-full h-full bg-black">
            <YouTubeEmbed
              videoId={media.providerMediaId}
              playbackState={playbackState}
              isHost={isHost}
              getAuthoritativePosition={getAuthoritativePosition}
              onHostCommand={onHostCommand}
            />
          </div>
        ) : activeVideoUrl ? (
          /* Real Playable HTML5 Cinema Video */
          <div className="relative w-full h-full bg-black flex items-center justify-center">
            <video
              ref={mainVideoRef}
              src={activeVideoUrl}
              playsInline
              crossOrigin="anonymous"
              className="w-full h-full object-contain bg-black"
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (d && !isNaN(d)) setDuration(d);
              }}
              onTimeUpdate={(e) => {
                setCurrentTime(e.currentTarget.currentTime);
              }}
              onEnded={() => {
                setIsPlaying(false);
                if (isHost) onHostCommand('PAUSE', 0);
              }}
            />
          </div>
        ) : null}

        {/* Hero stage when movie is not playing: Share screen to start party */}
        {!screenStream && !isPlaying && countdownStep === null && (
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-black via-black/85 to-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn">
            <div className="max-w-md w-full bg-[#121622]/90 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 flex flex-col items-center">
              {/* Glowing Icon Badge */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#E50914] to-rose-600 flex items-center justify-center shadow-lg shadow-red-600/30 text-white">
                <ScreenShare className="w-7 h-7" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Share Screen to Start Movie Party
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
                  Open Netflix, Prime Video, YouTube or any movie in your browser, then share your screen or tab with everyone.
                </p>
              </div>

              <div className="w-full pt-1">
                {onStartScreenShare && (
                  <button
                    onClick={() => {
                      if (onStartParty) {
                        onStartParty();
                      } else {
                        onStartScreenShare();
                      }
                    }}
                    className="w-full py-3 px-5 bg-[#E50914] hover:bg-red-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/30 transition transform active:scale-95 flex items-center justify-center space-x-2"
                  >
                    <ScreenShare className="w-4 h-4" />
                    <span>Share Screen &amp; Start</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Synchronized 3-2-1 Countdown Overlay */}
        {countdownStep !== null && (
          <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-fadeIn select-none pointer-events-none">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="text-xs sm:text-sm font-bold tracking-[0.3em] uppercase text-rose-500 animate-pulse">
                Movie Party Starting In
              </div>
              <div
                key={String(countdownStep)}
                className="text-7xl sm:text-9xl font-black tracking-tight text-white drop-shadow-[0_0_40px_rgba(229,9,20,0.8)] animate-bounce"
              >
                {countdownStep === 'START' ? (
                  <span className="text-5xl sm:text-7xl bg-gradient-to-r from-red-500 via-rose-400 to-amber-300 bg-clip-text text-transparent">
                    LET&apos;S WATCH!
                  </span>
                ) : (
                  countdownStep
                )}
              </div>
              <div className="text-xs text-zinc-400 font-medium tracking-wide">
                Synchronizing all participants...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Real Watch Party Bottom Controls Bar */}
      <div className="relative w-full px-4 sm:px-6 pb-3 pt-3 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex flex-col space-y-2 z-30">
        {/* Real Scrubber Bar ONLY when a real video file is actually loaded and not live screen */}
        {hasRealCustomVideo && !screenStream && duration > 0 && (
          <div className="space-y-1">
            <div className="text-white text-xs sm:text-sm font-bold tracking-wide drop-shadow-md truncate">
              {movieTitle}
            </div>
            <div
              onClick={handleSeek}
              className={`relative w-full h-1 hover:h-2 ${
                isHost ? 'cursor-pointer' : 'cursor-default'
              } bg-zinc-700/60 rounded-full transition-all group/scrub`}
            >
              <div
                className="absolute left-0 top-0 bottom-0 bg-[#E50914] rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#E50914] rounded-full border-2 border-white shadow-md transition-transform transform -translate-x-1/2 group-hover/scrub:scale-125"
                style={{ left: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
          </div>
        )}

        {/* Real Controls Line: Left (Live / Audio), Center (Call Dock), Right (Screen & Settings) */}
        <div className="flex items-center justify-between text-white text-xs pt-1">
          {/* Left: Live Broadcast Status / Audio Control */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {screenStream ? (
              <div className="flex items-center space-x-2 bg-emerald-950/70 border border-emerald-500/40 px-2.5 py-1 rounded-full text-emerald-400 text-[11px] font-bold shadow-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="tracking-wide uppercase text-[10px]">
                  {isScreenSharing ? 'Broadcasting Screen' : `${screenPresenter?.displayName || 'Host'}'s Screen`}
                </span>
              </div>
            ) : hasRealCustomVideo && duration > 0 ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleTogglePlay}
                  className="p-1.5 hover:text-zinc-300 transition bg-white/10 rounded-full"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-white" />
                  ) : (
                    <Play className="w-4 h-4 fill-white" />
                  )}
                </button>
                <button
                  onClick={() => handleSkip10(-10)}
                  className="p-1 hover:text-zinc-300 transition"
                  title="Rewind 10s"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleSkip10(10)}
                  className="p-1 hover:text-zinc-300 transition"
                  title="Forward 10s"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-zinc-400 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-zinc-600" />
                <span className="hidden sm:inline">Ready to stream movie party</span>
                <span className="sm:hidden">Ready</span>
              </div>
            )}

            {/* Real Stream Audio Volume Slider (adjusts real audio of screen share or video) */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleToggleMute}
                className="p-1 hover:text-zinc-300 transition"
                title={isMuted ? 'Unmute Stream Audio' : 'Mute Stream Audio'}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 sm:w-16 h-1 accent-[#E50914] cursor-pointer hidden md:inline-block"
                title="Stream Audio Volume"
              />
            </div>
          </div>

          {/* Center: Integrated Call Controls Dock (Mic, Camera, Screen Share) */}
          <div className="flex items-center space-x-2 sm:space-x-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 shadow-lg">
            {/* Mic Toggle Button */}
            {onToggleMic && (
              <button
                onClick={onToggleMic}
                className={`p-2 rounded-full transition ${
                  isMicMuted
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMicMuted ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
            )}

            {/* Camera Toggle Button */}
            {onToggleCamera && (
              <button
                onClick={onToggleCamera}
                className={`p-2 rounded-full transition ${
                  !isCameraOn
                    ? 'bg-white/5 text-zinc-400 hover:bg-white/15'
                    : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                }`}
                title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                {isCameraOn ? (
                  <Video className="w-4 h-4" />
                ) : (
                  <VideoOff className="w-4 h-4" />
                )}
              </button>
            )}

            {/* Screen Share Button */}
            {onStartScreenShare && (
              <button
                onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
                className={`p-2 rounded-full transition ${
                  isScreenSharing
                    ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-400/50'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
              >
                <ScreenShare className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Right: Real Duration (if video), Settings, PiP, Fullscreen */}
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 text-zinc-300">
            {/* Real elapsed / duration only if playing custom video file */}
            {hasRealCustomVideo && !screenStream && duration > 0 && (
              <span className="text-[11px] sm:text-xs font-mono font-medium text-white tracking-tight">
                {formatSecondsToTimestamp(currentTime)} / {formatSecondsToTimestamp(duration)}
              </span>
            )}

            {/* Settings Gear */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-1 hover:text-white transition"
              title="Stream & Video Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Picture in Picture */}
            <button
              onClick={handleTogglePiP}
              className="p-1 hover:text-white transition hidden sm:inline-flex"
              title="Picture in Picture"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={handleToggleFullscreen}
              className="p-1 hover:text-white transition"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Settings / Stream Change Modal */}
      {showSettingsModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
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
  );
}

