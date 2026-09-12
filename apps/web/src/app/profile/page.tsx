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
  LogOut,
  Save,
  Scissors,
  Sliders,
  ShieldCheck,
  Users,
  Tv,
  Gamepad2,
  Sun,
  Moon
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
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

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center space-y-3 text-white">
        <div className="w-8 h-8 rounded-full border-2 border-[#d2281e] border-t-transparent animate-spin" />
        <span className="text-xs text-zinc-400">Loading your profile...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090a0f] text-slate-900 dark:text-zinc-100 flex flex-col selection:bg-[#d2281e] selection:text-white antialiased transition-colors duration-200 relative overflow-x-hidden">
      
      {/* Ambient background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[450px] pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-150px] left-1/2 -translate-x-1/2 w-[600px] sm:w-[900px] h-[350px] bg-gradient-to-b from-[#d2281e]/10 via-[#d2281e]/5 to-transparent rounded-full blur-3xl dark:from-[#d2281e]/15 dark:via-[#d2281e]/5" />
      </div>

      {/* ===================================================================== */}
      {/* NAVBAR                                                                */}
      {/* ===================================================================== */}
      <nav className="h-16 border-b border-slate-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-[#0c0d14]/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 flex items-center justify-between transition-colors duration-200">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition group py-1.5 px-3 rounded-xl bg-slate-100/70 hover:bg-slate-200/70 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/5"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-slate-500 dark:text-zinc-400" />
            <span>Dashboard</span>
          </Link>
          <div className="h-4 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-gradient-to-br from-[#d2281e] to-[#ba1f16] rounded-xl text-white shadow-md shadow-[#d2281e]/25">
              <Film className="w-4 h-4 fill-current" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-0.5">
                Watch<span className="text-[#d2281e] text-lg leading-none">.</span>
              </span>
              <span className="text-[7.5px] font-extrabold text-slate-400 dark:text-zinc-400 tracking-widest uppercase mt-0.5">
                Powered by StitchByte
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* 1-Click Theme Switcher (Sun / Moon) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-zinc-200 transition shadow-sm active:scale-95"
            title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme mode"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform duration-300" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600 hover:-rotate-12 transition-transform duration-300" />
            )}
          </button>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:border-red-500/40 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 bg-white dark:bg-transparent hover:bg-red-50/70 dark:hover:bg-red-500/10 transition shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* ===================================================================== */}
      {/* MAIN CONTAINER                                                        */}
      {/* ===================================================================== */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 space-y-6 relative z-10">
        
        {/* HERO PROFILE CARD */}
        <div className="relative rounded-3xl bg-white dark:bg-[#11121c] border border-slate-200/90 dark:border-white/[0.08] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.05)] dark:shadow-2xl dark:shadow-black/70 overflow-hidden transition-all duration-200">
          
          {/* Subtle Top Decorative Banner */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#d2281e] via-amber-500 to-[#d2281e]" />

          {/* Ambient Glow Bubbles */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-[#d2281e]/10 dark:bg-[#d2281e]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-amber-500/10 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            
            {/* 3D Standing Character Stage */}
            <div className="relative group shrink-0">
              <div className="relative w-28 h-36 sm:w-32 sm:h-40 rounded-3xl overflow-hidden bg-gradient-to-b from-rose-50/80 via-slate-100 to-slate-200/80 dark:from-[#1d1b28] dark:via-[#13131b] dark:to-black border-2 border-[#d2281e]/40 dark:border-[#d2281e]/60 shadow-xl shadow-slate-200/70 dark:shadow-2xl dark:shadow-black/80 flex flex-col items-center justify-end">
                {/* Backlight halo */}
                <div className="absolute top-2 inset-x-0 h-20 bg-[#d2281e]/15 dark:bg-[#d2281e]/30 blur-xl rounded-full pointer-events-none" />
                
                <img
                  src={
                    session.user.avatarUrl
                      ? session.user.avatarUrl.replace(/[?&]radius=[^&]+/g, '').replace(/[?&]backgroundColor=[^&]+/g, '')
                      : '/avatars/standing_heart_transparent@2x.png'
                  }
                  alt={session.user.displayName || 'Persona'}
                  className="w-full h-full object-cover object-bottom transition-transform duration-300 group-hover:scale-105 select-none"
                />

                {/* Pedestal stage bar */}
                <div className="relative z-10 w-full h-3 bg-gradient-to-r from-slate-200 via-[#d2281e] to-slate-200 dark:from-zinc-900 dark:via-[#d2281e] dark:to-zinc-900 border-t border-[#d2281e] shadow-[0_0_12px_rgba(210,40,30,0.6)] flex items-center justify-center">
                  <div className="w-12 h-0.5 bg-white/90 rounded-full shadow-sm" />
                </div>
              </div>
              
              {/* Quick Customize Persona Badge */}
              <button
                type="button"
                onClick={() => setActiveTab('avatar')}
                className="absolute -bottom-2 -right-2 p-2.5 bg-[#d2281e] hover:bg-[#b82017] text-white rounded-2xl shadow-lg shadow-[#d2281e]/30 active:scale-95 transition-all flex items-center justify-center border-2 border-white dark:border-[#11121c] group-hover:scale-110"
                title="Customize Standing Persona"
                aria-label="Customize Standing Persona"
              >
                <Scissors className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Info & Partner Code */}
            <div className="flex-1 space-y-3.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {session.user.displayName || 'Watch Member'}
                </h1>
                
                {/* Cinema VIP Badge */}
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-purple-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-black tracking-wide flex items-center gap-1.5 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>Cinema VIP</span>
                </span>

                {session.user.isMarried && (
                  <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                    <span>💍</span>
                    <span>Married</span>
                  </span>
                )}
              </div>

              {/* Meta information chips */}
              <div className="text-xs text-slate-600 dark:text-zinc-400 flex flex-wrap items-center justify-center sm:justify-start gap-2 font-medium">
                {session.user.email && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200/60 dark:border-white/5">
                    <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                    <span>{session.user.email}</span>
                  </span>
                )}
                {session.user.age && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200/60 dark:border-white/5">
                    <span>🎂</span>
                    <span className="font-semibold text-slate-700 dark:text-zinc-300">{session.user.age} years old</span>
                  </span>
                )}
                {anniversaryDuration && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 font-bold">
                    <span>🥂</span>
                    <span>{anniversaryDuration}</span>
                  </span>
                )}
              </div>

              {/* Partner Pairing Code Box */}
              {session.user.partnerCode && (
                <div className="pt-1">
                  <div className="inline-flex flex-col sm:flex-row items-center gap-2 p-2 sm:p-2.5 px-3.5 sm:px-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 shadow-sm">
                    <span className="text-[11px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#d2281e]" />
                      <span>Partner Code:</span>
                    </span>
                    <span className="font-mono text-sm font-black text-slate-900 dark:text-white tracking-widest px-3 py-1 rounded-xl bg-white dark:bg-black/60 border border-slate-200 dark:border-white/10 shadow-inner">
                      {session.user.partnerCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPartnerCode}
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl bg-[#d2281e]/10 hover:bg-[#d2281e] text-[#d2281e] hover:text-white transition active:scale-95"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500 group-hover:text-white" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1.5">
                    Share this code with your partner to pair rooms, synchronize watch parties, and celebrate anniversaries together.
                  </p>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* TABS NAVIGATION                                                       */}
        {/* ===================================================================== */}
        <div className="flex rounded-2xl bg-slate-200/70 dark:bg-[#141520] p-1.5 border border-slate-300/60 dark:border-white/[0.08] text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition duration-150 ${
              activeTab === 'details'
                ? 'bg-white dark:bg-[#1e1f2b] text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-white/10'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4 text-[#d2281e]" />
            <span>Personal Details & Milestones</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('avatar')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition duration-150 ${
              activeTab === 'avatar'
                ? 'bg-white dark:bg-[#1e1f2b] text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-white/10'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#d2281e]" />
            <span>Bitmoji Avatar Studio</span>
          </button>
        </div>

        {/* FEEDBACK BANNERS */}
        {saveSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-2.5 animate-in fade-in shadow-sm">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-xs font-bold flex items-center gap-2.5 animate-in fade-in shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-[#d2281e]" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 1: PERSONAL DETAILS & MILESTONES                                  */}
        {/* ===================================================================== */}
        {activeTab === 'details' && (
          <div className="rounded-3xl bg-white dark:bg-[#11121c] border border-slate-200/90 dark:border-white/[0.08] p-6 sm:p-8 space-y-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] dark:shadow-2xl transition-all duration-200">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Edit Profile & Celebrations</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Keep your information fresh for party reminders, birthday alerts, and synced romantic lighting.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
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
                    className="w-full pl-10 pr-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm font-medium focus:bg-white dark:focus:bg-black/60 focus:outline-none focus:border-[#d2281e] focus:ring-4 focus:ring-[#d2281e]/10 dark:focus:ring-[#d2281e]/20 transition shadow-inner"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              {/* Date of Birth & Auto Age */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#d2281e]" />
                    <span>Date of Birth</span>
                  </label>
                  {calculatedAge !== null && (
                    <span className="text-[11px] font-black px-3 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 shadow-sm">
                      <span>🎂</span> {calculatedAge} years old
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm font-medium focus:bg-white dark:focus:bg-black/60 focus:outline-none focus:border-[#d2281e] focus:ring-4 focus:ring-[#d2281e]/10 dark:focus:ring-[#d2281e]/20 transition shadow-inner"
                />
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1.5">
                  We use your birthdate to trigger special birthday celebrations and confetti in your watch rooms.
                </p>
              </div>

              {/* Marital / Relationship Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Relationship Status
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setIsMarried(false); setAnniversaryDate(''); }}
                    className={`py-3.5 px-4 rounded-2xl text-xs font-bold border transition duration-150 flex items-center justify-center gap-2 ${
                      !isMarried
                        ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white border-[#d2281e] ring-2 ring-[#d2281e]/20 shadow-sm'
                        : 'bg-slate-50 dark:bg-black/30 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <span>Single / Not Married</span>
                    {!isMarried && <Check className="w-3.5 h-3.5 text-[#d2281e]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMarried(true)}
                    className={`py-3.5 px-4 rounded-2xl text-xs font-bold border transition duration-150 flex items-center justify-center gap-2 ${
                      isMarried
                        ? 'bg-gradient-to-r from-[#d2281e] to-[#e63946] text-white border-[#d2281e] shadow-md shadow-[#d2281e]/25'
                        : 'bg-slate-50 dark:bg-black/30 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <span>💍 Yes, Married</span>
                    {isMarried && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                </div>
              </div>

              {/* Anniversary Date (If Married) */}
              {isMarried && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-50/90 to-red-50/50 dark:from-rose-950/20 dark:to-red-950/20 border border-rose-200 dark:border-[#d2281e]/30 space-y-3 animate-in fade-in shadow-sm">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 fill-current text-[#d2281e]" />
                      <span>Wedding / Couple Anniversary Date</span>
                    </label>
                    {anniversaryDuration && (
                      <span className="text-[11px] font-black text-rose-700 dark:text-rose-300 bg-white/80 dark:bg-black/40 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-500/30">
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
                    className="w-full px-3.5 py-3 rounded-2xl bg-white dark:bg-black/60 border border-rose-200 dark:border-red-500/30 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:border-[#d2281e] focus:ring-4 focus:ring-[#d2281e]/20 transition shadow-inner"
                  />
                  <p className="text-[11px] text-rose-700/80 dark:text-zinc-400 leading-relaxed">
                    🥂 Every year on your anniversary, Watch lights up a synchronized couple countdown with special romantic cinema themes!
                  </p>
                </div>
              )}

              {/* Save Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#d2281e] to-[#e63946] hover:from-[#ba1f16] hover:to-[#d2281e] disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-[#d2281e]/30 hover:shadow-xl hover:shadow-[#d2281e]/40 transition duration-200 transform hover:-translate-y-0.5 active:scale-[0.99] flex items-center justify-center gap-2"
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

        {/* ===================================================================== */}
        {/* TAB 2: BITMOJI AVATAR STUDIO                                          */}
        {/* ===================================================================== */}
        {activeTab === 'avatar' && (
          <div className="rounded-3xl bg-white dark:bg-[#11121c] border border-slate-200/90 dark:border-white/[0.08] p-6 sm:p-8 space-y-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] dark:shadow-2xl transition-all duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Customize Your Persona</h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Personalize your Bitmoji look anytime. Your new avatar will instantly show on your dashboard and party rooms.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveAvatarOnly}
                disabled={saving}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#d2281e] to-[#e63946] hover:from-[#ba1f16] hover:to-[#d2281e] text-white font-bold text-xs shadow-md shadow-[#d2281e]/30 transition active:scale-95 shrink-0"
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

            {/* Studio Component Container */}
            <div className="p-4 sm:p-6 rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 shadow-inner">
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
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#d2281e] to-[#e63946] hover:from-[#ba1f16] hover:to-[#d2281e] disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-[#d2281e]/30 hover:shadow-xl hover:shadow-[#d2281e]/40 transition duration-200 transform hover:-translate-y-0.5 active:scale-[0.99] flex items-center justify-center gap-2"
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

        {/* QUICK NAVIGATION CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
          <Link
            href="/dashboard"
            className="p-4 rounded-2xl bg-white dark:bg-[#11121c] hover:bg-slate-50 dark:hover:bg-[#161724] border border-slate-200/90 dark:border-white/[0.08] hover:border-[#d2281e]/40 flex items-center gap-3.5 transition group shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="p-2.5 rounded-xl bg-[#d2281e]/10 text-[#d2281e] group-hover:scale-110 transition-transform">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#d2281e] transition">Cinema Lounge</div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">Stream YouTube & Movies</div>
            </div>
          </Link>

          <Link
            href="/games"
            className="p-4 rounded-2xl bg-white dark:bg-[#11121c] hover:bg-slate-50 dark:hover:bg-[#161724] border border-slate-200/90 dark:border-white/[0.08] hover:border-purple-500/40 flex items-center gap-3.5 transition group shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition">Game Arcade</div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">Ludo 3D & Connect 4</div>
            </div>
          </Link>

          <div
            onClick={handleCopyPartnerCode}
            className="p-4 rounded-2xl bg-white dark:bg-[#11121c] hover:bg-slate-50 dark:hover:bg-[#161724] border border-slate-200/90 dark:border-white/[0.08] hover:border-amber-500/40 flex items-center gap-3.5 transition group cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition">Pair with Partner</div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                {copiedCode ? 'Code copied to clipboard!' : `Code: ${session.user.partnerCode || 'Copy'}`}
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="py-6 text-center text-xs text-slate-400 dark:text-zinc-500 border-t border-slate-200/60 dark:border-white/[0.06] mt-12 relative z-10">
        <span>© {new Date().getFullYear()} Watch · Powered by StitchByte · 100% Free & Private</span>
      </footer>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#d2281e] border-t-transparent animate-spin" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
