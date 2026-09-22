'use client';

import React, { useState } from 'react';
import {
  Users,
  Copy,
  Check,
  Play,
  Share2,
  Sparkles,
  ShieldCheck,
  Flame,
  Crown,
  User,
  Heart,
  UserPlus
} from 'lucide-react';
import { BingoDuelConfig } from '@synccinema/common';
import { GameRoom, GameRoomPlayer } from '@synccinema/common';

interface BingoDuelWaitingRoomProps {
  room: GameRoom;
  players: GameRoomPlayer[];
  myUserId: string;
  isHost: boolean;
  config: BingoDuelConfig;
  onUpdateConfig: (partial: Partial<BingoDuelConfig>) => void;
  onStartGame: () => void;
  onSelectPartner?: () => void;
  partner?: {
    id: string;
    displayName: string;
    partnerCode: string;
    online: boolean;
  } | null;
  onPingPartner?: () => void;
  isPingingPartner?: boolean;
  onOpenBoardCustomizer?: () => void;
  isBoardCustomized?: boolean;
}

export const BingoDuelWaitingRoom: React.FC<BingoDuelWaitingRoomProps> = ({
  room,
  players,
  myUserId,
  isHost,
  config,
  onUpdateConfig,
  onStartGame,
  onSelectPartner,
  partner,
  onPingPartner,
  isPingingPartner,
  onOpenBoardCustomizer,
  isBoardCustomized
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/games/bingo?room=${encodeURIComponent(room.roomCode)}`;
    if (navigator.share) {
      navigator
        .share({
          title: 'Join my Bingo Duel on watch.',
          text: `Play Bingo Duel 1–25 with me! Room Code: ${room.roomCode}`,
          url
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const isFull = players.length >= 2;

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Floating Glassmorphic Waiting Card matching Ludo waiting room */}
      <div className="relative z-10 w-full max-w-xl my-auto rounded-[32px] sm:rounded-[36px] p-6 sm:p-8 bg-[#0e0c18]/80 border border-white/20 backdrop-blur-2xl shadow-[0_25px_70px_rgba(0,0,0,0.7),0_0_35px_rgba(255,43,94,0.12)] text-center overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Strict Zero-Bots Matchmaking Pill */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#0d2a20]/90 border border-[#10b981]/50 text-[#34d399] text-[11px] font-semibold tracking-wide mb-4 shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-[#34d399]" />
          <span>Strict Zero-Bots Matchmaking</span>
        </div>

        {/* Waiting for Players Heading */}
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
          Waiting <span className="font-medium text-white/90">for</span> <span className="text-[#ff2b5e]">Players</span>
        </h2>

        {/* Match Subtitle */}
        <p className="text-xs sm:text-[13px] text-zinc-300 font-normal leading-relaxed max-w-sm mx-auto mb-6">
          Match will begin automatically when <span className="text-[#ff2b5e] font-semibold">2 human players</span> join.
          <br />
          No bots will ever be injected.
        </p>

        {/* Room Code Card (Exact Ludo styling) */}
        <div className="w-full bg-[#161220]/90 border border-white/10 rounded-2xl p-4 sm:p-4.5 flex items-center justify-between gap-3 mb-5 shadow-inner">
          <div className="text-left min-w-0">
            <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase block">
              ROOM CODE
            </span>
            <span className="text-2xl sm:text-3xl font-mono font-black text-[#ff2b5e] tracking-wider block mt-0.5 leading-tight">
              {room.roomCode}
            </span>
            <span className="text-[11px] text-zinc-400 block mt-0.5 truncate">
              Share this code with your friend
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 hover:text-white transition cursor-pointer active:scale-95"
              title="Copy Code"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="py-2.5 px-4 sm:px-5 bg-gradient-to-r from-[#ff2b5e] to-[#f43f5e] hover:from-[#e11d48] hover:to-[#be123c] text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(255,43,94,0.4)] transition active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>{copiedLink ? 'Link Copied!' : 'Share Link'}</span>
            </button>
          </div>
        </div>

        {/* Joined Seats Section (2 Players for Bingo Duel) */}
        <div className="w-full mb-5">
          <div className="flex items-center justify-between text-xs font-semibold text-white/90 mb-3 px-0.5">
            <span>Joined Seats ({players.length}/2)</span>
            <span className="text-[11px] text-zinc-300 flex items-center gap-1.5 font-normal">
              <span className="w-2.5 h-2.5 rounded-full border border-rose-400/80 inline-block shrink-0" />
              <span>{2 - players.length} seat remaining</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {Array.from({ length: 2 }).map((_, seatIdx) => {
              const player = players[seatIdx];
              if (player) {
                const isPlayerHost = player.userId === room.hostUserId || seatIdx === 0;
                return (
                  <div
                    key={player.userId || seatIdx}
                    className="bg-[#181322]/90 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-md min-h-[120px]"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff2b5e] to-[#d6143c] text-white font-black text-lg flex items-center justify-center mb-2 shadow-sm">
                      {(player.displayName?.[0] || 'P').toUpperCase()}
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white truncate max-w-full">
                      {player.displayName}
                    </span>
                    <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                      {isPlayerHost ? (
                        <>
                          <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Host
                        </>
                      ) : (
                        <>
                          <User className="w-3.5 h-3.5 text-zinc-400" /> Player
                        </>
                      )}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={seatIdx}
                  className="bg-[#14111d]/60 border border-dashed border-white/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-inner min-h-[120px]"
                >
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-zinc-400 flex items-center justify-center mb-2">
                    <User className="w-5 h-5 text-zinc-400" />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-zinc-300">Waiting...</span>
                  <span className="text-[11px] text-zinc-500 mt-0.5">Player {seatIdx + 1}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Partner Quick-Invite Container (Matching Ludo) */}
        <div className="w-full bg-[#161220]/90 border border-white/10 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-inner mb-4">
          {partner ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#ff2b5e] to-[#d6143c] text-white font-black text-xs flex items-center justify-center shrink-0">
                  {(partner.displayName?.[0] || partner.partnerCode?.[0] || 'P').toUpperCase()}
                </div>
                <div className="text-left min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white truncate">
                      Partner: {partner.displayName}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      <span>{partner.online ? 'Online' : 'Offline'}</span>
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono block">Code: {partner.partnerCode}</span>
                </div>
              </div>

              {onPingPartner && (
                <button
                  type="button"
                  onClick={onPingPartner}
                  disabled={isPingingPartner}
                  className="py-2 px-3.5 sm:px-4 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5 text-white" />
                  <span>{isPingingPartner ? 'Inviting...' : 'Invite Partner'}</span>
                </button>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5 text-left min-w-0">
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-rose-400 flex items-center justify-center shrink-0">
                  <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Invite your Partner</span>
                  <span className="text-[10px] text-zinc-400 block">Link codes or pick a friend</span>
                </div>
              </div>

              {onSelectPartner && (
                <button
                  type="button"
                  onClick={onSelectPartner}
                  className="py-2 px-3.5 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Choose Friend</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Start Game CTA / Status */}
        {isFull ? (
          <button
            type="button"
            onClick={onStartGame}
            className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm sm:text-base shadow-xl transition flex items-center justify-center gap-2 bg-gradient-to-r from-[#ff2b5e] to-[#f43f5e] hover:from-[#e11d48] hover:to-[#be123c] text-white shadow-[0_4px_20px_rgba(255,43,94,0.4)] animate-pulse active:scale-[0.98] cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
            <span>2 PLAYERS JOINED • STARTING MATCH...</span>
          </button>
        ) : isHost ? (
          <button
            type="button"
            disabled
            className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm sm:text-base transition flex items-center justify-center gap-2 bg-white/10 text-zinc-500 cursor-not-allowed border border-white/10"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>WAITING FOR OPPONENT...</span>
          </button>
        ) : (
          <div className="w-full py-3.5 px-6 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-center">
            <span className="text-xs sm:text-sm font-semibold text-rose-300 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Waiting for opponent to join...
            </span>
          </div>
        )}

      </div>
    </div>
  );
};
