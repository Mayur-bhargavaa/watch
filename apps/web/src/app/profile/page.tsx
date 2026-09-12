'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Film,
  User,
  Mail,
  Calendar,
  Heart,
  Sparkles,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Save,
  Scissors,
  Sliders,
  ShieldCheck,
  Users,
  Tv,
  Gamepad2,
  Sun,
  Moon,
  Search,
  Settings,
  Crown,
  Award,
  Zap,
  Flame,
  Wifi,
  QrCode,
  RotateCw,
  Star
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  getStoredSession,
  clearStoredSession,
  fetchCurrentUser,
  updateUserProfile,
  UserSession
} from '../../lib/api';
import { AvatarStudio } from '../../components/auth/AvatarStudio';

const CINEMA_VIBES = [
  {
    id: 'cinephile',
    name: "Director's Cut",
    icon: '🎬',
    tagline: '4K IMAX & Deep Lore',
    badge: 'CINEPHILE',
    gradient: 'from-rose-500/15 via-red-500/5 to-transparent',
    borderActive: 'border-rose-600 ring-2 ring-rose-600/30 shadow-rose-500/20',
    iconBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
  },
  {
    id: 'binger',
    name: 'Popcorn Binger',
    icon: '🍿',
    tagline: '8-Hour Midnight Marathons',
    badge: 'MARATHON',
    gradient: 'from-amber-500/15 via-yellow-500/5 to-transparent',
    borderActive: 'border-amber-500 ring-2 ring-amber-500/30 shadow-amber-500/20',
    iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  },
  {
    id: 'romcom',
    name: 'Rom-Com Duo',
    icon: '💖',
    tagline: 'Couple Sync & Love Rooms',
    badge: 'COUPLE VIP',
    gradient: 'from-pink-500/15 via-rose-500/5 to-transparent',
    borderActive: 'border-pink-500 ring-2 ring-pink-500/30 shadow-pink-500/20',
    iconBg: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
    badgeColor: 'bg-pink-500/15 text-pink-700 dark:text-pink-300'
  },
  {
    id: 'scifi',
    name: 'Sci-Fi Voyager',
    icon: '🚀',
    tagline: 'Cyberpunk, Space & Time',
    badge: 'VOYAGER',
    gradient: 'from-sky-500/15 via-indigo-500/5 to-transparent',
    borderActive: 'border-sky-500 ring-2 ring-sky-500/30 shadow-sky-500/20',
    iconBg: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    badgeColor: 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
  },
  {
    id: 'arcade',
    name: 'Arcade Champion',
    icon: '🎮',
    tagline: 'Ludo 3D & Connect 4 King',
    badge: 'DUELIST',
    gradient: 'from-purple-500/15 via-violet-500/5 to-transparent',
    borderActive: 'border-purple-500 ring-2 ring-purple-500/30 shadow-purple-500/20',
    iconBg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
    badgeColor: 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
  }
];

const ACHIEVEMENTS = [
  { id: 'host', title: 'Cinema Host', desc: 'Launched first room with friends', icon: '🎬', unlocked: true },
  { id: 'vip', title: 'Cinema VIP', desc: 'StitchByte Titanium VIP status', icon: '👑', unlocked: true },
  { id: 'couple', title: 'Love Theater', desc: 'Linked partner room & countdown', icon: '💍', unlocked: true },
  { id: 'arcade', title: 'Arcade Duelist', desc: 'Challenged friends in Ludo 3D', icon: '🎮', unlocked: true },
  { id: 'owl', title: 'Midnight Streamer', desc: 'Streamed movies past midnight', icon: '🌙', unlocked: true },
  { id: '4k', title: '4K Ultra-Sync', desc: 'Synchronized low-latency playback', icon: '⚡', unlocked: true }
];

function ProfileContent() {
  const router = useRouter();
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'details' | 'couple' | 'avatar' | 'achievements'>('details');

  // Form states
  const [displayName, setDisplayName] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [isMarried, setIsMarried] = useState<boolean>(false);
  const [anniversaryDate, setAnniversaryDate] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [selectedVibeId, setSelectedVibeId] = useState<string>('cinephile');

  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const activeVibe = useMemo(() => {
    return CINEMA_VIBES.find(v => v.id === selectedVibeId) || CINEMA_VIBES[0];
  }, [selectedVibeId]);

  // Auto-calculated age
  const calculatedAge = useMemo(() => {
    if (!dateOfBirth) return null;
    const birth = new Date(dateOfBirth);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 && age <= 125 ? age : null;
  }, [dateOfBirth]);

  // Milestone text for married couples
  const anniversaryDuration = useMemo(() => {
    if (!isMarried || !anniversaryDate) return null;
    const anniv = new Date(anniversaryDate);
    if (isNaN(anniv.getTime())) return null;
    const today = new Date();
    let years = today.getFullYear() - anniv.getFullYear();
    let months = today.getMonth() - anniv.getMonth();
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years <= 0 && months <= 0) return 'Just married! Happy beginnings 🥂';
    if (years <= 0) return `${months} month${months > 1 ? 's' : ''} together 🥂`;
    return `${years} year${years > 1 ? 's' : ''}${months > 0 ? `, ${months} mo` : ''} of movie nights 🥂`;
  }, [isMarried, anniversaryDate]);

  // Load session on mount
  useEffect(() => {
    const current = getStoredSession();
    if (!current || current.user.isAnonymous) {
      router.push('/login');
      return;
    }

    setSession(current);
    setDisplayName(current.user.displayName || '');
    setDateOfBirth(current.user.dateOfBirth || '');
    setIsMarried(Boolean(current.user.isMarried));
    setAnniversaryDate(current.user.anniversaryDate || '');
    setAvatarUrl(current.user.avatarUrl || '');

    try {
      const savedVibe = localStorage.getItem('stitchbyte_user_vibe_id');
      if (savedVibe) setSelectedVibeId(savedVibe);
    } catch {}

    setLoading(false);

    // Sync fresh profile from DB
    fetchCurrentUser(current.token).then(fresh => {
      if (fresh) {
        setSession(fresh);
        setDisplayName(fresh.user.displayName || '');
        setDateOfBirth(fresh.user.dateOfBirth || '');
        setIsMarried(Boolean(fresh.user.isMarried));
        setAnniversaryDate(fresh.user.anniversaryDate || '');
        setAvatarUrl(fresh.user.avatarUrl || '');
      }
    });
  }, [router]);

  const handleCopyPartnerCode = () => {
    if (!session?.user.partnerCode) return;
    navigator.clipboard.writeText(session.user.partnerCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSelectVibe = (id: string) => {
    setSelectedVibeId(id);
    try {
      localStorage.setItem('stitchbyte_user_vibe_id', id);
    } catch {}
  };

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!displayName.trim()) {
      setErrorMsg('Display name cannot be empty.');
      return;
    }
    if (isMarried && !anniversaryDate) {
      setErrorMsg('Please select your anniversary date.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSaveSuccess(null);

    try {
      const updated = await updateUserProfile({
        displayName: displayName.trim(),
        avatarUrl,
        dateOfBirth: dateOfBirth || undefined,
        anniversaryDate: isMarried && anniversaryDate ? anniversaryDate : undefined,
        isMarried,
        age: calculatedAge ?? undefined
      });

      setSession(prev => prev ? { ...prev, user: { ...prev.user, ...updated } } : null);
      setSaveSuccess('Profile saved successfully!');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAvatarOnly = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSaveSuccess(null);

    try {
      const updated = await updateUserProfile({
        avatarUrl
      });
      setSession(prev => prev ? { ...prev, user: { ...prev.user, ...updated } } : null);
      setSaveSuccess('Avatar updated successfully!');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update avatar.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    clearStoredSession();
    router.push('/');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/dashboard`);
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#111217] flex flex-col items-center justify-center space-y-4 text-slate-900 dark:text-white">
        <div className="w-10 h-10 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
        <div className="text-xs font-semibold text-slate-500 dark:text-zinc-400 tracking-wider">
          Connecting to Watch...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#111217] text-slate-900 dark:text-slate-100 flex selection:bg-rose-600 selection:text-white font-sans antialiased overflow-x-hidden transition-colors duration-150">
      
      {/* ========================================================================= */}
      {/* 1. LEFT SIDEBAR (DASHBOARD AUTHENTIC SHELL)                               */}
      {/* ========================================================================= */}
      <aside className="w-64 bg-white dark:bg-[#14151b] border-r border-slate-200 dark:border-white/[0.06] p-6 flex flex-col justify-between shrink-0 hidden lg:flex select-none transition-colors duration-150">
        <div className="space-y-8">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center space-x-2.5 cursor-pointer select-none group"
          >
            <div className="p-1.5 bg-rose-600 rounded-xl text-white shadow-lg shadow-rose-600/30 group-hover:scale-105 transition-transform">
              <Film className="w-4 h-4 fill-current" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Watch<span className="text-rose-600 text-2xl leading-none">.</span>
              </span>
              <span className="text-[9px] font-semibold text-slate-400 dark:text-zinc-500 tracking-widest uppercase mt-0.5">
                Powered by StitchByte
              </span>
            </div>
          </Link>

          {/* Navigation Groups */}
          <div className="space-y-6">
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-3 mb-2">
                Menu
              </div>
              <Link
                href="/dashboard"
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition"
              >
                <Film className="w-4 h-4 text-slate-400 dark:text-zinc-400" />
                <span>Browse Cinema</span>
              </Link>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-3 mb-2">
                Social
              </div>
              <Link
                href="/dashboard"
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition"
              >
                <Tv className="w-4 h-4 text-slate-400 dark:text-zinc-400" />
                <span>Watch Parties</span>
                <span className="ml-auto text-[10px] bg-rose-600/20 text-rose-500 dark:text-rose-400 px-1.5 py-0.5 rounded-full font-bold">
                  Max 6
                </span>
              </Link>

              <Link
                href="/games"
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition"
              >
                <Gamepad2 className="w-4 h-4 text-slate-400 dark:text-zinc-400" />
                <span>Game Lounge</span>
                <span className="ml-auto text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full font-bold">
                  PLAY
                </span>
              </Link>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-3 mb-2">
                General
              </div>
              
              <div className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-white/[0.08] shadow-sm relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-rose-600 before:rounded-r">
                <User className="w-4 h-4 text-rose-600" />
                <span>My Profile</span>
                <span className="ml-auto text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full font-bold">
                  VIP
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-100 dark:bg-[#1b1c24] border border-slate-200 dark:border-white/[0.06] select-none">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 ring-2 ring-rose-600/40 shrink-0 flex items-center justify-center">
            {session.user.avatarUrl ? (
              <img
                src={session.user.avatarUrl}
                alt={session.user.displayName || 'Avatar'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white text-sm font-bold">
                {(session.user.displayName || 'U')[0].toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {session.user.displayName || 'User'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate flex items-center gap-1">
              <span>{activeVibe.icon}</span>
              <span>{session.user.isMarried ? '💍 Married' : 'Cinema VIP'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN DASHBOARD CONTENT AREA                                            */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-9 h-9 rounded-full bg-white dark:bg-[#1b1c24] hover:bg-slate-100 dark:hover:bg-[#242531] border border-slate-200 dark:border-white/[0.06] flex items-center justify-center text-slate-600 dark:text-zinc-300 transition shadow-sm"
              title="Back to Dashboard"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.forward()}
              className="w-9 h-9 rounded-full bg-white dark:bg-[#1b1c24] hover:bg-slate-100 dark:hover:bg-[#242531] border border-slate-200 dark:border-white/[0.06] flex items-center justify-center text-slate-600 dark:text-zinc-300 transition shadow-sm"
              title="Forward"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-xl flex items-center bg-white dark:bg-[#1b1c24] border border-slate-200 dark:border-white/[0.08] px-4 py-2 rounded-full text-xs text-slate-900 dark:text-white focus-within:border-rose-500/80 transition shadow-sm"
          >
            <Search className="w-4 h-4 text-slate-400 dark:text-zinc-400 shrink-0 mr-2.5" />
            <input
              type="text"
              placeholder="Search cinema or room invite code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-xs placeholder-slate-400 dark:placeholder-zinc-500 text-slate-900 dark:text-white font-mono text-[11px]"
            />
          </form>

          <div className="flex items-center space-x-2.5 shrink-0">
            <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-[11px] text-slate-600 dark:text-zinc-300 shadow-sm">
              <Users className="w-3.5 h-3.5 text-rose-600" />
              <span>Max 6 per room</span>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="w-9 h-9 rounded-full bg-white dark:bg-[#1b1c24] hover:bg-slate-100 dark:hover:bg-[#242531] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-zinc-200 transition shadow-sm active:scale-95"
              title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle theme mode"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform duration-300" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600 hover:-rotate-12 transition-transform duration-300" />
              )}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. PROFILE PERSONA CARD (VERTICAL & CLEAN)                                */}
        {/* ========================================================================= */}
        <div className="flex justify-center w-full">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#14151b] border border-slate-200 dark:border-white/10 p-6 shadow-sm flex flex-col items-center text-center space-y-4">
            
            {/* Avatar Booth */}
            <div className="relative group">
              <div className="relative w-32 h-40 rounded-2xl overflow-hidden bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 flex flex-col items-center justify-end">
                <img
                  src={
                    session.user.avatarUrl
                      ? session.user.avatarUrl.replace(/[?&]radius=[^&]+/g, '').replace(/[?&]backgroundColor=[^&]+/g, '')
                      : '/avatars/standing_heart_transparent@2x.png'
                  }
                  alt={session.user.displayName || 'Persona'}
                  className="w-full h-full object-cover object-bottom"
                />
                
                {/* Red Counter Bar */}
                <div className="relative z-10 w-full h-3 bg-gradient-to-r from-slate-200 via-rose-600 to-slate-200 dark:from-zinc-900 dark:via-rose-600 dark:to-zinc-900 border-t border-rose-600 flex items-center justify-center">
                  <div className="w-12 h-0.5 bg-white/80 rounded-full" />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('avatar')}
                className="absolute -bottom-1 -right-1 p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow transition flex items-center justify-center border-2 border-white dark:border-[#14151b]"
                title="Change Avatar"
              >
                <Scissors className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Information Block */}
            <div className="flex flex-col items-center space-y-2 w-full">
              {/* VIP Live Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>CINEMA VIP LIVE</span>
              </div>

              {/* User Display Name */}
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {session.user.displayName || 'User'}
              </h1>

              {/* Age & Marital Status */}
              <div className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                {calculatedAge ? `🎂 ${calculatedAge} years old · ` : ''}
                {session.user.isMarried ? '💍 Married' : 'Single'}
              </div>

              {/* Partner Code */}
              {session.user.partnerCode && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleCopyPartnerCode}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1b1c24] hover:bg-slate-200 dark:hover:bg-[#232430] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white transition"
                  >
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Partner Code:</span>
                    <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">{session.user.partnerCode}</span>
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500 ml-1" /> : <Copy className="w-3.5 h-3.5 text-slate-400 ml-1" />}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. TABS NAVIGATION (CLEAN SEGMENTED CONTROL)                              */}
        {/* ========================================================================= */}
        <div className="flex rounded-2xl bg-slate-200/80 dark:bg-[#14151b] p-1.5 border border-slate-300/70 dark:border-white/[0.06] text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition shrink-0 ${
              activeTab === 'details'
                ? 'bg-white dark:bg-[#1f202c] text-slate-900 dark:text-white shadow-sm font-bold'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4 text-rose-600" />
            <span>Personal Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('couple')}
            className={`flex-1 py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition shrink-0 ${
              activeTab === 'couple'
                ? 'bg-white dark:bg-[#1f202c] text-slate-900 dark:text-white shadow-sm font-bold'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Heart className="w-4 h-4 text-rose-600" />
            <span>Couple Cinema Booth</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('avatar')}
            className={`flex-1 py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition shrink-0 ${
              activeTab === 'avatar'
                ? 'bg-white dark:bg-[#1f202c] text-slate-900 dark:text-white shadow-sm font-bold'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-rose-600" />
            <span>3D Avatar Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('achievements')}
            className={`flex-1 py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition shrink-0 ${
              activeTab === 'achievements'
                ? 'bg-white dark:bg-[#1f202c] text-slate-900 dark:text-white shadow-sm font-bold'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Award className="w-4 h-4 text-rose-600" />
            <span>Cinema Trophies</span>
          </button>
        </div>

        {/* FEEDBACK BANNERS */}
        {saveSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in shadow-sm">
            <Check className="w-4 h-4" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2 animate-in fade-in shadow-sm">
            <span className="w-2 h-2 rounded-full bg-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: PERSONAL DETAILS                                                   */}
        {/* ========================================================================= */}
        {activeTab === 'details' && (
          <div className="rounded-3xl bg-white dark:bg-[#14151b] border border-slate-200 dark:border-white/[0.06] p-6 sm:p-8 space-y-6 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Personal Details & Celebrations</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Keep your information fresh for party reminders, birthday alerts, and synced romantic lighting.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Display Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={30}
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-slate-50 dark:bg-[#1b1c24] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:border-rose-600 transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-rose-600" />
                    <span>Date of Birth</span>
                  </label>
                  {calculatedAge !== null && (
                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 flex items-center gap-1">
                      <span>🎂</span> {calculatedAge} years old
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-[#1b1c24] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:border-rose-600 transition"
                />
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                  We use your birthdate to trigger special birthday surprises in your watch rooms.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-rose-600/30 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Profile Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: COUPLE CINEMA BOOTH & LOVE SEAT                                    */}
        {/* ========================================================================= */}
        {activeTab === 'couple' && (
          <div className="rounded-3xl bg-white dark:bg-[#14151b] border border-slate-200 dark:border-white/[0.06] p-6 sm:p-8 space-y-6 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-600 fill-current" />
                <span>Couple Cinema Love-Seat Stage</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                A private cinema booth built for you and your partner. Sync countdowns, love reactions, and couple streams.
              </p>
            </div>

            {/* Visual Double Cinema Seat */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-50/70 via-slate-50 to-red-50/70 dark:from-rose-950/20 dark:via-[#181922] dark:to-red-950/20 border border-rose-200 dark:border-rose-500/20 flex flex-col sm:flex-row items-center justify-around gap-6">
              
              {/* Left Seat: User */}
              <div className="flex flex-col items-center space-y-2">
                <div className="relative w-24 h-32 rounded-t-3xl rounded-b-xl overflow-hidden bg-slate-200 dark:bg-zinc-950 border-2 border-rose-600 shadow-lg flex items-end justify-center">
                  <img
                    src={avatarUrl || '/avatars/standing_heart_transparent@2x.png'}
                    alt="You"
                    className="w-full h-full object-cover object-bottom"
                  />
                  <div className="absolute bottom-0 inset-x-0 h-2 bg-rose-600" />
                </div>
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {displayName || 'You'}
                </span>
                <span className="text-[10px] text-rose-600 font-bold">Seat 1 (Host)</span>
              </div>

              {/* Center Heart Aura */}
              <div className="flex flex-col items-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 animate-pulse">
                  <Heart className="w-6 h-6 fill-current" />
                </div>
                <span className="text-xs font-black text-rose-600 tracking-wider uppercase">
                  {anniversaryDuration || 'Duo Sync'}
                </span>
              </div>

              {/* Right Seat: Partner */}
              <div className="flex flex-col items-center space-y-2">
                <div className="relative w-24 h-32 rounded-t-3xl rounded-b-xl overflow-hidden bg-slate-200/80 dark:bg-zinc-950/80 border-2 border-dashed border-rose-400/80 flex flex-col items-center justify-center text-center p-2">
                  <span className="text-2xl">🧸</span>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 mt-1">
                    Partner Seat
                  </span>
                  <div className="absolute bottom-0 inset-x-0 h-2 bg-rose-400/60" />
                </div>
                <button
                  type="button"
                  onClick={handleCopyPartnerCode}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedCode ? 'Code Copied!' : 'Share Code'}</span>
                </button>
                <span className="text-[10px] text-slate-400">Seat 2 (Partner)</span>
              </div>

            </div>

            {/* Relationship status toggle & Anniversary */}
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Are you married?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setIsMarried(false); setAnniversaryDate(''); }}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition ${
                      !isMarried
                        ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white border-slate-300 dark:border-white/30 shadow-sm'
                        : 'bg-slate-50 dark:bg-[#1b1c24] border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    Single / Not Married
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMarried(true)}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      isMarried
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/30'
                        : 'bg-slate-50 dark:bg-[#1b1c24] border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    <span>💍 Yes, Married</span>
                  </button>
                </div>
              </div>

              {isMarried && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/30 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 fill-current text-rose-600" />
                      <span>Wedding / Couple Anniversary Date</span>
                    </label>
                    {anniversaryDuration && (
                      <span className="text-[11px] font-black text-rose-600 dark:text-rose-300">
                        {anniversaryDuration}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    required={isMarried}
                    value={anniversaryDate}
                    onChange={(e) => setAnniversaryDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3.5 py-3 rounded-xl bg-white dark:bg-black/60 border border-rose-200 dark:border-rose-500/30 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:border-rose-600 transition"
                  />
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400">
                    🥂 Every year on your anniversary, Watch lights up a synchronized couple countdown with special romantic cinema themes!
                  </p>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-rose-600/30 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Partner Settings</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: 3D AVATAR STUDIO                                                   */}
        {/* ========================================================================= */}
        {activeTab === 'avatar' && (
          <div className="rounded-3xl bg-white dark:bg-[#14151b] border border-slate-200 dark:border-white/[0.06] p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Customize Your Persona</h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Personalize your Bitmoji look anytime. Your new avatar will instantly show on your dashboard and party rooms.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveAvatarOnly}
                disabled={saving}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/30 transition active:scale-95 shrink-0"
              >
                {saving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Avatar</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 sm:p-6 rounded-2xl bg-slate-50 dark:bg-[#1b1c24] border border-slate-200 dark:border-white/[0.06] shadow-inner">
              <AvatarStudio
                displayName={displayName}
                value={avatarUrl}
                onChange={setAvatarUrl}
              />
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveAvatarOnly}
                disabled={saving}
                className="w-full py-3.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-rose-600/30 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Updating Persona in Database...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Save & Update Persona</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: CINEMA TROPHIES & ACHIEVEMENTS                                     */}
        {/* ========================================================================= */}
        {activeTab === 'achievements' && (
          <div className="rounded-3xl bg-white dark:bg-[#14151b] border border-slate-200 dark:border-white/[0.06] p-6 sm:p-8 space-y-6 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <Award className="w-5 h-5 text-rose-600" />
                <span>Cinema Trophies & Milestones</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Achievements unlocked on your Watch account through streaming, hosting parties, and playing arcade games.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {ACHIEVEMENTS.map(ach => (
                <div
                  key={ach.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1b1c24] border border-slate-200 dark:border-white/[0.06] flex items-start gap-3.5 shadow-sm"
                >
                  <div className="text-2xl p-2 rounded-xl bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 shadow-sm shrink-0">
                    {ach.icon}
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{ach.title}</span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        UNLOCKED
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-tight">
                      {ach.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 6. QUICK NAVIGATION CARDS                                                 */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <Link
            href="/dashboard"
            className="p-4 rounded-2xl bg-white dark:bg-[#14151b] hover:bg-slate-100 dark:hover:bg-[#1b1c24] border border-slate-200 dark:border-white/[0.06] flex items-center gap-3 transition group shadow-sm"
          >
            <div className="p-2.5 rounded-xl bg-rose-600/10 text-rose-600 group-hover:scale-105 transition-transform">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-rose-600 transition">Cinema Lounge</div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400">Stream YouTube & Movies</div>
            </div>
          </Link>

          <Link
            href="/games"
            className="p-4 rounded-2xl bg-white dark:bg-[#14151b] hover:bg-slate-100 dark:hover:bg-[#1b1c24] border border-slate-200 dark:border-white/[0.06] flex items-center gap-3 transition group shadow-sm"
          >
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition">Game Arcade</div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400">Ludo 3D & Connect 4</div>
            </div>
          </Link>

          <div
            onClick={handleCopyPartnerCode}
            className="p-4 rounded-2xl bg-white dark:bg-[#14151b] hover:bg-slate-100 dark:hover:bg-[#1b1c24] border border-slate-200 dark:border-white/[0.06] flex items-center gap-3 transition group cursor-pointer shadow-sm"
          >
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition">Pair with Partner</div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                {copiedCode ? 'Code copied to clipboard!' : `Code: ${session.user.partnerCode || 'Copy'}`}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="py-6 text-center text-xs text-slate-400 dark:text-zinc-500 border-t border-slate-200 dark:border-white/[0.06] mt-auto">
          <span>© {new Date().getFullYear()} Watch · Powered by StitchByte · 100% Free & Private</span>
        </footer>

      </div>

    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-[#111217] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-rose-600 border-t-transparent animate-spin" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
