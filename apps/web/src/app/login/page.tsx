'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Film,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Gamepad2,
  Video,
  Heart,
  ChevronLeft,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { loginUser, registerUser, getStoredSession } from '../../lib/api';
import { AvatarStudio } from '../../components/auth/AvatarStudio';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'signup' ? false : true;
  const redirectUrl = searchParams.get('redirect') || '/dashboard';

  const [isLogin, setIsLogin] = useState<boolean>(initialTab);
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);

  // Phase 1: Account credentials
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Phase 2: Personal milestones & dates
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [isMarried, setIsMarried] = useState<boolean>(false);
  const [anniversaryDate, setAnniversaryDate] = useState<string>('');

  // Phase 3: Avatar Persona
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate age automatically from Date of Birth
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

  // If already logged in, redirect immediately
  useEffect(() => {
    const existing = getStoredSession();
    if (existing && !existing.user.isAnonymous) {
      router.replace(redirectUrl);
    }
  }, [router, redirectUrl]);

  // Sync tab if URL query changes
  useEffect(() => {
    if (searchParams.get('tab') === 'signup') {
      setIsLogin(false);
      setSignupStep(1);
    } else if (searchParams.get('tab') === 'login') {
      setIsLogin(true);
    }
  }, [searchParams]);

  // Handle Step 1 validation -> Step 2
  const handleNextToStep2 = () => {
    setError(null);
    if (!displayName.trim()) {
      setError('Please enter your display name to continue.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    setSignupStep(2);
  };

  // Handle Step 2 validation -> Step 3
  const handleNextToStep3 = () => {
    setError(null);
    if (dateOfBirth && calculatedAge === null) {
      setError('Please enter a valid date of birth in the past.');
      return;
    }
    if (isMarried && !anniversaryDate) {
      setError('Please enter your wedding or partner anniversary date.');
      return;
    }
    setSignupStep(3);
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // If logging in
    if (isLogin) {
      setLoading(true);
      try {
        await loginUser(email.trim(), password, displayName.trim() || undefined);
        router.push(redirectUrl);
      } catch (err: any) {
        setError(err.message || 'Authentication failed. Please check your credentials.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // If registering on step 1 or 2, guide them forward
    if (signupStep === 1) {
      handleNextToStep2();
      return;
    }
    if (signupStep === 2) {
      handleNextToStep3();
      return;
    }

    // Step 3: Complete registration
    setLoading(true);
    try {
      await registerUser({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        avatarUrl: avatarUrl || undefined,
        dateOfBirth: dateOfBirth || undefined,
        anniversaryDate: isMarried && anniversaryDate ? anniversaryDate : undefined,
        isMarried,
        age: calculatedAge ?? undefined
      });
      router.push(redirectUrl);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col lg:flex-row w-full selection:bg-[#d2281e] selection:text-white antialiased">
      
      {/* ===================================================================== */}
      {/* LEFT COLUMN: Cinematic Brand & Value Showcase                         */}
      {/* ===================================================================== */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950 text-white p-12 flex-col justify-between relative overflow-hidden">
        
        {/* Subtle Ambient Red Glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#d2281e]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#d2281e]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center space-x-3 group">
            <div className="p-2 bg-[#d2281e] rounded-xl text-white shadow-lg shadow-[#d2281e]/30 group-hover:scale-105 transition-transform">
              <Film className="w-5 h-5 fill-current" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-2xl font-black tracking-tight text-white flex items-center gap-0.5">
                Watch<span className="text-[#d2281e] text-3xl leading-none">.</span>
              </span>
              <span className="text-[9px] font-bold text-zinc-400 tracking-widest uppercase mt-0.5">
                Powered by StitchByte
              </span>
            </div>
          </Link>
        </div>

        {/* Central Cinematic Stage */}
        <div className="relative z-10 my-auto py-8 space-y-6 max-w-lg">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d2281e]/20 border border-[#d2281e]/40 text-red-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#d2281e]" />
            <span>THE ALL-IN-ONE ENTERTAINMENT ROOM</span>
          </div>

          <h2 className="text-4xl xl:text-5xl font-black text-white tracking-tight leading-tight">
            Stream together. <br />
            <span className="text-[#d2281e]">Play together.</span> Feel closer.
          </h2>

          <p className="text-sm text-zinc-300 leading-relaxed font-normal">
            Watch YouTube in sub-15ms sync, talk on face-to-face live camera, and play real-time matches of Cottagecore Ludo 3D and Connect 4 — all in one private room.
          </p>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#d2281e] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-white">Sub-15ms Sync</div>
                <div className="text-[10px] text-zinc-400">Cristian NTP engine</div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10 flex items-start gap-2.5">
              <Gamepad2 className="w-4 h-4 text-[#d2281e] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-white">Zero Bots Duels</div>
                <div className="text-[10px] text-zinc-400">100% human matches</div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10 flex items-start gap-2.5">
              <Video className="w-4 h-4 text-[#d2281e] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-white">Live Video Calls</div>
                <div className="text-[10px] text-zinc-400">Picture-in-picture cam</div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#d2281e] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-white">100% Private</div>
                <div className="text-[10px] text-zinc-400">Invite-only rooms</div>
              </div>
            </div>
          </div>

          {/* Social Proof Quote Card */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d2281e] to-red-700 flex items-center justify-center text-white shrink-0">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div>
              <p className="text-xs text-zinc-200 italic font-medium">
                "Watch makes our 4,000-mile long distance feel like sitting on the exact same couch every evening."
              </p>
              <p className="text-[10px] text-zinc-400 mt-1 font-bold">
                — Sarah & Priya · 12,400+ parties hosted
              </p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-zinc-500 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Watch · Powered by StitchByte</span>
          <span>100% Free · Zero downloads</span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* RIGHT COLUMN: The Auth Form Card                                     */}
      {/* ===================================================================== */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-10 lg:p-14 max-w-xl mx-auto">
        
        {/* Top bar with back to home link */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-950 transition group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Watch</span>
          </Link>

          {/* Mobile Logo display */}
          <div className="lg:hidden flex items-center space-x-2">
            <div className="p-1.5 bg-[#d2281e] rounded-lg text-white">
              <Film className="w-3.5 h-3.5 fill-current" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-zinc-950 text-sm">
                Watch<span className="text-[#d2281e]">.</span>
              </span>
              <span className="text-[7.5px] font-bold text-zinc-500 uppercase">
                Powered by StitchByte
              </span>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="my-auto py-2 space-y-5">
          
          {/* Header Title & Subtitle */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              {isLogin
                ? 'Welcome back to Watch'
                : signupStep === 1
                ? 'Create your free account'
                : signupStep === 2
                ? 'Personalize your milestones'
                : 'Build your Bitmoji persona'}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1 leading-relaxed">
              {isLogin
                ? 'Sign in to access your private cinema rooms, paired partner, and games.'
                : signupStep === 1
                ? 'Step 1 of 3: Start with your basic account credentials.'
                : signupStep === 2
                ? 'Step 2 of 3: Birthday and anniversary celebrations for synchronized themes.'
                : 'Step 3 of 3: Customize your 3D/Bitmoji character persona.'}
            </p>
          </div>

          {/* Segmented Tab Switcher (Sign In vs Create Account) */}
          <div className="flex rounded-2xl bg-zinc-100 p-1 border border-zinc-200">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                isLogin
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/80'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                !isLogin
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/80'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Stepper Progress Bar for 3-Phase Signup */}
          {!isLogin && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                <span className={signupStep === 1 ? 'text-[#d2281e]' : signupStep > 1 ? 'text-zinc-800' : 'text-zinc-400'}>
                  1. Account
                </span>
                <span className="text-zinc-300">→</span>
                <span className={signupStep === 2 ? 'text-[#d2281e]' : signupStep > 2 ? 'text-zinc-800' : 'text-zinc-400'}>
                  2. About You
                </span>
                <span className="text-zinc-300">→</span>
                <span className={signupStep === 3 ? 'text-[#d2281e]' : 'text-zinc-400'}>
                  3. Bitmoji Persona
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#d2281e] transition-all duration-300"
                  style={{ width: signupStep === 1 ? '33.3%' : signupStep === 2 ? '66.6%' : '100%' }}
                />
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[#d2281e] text-xs flex items-center gap-2.5 animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-[#d2281e] shrink-0" />
              <span className="font-semibold leading-relaxed">{error}</span>
            </div>
          )}

          {/* ================================================================= */}
          {/* SIGN IN FORM                                                      */}
          {/* ================================================================= */}
          {isLogin ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@example.com"
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-zinc-50 border border-zinc-300 text-zinc-900 text-sm font-medium focus:outline-none focus:border-[#d2281e] focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-zinc-50 border border-zinc-300 text-zinc-900 text-sm font-medium focus:outline-none focus:border-[#d2281e] focus:bg-white transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-600 transition"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button in Pure #d2281e */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-5 rounded-xl bg-[#d2281e] hover:bg-[#b82017] disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-[#d2281e]/30 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* ================================================================= */
            /* 3-PHASE SIGNUP FLOW                                               */
            /* ================================================================= */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* PHASE 1: Basic Identity & Credentials */}
              {signupStep === 1 && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Display Name */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">
                      Display Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Maya"
                        className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-zinc-50 border border-zinc-300 text-zinc-900 text-sm font-medium focus:outline-none focus:border-[#d2281e] focus:bg-white transition"
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="maya@example.com"
                        className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-zinc-50 border border-zinc-300 text-zinc-900 text-sm font-medium focus:outline-none focus:border-[#d2281e] focus:bg-white transition"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full pl-10 pr-10 py-3 rounded-xl bg-zinc-50 border border-zinc-300 text-zinc-900 text-sm font-medium focus:outline-none focus:border-[#d2281e] focus:bg-white transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-600 transition"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Continue Button to Step 2 */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleNextToStep2}
                      className="w-full py-3.5 px-5 rounded-xl bg-[#d2281e] hover:bg-[#b82017] text-white font-black text-sm shadow-lg shadow-[#d2281e]/30 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
                    >
                      <span>Continue to Step 2</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* PHASE 2: Personal Milestones (DOB, Age, Marital status & Anniversary) */}
              {signupStep === 2 && (
                <div className="space-y-4 animate-in fade-in">
                  
                  {/* Date of Birth Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#d2281e]" />
                        <span>Date of Birth</span>
                      </label>
                      {calculatedAge !== null && (
                        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <span>🎂</span> {calculatedAge} years old
                        </span>
                      )}
                    </div>

                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-3.5 py-3 rounded-xl bg-zinc-50 border border-zinc-300 text-zinc-900 text-sm font-medium focus:outline-none focus:border-[#d2281e] focus:bg-white transition"
                    />
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Age is automatically calculated for party notifications & birthday themes.
                    </p>
                  </div>

                  {/* Marital / Relationship Status */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">
                      Are you married?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setIsMarried(false); setAnniversaryDate(''); }}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                          !isMarried
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                        }`}
                      >
                        Single / Not Married
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsMarried(true)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                          isMarried
                            ? 'bg-[#d2281e] text-white border-[#d2281e] shadow-md shadow-[#d2281e]/30'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                        }`}
                      >
                        <span>💍 Yes, Married</span>
                      </button>
                    </div>
                  </div>

                  {/* Anniversary Date (Conditioned on isMarried) */}
                  {isMarried && (
                    <div className="p-3.5 rounded-2xl bg-red-50/60 border border-[#d2281e]/20 space-y-2 animate-in fade-in slide-in-from-top-2">
                      <label className="text-xs font-bold text-[#d2281e] uppercase tracking-wider flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 fill-current" />
                        <span>Wedding / Couple Anniversary Date</span>
                      </label>
                      <input
                        type="date"
                        required={isMarried}
                        value={anniversaryDate}
                        onChange={(e) => setAnniversaryDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-red-200 text-zinc-900 text-sm font-medium focus:outline-none focus:border-[#d2281e] transition"
                      />
                      <p className="text-[10.5px] text-zinc-500">
                        🥂 We'll celebrate your anniversary with synchronized fireworks & romantic cinema lighting!
                      </p>
                    </div>
                  )}

                  {/* Actions in single row */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setError(null); setSignupStep(1); }}
                      className="w-1/3 py-3 px-4 rounded-xl border border-zinc-300 text-zinc-700 hover:bg-zinc-100 font-bold text-xs transition flex items-center justify-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNextToStep3}
                      className="w-2/3 py-3 px-5 rounded-xl bg-[#d2281e] hover:bg-[#b82017] text-white font-black text-xs sm:text-sm shadow-lg shadow-[#d2281e]/30 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
                    >
                      <span>Continue to Avatar Studio</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* PHASE 3: Avatar Persona Builder (Bitmoji Style) */}
              {signupStep === 3 && (
                <div className="space-y-4 animate-in fade-in">
                  <AvatarStudio
                    displayName={displayName}
                    value={avatarUrl}
                    onChange={setAvatarUrl}
                  />

                  {/* Navigation & Submit in a row */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => { setError(null); setSignupStep(2); }}
                      className="w-1/3 py-3 px-4 rounded-xl border border-zinc-300 text-zinc-700 hover:bg-zinc-100 font-bold text-xs transition flex items-center justify-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-2/3 py-3.5 px-5 rounded-xl bg-[#d2281e] hover:bg-[#b82017] disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-lg shadow-[#d2281e]/30 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>Creating Profile...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Complete & Join Watch</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </form>
          )}

          {/* Alternate Switch Link */}
          <div className="text-center pt-2 text-xs text-zinc-500">
            {isLogin ? (
              <span>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => { setIsLogin(false); setSignupStep(1); setError(null); }}
                  className="font-bold text-[#d2281e] hover:underline"
                >
                  Create one for free
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setIsLogin(true); setError(null); }}
                  className="font-bold text-[#d2281e] hover:underline"
                >
                  Sign in here
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Bottom Legal / Trust note */}
        <div className="pt-4 border-t border-zinc-200 text-center">
          <p className="text-[11px] text-zinc-400">
            By continuing, you agree to Watch terms & privacy. Encrypted & 100% private.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#d2281e] border-t-transparent animate-spin" />
      </div>
    }>
      <LoginFormContent />
    </Suspense>
  );
}
