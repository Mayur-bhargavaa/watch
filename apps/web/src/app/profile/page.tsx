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
  Gamepad2
} from 'lucide-react';
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
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex flex-col selection:bg-[#d2281e] selection:text-white antialiased">
      
      {/* ===================================================================== */}
      {/* NAVBAR                                                                */}
      {/* ===================================================================== */}
      <nav className="h-16 border-b border-white/[0.08] bg-[#0c0d14]/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition group py-1.5 px-2.5 rounded-xl hover:bg-white/5"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="h-4 w-px bg-white/10 hidden sm:block" />
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-[#d2281e] rounded-xl text-white shadow-lg shadow-[#d2281e]/30">
              <Film className="w-4 h-4 fill-current" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-black tracking-tight text-white flex items-center gap-0.5">
                Watch<span className="text-[#d2281e] text-lg leading-none">.</span>
              </span>
              <span className="text-[7.5px] font-bold text-zinc-400 tracking-widest uppercase mt-0.5">
                Powered by StitchByte
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-red-500/40 text-xs font-bold text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* ===================================================================== */}
      {/* MAIN CONTAINER                                                        */}
      {/* ===================================================================== */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 space-y-6">
        
        {/* HERO PROFILE CARD */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#141520] to-[#0e0f17] border border-white/[0.08] p-6 sm:p-8 shadow-2xl overflow-hidden">
          
          {/* Ambient Red Glow */}
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-[#d2281e]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-[#d2281e]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            
            {/* 3D Standing Character Booth & Quick Edit Button */}
            <div className="relative group shrink-0">
              <div className="relative w-28 h-36 sm:w-32 sm:h-40 rounded-t-3xl rounded-b-xl overflow-hidden bg-gradient-to-b from-zinc-900/90 via-black to-zinc-950 border-2 border-[#d2281e]/60 shadow-2xl shadow-black/80 flex flex-col items-center justify-end">
                {/* Backlight glow */}
                <div className="absolute top-2 inset-x-0 h-20 bg-[#d2281e]/25 blur-xl rounded-full pointer-events-none" />
                
                <img
                  src={
                    session.user.avatarUrl
                      ? session.user.avatarUrl.replace('radius=50', 'radius=0')
                      : '/avatars/standing_heart.png'
                  }
                  alt={session.user.displayName || 'Persona'}
                  className="w-full h-full object-cover object-bottom transition-transform duration-300 group-hover:scale-105"
                />

                {/* Counter ledge matching reference image */}
                <div className="relative z-10 w-full h-3 bg-gradient-to-r from-zinc-900 via-[#d2281e] to-zinc-900 border-t border-[#d2281e] shadow-[0_0_12px_rgba(210,40,30,0.8)] flex items-center justify-center">
                  <div className="w-12 h-0.5 bg-white/70 rounded-full" />
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => setActiveTab('avatar')}
                className="absolute -bottom-2 -right-2 p-2.5 bg-[#d2281e] text-white rounded-xl shadow-lg hover:bg-[#b82017] active:scale-95 transition-all flex items-center justify-center border border-white/20"
                title="Customize Standing Persona"
              >
                <Scissors className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Info & Partner Code */}
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {session.user.displayName || 'Watch Member'}
                </h1>
                {session.user.isMarried && (
                  <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1">
                    <span>💍</span> Married
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs font-semibold">
                  Cinema VIP
                </span>
              </div>

              <div className="text-xs text-zinc-400 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 font-medium">
                {session.user.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-zinc-500" />
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
                  <span className="flex items-center gap-1 text-red-300 font-bold">
                    <span>🥂</span>
                    <span>{anniversaryDuration}</span>
                  </span>
                )}
              </div>

              {/* Unique Partner Pairing Code Box */}
              {session.user.partnerCode && (
                <div className="pt-2">
                  <div className="inline-flex flex-col sm:flex-row items-center gap-2 p-2.5 px-4 rounded-2xl bg-white/[0.04] border border-white/10">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      Partner Code:
                    </span>
                    <span className="font-mono text-sm font-black text-white tracking-widest px-2 py-0.5 rounded-lg bg-black/40 border border-white/10">
                      {session.user.partnerCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPartnerCode}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#d2281e] hover:text-red-400 transition ml-1"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Share this code with your partner to pair your rooms and celebrate together.
                  </p>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* TABS NAVIGATION                                                       */}
        {/* ===================================================================== */}
        <div className="flex rounded-2xl bg-[#141520] p-1 border border-white/[0.08] text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition ${
              activeTab === 'details'
                ? 'bg-white text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4 text-[#d2281e]" />
            <span>Personal Details & Milestones</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('avatar')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition ${
              activeTab === 'avatar'
                ? 'bg-white text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#d2281e]" />
            <span>Bitmoji Avatar Studio</span>
          </button>
        </div>

        {/* FEEDBACK BANNERS */}
        {saveSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <span className="w-2 h-2 rounded-full bg-[#d2281e]" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 1: PERSONAL DETAILS & MILESTONES                                  */}
        {/* ===================================================================== */}
        {activeTab === 'details' && (
          <div className="rounded-3xl bg-[#141520] border border-white/[0.08] p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Edit Profile & Celebrations</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Keep your information fresh for party reminders, birthday alerts, and synced romantic lighting.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Display Name */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                  Display Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={30}
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-black/40 border border-white/10 text-white text-sm font-medium focus:outline-none focus:border-[#d2281e] transition"
                  />
                </div>
              </div>

              {/* Date of Birth & Auto Age */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#d2281e]" />
                    <span>Date of Birth</span>
                  </label>
                  {calculatedAge !== null && (
                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                      <span>🎂</span> {calculatedAge} years old
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3.5 py-3 rounded-xl bg-black/40 border border-white/10 text-white text-sm font-medium focus:outline-none focus:border-[#d2281e] transition"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  We use your birthdate to trigger special birthday surprises in your watch rooms.
                </p>
              </div>

              {/* Marital / Relationship Status */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                  Are you married?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setIsMarried(false); setAnniversaryDate(''); }}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition ${
                      !isMarried
                        ? 'bg-white text-zinc-950 border-white shadow-md'
                        : 'bg-black/30 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Single / Not Married
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMarried(true)}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      isMarried
                        ? 'bg-[#d2281e] text-white border-[#d2281e] shadow-lg shadow-[#d2281e]/30'
                        : 'bg-black/30 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>💍 Yes, Married</span>
                  </button>
                </div>
              </div>

              {/* Anniversary Date (If Married) */}
              {isMarried && (
                <div className="p-4 rounded-2xl bg-red-950/20 border border-[#d2281e]/30 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-red-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 fill-current text-[#d2281e]" />
                      <span>Wedding / Couple Anniversary Date</span>
                    </label>
                    {anniversaryDuration && (
                      <span className="text-[11px] font-black text-red-300">
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
                    className="w-full px-3.5 py-3 rounded-xl bg-black/60 border border-red-500/30 text-white text-sm font-medium focus:outline-none focus:border-[#d2281e] transition"
                  />
                  <p className="text-[11px] text-zinc-400">
                    🥂 Every year on your anniversary, Watch lights up a synchronized couple countdown with special romantic cinema themes!
                  </p>
                </div>
              )}

              {/* Save Button in pure #d2281e */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 px-5 rounded-xl bg-[#d2281e] hover:bg-[#b82017] disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-[#d2281e]/30 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
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
          <div className="rounded-3xl bg-[#141520] border border-white/[0.08] p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">Customize Your Persona</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Personalize your Bitmoji look anytime. Your new avatar will instantly show on your dashboard and party rooms.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveAvatarOnly}
                disabled={saving}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#d2281e] hover:bg-[#b82017] text-white font-bold text-xs shadow-md shadow-[#d2281e]/30 transition active:scale-95 shrink-0"
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

            {/* Studio Component (Clean white inner container for avatar previews) */}
            <div className="p-4 sm:p-6 rounded-2xl bg-white text-zinc-900 shadow-inner">
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
                className="w-full py-3.5 px-5 rounded-xl bg-[#d2281e] hover:bg-[#b82017] disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-[#d2281e]/30 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <Link
            href="/dashboard"
            className="p-4 rounded-2xl bg-[#141520] hover:bg-[#1a1b28] border border-white/[0.08] flex items-center gap-3 transition group"
          >
            <div className="p-2.5 rounded-xl bg-[#d2281e]/10 text-[#d2281e] group-hover:scale-105 transition-transform">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-[#d2281e] transition">Cinema Lounge</div>
              <div className="text-[10px] text-zinc-400">Stream YouTube & Movies</div>
            </div>
          </Link>

          <Link
            href="/games"
            className="p-4 rounded-2xl bg-[#141520] hover:bg-[#1a1b28] border border-white/[0.08] flex items-center gap-3 transition group"
          >
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-105 transition-transform">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-purple-300 transition">Game Arcade</div>
              <div className="text-[10px] text-zinc-400">Ludo 3D & Connect 4</div>
            </div>
          </Link>

          <div
            onClick={handleCopyPartnerCode}
            className="p-4 rounded-2xl bg-[#141520] hover:bg-[#1a1b28] border border-white/[0.08] flex items-center gap-3 transition group cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white group-hover:text-amber-300 transition">Pair with Partner</div>
              <div className="text-[10px] text-zinc-400 truncate">
                {copiedCode ? 'Code copied to clipboard!' : `Code: ${session.user.partnerCode || 'Copy'}`}
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="py-6 text-center text-xs text-zinc-500 border-t border-white/[0.06] mt-12">
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
