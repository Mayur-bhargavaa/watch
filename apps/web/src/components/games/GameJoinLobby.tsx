'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Heart,
  Bell,
  Lock,
  X,
  Sparkles,
  ChevronLeft,
  Copy,
  HelpCircle,
  Sun,
  Moon,
  Menu
} from 'lucide-react';
import {
  UserSession,
  getStoredSession,
  getUserPartner,
  connectUserPartner,
  pingPartner,
  createGameRoomWithPartner,
  joinGameRoomByCode
} from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { AppSidebar } from '../layout/AppSidebar';
import { GameFriendSelectorDrawer } from './GameFriendSelectorDrawer';

export interface GameJoinLobbyProps {
  gameType: 'bingo' | 'doodle-duel' | 'four-in-a-row' | 'tic-tac-toe' | 'ludo';
  eyebrow: string;
  titlePrimary: string;
  titleSecondary: string;
  description: string;
  rightGraphic?: React.ReactNode;
  createModalOptions?: React.ReactNode;
  onCreateCustomRoom?: () => Promise<void>;
  rulesContent?: React.ReactNode;
}

export const GameJoinLobby: React.FC<GameJoinLobbyProps> = ({
  gameType,
  eyebrow,
  titlePrimary,
  titleSecondary,
  description,
  rightGraphic,
  createModalOptions,
  onCreateCustomRoom,
  rulesContent
}) => {
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  const [session, setSession] = useState<UserSession | null>(null);
  const [partner, setPartner] = useState<{
    id: string;
    displayName: string;
    partnerCode: string;
    avatarUrl?: string | null;
    online: boolean;
  } | null>(null);
  const [myPartnerCode, setMyPartnerCode] = useState<string>('');
  const [copiedPartnerCode, setCopiedPartnerCode] = useState(false);
  const [partnerInputCode, setPartnerInputCode] = useState('');
  const [isConnectingPartner, setIsConnectingPartner] = useState(false);
  const [partnerConnectError, setPartnerConnectError] = useState<string | null>(null);
  const [partnerPingStatus, setPartnerPingStatus] = useState<string | null>(null);
  const [isPingingPartner, setIsPingingPartner] = useState(false);
  const [showPartnerConnectInput, setShowPartnerConnectInput] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isFriendDrawerOpen, setIsFriendDrawerOpen] = useState(false);

  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Load session & partner
  useEffect(() => {
    const s = getStoredSession();
    if (s && s.token) {
      setSession(s);
      setMyPartnerCode((s.user as any)?.partnerCode || '');
      getUserPartner(s.token)
        .then(p => {
          if (p?.partner) {
            setPartner({
              id: p.partner.id,
              displayName: p.partner.displayName || 'Partner',
              partnerCode: p.partner.partnerCode,
              avatarUrl: p.partner.avatarUrl,
              online: Boolean((p.partner as any).online ?? (p.partner as any).isOnline)
            });
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleCopyPartnerCode = () => {
    if (!myPartnerCode) return;
    navigator.clipboard.writeText(myPartnerCode);
    setCopiedPartnerCode(true);
    setTimeout(() => setCopiedPartnerCode(false), 2000);
  };

  const handleConnectPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.token || !partnerInputCode.trim()) return;
    setIsConnectingPartner(true);
    setPartnerConnectError(null);
    try {
      const res = await connectUserPartner(session.token, partnerInputCode.trim().toUpperCase());
      if (res?.partner) {
        setPartner({
          id: res.partner.id,
          displayName: res.partner.displayName || 'Partner',
          partnerCode: res.partner.partnerCode,
          avatarUrl: res.partner.avatarUrl,
          online: Boolean((res.partner as any).online ?? (res.partner as any).isOnline)
        });
        setShowPartnerConnectInput(false);
      }
    } catch (err: any) {
      setPartnerConnectError(err?.message || 'Failed to link partner');
    } finally {
      setIsConnectingPartner(false);
    }
  };

  const handlePingPartner = async () => {
    if (!session?.token || !partner?.partnerCode || isPingingPartner) return;
    setIsPingingPartner(true);
    setPartnerPingStatus(null);
    try {
      const res = await pingPartner({
        targetCode: partner.partnerCode,
        fromCode: myPartnerCode,
        fromName: session.user.displayName,
        gameType
      });
      if (res?.deliveredLive) {
        setPartnerPingStatus(`🔔 Live alert delivered to ${partner.displayName}!`);
      } else {
        setPartnerPingStatus(`🔔 Ping notification queued for ${partner.displayName}!`);
      }
      setTimeout(() => setPartnerPingStatus(null), 3500);
    } catch (e: any) {
      setPartnerPingStatus(e?.message || 'Failed to ping partner');
      setTimeout(() => setPartnerPingStatus(null), 3500);
    } finally {
      setIsPingingPartner(false);
    }
  };

  const handlePlayWithPartner = async () => {
    if (!session?.token) {
      router.push('/login');
      return;
    }
    setIsCreating(true);
    setLobbyError(null);
    try {
      const res = await createGameRoomWithPartner(gameType, partner?.id);
      if (res?.room?.roomCode) {
        const path = gameType === 'bingo' ? '/games/bingo' : gameType === 'doodle-duel' ? '/games/doodle-duel' : `/games/${gameType}`;
        router.push(`${path}?room=${res.room.roomCode}`);
      }
    } catch (err: any) {
      setLobbyError(err?.message || 'Failed to start duel with partner');
      setIsCreating(false);
    }
  };

  const handleCreateRoom = async () => {
    if (onCreateCustomRoom) {
      await onCreateCustomRoom();
      return;
    }
    if (!session?.token) {
      router.push('/login');
      return;
    }
    setIsCreating(true);
    setLobbyError(null);
    try {
      const res = await createGameRoomWithPartner(gameType);
      if (res?.room?.roomCode) {
        const path = gameType === 'bingo' ? '/games/bingo' : gameType === 'doodle-duel' ? '/games/doodle-duel' : `/games/${gameType}`;
        router.push(`${path}?room=${res.room.roomCode}`);
      }
    } catch (err: any) {
      setLobbyError(err?.message || 'Failed to create room');
      setIsCreating(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    setIsJoining(true);
    setLobbyError(null);
    try {
      const code = roomCodeInput.trim().toUpperCase();
      const res = await joinGameRoomByCode(code);
      if (res?.room?.roomCode) {
        const path = gameType === 'bingo' ? '/games/bingo' : gameType === 'doodle-duel' ? '/games/doodle-duel' : `/games/${gameType}`;
        router.push(`${path}?room=${res.room.roomCode}`);
      }
    } catch (err: any) {
      setLobbyError(err?.message || 'Room not found or expired');
      setIsJoining(false);
    }
  };

  return (
    <div className={`flex selection:bg-rose-600 selection:text-white font-sans antialiased overflow-x-hidden transition-colors duration-150 h-screen w-screen overflow-hidden ${
      isDark ? 'bg-[#111217] text-white' : 'bg-white text-zinc-900'
    }`}>
      {/* Centralized AppSidebar Navigation */}
      <AppSidebar
        activeNav="games"
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative h-screen overflow-hidden">
        {/* Modern Ambient Atmosphere */}
        <div className="fixed inset-0 pointer-events-none z-0">
          {isDark ? (
            <div className="absolute inset-0 bg-[#111217]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(244,63,94,0.06),rgba(255,255,255,0))]" />
              <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-white">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(244,63,94,0.03),rgba(255,255,255,0))]" />
            </div>
          )}
        </div>

        {/* Top Header Bar */}
        <header className={`h-16 px-4 sm:px-8 border-b flex items-center justify-between shrink-0 sticky top-0 z-40 backdrop-blur-xl transition-colors duration-200 ${
          isDark ? 'bg-[#14151b]/85 border-white/[0.08]' : 'bg-white/95 border-zinc-200/80 shadow-xs'
        }`}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className={`lg:hidden p-2 rounded-xl border flex items-center justify-center transition cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'
              }`}
              title="Open Navigation"
            >
              <Menu className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => router.push('/games')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 border ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border-white/10'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 border-zinc-200'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Games</span>
            </button>

            <div className={`text-xs sm:text-sm font-semibold tracking-tight ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              <span>Watch.</span> <span className={isDark ? 'text-zinc-600' : 'text-zinc-300'}>/</span> <span>Game Lobby</span> <span className={isDark ? 'text-zinc-600' : 'text-zinc-300'}>/</span> <span className="text-[#ee1d49] font-bold">{titlePrimary} {titleSecondary}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-amber-400'
                  : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700'
              }`}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Theme`}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {rulesContent && (
              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition cursor-pointer ${
                  isDark
                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300 hover:text-white'
                    : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700 hover:text-zinc-900'
                }`}
                title="Rules & How to Play"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Main Hero Container */}
        <div className={`w-full flex-1 flex flex-col justify-between relative z-10 select-none px-6 sm:px-10 lg:px-14 py-4 sm:py-6 overflow-hidden transition-colors duration-200 ${
          isDark ? 'text-white' : 'text-zinc-900'
        }`}>
          <div className="w-full flex-1 flex items-center max-w-7xl mx-auto my-auto py-2 sm:py-4">
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              
              {/* Left Column: Eyebrow, Title, Subtitle, Connected Partner, Two Action Cards */}
              <div className="lg:col-span-7 flex flex-col justify-center">
                
                {/* Eyebrow */}
                <div className="text-[11px] sm:text-xs font-bold tracking-[0.25em] text-[#f43f5e] uppercase mb-2 sm:mb-3">
                  {eyebrow}
                </div>

                {/* Main Hero Heading */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight leading-none mb-3 sm:mb-4">
                  <span className="text-[#ee1d49]">{titlePrimary}</span>{' '}
                  <span className={isDark ? 'text-white' : 'text-[#131727]'}>{titleSecondary}</span>
                </h1>

                {/* Subtitle */}
                <p className={`text-xs sm:text-sm lg:text-base font-medium max-w-lg leading-relaxed mb-4 sm:mb-5 ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}>
                  {description}
                  <br className="hidden sm:inline" />
                  No bots, just real players.
                </p>

                {/* Error Banner */}
                {lobbyError && (
                  <div className={`mb-4 p-3 rounded-2xl text-xs font-semibold ${
                    isDark ? 'bg-rose-950/60 border border-rose-500/40 text-rose-300' : 'bg-rose-50 border border-rose-200 text-rose-600'
                  }`}>
                    {lobbyError}
                  </div>
                )}

                {/* Container: Play with Connected Person */}
                {partner ? (
                  <div className={`mb-4 sm:mb-5 rounded-[22px] sm:rounded-[26px] p-3.5 sm:p-4.5 max-w-xl transition-all ${
                    isDark
                      ? 'bg-[#18121f]/90 border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
                      : 'bg-[#fff5f7] border border-[#fde4eb] shadow-[0_4px_20px_rgba(238,29,73,0.05)]'
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-[#ee1d49] to-[#f43f5e] text-white flex items-center justify-center font-bold text-sm shadow-xs ring-2 ring-white/20 overflow-hidden">
                            {partner.avatarUrl ? (
                              <img src={partner.avatarUrl} alt={partner.displayName} className="w-full h-full object-cover" />
                            ) : (
                              (partner.displayName || partner.partnerCode || 'P').charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full ${isDark ? 'bg-[#0c0d12]' : 'bg-white'}`}>
                            <span className="relative flex h-2 w-2">
                              <span className={`absolute inline-flex h-full w-full rounded-full ${partner.online ? 'animate-ping bg-emerald-400 opacity-75' : 'bg-zinc-500'}`} />
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${partner.online ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                            </span>
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold tracking-wider text-[#ee1d49] uppercase">
                              Connected Partner
                            </span>
                            <Heart className="w-3 h-3 text-[#ee1d49] fill-[#ee1d49]" />
                            <button
                              type="button"
                              onClick={() => setIsFriendDrawerOpen(true)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ee1d49]/10 hover:bg-[#ee1d49]/20 text-[#ee1d49] text-[10px] font-bold tracking-tight transition cursor-pointer active:scale-95"
                              title="Switch opponent"
                            >
                              <Users className="w-2.5 h-2.5" />
                              <span>Switch</span>
                            </button>
                          </div>
                          <h4 className={`text-sm sm:text-base font-bold truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                            {partner.displayName || partner.partnerCode}
                          </h4>
                          <p className={`text-[11px] truncate ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            {partner.online ? 'Online & ready to duel' : 'Offline • Tap ping to alert'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handlePingPartner}
                          disabled={isPingingPartner}
                          title={`Ping ${partner.displayName || 'partner'}`}
                          className={`p-2 sm:p-2.5 rounded-xl border transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 ${
                            isDark ? 'border-white/10 bg-white/5 hover:bg-white/10 text-rose-300' : 'border-[#fde4eb] bg-white hover:bg-rose-50 text-[#ee1d49]'
                          }`}
                        >
                          <Bell className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isPingingPartner ? 'animate-bounce' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={handlePlayWithPartner}
                          disabled={isCreating}
                          className="py-2.5 px-4 sm:px-5 bg-[#ed1c46] hover:bg-[#d6143c] text-white font-semibold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(237,28,70,0.25)] hover:shadow-[0_6px_20px_rgba(237,28,70,0.35)] transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          <span>{isCreating ? 'Starting...' : 'Play Together'}</span>
                          <span className="text-sm sm:text-base font-bold">→</span>
                        </button>
                      </div>
                    </div>

                    {partnerPingStatus && (
                      <div className={`mt-2.5 pt-2 border-t text-[11px] font-medium flex items-center gap-1.5 ${
                        isDark ? 'border-white/10 text-rose-400' : 'border-[#fde4eb] text-rose-600'
                      }`}>
                        <span>{partnerPingStatus}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`mb-4 sm:mb-5 rounded-[22px] sm:rounded-[26px] p-3.5 sm:p-4 max-w-xl transition-all ${
                    isDark ? 'bg-[#18121f]/90 border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)]' : 'bg-[#fff5f7] border border-[#fde4eb] shadow-[0_4px_20px_rgba(238,29,73,0.04)]'
                  }`}>
                    {!showPartnerConnectInput ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 ${
                            isDark ? 'text-[#ee1d49] bg-rose-500/15' : 'text-[#ee1d49] bg-[#fee1e7]'
                          }`}>
                            <Heart className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold tracking-wider text-[#ee1d49] uppercase">
                                Play With Partner
                              </span>
                            </div>
                            <h4 className={`text-xs sm:text-sm font-bold truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                              Play with your connected person
                            </h4>
                            <p className={`text-[11px] truncate ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                              Link codes to play 1-click matches together
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setIsFriendDrawerOpen(true)}
                            className="py-2 px-3 sm:px-4 bg-[#ed1c46] hover:bg-[#d6143c] text-white font-semibold text-xs rounded-xl sm:rounded-2xl shadow-[0_4px_14px_rgba(237,28,70,0.2)] transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Choose Friend</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowPartnerConnectInput(true)}
                            className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                              isDark ? 'border-white/10 text-zinc-300 hover:bg-white/5' : 'border-[#fde4eb] text-zinc-700 hover:bg-rose-50'
                            }`}
                            title="Enter partner code manually"
                          >
                            Code
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Heart className="w-3.5 h-3.5 text-[#ee1d49] fill-[#ee1d49]" />
                            <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Connect with your Partner</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowPartnerConnectInput(false)}
                            className={`p-1 text-xs cursor-pointer ${isDark ? 'text-zinc-400 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-800'}`}
                          >
                            ✕
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {myPartnerCode && (
                            <div className={`flex items-center justify-between p-2 rounded-xl border ${
                              isDark ? 'bg-white/5 border-white/10' : 'bg-white border-[#fde4eb]'
                            }`}>
                              <div className="min-w-0">
                                <span className={`text-[9px] uppercase font-bold block ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Your Code</span>
                                <span className={`font-mono font-bold text-xs tracking-wider ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                  {myPartnerCode}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={handleCopyPartnerCode}
                                className="px-2 py-1 font-medium text-[10px] rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-500 transition cursor-pointer"
                              >
                                {copiedPartnerCode ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          )}

                          <form onSubmit={handleConnectPartner} className="flex gap-1.5">
                            <input
                              type="text"
                              value={partnerInputCode}
                              onChange={e => setPartnerInputCode(e.target.value.toUpperCase())}
                              placeholder="THEIR CODE"
                              className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-xl text-xs font-mono uppercase focus:outline-none focus:border-[#ee1d49] ${
                                isDark ? 'bg-black/40 border border-white/10 text-white placeholder-zinc-500' : 'bg-white border border-[#fde4eb] text-zinc-900 placeholder-zinc-400'
                              }`}
                            />
                            <button
                              type="submit"
                              disabled={isConnectingPartner || !partnerInputCode.trim()}
                              className="px-3 py-1.5 bg-[#ed1c46] hover:bg-[#d6143c] disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition shrink-0 cursor-pointer"
                            >
                              {isConnectingPartner ? '...' : 'Link'}
                            </button>
                          </form>
                        </div>

                        {partnerConnectError && (
                          <p className="text-[11px] text-rose-500 font-medium">{partnerConnectError}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Two Pastel Cards Grid (Exact Ludo theme) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-xl">
                  
                  {/* Card 1: Create a Room */}
                  <div className={`rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 flex flex-col justify-between transition-all ${
                    isDark
                      ? 'bg-[#18121f]/90 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:border-white/20'
                      : 'bg-[#fff5f7] border border-[#fde4eb] shadow-[0_4px_24px_rgba(238,29,73,0.04)] hover:shadow-[0_8px_30px_rgba(238,29,73,0.08)]'
                  }`}>
                    <div>
                      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center mb-4 sm:mb-5 ${
                        isDark ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400' : 'bg-[#fee1e7] text-[#ee1d49]'
                      }`}>
                        <Users className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                      </div>
                      <h3 className={`text-lg sm:text-xl font-bold tracking-tight mb-1.5 ${
                        isDark ? 'text-white' : 'text-zinc-900'
                      }`}>
                        Create a Room
                      </h3>
                      <p className={`text-xs sm:text-[13px] font-normal leading-relaxed mb-5 sm:mb-6 ${
                        isDark ? 'text-zinc-400' : 'text-zinc-500'
                      }`}>
                        Start a new duel and invite your friend.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCreateModal(true)}
                      className="w-full py-3 px-4 bg-[#ed1c46] hover:bg-[#d6143c] text-white font-semibold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(237,28,70,0.25)] hover:shadow-[0_6px_20px_rgba(237,28,70,0.35)] transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="text-base sm:text-lg leading-none font-bold">+</span>
                      <span>Create Room</span>
                    </button>
                  </div>

                  {/* Card 2: Join a Room */}
                  <div className={`rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 flex flex-col justify-between transition-all ${
                    isDark
                      ? 'bg-[#121626]/90 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:border-white/20'
                      : 'bg-[#f5f9ff] border border-[#e3eeff] shadow-[0_4px_24px_rgba(24,93,242,0.04)] hover:shadow-[0_8px_30px_rgba(24,93,242,0.08)]'
                  }`}>
                    <div>
                      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center mb-4 sm:mb-5 ${
                        isDark ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400' : 'bg-[#dce8fe] text-[#185df2]'
                      }`}>
                        <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <h3 className={`text-lg sm:text-xl font-bold tracking-tight mb-1.5 ${
                        isDark ? 'text-white' : 'text-zinc-900'
                      }`}>
                        Join a Room
                      </h3>
                      <p className={`text-xs sm:text-[13px] font-normal leading-relaxed mb-5 sm:mb-6 ${
                        isDark ? 'text-zinc-400' : 'text-zinc-500'
                      }`}>
                        Enter a room code to join your friend's duel.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowJoinModal(true)}
                      className="w-full py-3 px-4 bg-[#185df2] hover:bg-[#144ecc] text-white font-semibold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(24,93,242,0.25)] hover:shadow-[0_6px_20px_rgba(24,93,242,0.35)] transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="text-sm sm:text-base font-bold">→</span>
                      <span>Join Room</span>
                    </button>
                  </div>

                </div>

              </div>

              {/* Right Column: 3D Graphic or Custom Illustration */}
              <div className="lg:col-span-5 flex items-center justify-center relative">
                <div className="relative w-full max-w-[340px] sm:max-w-[400px] lg:max-w-[460px] max-h-[50vh] aspect-square flex items-center justify-center">
                  {rightGraphic || (
                    <div className={`w-full h-full rounded-3xl border flex flex-col items-center justify-center p-8 text-center shadow-2xl relative ${
                      isDark ? 'bg-gradient-to-tr from-rose-500/10 via-purple-500/10 to-transparent border-white/10' : 'bg-gradient-to-tr from-rose-50 to-pink-50 border-rose-100'
                    }`}>
                      <Sparkles className="w-16 h-16 text-[#ee1d49] animate-pulse mb-3" />
                      <span className={`text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{titlePrimary} {titleSecondary}</span>
                      <span className={`text-xs mt-2 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Real-time 2-Player Private Arena</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Bottom Row / Footer Decoration (Exact Ludo flourish) */}
          <div className={`w-full max-w-7xl mx-auto pt-2 pb-1 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10 shrink-0 border-t ${
            isDark ? 'border-white/[0.05]' : 'border-zinc-200'
          }`}>
            <div className="flex items-center">
              <img
                src={isDark ? "/images/ludo-flourish-dark.png" : "/images/ludo-flourish.png"}
                alt="Good Games, Brighter Friendships"
                className="h-14 sm:h-18 lg:h-20 w-auto object-contain select-none pointer-events-none"
              />
            </div>

            <div className={`text-[10px] sm:text-[11px] font-bold tracking-[0.3em] uppercase ${
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            }`}>
              PLAY • CONNECT • REPEAT
            </div>
          </div>
        </div>
      </div>

      {/* CREATE ROOM MODAL (Ludo standard) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`rounded-[28px] p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150 relative border transition-colors ${
            isDark ? 'bg-[#14151b] border-white/15 text-white' : 'bg-white border-zinc-200 text-zinc-900 shadow-2xl'
          }`}>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className={`absolute top-5 right-5 p-2 rounded-full transition cursor-pointer ${
                isDark ? 'hover:bg-white/10 text-zinc-400 hover:text-white' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#ee1d49]/20 text-[#ee1d49]">
                <Users className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h3 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  Create a Room
                </h3>
                <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  Generate your instant 2-player duel
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {createModalOptions}

              {partner && (
                <div className={`p-3.5 border rounded-2xl flex items-center justify-between ${
                  isDark ? 'border-rose-500/20 bg-rose-500/10 text-rose-200' : 'border-[#fde4eb] bg-[#fff5f7] text-rose-800'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                    <span className="text-xs font-semibold">
                      Partner: {partner.displayName}
                    </span>
                  </div>
                  {partner.online && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                      Online
                    </span>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={async () => {
                  setShowCreateModal(false);
                  await handleCreateRoom();
                }}
                disabled={isCreating}
                className="w-full py-4 bg-[#ed1c46] hover:bg-[#d6143c] text-white font-semibold text-sm rounded-2xl shadow-[0_4px_16px_rgba(237,28,70,0.25)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <span>{isCreating ? 'Setting up Room...' : 'Create Private Duel 🚀'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JOIN ROOM MODAL (Ludo standard) */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`rounded-[28px] p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150 relative border transition-colors ${
            isDark ? 'bg-[#14151b] border-white/15 text-white' : 'bg-white border-zinc-200 text-zinc-900 shadow-2xl'
          }`}>
            <button
              type="button"
              onClick={() => setShowJoinModal(false)}
              className={`absolute top-5 right-5 p-2 rounded-full transition cursor-pointer ${
                isDark ? 'hover:bg-white/10 text-zinc-400 hover:text-white' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#185df2]/20 text-[#185df2]">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  Join a Room
                </h3>
                <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  Enter a room code or your friend's invite code
                </p>
              </div>
            </div>

            <form onSubmit={handleJoinByCode} className="space-y-4">
              <div>
                <label className={`text-xs font-semibold block mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Room Code
                </label>
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. BINGO-7F2A"
                  maxLength={20}
                  className={`w-full rounded-2xl px-4 py-3 text-center font-mono text-base font-bold uppercase tracking-widest outline-none transition border ${
                    isDark
                      ? 'bg-black/50 border-white/15 focus:border-[#185df2] text-white placeholder-zinc-500'
                      : 'bg-zinc-50 border-zinc-200 focus:border-[#185df2] text-zinc-900 placeholder-zinc-400'
                  }`}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isJoining || !roomCodeInput.trim()}
                className="w-full py-4 bg-[#185df2] hover:bg-[#144ecc] disabled:opacity-50 text-white font-semibold text-sm rounded-2xl shadow-[0_4px_16px_rgba(24,93,242,0.25)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <span>{isJoining ? 'Joining Room...' : 'Join Room →'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && rulesContent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`rounded-[28px] p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150 relative border transition-colors max-h-[85vh] overflow-y-auto ${
            isDark ? 'bg-[#14151b] border-white/15 text-white' : 'bg-white border-zinc-200 text-zinc-900 shadow-2xl'
          }`}>
            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              className={`absolute top-5 right-5 p-2 rounded-full transition cursor-pointer ${
                isDark ? 'hover:bg-white/10 text-zinc-400 hover:text-white' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-[#ee1d49]" />
              <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>How to Play</h3>
            </div>

            {rulesContent}
          </div>
        </div>
      )}

      {/* Friend Selector Drawer */}
      <GameFriendSelectorDrawer
        isOpen={isFriendDrawerOpen}
        onClose={() => setIsFriendDrawerOpen(false)}
        token={session?.token}
        currentPartnerId={partner?.id}
        currentPartnerCode={partner?.partnerCode}
        gameTitle={`${titlePrimary} ${titleSecondary}`}
        onSelectFriend={friend => {
          setIsFriendDrawerOpen(false);
          setPartner({
            id: friend.friendUser.id,
            displayName: friend.friendUser.displayName,
            partnerCode: friend.friendUser.partnerCode || '',
            avatarUrl: friend.friendUser.avatarUrl,
            online: Boolean((friend.friendUser as any).online ?? (friend.friendUser as any).isOnline)
          });
        }}
        onPlayWithFriend={async friend => {
          setIsFriendDrawerOpen(false);
          try {
            const res = await createGameRoomWithPartner(gameType, friend.friendUser.id);
            if (res?.room?.roomCode) {
              const path = gameType === 'bingo' ? '/games/bingo' : gameType === 'doodle-duel' ? '/games/doodle-duel' : `/games/${gameType}`;
              router.push(`${path}?room=${res.room.roomCode}`);
            }
          } catch (e) {
            console.error(e);
          }
        }}
      />
    </div>
  );
};
