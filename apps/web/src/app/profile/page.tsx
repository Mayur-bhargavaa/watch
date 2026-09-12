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
  Camera,
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
  const [showAvatarModal, setShowAvatarModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

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
        {/* 3. TWO CONTAINERS: 1) PROFILE & DETAILS  2) 3D FLIP PASS                 */}
        {/* ========================================================================= */}
        <div className="w-full max-w-7xl mx-auto py-2 space-y-4">
          
          {/* Notifications */}
          {saveSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in shadow-sm">
              <Check className="w-4 h-4 shrink-0" />
              <span>{saveSuccess}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2 animate-in fade-in shadow-sm">
              <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* ===================================================================== */}
            {/* CONTAINER 1: IMAGE, NAME & ALL PROFILE DETAILS                        */}
            {/* ===================================================================== */}
            <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#14151b] border border-slate-200 dark:border-white/10 p-6 sm:p-7 shadow-sm flex flex-col items-center text-center space-y-4">
              
              {/* Circular Avatar with Round Border & Camera Icon */}
              <div className="relative group">
                <div className="w-28 h-28 rounded-full overflow-hidden bg-slate-100 dark:bg-zinc-900 border-4 border-slate-200 dark:border-white/10 shadow-md flex items-center justify-center">
                  <img
                    src={avatarUrl || session.user.avatarUrl || '/avatars/standing_heart_transparent@2x.png'}
                    alt={displayName || 'Persona'}
                    className="w-full h-full object-cover object-center"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowAvatarModal(true)}
                  className="absolute bottom-0 right-0 p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-full shadow-lg transition flex items-center justify-center border-2 border-white dark:border-[#14151b] active:scale-95"
                  title="Change Avatar"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* VIP Live Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>CINEMA VIP LIVE</span>
              </div>

              {/* Name & Email */}
              <div>
                <h1 className="text-xl font-black text-slate-900 dark:text-white">
                  {session.user.displayName || 'User'}
                </h1>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  {session.user.email || 'cinema@stitchbyte.com'}
                </p>
              </div>

              {/* All Details (Form Fields) */}
              <form onSubmit={handleSaveProfile} className="w-full space-y-3.5 text-left pt-2">
                
                {/* Partner Sync Code */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    Partner Sync Code
                  </label>
                  <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-slate-50 dark:bg-[#1b1c24] border border-slate-200 dark:border-white/[0.08]">
                    <span className="font-mono text-xs font-black text-rose-600 dark:text-rose-400">
                      {session.user.partnerCode || 'SYNC-VIP'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPartnerCode}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
                      title="Copy Partner Code"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    Display Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={30}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1b1c24] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-rose-600 transition"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="email"
                      disabled
                      value={session.user.email || 'cinema@stitchbyte.com'}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] text-slate-500 dark:text-zinc-400 text-xs font-medium cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Date of Birth & Age */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-rose-600" />
                      <span>Date of Birth</span>
                    </label>
                    {calculatedAge !== null && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
                        🎂 {calculatedAge} yrs
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1b1c24] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-rose-600 transition"
                  />
                </div>

                {/* Relationship Status */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    Relationship Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setIsMarried(false); setAnniversaryDate(''); }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                        !isMarried
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-[#1b1c24] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      Single
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMarried(true)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                        isMarried
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-[#1b1c24] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      <span>💍 Married</span>
                    </button>
                  </div>
                </div>

                {/* Anniversary Date (if married) */}
                {isMarried && (
                  <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/30 space-y-1 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1">
                        <Heart className="w-3 h-3 fill-current text-rose-600" />
                        <span>Anniversary Date</span>
                      </label>
                      {anniversaryDuration && (
                        <span className="text-[9px] font-bold text-rose-600 dark:text-rose-300">
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
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-black/50 border border-rose-200 dark:border-rose-500/30 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-rose-600 transition"
                    />
                  </div>
                )}

                {/* Save Changes Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition active:scale-95 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Profile Details</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>

            {/* ===================================================================== */}
            {/* CONTAINER 2: 3D FLIP PASS                                             */}
            {/* ===================================================================== */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <div className="perspective-1000 w-full select-none">
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className={`relative w-full cursor-pointer transition-transform duration-700 transform-style-3d min-h-[360px] sm:min-h-[400px] ${
                    isFlipped ? 'rotate-y-180' : ''
                  }`}
                >
                  
                  {/* CARD FRONT: TITANIUM VIP PASS */}
                  <div className="backface-hidden absolute inset-0 rounded-3xl p-7 text-white overflow-hidden shadow-2xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-black border border-white/15 flex flex-col justify-between">
                    
                    {/* Subtle Metallic Ambient Sheen */}
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/[0.04] rounded-full blur-3xl pointer-events-none" />

                    {/* Top Row: Brand & Wireless NFC */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 bg-white/10 rounded-xl text-white border border-white/15 shadow-sm">
                          <Film className="w-4 h-4 fill-current" />
                        </div>
                        <div className="flex flex-col leading-none">
                          <span className="text-sm font-black tracking-widest uppercase text-white flex items-center gap-1.5">
                            STITCHBYTE <span className="text-zinc-300 text-xs font-black">TITANIUM</span>
                          </span>
                          <span className="text-[8.5px] font-extrabold text-zinc-400 tracking-widest uppercase mt-0.5">
                            All-Access Cinema VIP Pass
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-zinc-400 rotate-90" />
                        <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-white/[0.06] border border-white/15 text-zinc-300 font-bold tracking-widest shadow-inner">
                          TIER 1
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Gold Chip & Tap To Flip indicator */}
                    <div className="flex items-center justify-between my-auto py-4">
                      <div className="flex items-center gap-3.5">
                        {/* EMV Smart Chip */}
                        <div className="w-12 h-9 rounded-lg bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 border border-yellow-100/60 shadow-md flex flex-col justify-between p-1.5">
                          <div className="flex justify-between">
                            <div className="w-2.5 h-1 bg-amber-900/40 rounded-sm" />
                            <div className="w-2.5 h-1 bg-amber-900/40 rounded-sm" />
                          </div>
                          <div className="h-px w-full bg-amber-900/40" />
                          <div className="flex justify-between">
                            <div className="w-2.5 h-1 bg-amber-900/40 rounded-sm" />
                            <div className="w-2.5 h-1 bg-amber-900/40 rounded-sm" />
                          </div>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-[9px] font-mono font-bold text-zinc-400 tracking-wider">
                            TAP PASS TO FLIP
                          </span>
                          <span className="text-[8.5px] text-zinc-400 font-mono flex items-center gap-1 mt-0.5">
                            <RotateCw className="w-2.5 h-2.5" /> 3D AUTHENTICATED
                          </span>
                        </div>
                      </div>

                      <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-amber-300">
                        <Crown className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Bottom Row: Holder & Partner Code */}
                    <div className="flex items-end justify-between pt-2 border-t border-white/10">
                      <div>
                        <div className="text-[8.5px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">
                          Pass Holder
                        </div>
                        <div className="text-lg sm:text-xl font-black text-white tracking-wider uppercase font-mono">
                          {session.user.displayName || 'Watch Member'}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-medium mt-0.5">
                          {calculatedAge ? `Age: ${calculatedAge} · ` : ''}
                          {session.user.isMarried ? '💍 Married' : 'Single'}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[8.5px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">
                          Partner Pass Code
                        </div>
                        <div className="font-mono text-sm sm:text-base font-black text-zinc-200 tracking-widest bg-white/[0.06] px-3 py-1 rounded-xl border border-white/15 shadow-inner">
                          {session.user.partnerCode || 'SYNC-VIP'}
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* CARD BACK: VIP PRIVILEGES & SECURITY */}
                  <div className="backface-hidden rotate-y-180 absolute inset-0 rounded-3xl p-7 text-white overflow-hidden shadow-2xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-black border border-white/15 flex flex-col justify-between">
                    
                    {/* Magnetic Strip Header */}
                    <div className="-mx-7 -mt-7 h-10 bg-black/90 border-b border-white/10 flex items-center px-7">
                      <span className="text-[9px] font-mono tracking-widest text-zinc-500">
                        MAGNETIC STRIP // STITCHBYTE ENCRYPTED PASS
                      </span>
                    </div>

                    {/* Signature Panel */}
                    <div className="flex items-center justify-between gap-4 mt-2">
                      <div className="flex-1 h-9 rounded-lg bg-white text-zinc-900 flex items-center px-4 font-mono font-bold text-xs tracking-wider shadow-inner">
                        <span>{session.user.displayName || 'Authorized Member'}</span>
                        <span className="ml-auto text-[9px] text-zinc-400 font-sans uppercase">Authorized</span>
                      </div>
                      <div className="px-3 py-1 rounded-lg bg-white/10 border border-white/20 font-mono text-xs font-black text-zinc-200">
                        4K-VIP
                      </div>
                    </div>

                    {/* Perks list */}
                    <div className="space-y-2 text-xs text-zinc-200 font-medium py-2">
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>Zero latency 4K video synchronization</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>Duo Love-Seat room with synced couple lighting</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>Unlimited arcade gameplay (Ludo 3D & Connect 4)</span>
                      </div>
                    </div>

                    {/* Barcode Strip */}
                    <div className="pt-2 flex items-center justify-between border-t border-white/10">
                      <div className="h-7 flex items-center space-x-1 opacity-80 select-none">
                        <div className="w-1 h-full bg-white" />
                        <div className="w-0.5 h-full bg-white" />
                        <div className="w-2 h-full bg-white" />
                        <div className="w-0.5 h-full bg-white" />
                        <div className="w-1.5 h-full bg-white" />
                        <div className="w-0.5 h-full bg-white" />
                        <div className="w-2.5 h-full bg-white" />
                        <div className="w-0.5 h-full bg-white" />
                        <div className="w-1 h-full bg-white" />
                        <div className="w-2 h-full bg-white" />
                      </div>
                      <span className="font-mono text-[9px] text-zinc-400">
                        TAP TO FLIP FRONT ⟳
                      </span>
                    </div>

                  </div>

                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Avatar Customization Modal */}
        {showAvatarModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#181922] border border-slate-200 dark:border-white/10 rounded-3xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 dark:text-white">Customize 3D Avatar</h3>
                <button
                  type="button"
                  onClick={() => setShowAvatarModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold text-sm transition"
                >
                  ✕
                </button>
              </div>
              <AvatarStudio
                displayName={displayName}
                value={avatarUrl}
                onChange={setAvatarUrl}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAvatarModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300 text-xs font-bold transition hover:bg-slate-200"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleSaveAvatarOnly();
                    setShowAvatarModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow transition"
                >
                  Save Avatar
                </button>
              </div>
            </div>
          </div>
        )}

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
