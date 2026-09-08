'use client';

import { RoomMember } from '@synccinema/common';
import { UserPlus, Crown, Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface ParticipantsCardProps {
  members: RoomMember[];
  myUserId: string;
  isHost: boolean;
  isCameraOn: boolean;
  isMuted: boolean;
  onCopyInvite: () => void;
  copiedInvite?: boolean;
}

export function ParticipantsCard({
  members,
  myUserId,
  isHost,
  isCameraOn,
  isMuted,
  onCopyInvite,
  copiedInvite
}: ParticipantsCardProps) {
  const avatarColors = [
    'from-purple-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-blue-500 to-cyan-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600'
  ];

  return (
    <div className="flex flex-col bg-[#121622] rounded-2xl border border-[#1e2538] overflow-hidden shadow-lg h-72">
      {/* Header */}
      <div className="p-3 px-4 border-b border-[#1e2538] flex items-center justify-between">
        <span className="text-xs font-bold text-white tracking-wide">
          Participants ({members.length})
        </span>

        <button
          onClick={onCopyInvite}
          className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-zinc-200 hover:text-white rounded-full border border-white/10 text-[11px] font-medium transition flex items-center space-x-1"
        >
          <UserPlus className="w-3 h-3 text-indigo-400" />
          <span>{copiedInvite ? 'Copied!' : 'Invite'}</span>
        </button>
      </div>

      {/* Participant List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {members.map((member, idx) => {
          const isMe = member.userId === myUserId;
          const memberIsHost = member.role === 'HOST' || (isMe && isHost);
          const memberMuted = isMe ? isMuted : (member.isMuted ?? false);
          const memberVideoOn = isMe ? isCameraOn : (member.isCameraOn ?? false);
          const colorClass = avatarColors[idx % avatarColors.length];

          return (
            <div
              key={member.userId || idx}
              className="flex items-center justify-between py-1 px-1.5 rounded-xl hover:bg-white/[0.02] transition"
            >
              {/* Left: Avatar + Name + Subtitle */}
              <div className="flex items-center space-x-2.5 truncate">
                <div className="relative flex-shrink-0">
                  <div
                    className={`w-8 h-8 rounded-full bg-gradient-to-tr ${colorClass} flex items-center justify-center text-white text-xs font-bold shadow-sm`}
                  >
                    {member.displayName ? member.displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  {/* Status dot */}
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[#121622] ${
                      member.isConnected ? 'bg-emerald-500' : 'bg-zinc-500'
                    }`}
                  />
                </div>

                <div className="flex flex-col truncate">
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className="text-xs font-semibold text-zinc-100 truncate">
                      {isMe ? `${member.displayName} (You)` : member.displayName}
                    </span>
                    {memberIsHost && (
                      <Crown className="w-3 h-3 text-amber-400 fill-amber-400/30 flex-shrink-0" />
                    )}
                  </div>
                  {memberIsHost && (
                    <span className="text-[10px] text-zinc-500 font-medium leading-none mt-0.5">
                      Host
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Mic & Camera Status Icons */}
              <div className="flex items-center space-x-2.5 flex-shrink-0 text-zinc-400">
                {memberMuted ? (
                  <MicOff className="w-4 h-4 text-red-400" />
                ) : (
                  <Mic className="w-4 h-4 text-emerald-400" />
                )}

                {memberVideoOn ? (
                  <Video className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VideoOff className="w-4 h-4 text-zinc-500" />
                )}
              </div>
            </div>
          );
        })}

        {members.length === 1 && (
          <div className="pt-4 text-center space-y-1">
            <p className="text-[11px] text-zinc-500">You are the only one in the room right now.</p>
            <button
              onClick={onCopyInvite}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline"
            >
              {copiedInvite ? 'Invite link copied!' : 'Invite friends to join'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
