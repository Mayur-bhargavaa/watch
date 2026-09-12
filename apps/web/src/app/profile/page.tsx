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
  Moon,
  Crown,
  Award,
  Zap,
  Volume2,
  Shield,
  Palette
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
  const { theme, resolvedTheme, toggleTheme, setTheme } = useTheme();
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'details' | 'partner' | 'avatar' | 'preferences'>('details');

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

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090a0f] flex flex-col items-center justify-center space-y-4 text-slate-900 dark:text-white">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-slate-200 dark:border-white/10 border-t-[#d2281e] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Film className="w-5 h-5 text-[#d2281e]" />
          </div>
        </div>
        <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider uppercase">
          Loading VIP Profile...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090a0f] text-slate-900 dark:text-zinc-100 flex flex-col selection:bg-[#d2281e] selection:text-white antialiased transition-colors duration-200 relative overflow-x-hidden">
      
      {/* Background Ambient Lighting */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-180px] left-1/2 -translate-x-1/2 w-[700px] sm:w-[1000px] h-[380px] bg-gradient-to-b from-[#d2281e]/15 via-[#d2281e]/5 to-transparent rounded-full blur-3xl dark:from-[#d2281e]/20 dark:via-[#d2281e]/5" />
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
          {/* Quick Sun / Moon Theme Switcher */}
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
      {/* MAIN PROFILE WRAPPER                                                  */}
      {/* ===================================================================== */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 relative z-10">
        
        {/* ===================================================================== */}
        {/* 1. CINEMATIC COVER BANNER & HERO IDENTITY                             */}
        {/* ===================================================================== */}
        <div className="relative rounded-3xl bg-white dark:bg-[#11121c] border border-slate-200/90 dark:border-white/[0.08] shadow-[0_12px_40px_rgb(0,0,0,0.06)] dark:shadow-2xl dark:shadow-black/70 overflow-hidden transition-all duration-200">
          
          {/* Panoramic Cinema Header Banner */}
          <div className="relative h-44 sm:h-52 w-full bg-gradient-to-r from-[#5a0904] via-[#a81c13] to-[#2b080f] dark:from-[#380503] dark:via-[#1f090d] dark:to-[#0d0914] overflow-hidden">
            {/* Ambient Radial Spotlights */}
            <div className="absolute top-0 right-10 w-96 h-96 bg-[#d2281e]/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 left-1/3 w-80 h-80 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(255,255,255,0.08)_0%,transparent_70%)] pointer-events-none" />

            {/* Cinema VIP Pass Ribbon */}
            <div className="absolute top-4 right-4 sm:top-5 sm:right-6 flex items-center gap-2">
              <span className="px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg">
                <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Cinema VIP Pass</span>
              </span>
            </div>

            {/* Bottom film strip hairline */}
            <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#d2281e] to-transparent opacity-80" />
          </div>

          {/* Hero Profile Body Overlapping Header */}
          <div className="relative px-6 sm:px-8 pb-8 pt-0">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-20 sm:-mt-24 mb-4 text-center sm:text-left">
              
              {/* 3D Standing Persona Stage */}
              <div className="relative group shrink-0">
                <div className="relative w-32 h-44 sm:w-36 sm:h-48 rounded-3xl overflow-hidden bg-gradient-to-b from-rose-50/90 via-slate-100 to-slate-200/90 dark:from-[#1e1c28] dark:via-[#13121b] dark:to-black border-4 border-white dark:border-[#11121c] shadow-2xl shadow-slate-400/50 dark:shadow-black/90 flex flex-col items-center justify-end">
                  {/* Glowing backlight halo */}
                  <div className="absolute top-2 inset-x-0 h-24 bg-[#d2281e]/20 dark:bg-[#d2281e]/35 blur-xl rounded-full pointer-events-none" />
                  
                  <img
                    src={
                      session.user.avatarUrl
                        ? session.user.avatarUrl.replace(/[?&]radius=[^&]+/g, '').replace(/[?&]backgroundColor=[^&]+/g, '')
                        : '/avatars/standing_heart_transparent@2x.png'
                    }
                    alt={session.user.displayName || 'Persona'}
                    className="w-full h-full object-cover object-bottom transition-transform duration-300 group-hover:scale-105 select-none"
                  />

                  {/* VIP Pedestal Bar */}
                  <div className="relative z-10 w-full h-3.5 bg-gradient-to-r from-slate-200 via-[#d2281e] to-slate-200 dark:from-zinc-900 dark:via-[#d2281e] dark:to-zinc-900 border-t border-[#d2281e] shadow-[0_0_12px_rgba(210,40,30,0.7)] flex items-center justify-center">
                    <div className="w-14 h-0.5 bg-white rounded-full shadow-sm" />
                  </div>
                </div>

                {/* Floating Edit Persona Button */}
                <button
                  type="button"
                  onClick={() => setActiveTab('avatar')}
                  className="absolute -bottom-1 -right-1 p-2.5 bg-[#d2281e] hover:bg-[#b82017] text-white rounded-2xl shadow-xl shadow-[#d2281e]/40 active:scale-95 transition-all flex items-center justify-center border-2 border-white dark:border-[#11121c] group-hover:scale-110"
                  title="Customize Avatar Persona"
                  aria-label="Customize Avatar Persona"
                >
                  <Scissors className="w-4 h-4" />
                </button>
              </div>

              {/* Identity & Badges */}
              <div className="flex-1 space-y-2.5 pt-2 sm:pt-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span>{session.user.displayName || 'Watch Member'}</span>
                    <ShieldCheck className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
                  </h1>
                  
                  {/* VIP Badge */}
                  <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-purple-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-black tracking-wide flex items-center gap-1.5 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Cinema VIP Level 1</span>
                  </span>

                  {/* Married Status Badge */}
                  {session.user.isMarried && (
                    <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                      <span>💍</span>
                      <span>Married</span>
                    </span>
                  )}
                </div>

                {/* Metadata tags */}
                <div className="text-xs text-slate-600 dark:text-zinc-400 flex flex-wrap items-center justify-center sm:justify-start gap-2 font-medium">
                  {session.user.email && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200/70 dark:border-white/5">
                      <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                      <span>{session.user.email}</span>
                    </span>
                  )}
                  {session.user.age && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200/70 dark:border-white/5">
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
              </div>

              {/* Quick Partner Box on Desktop */}
              {session.user.partnerCode && (
                <div className="shrink-0 flex flex-col items-center sm:items-end">
                  <div className="inline-flex items-center gap-2 p-2 px-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/90 dark:border-white/10 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-wider">
                      Partner Code
                    </span>
                    <span className="font-mono text-xs font-black text-slate-900 dark:text-white tracking-widest px-2.5 py-1 rounded-lg bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10">
                      {session.user.partnerCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPartnerCode}
                      className="p-1.5 rounded-lg bg-[#d2281e]/10 hover:bg-[#d2281e] text-[#d2281e] hover:text-white transition active:scale-95"
                      title="Copy Partner Code"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 2. VIP METRICS & STATS STRIP                                          */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          {/* Card 1: VIP Tier */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#11121c] border border-slate-200/80 dark:border-white/[0.08] shadow-sm flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10.5px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Tier Status</div>
              <div className="text-sm font-black text-slate-900 dark:text-white">Cinema VIP</div>
            </div>
          </div>

          {/* Card 2: Partner Room Code */}
          <div
            onClick={handleCopyPartnerCode}
            className="p-4 rounded-2xl bg-white dark:bg-[#11121c] border border-slate-200/80 dark:border-white/[0.08] shadow-sm flex items-center gap-3 cursor-pointer hover:border-[#d2281e]/40 transition group"
          >
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <span>Partner Code</span>
                {copiedCode && <span className="text-emerald-500 text-[9px] font-black">Copied!</span>}
              </div>
              <div className="text-sm font-mono font-black text-slate-900 dark:text-white truncate">
                {session.user.partnerCode || 'Generate'}
              </div>
            </div>
          </div>

          {/* Card 3: Milestone / Age */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#11121c] border border-slate-200/80 dark:border-white/[0.08] shadow-sm flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10.5px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Celebration</div>
              <div className="text-sm font-black text-slate-900 dark:text-white">
                {calculatedAge ? `${calculatedAge} Yrs Old` : 'Set Birthday'}
              </div>
            </div>
          </div>

          {/* Card 4: Party Role */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#11121c] border border-slate-200/80 dark:border-white/[0.08] shadow-sm flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10.5px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Party Role</div>
              <div className="text-sm font-black text-slate-900 dark:text-white">Host & Director</div>
            </div>
          </div>

        </div>

        {/* ===================================================================== */}
        {/* 3. SEGMENTED TABS NAVIGATION BAR                                      */}
        {/* ===================================================================== */}
        <div className="flex rounded-2xl bg-slate-200/70 dark:bg-[#141520] p-1.5 border border-slate-300/60 dark:border-white/[0.08] text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition duration-150 shrink-0 ${
              activeTab === 'details'
                ? 'bg-white dark:bg-[#1e1f2b] text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-white/10'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-4 h-4 text-[#d2281e]" />
            <span>Personal Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('partner')}
            className={`flex-1 py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition duration-150 shrink-0 ${
              activeTab === 'partner'
                ? 'bg-white dark:bg-[#1e1f2b] text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-white/10'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Heart className="w-4 h-4 text-[#d2281e]" />
            <span>Couple & Partner Room</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('avatar')}
            className={`flex-1 py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition duration-150 shrink-0 ${
              activeTab === 'avatar'
                ? 'bg-white dark:bg-[#1e1f2b] text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-white/10'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#d2281e]" />
            <span>3D Avatar Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preferences')}
            className={`flex-1 py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition duration-150 shrink-0 ${
              activeTab === 'preferences'
                ? 'bg-white dark:bg-[#1e1f2b] text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-white/10'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4 text-[#d2281e]" />
            <span>Theme & Settings</span>
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
        {/* TAB 1: PERSONAL DETAILS & CELEBRATIONS                                */}
        {/* ===================================================================== */}
        {activeTab === 'details' && (
          <div className="rounded-3xl bg-white dark:bg-[#11121c] border border-slate-200/90 dark:border-white/[0.08] p-6 sm:p-8 space-y-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] dark:shadow-2xl transition-all duration-200">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <User className="w-5 h-5 text-[#d2281e]" />
                <span>Personal Identity & Celebrations</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Keep your information updated for birthday confetti, watch party invites, and personalized room controls.
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
        {/* TAB 2: COUPLE & PARTNER ROOM                                          */}
        {/* ===================================================================== */}
        {activeTab === 'partner' && (
          <div className="rounded-3xl bg-white dark:bg-[#11121c] border border-slate-200/90 dark:border-white/[0.08] p-6 sm:p-8 space-y-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] dark:shadow-2xl transition-all duration-200">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <Heart className="w-5 h-5 text-[#d2281e] fill-current" />
                <span>Couple & Partner Room Hub</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Link with your romantic partner to automatically sync couple reactions, anniversary countdowns, and private duo rooms.
              </p>
            </div>

            {/* Partner Code Share Card */}
            {session.user.partnerCode && (
              <div className="p-5 rounded-3xl bg-gradient-to-br from-rose-50 via-white to-red-50/40 dark:from-rose-950/20 dark:via-[#141520] dark:to-red-950/20 border border-rose-200/90 dark:border-[#d2281e]/30 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-black text-[#d2281e] uppercase tracking-wider">
                      Your Unique Partner Code
                    </span>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                      Share this code with your partner to connect your accounts.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-slate-900 dark:text-white tracking-widest px-4 py-2 rounded-xl bg-white dark:bg-black/60 border border-rose-200 dark:border-white/10 shadow-inner">
                      {session.user.partnerCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPartnerCode}
                      className="px-4 py-2 rounded-xl bg-[#d2281e] hover:bg-[#b82017] text-white text-xs font-bold transition shadow-md shadow-[#d2281e]/30 active:scale-95 flex items-center gap-1.5"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedCode ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-6">
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
                      <span>Save Partner Settings</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 3: BITMOJI AVATAR STUDIO                                          */}
        {/* ===================================================================== */}
        {activeTab === 'avatar' && (
          <div className="rounded-3xl bg-white dark:bg-[#11121c] border border-slate-200/90 dark:border-white/[0.08] p-6 sm:p-8 space-y-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] dark:shadow-2xl transition-all duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#d2281e]" />
                  <span>Customize Your 3D Persona</span>
                </h2>
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

        {/* ===================================================================== */}
        {/* TAB 4: THEME & PREFERENCES                                            */}
        {/* ===================================================================== */}
        {activeTab === 'preferences' && (
          <div className="rounded-3xl bg-white dark:bg-[#11121c] border border-slate-200/90 dark:border-white/[0.08] p-6 sm:p-8 space-y-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] dark:shadow-2xl transition-all duration-200">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#d2281e]" />
                <span>Theme & Experience Preferences</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Customize your visual display mode and party settings.
              </p>
            </div>

            {/* Theme Selector Cards */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                Display Theme
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Light Mode Tile */}
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`p-4 rounded-2xl border text-left transition relative flex flex-col gap-2 ${
                    theme === 'light'
                      ? 'bg-slate-50 border-[#d2281e] ring-2 ring-[#d2281e]/20 shadow-md'
                      : 'bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Sun className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white">White / Light Mode</div>
                    <div className="text-[10.5px] text-slate-500 dark:text-zinc-400">Crisp white canvas & red accents</div>
                  </div>
                  {theme === 'light' && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#d2281e] text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>

                {/* Dark Mode Tile */}
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`p-4 rounded-2xl border text-left transition relative flex flex-col gap-2 ${
                    theme === 'dark'
                      ? 'bg-slate-900 border-[#d2281e] ring-2 ring-[#d2281e]/20 shadow-md text-white'
                      : 'bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <Moon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white">Obsidian / Dark Mode</div>
                    <div className="text-[10.5px] text-slate-500 dark:text-zinc-400">Cinematic velvet & glowing red</div>
                  </div>
                  {theme === 'dark' && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#d2281e] text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>

                {/* System Mode Tile */}
                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  className={`p-4 rounded-2xl border text-left transition relative flex flex-col gap-2 ${
                    theme === 'system'
                      ? 'bg-slate-100 dark:bg-white/10 border-[#d2281e] ring-2 ring-[#d2281e]/20 shadow-md'
                      : 'bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Tv className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white">System Sync</div>
                    <div className="text-[10.5px] text-slate-500 dark:text-zinc-400">Matches your OS setting automatically</div>
                  </div>
                  {theme === 'system' && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#d2281e] text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Party Features Info */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 space-y-2">
              <div className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>100% Free & Private Rooms</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                Watch parties never require an account subscription. All streaming is peer-to-peer and synchronized via real-time WebSocket signals.
              </p>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 4. QUICK NAVIGATION CARDS                                             */}
        {/* ===================================================================== */}
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
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#d2281e] border-t-transparent animate-spin" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
