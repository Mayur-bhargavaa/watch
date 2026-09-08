'use client';

import { useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Radio } from 'lucide-react';

interface VoiceToolbarProps {
  onToggleMute?: (isMuted: boolean) => void;
  onToggleDeafen?: (isDeafened: boolean) => void;
  activeSpeakerCount?: number;
}

export function VoiceToolbar({
  onToggleMute,
  onToggleDeafen,
  activeSpeakerCount = 0
}: VoiceToolbarProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [volume, setVolume] = useState(80);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    onToggleMute?.(next);
  };

  const toggleDeafen = () => {
    const next = !isDeafened;
    setIsDeafened(next);
    onToggleDeafen?.(next);
  };

  return (
    <div className="flex items-center justify-between bg-cinema-card/90 backdrop-blur px-4 py-2 rounded-xl border border-cinema-border text-xs">
      <div className="flex items-center space-x-2">
        <div className="relative">
          <Radio
            className={`w-4 h-4 ${
              activeSpeakerCount > 0 ? 'text-cinema-emerald animate-pulse' : 'text-cinema-muted'
            }`}
          />
        </div>
        <span className="font-semibold text-slate-300">
          Voice Lounge {activeSpeakerCount > 0 ? `(${activeSpeakerCount} speaking)` : '(Connected)'}
        </span>
      </div>

      <div className="flex items-center space-x-3">
        {/* Volume Slider */}
        <div className="hidden sm:flex items-center space-x-1.5 text-cinema-muted">
          <Volume2 className="w-3.5 h-3.5" />
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-16 h-1 bg-cinema-border rounded-lg appearance-none cursor-pointer accent-cinema-accent"
          />
        </div>

        {/* Deafen Toggle */}
        <button
          onClick={toggleDeafen}
          className={`p-1.5 rounded-lg border transition ${
            isDeafened
              ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : 'bg-cinema-base text-slate-300 border-cinema-border hover:bg-cinema-border'
          }`}
          title={isDeafened ? 'Undeafen' : 'Deafen Voice'}
        >
          {isDeafened ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* Mic Mute Toggle */}
        <button
          onClick={toggleMute}
          className={`p-1.5 rounded-lg border transition flex items-center space-x-1 font-semibold ${
            isMuted
              ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : 'bg-cinema-emerald/20 text-cinema-emerald border-cinema-emerald/30'
          }`}
          title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          <span className="text-[10px]">{isMuted ? 'Muted' : 'Live'}</span>
        </button>
      </div>
    </div>
  );
}
