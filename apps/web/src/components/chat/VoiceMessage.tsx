'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { ChatVoicePayload } from '@/types/chat';

interface VoiceMessageProps {
  voice: ChatVoicePayload;
  isSender: boolean;
}

export const VoiceMessage: React.FC<VoiceMessageProps> = ({ voice, isSender }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const waveformBars = voice.waveform && voice.waveform.length > 0
    ? voice.waveform
    : [30, 45, 75, 90, 60, 40, 80, 100, 70, 50, 65, 85, 45, 95, 60, 40, 70, 85, 60, 35, 50, 40];

  const totalDuration = voice.duration || 12;

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const togglePlay = () => {
    if (voice.audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        const audio = audioRef.current;
        if (audio.ended || audio.currentTime >= (audio.duration || totalDuration) - 0.2) {
          audio.currentTime = 0;
          setCurrentTime(0);
        }
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn('Audio play error, falling back to simulated playback:', err);
            startSyntheticPlayback();
          });
      }
    } else {
      if (isPlaying) {
        setIsPlaying(false);
      } else {
        startSyntheticPlayback();
      }
    }
  };

  const handleSeek = (index: number) => {
    const ratio = (index + 1) / waveformBars.length;
    const target = ratio * totalDuration;
    setCurrentTime(target);
    if (audioRef.current && voice.audioUrl) {
      audioRef.current.currentTime = target;
    }
  };

  const syntheticTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startSyntheticPlayback = () => {
    setIsPlaying(true);
    if (currentTime >= totalDuration) {
      setCurrentTime(0);
    }
  };

  useEffect(() => {
    if (isPlaying && (!voice.audioUrl || !audioRef.current)) {
      const interval = 100 / playbackSpeed;
      syntheticTimerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, interval);
    } else {
      if (syntheticTimerRef.current) {
        clearInterval(syntheticTimerRef.current);
      }
    }
    return () => {
      if (syntheticTimerRef.current) clearInterval(syntheticTimerRef.current);
    };
  }, [isPlaying, playbackSpeed, totalDuration, voice.audioUrl]);

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playbackSpeed === 1) setPlaybackSpeed(1.5);
    else if (playbackSpeed === 1.5) setPlaybackSpeed(2);
    else setPlaybackSpeed(1);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressRatio = Math.min(currentTime / totalDuration, 1);

  return (
    <div className="flex items-center gap-3 py-1 px-1 min-w-[220px] sm:min-w-[260px] max-w-[320px]">
      {voice.audioUrl && (
        <audio
          ref={audioRef}
          src={voice.audioUrl}
          onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
          className="hidden"
        />
      )}

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-xs cursor-pointer ${
          isSender
            ? 'bg-white text-[#ee1d49] hover:bg-slate-50'
            : 'bg-[#ee1d49] text-white hover:bg-[#d61840]'
        }`}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform & Timeline */}
      <div className="flex-1 flex flex-col gap-1.5 justify-center">
        <div className="flex items-center gap-0.5 h-7 cursor-pointer">
          {waveformBars.map((height, i) => {
            const barRatio = (i + 1) / waveformBars.length;
            const isFilled = barRatio <= progressRatio;
            return (
              <div
                key={i}
                onClick={() => handleSeek(i)}
                className={`flex-1 rounded-full transition-all duration-100 hover:opacity-80 active:scale-110 ${
                  isSender
                    ? isFilled
                      ? 'bg-white'
                      : 'bg-white/40'
                    : isFilled
                    ? 'bg-[#ee1d49]'
                    : 'bg-slate-300 dark:bg-zinc-600'
                }`}
                style={{
                  height: `${Math.max(15, (height / 100) * 26)}px`,
                }}
                title={`Seek to ${formatTime(((i + 1) / waveformBars.length) * totalDuration)}`}
              />
            );
          })}
        </div>

        {/* Duration & Speed */}
        <div className="flex items-center justify-between text-[11px] font-medium leading-none">
          <span className={isSender ? 'text-white/80' : 'text-slate-500 dark:text-zinc-400'}>
            {isPlaying ? formatTime(currentTime) : formatTime(totalDuration)}
          </span>

          <button
            type="button"
            onClick={cycleSpeed}
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase transition cursor-pointer ${
              isSender
                ? 'bg-white/20 hover:bg-white/30 text-white'
                : 'bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200'
            }`}
          >
            {playbackSpeed}x
          </button>
        </div>
      </div>
    </div>
  );
};
