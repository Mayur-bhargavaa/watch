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
  Plus
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

function ProfileContent() {
  const router = useRouter();
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'details' | 'avatar'>('details');

  // Form states
  const [displayName, setDisplayName] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [isMarried, setIsMarried] = useState<boolean>(false);
  const [anniversaryDate, setAnniversaryDate] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

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
      {/* 1. LEFT SIDEBAR NAVIGATION (MATCHING DASHBOARD EXACTLY)                   */}
      {/* ========================================================================= */}
      <aside className="w-64 bg-white dark:bg-[#14151b] border-r border-slate-200 dark:border-white/[0.06] p-6 flex flex-col justify-between shrink-0 hidden lg:flex select-none transition-colors duration-150">
        <div className="space-y-8">
          {/* Logo: Watch. Powered by StitchByte */}
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
            {/* Nav Group 1: Menu */}
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

            {/* Nav Group 2: Social / Rooms */}
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

            {/* Nav Group 3: General */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-3 mb-2">
                General
              </div>
              
              {/* Profile Active Nav Item */}
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

        {/* User Profile Card at Bottom of Sidebar */}
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
              {session.user.age ? <span>🎂 {session.user.age}y · </span> : null}
              <span>{session.user.isMarried ? '💍 Married' : 'Cinema Fan'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT AREA (MATCHING DASHBOARD TOPBAR & CARDS)                  */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-4">
          {/* Back & Forward Controls */}
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

          {/* Search Bar matching Dashboard */}
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

          {/* Top Right Header with Max 6 Indicator & Theme Toggle */}
          <div className="flex items-center space-x-2.5 shrink-0">
            {/* Live Room Limit Indicator */}
            <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-[11px] text-slate-600 dark:text-zinc-300 shadow-sm">
              <Users className="w-3.5 h-3.5 text-rose-600" />
              <span>Max 6 per room</span>
            </div>

            {/* 1-Click Theme Switcher (Sun / Moon) */}
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
        {/* 3. HERO PROFILE CARD (MATCHING DASHBOARD CARD STYLE)                      */}
        {/* ========================================================================= */}
        <div className="relative rounded-3xl bg-white dark:bg-[#14151b] border border-slate-200 dark:border-white/[0.06] p-6 sm:p-8 shadow-sm transition-colors duration-150 overflow-hidden">
          
          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            
            {/* Standing Torso Persona Stage */}
            <div className="relative group shrink-0">
              <div className="relative w-28 h-36 sm:w-32 sm:h-40 rounded-t-3xl rounded-b-xl overflow-hidden bg-slate-100 dark:bg-zinc-950 border-2 border-rose-600/60 shadow-xl flex flex-col items-center justify-end">
                <img
                  src={
                    session.user.avatarUrl
                      ? session.user.avatarUrl.replace(/[?&]radius=[^&]+/g, '').replace(/[?&]backgroundColor=[^&]+/g, '')
                      : '/avatars/standing_heart_transparent@2x.png'
                  }
                  alt={session.user.displayName || 'Persona'}
                  className="w-full h-full object-cover object-bottom transition-transform duration-300 group-hover:scale-105 select-none"
                />

                {/* Counter ledge matching dashboard bitmoji */}
                <div className="relative z-10 w-full h-3 bg-gradient-to-r from-slate-200 via-rose-600 to-slate-200 dark:from-zinc-900 dark:via-rose-600 dark:to-zinc-900 border-t border-rose-600 shadow-[0_0_12px_rgba(225,29,72,0.8)] flex items-center justify-center">
                  <div className="w-12 h-0.5 bg-white/70 rounded-full" />
                </div>
              </div>
              
              {/* Customize Persona Button */}
              <button
                type="button"
                onClick={() => setActiveTab('avatar')}
                className="absolute -bottom-2 -right-2 p-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center border-2 border-white dark:border-[#14151b]"
                title="Customize Persona"
              >
                <Scissors className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Info & Partner Code */}
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {session.user.displayName || 'Watch Member'}
                </h1>
                
                <span className="px-2.5 py-0.5 rounded-full bg-rose-600/10 dark:bg-rose-600/20 border border-rose-600/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-rose-600" />
                  <span>Cinema VIP</span>
                </span>

                {session.user.isMarried && (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 text-xs font-bold flex items-center gap-1">
                    <span>💍</span> Married
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-600 dark:text-zinc-400 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 font-medium">
                {session.user.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                    <span>{session.user.email}</span>
                  </span>
                )}
                {session.user.age && (
                  <span className="flex items-center gap-1">
                    <span>🎂</span>
                    <span>{session.user.age} years old</span>
                  </span>
                )}
                {anniversaryDuration && (
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                    <span>🥂</span>
                    <span>{anniversaryDuration}</span>
                  </span>
                )}
              </div>

              {/* Unique Partner Pairing Code Box */}
              {session.user.partnerCode && (
                <div className="pt-2">
                  <div className="inline-flex flex-col sm:flex-row items-center gap-2 p-2.5 px-4 rounded-2xl bg-slate-100 dark:bg-[#1b1c24] border border-slate-200 dark:border-white/[0.08]">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">
                      Partner Code:
                    </span>
                    <span className="font-mono text-sm font-black text-slate-900 dark:text-white tracking-widest px-2 py-0.5 rounded-lg bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 shadow-sm">
                      {session.user.partnerCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPartnerCode}
                      className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 transition ml-1"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">
                    Share this code with your partner to pair your rooms and celebrate together.
                  </p>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. TABS NAVIGATION (MATCHING DASHBOARD PILL BUTTONS)                      */}
        {/* ========================================================================= */}
        <div className="flex rounded-2xl bg-slate-200/80 dark:bg-[#14151b] p-1.5 border border-slate-300/70 dark:border-white/[0.06] text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition ${
              activeTab === 'details'
                ? 'bg-white dark:bg-[#1f202c] text-slate-900 dark:text-white shadow-sm font-bold'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4 text-rose-600" />
            <span>Personal Details & Milestones</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('avatar')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition ${
              activeTab === 'avatar'
                ? 'bg-white dark:bg-[#1f202c] text-slate-900 dark:text-white shadow-sm font-bold'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-rose-600" />
            <span>Bitmoji Avatar Studio</span>
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
        {/* 5. TAB 1: PERSONAL DETAILS & MILESTONES (MATCHING DASHBOARD CARDS)        */}
        {/* ========================================================================= */}
        {activeTab === 'details' && (
          <div className="rounded-3xl bg-white dark:bg-[#14151b] border border-slate-200 dark:border-white/[0.06] p-6 sm:p-8 space-y-6 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Edit Profile & Celebrations</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Keep your information fresh for party reminders, birthday alerts, and synced romantic lighting.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Display Name */}
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

              {/* Date of Birth & Auto Age */}
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

              {/* Marital / Relationship Status */}
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
                        : 'bg-slate-50 dark:bg-[#1b1c24] border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
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
                        : 'bg-slate-50 dark:bg-[#1b1c24] border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>💍 Yes, Married</span>
                  </button>
                </div>
              </div>

              {/* Anniversary Date (If Married) */}
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

              {/* Save Button */}
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
        {/* 6. TAB 2: BITMOJI AVATAR STUDIO                                           */}
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

            {/* Studio Component */}
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
        {/* 7. QUICK NAVIGATION CARDS (MATCHING DASHBOARD SHORTCUTS)                  */}
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
