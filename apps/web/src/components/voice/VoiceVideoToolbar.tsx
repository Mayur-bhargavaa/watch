'use client';

import { useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Sparkles } from 'lucide-react';

interface VoiceVideoToolbarProps {
  isMuted?: boolean;
  isCameraOn?: boolean;
  onToggleMute?: () => void;
  onToggleDeafen?: (isDeafened: boolean) => void;
  onToggleCamera?: () => void;
  activeSpeakerCount?: number;
}

export function VoiceVideoToolbar({
  isMuted = true,
  isCameraOn = false,
  onToggleMute,
  onToggleDeafen,
  onToggleCamera,
  activeSpeakerCount = 0
}: VoiceVideoToolbarProps) {
  const [isDeafened, setIsDeafened] = useState(false);
  const [volume, setVolume] = useState(80);

  const toggleDeafen = () => {
    const next = !isDeafened;
    setIsDeafened(next);
    onToggleDeafen?.(next);
  };

  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-cinema-card/70 via-cinema-base/80 to-cinema-card/70 backdrop-blur-2xl px-4 py-2.5 rounded-2xl border border-white/10 text-xs shadow-glass-card">
      <div className="flex items-center space-x-2.5">
        <div className="p-1.5 bg-rose-500/10 rounded-lg border border-rose-500/20 text-rose-400">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-zinc-200 text-xs">
            Live Co-Watch Audio & Cam
          </span>
          <span className="text-[10px] text-zinc-400">
            {activeSpeakerCount > 0 ? `${activeSpeakerCount} speaking now` : 'Crystal-clear low latency'}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Volume Slider */}
        <div className="hidden md:flex items-center space-x-1.5 text-zinc-400">
          <Volume2 className="w-3.5 h-3.5 text-rose-400" />
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-16 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
          />
        </div>

        {/* Deafen Toggle */}
        <button
          onClick={toggleDeafen}
          className={`p-2 rounded-xl border transition duration-200 ${
            isDeafened
              ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-sm'
              : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
          }`}
          title={isDeafened ? 'Undeafen' : 'Deafen Voice'}
        >
          {isDeafened ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={onToggleCamera}
          className={`px-3 py-1.5 rounded-xl border transition-all duration-200 flex items-center space-x-1.5 font-semibold text-xs ${
            isCameraOn
              ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white border-rose-400 shadow-ambient-rose'
              : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10 hover:text-white'
          }`}
          title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isCameraOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
          <span>{isCameraOn ? 'Cam On' : 'Cam Off'}</span>
        </button>

        {/* Mic Mute Toggle */}
        <button
          onClick={onToggleMute}
          className={`px-3 py-1.5 rounded-xl border transition-all duration-200 flex items-center space-x-1.5 font-semibold text-xs ${
            isMuted
              ? 'bg-red-500/20 text-red-400 border-red-500/40'
              : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-400 shadow-md shadow-emerald-500/20'
          }`}
          title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          <span>{isMuted ? 'Muted' : 'Mic Live'}</span>
        </button>
      </div>
    </div>
  );
}
