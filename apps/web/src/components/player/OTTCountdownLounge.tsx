'use client';

import { useState, useEffect } from 'react';
import { RoomPlaybackState, formatSecondsToTimestamp } from '@synccinema/common';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Film,
  Tv,
  ShieldCheck,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';

interface OTTCountdownLoungeProps {
  playbackState: RoomPlaybackState;
  isHost: boolean;
  provider: string;
  sourceUrl: string;
  getAuthoritativePosition: () => number;
  onHostCommand: (action: 'PLAY' | 'PAUSE' | 'SEEK', position: number) => void;
}

export function OTTCountdownLounge({
  playbackState,
  isHost,
  provider,
  sourceUrl,
  getAuthoritativePosition,
  onHostCommand
}: OTTCountdownLoungeProps) {
  const [currentDisplayPos, setCurrentDisplayPos] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isPopoutActive, setIsPopoutActive] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDisplayPos(getAuthoritativePosition());
    }, 200);
    return () => clearInterval(interval);
  }, [getAuthoritativePosition]);

  const triggerCountdown = (targetAction: 'PLAY' | 'PAUSE') => {
    let count = 3;
    setCountdown(count);
    const timer = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(timer);
        setCountdown(null);
        onHostCommand(targetAction, currentDisplayPos);
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  const openPopoutHUD = () => {
    if (typeof window === 'undefined') return;
    const width = 420;
    const height = 650;
    const left = window.screen.width - width - 40;
    const top = 60;
    window.open(
      window.location.href,
      'SyncCinemaFloatingHUD',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
    );
    setIsPopoutActive(true);
  };

  return (
    <div className="relative w-full aspect-video bg-gradient-to-br from-cinema-card via-[#0F141F] to-cinema-darkest rounded-xl overflow-hidden shadow-2xl border border-cinema-border p-6 sm:p-8 flex flex-col justify-between">
      {/* Top Banner */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-cinema-accent/20 rounded-xl text-cinema-accent border border-cinema-accent/30 shadow-lg shadow-cinema-accent/10">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cinema-accent bg-cinema-accent/10 px-2 py-0.5 rounded border border-cinema-accent/20">
                In-App Social Cinema
              </span>
              <span className="text-[11px] text-cinema-muted font-medium">
                Netflix Synchronized Session
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white capitalize mt-0.5">
              Watching together on {provider === 'ott_fallback' ? 'Netflix' : provider.replace('_', ' ')}
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={openPopoutHUD}
            className="px-3 py-1.5 bg-cinema-card hover:bg-cinema-border text-xs font-semibold text-slate-200 rounded-lg border border-cinema-border transition flex items-center space-x-1.5"
            title="Pop out floating social HUD to overlay on Netflix"
          >
            <Layers className="w-3.5 h-3.5 text-cinema-accent" />
            <span className="hidden sm:inline">Floating Pop-out</span>
          </button>

          <div className="flex items-center space-x-1.5 text-xs text-cinema-muted bg-cinema-base px-3 py-1.5 rounded-lg border border-cinema-border">
            <ShieldCheck className="w-4 h-4 text-cinema-emerald" />
            <span className="hidden md:inline">100% Legal DRM-Safe Sync</span>
          </div>
        </div>
      </div>

      {/* Center Display: Live Synced Movie Scrubber Ticker */}
      <div className="text-center py-4 sm:py-6">
        {countdown !== null ? (
          <div className="animate-bounce">
            <div className="text-7xl sm:text-8xl font-black text-cinema-gold drop-shadow-[0_0_30px_rgba(245,158,11,0.7)]">
              {countdown}
            </div>
            <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-white mt-2">
              PRESS {playbackState.state === 'PLAYING' ? 'PAUSE' : 'PLAY'} ON NETFLIX WHEN COUNTDOWN HITS ZERO!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cinema-base/80 border border-cinema-border text-[11px] text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-cinema-accent" />
              <span>Room Synchronized Timestamp</span>
            </div>

            <div className="text-5xl sm:text-7xl font-mono font-black text-white tracking-widest drop-shadow-md">
              {formatSecondsToTimestamp(currentDisplayPos)}
            </div>

            <div className="flex items-center justify-center space-x-3 pt-1">
              <div className="flex items-center space-x-2 bg-cinema-base/90 px-3 py-1 rounded-full border border-cinema-border">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    playbackState.state === 'PLAYING'
                      ? 'bg-cinema-emerald animate-pulse'
                      : 'bg-cinema-gold'
                  }`}
                />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  {playbackState.state}
                </span>
              </div>

              <span className="text-xs text-cinema-muted font-mono">
                Speed: {playbackState.playbackRate.toFixed(2)}x
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Host / Participant Synchronization Bar */}
      <div className="bg-cinema-base/90 backdrop-blur rounded-xl p-3 sm:p-4 border border-cinema-border flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-2">
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-cinema-card hover:bg-cinema-border text-xs font-bold text-slate-200 rounded-lg transition border border-cinema-border flex items-center space-x-1.5"
            >
              <Film className="w-4 h-4 text-red-500" />
              <span>Open Netflix Movie</span>
              <ExternalLink className="w-3 h-3 text-cinema-muted" />
            </a>
          )}
        </div>

        {isHost ? (
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => onHostCommand('SEEK', Math.max(0, currentDisplayPos - 10))}
              className="p-2.5 bg-cinema-card hover:bg-cinema-border rounded-lg text-slate-300 transition text-xs flex items-center space-x-1"
              title="Seek Back 10s"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">-10s</span>
            </button>

            <button
              onClick={() => triggerCountdown(playbackState.state === 'PLAYING' ? 'PAUSE' : 'PLAY')}
              className="px-5 py-2.5 bg-gradient-to-r from-cinema-accent to-indigo-600 hover:from-indigo-500 hover:to-indigo-700 font-bold text-white text-xs sm:text-sm rounded-lg shadow-lg flex items-center space-x-2 transition"
            >
              {playbackState.state === 'PLAYING' ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Countdown Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Countdown Play</span>
                </>
              )}
            </button>

            <button
              onClick={() => onHostCommand('SEEK', currentDisplayPos + 10)}
              className="p-2.5 bg-cinema-card hover:bg-cinema-border rounded-lg text-slate-300 transition text-xs flex items-center space-x-1"
              title="Seek Ahead 10s"
            >
              <FastForward className="w-4 h-4" />
              <span className="hidden sm:inline">+10s</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentDisplayPos(getAuthoritativePosition())}
              className="px-3 py-1.5 bg-cinema-card hover:bg-cinema-border text-xs font-semibold text-slate-300 rounded-lg border border-cinema-border transition flex items-center space-x-1"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cinema-accent" />
              <span>Resync to Host Time</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
