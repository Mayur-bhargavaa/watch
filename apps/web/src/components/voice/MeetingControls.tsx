'use client';

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  StopCircle,
  PhoneOff,
  Smile
} from 'lucide-react';

interface MeetingControlsProps {
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onReact: (code: string, emoji: string) => void;
  onLeaveRoom: () => void;
}

const QUICK_REACTIONS = [
  { code: 'heart', emoji: '❤️' },
  { code: 'thumbs_up', emoji: '👍' },
  { code: 'joy', emoji: '😂' },
  { code: 'clap', emoji: '👏' },
  { code: 'party', emoji: '🎉' }
];

export function MeetingControls({
  isMuted,
  isCameraOn,
  isScreenSharing,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onReact,
  onLeaveRoom
}: MeetingControlsProps) {
  return (
    <div className="w-full flex items-center justify-between px-6 py-3 bg-[#121622] rounded-2xl border border-[#1e2538] shadow-2xl">
      {/* Left Action Buttons: Mic, Camera, Share Screen, Stop Share */}
      <div className="flex items-center space-x-6">
        {/* Mic */}
        <button
          onClick={onToggleMute}
          className="flex flex-col items-center justify-center group focus:outline-none"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <MicOff className="w-5 h-5 text-red-400 group-hover:scale-110 transition" />
          ) : (
            <Mic className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition" />
          )}
          <span className="text-[10px] text-zinc-400 group-hover:text-zinc-200 mt-1 font-medium">
            Mic
          </span>
        </button>

        {/* Camera */}
        <button
          onClick={onToggleCamera}
          className="flex flex-col items-center justify-center group focus:outline-none"
          title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isCameraOn ? (
            <Video className="w-5 h-5 text-zinc-200 group-hover:scale-110 transition" />
          ) : (
            <VideoOff className="w-5 h-5 text-zinc-400 group-hover:scale-110 transition" />
          )}
          <span className="text-[10px] text-zinc-400 group-hover:text-zinc-200 mt-1 font-medium">
            Camera
          </span>
        </button>

        {/* Share Screen */}
        <button
          onClick={onToggleScreenShare}
          className="flex flex-col items-center justify-center group focus:outline-none"
          title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        >
          <ScreenShare
            className={`w-5 h-5 ${
              isScreenSharing ? 'text-emerald-400' : 'text-zinc-200'
            } group-hover:scale-110 transition`}
          />
          <span className="text-[10px] text-zinc-400 group-hover:text-zinc-200 mt-1 font-medium">
            Share Screen
          </span>
        </button>

        {/* Stop Share */}
        <button
          onClick={onToggleScreenShare}
          disabled={!isScreenSharing}
          className="flex flex-col items-center justify-center group focus:outline-none disabled:opacity-40"
          title="Stop Screen Share"
        >
          <StopCircle className="w-5 h-5 text-red-400 group-hover:scale-110 transition" />
          <span className="text-[10px] text-zinc-400 group-hover:text-zinc-200 mt-1 font-medium">
            Stop Share
          </span>
        </button>
      </div>

      {/* Center Action: Red Pill Leave Room Button */}
      <div className="flex items-center justify-center">
        <button
          onClick={onLeaveRoom}
          className="flex items-center space-x-2 px-6 py-2.5 bg-[#e52d3d] hover:bg-[#d02534] text-white rounded-full font-semibold text-xs transition-all duration-200 shadow-md shadow-red-600/30 active:scale-95"
        >
          <PhoneOff className="w-4 h-4 fill-white" />
          <span>Leave Room</span>
        </button>
      </div>

      {/* Right Action: Reactions Label + Quick Emoji Row */}
      <div className="flex items-center space-x-3">
        <div className="flex flex-col items-center justify-center text-zinc-400 select-none">
          <Smile className="w-5 h-5 text-zinc-300" />
          <span className="text-[10px] mt-1 font-medium">Reactions</span>
        </div>

        <div className="flex items-center space-x-1.5 bg-black/30 px-2.5 py-1.5 rounded-full border border-white/5">
          {QUICK_REACTIONS.map((r) => (
            <button
              key={r.code}
              onClick={() => onReact(r.code, r.emoji)}
              className="p-1 hover:bg-white/10 rounded-full transition transform active:scale-90 hover:scale-125 text-lg select-none"
              title={`React with ${r.emoji}`}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
