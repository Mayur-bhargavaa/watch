'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Film,
  Play,
  Users,
  Video,
  MessageSquare,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Heart,
  Gamepad2,
  Copy,
  Check,
  HelpCircle,
  Shield,
  Share2,
  Smile,
  Volume2,
  Lock,
  Smartphone,
  Laptop,
  Tv,
  ChevronDown,
  LogOut,
  Radio,
  Clock,
  Flame,
  Award
} from 'lucide-react';
import { getStoredSession, clearStoredSession, UserSession } from '../lib/api';
import { AuthModal } from '../components/auth/AuthModal';

export default function LandingPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [joinSlug, setJoinSlug] = useState('');
  const [copiedDemoLink, setCopiedDemoLink] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  useEffect(() => {
    setSession(getStoredSession());
  }, []);

  const handleAuthSuccess = (newSession: UserSession) => {
    setSession(newSession);
    setIsAuthModalOpen(false);
    router.push('/dashboard');
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinSlug.trim()) return;
    const cleanSlug = joinSlug.trim().replace(/^.*\/room\//, '').replace(/^.*\/games\/[a-z0-9-]+\?room=/, '');
    router.push(`/room/${cleanSlug}`);
  };

  const handleGetStarted = () => {
    const current = getStoredSession();
    if (current && !current.user.isAnonymous) {
      router.push('/dashboard');
    } else {
      setIsAuthModalOpen(true);
    }
  };

  const handleCopyDemoRoom = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(`${window.location.origin}/dashboard`);
    setCopiedDemoLink(true);
    setTimeout(() => setCopiedDemoLink(false), 2000);
  };

  // Real FAQs in plain, simple English for students
  const faqs = [
    {
      q: 'What is StitchByte? Is it free to use?',
      a: 'StitchByte is a 100% free website made for couples and friends to spend time together online. You can watch YouTube videos at the exact same second, talk on live video call, and play 2-player games like Ludo and Four in a Row together — all in one private room. There are no hidden fees or charges.'
    },
    {
      q: 'Do I or my partner need to download any application?',
      a: 'No app download is needed! StitchByte runs directly inside any web browser (Google Chrome, Safari, Brave, or Firefox) on your Android phone, iPhone, iPad, laptop, or desktop computer. Just open the link and start.'
    },
    {
      q: 'How do we watch videos together in sync?',
      a: 'When you create a room, you can pick any YouTube video or paste any YouTube link. When you click Play or Pause, the video automatically plays or pauses on your partner’s screen at the exact same moment. No more saying "3, 2, 1, press play!"'
    },
    {
      q: 'Can strangers or random people enter our room?',
      a: 'No, absolutely not. Every room has a unique secret room code (like MOVIE-7892). Only people who have your exact code or private link can enter. Your video call, messages, and games stay completely private between you and your friend.'
    },
    {
      q: 'Are the games played with real people or computer bots?',
      a: 'We have a strict Zero-Bots Policy. Every game of Ludo and Four in a Row is played between real human beings in real time. You play directly with your partner or friend sitting across their screen with live camera feeds.'
    },
    {
      q: 'How do I connect with my partner or best friend?',
      a: 'It takes only 10 seconds: Click "Get Started", enter your name, and create your free account. Once inside the Dashboard, copy your Partner Code and send it to your partner on WhatsApp. Once they enter your code, you two are linked forever!'
    }
  ];

  return (
    <div className="min-h-screen bg-[#111217] text-slate-100 flex flex-col justify-between selection:bg-rose-600 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Dynamic Background Ambient Glow (matches Dashboard aesthetic) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-rose-600/15 via-pink-600/10 to-transparent blur-[150px] rounded-full" />
        <div className="absolute top-[35%] right-[-10%] w-[500px] h-[500px] bg-rose-700/10 blur-[160px] rounded-full" />
        <div className="absolute top-[65%] left-[-10%] w-[600px] h-[600px] bg-amber-600/10 blur-[180px] rounded-full" />
      </div>

      {/* ===================================================================== */}
      {/* 1. TOP NAVIGATION BAR (Dashboard Theme)                                */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-2xl bg-[#111217]/85 border-b border-white/[0.08] px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div
            onClick={() => router.push('/')}
            className="flex items-center space-x-2.5 cursor-pointer select-none shrink-0"
          >
            <div className="p-1.5 bg-rose-600 rounded-xl text-white shadow-lg shadow-rose-600/30">
              <Film className="w-4 h-4 fill-current" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">
              StitchByte<span className="text-rose-600 text-2xl leading-none">.</span>
            </span>
          </div>

          {/* Quick Nav Links (Desktop) */}
          <nav className="hidden md:flex items-center space-x-6 text-xs font-semibold text-zinc-400">
            <a href="#how-it-works" className="hover:text-rose-300 transition">
              How It Works
            </a>
            <a href="#features" className="hover:text-rose-300 transition">
              Real Features
            </a>
            <a href="#games" className="hover:text-rose-300 transition">
              Play Games
            </a>
            <a href="#faq" className="hover:text-rose-300 transition">
              FAQ
            </a>
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center space-x-2.5">
            {/* Quick Room Code Input */}
            <form onSubmit={handleJoinByCode} className="hidden sm:flex items-center space-x-1.5">
              <input
                type="text"
                placeholder="Enter room code..."
                value={joinSlug}
                onChange={(e) => setJoinSlug(e.target.value.toUpperCase())}
                className="bg-[#181920] text-xs font-mono uppercase text-slate-100 placeholder:text-zinc-500 px-3 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-rose-500 transition w-36 sm:w-44"
              />
              <button
                type="submit"
                disabled={!joinSlug.trim()}
                className="px-3 py-2 bg-white/10 hover:bg-rose-600 disabled:opacity-30 disabled:hover:bg-white/10 text-xs font-bold text-white rounded-xl border border-white/10 transition"
              >
                Join
              </button>
            </form>

            {/* Auth CTA */}
            {session && !session.user.isAnonymous ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-4 py-2 bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-xs font-black text-white rounded-xl shadow-lg shadow-rose-600/30 transition transform active:scale-95 flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Dashboard 🚀</span>
                </button>
                <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 text-white font-black text-[10px] flex items-center justify-center">
                    {session.user.displayName[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-zinc-200 font-medium max-w-[100px] truncate">
                    {session.user.displayName}
                  </span>
                </div>
                <button
                  onClick={() => {
                    clearStoredSession();
                    setSession(null);
                  }}
                  className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition"
                  title="Log Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-200 rounded-xl border border-white/10 transition"
                >
                  Sign In
                </button>
                <button
                  onClick={handleGetStarted}
                  className="px-4 py-2 bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-xs font-black text-white rounded-xl shadow-lg shadow-rose-600/30 transition transform active:scale-95 flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Get Started</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 2. HERO SECTION: PLAIN ENGLISH & INSTANTLY CLEAR                       */}
      {/* ===================================================================== */}
      <section className="relative z-10 px-4 sm:px-8 pt-12 sm:pt-20 pb-16 max-w-6xl mx-auto text-center flex flex-col items-center">
        {/* Simple Trust Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-bold mb-6 animate-pulse">
          <Heart className="w-3.5 h-3.5 fill-current text-rose-400" />
          <span>Made for Couples & Friends • 100% Free • No App Required</span>
        </div>

        {/* Hero Title: Easy English */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl leading-tight sm:leading-tight mb-5">
          Watch Videos, Play Games & Video Call Together —{' '}
          <span className="bg-gradient-to-r from-rose-500 via-pink-400 to-amber-300 bg-clip-text text-transparent">
            From Anywhere.
          </span>
        </h1>

        {/* Subtitle: Plain English for 12th pass / Hindi medium */}
        <p className="text-sm sm:text-lg text-zinc-300 max-w-2xl leading-relaxed mb-8 font-normal">
          Whether your favorite person is in another room or another city, watch YouTube videos in perfect sync, play real Ludo and Four-in-a-Row, and talk on live video call together.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mb-10">
          <button
            onClick={handleGetStarted}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-sm shadow-xl shadow-rose-600/30 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Create Free Room & Invite</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              const el = document.getElementById('how-it-works');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-[#181920] hover:bg-[#20222c] border border-white/15 text-zinc-200 hover:text-white font-bold text-sm transition flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 text-rose-400" />
            <span>See How It Works</span>
          </button>
        </div>

        {/* Quick Join Mobile Bar */}
        <div className="sm:hidden w-full max-w-sm mb-8">
          <form onSubmit={handleJoinByCode} className="flex gap-2">
            <input
              type="text"
              placeholder="Enter room code..."
              value={joinSlug}
              onChange={(e) => setJoinSlug(e.target.value.toUpperCase())}
              className="flex-1 bg-[#181920] text-xs font-mono uppercase text-slate-100 placeholder:text-zinc-500 px-3.5 py-3 rounded-xl border border-white/15 focus:outline-none focus:border-rose-500"
            />
            <button
              type="submit"
              disabled={!joinSlug.trim()}
              className="px-4 py-3 bg-rose-600 disabled:opacity-40 text-xs font-bold text-white rounded-xl shadow"
            >
              Join
            </button>
          </form>
        </div>

        {/* =================================================================== */}
        {/* VISUAL SHOWCASE CARD: REAL PRODUCT PREVIEW                           */}
        {/* =================================================================== */}
        <div className="w-full max-w-4xl p-2 sm:p-3 rounded-3xl bg-gradient-to-b from-white/15 to-white/5 border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
          <div className="rounded-2xl bg-[#14151c] border border-white/10 overflow-hidden text-left relative">
            {/* Top Bar of the Mockup Room */}
            <div className="px-4 py-3 bg-[#181922] border-b border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-zinc-400 text-[11px]">stitchbyte.com/room/MOVIE-NIGHT</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Synced (0s delay)
                </span>
              </div>
            </div>

            {/* Mock Screen Content */}
            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {/* Left 2 Cols: Synchronized Video Showcase */}
              <div className="md:col-span-2 space-y-3">
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-black/80 border border-white/10 shadow-inner group">
                  <img
                    src="https://img.youtube.com/vi/zSWdZVtXT7E/maxresdefault.jpg"
                    alt="Cinema Watch Party"
                    className="w-full h-full object-cover opacity-85"
                  />
                  {/* Playhead Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-4">
                    <div className="flex items-center justify-between text-xs text-white mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-rose-600 flex items-center justify-center text-white shadow">
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </div>
                        <span className="font-bold text-xs">Interstellar: Space Travel (4K)</span>
                      </div>
                      <span className="text-[11px] font-mono text-rose-300">1:42:15 / 2:49:00</span>
                    </div>
                    {/* Synchronized Progress Bar */}
                    <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div className="w-[62%] h-full bg-gradient-to-r from-rose-600 to-amber-500 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Video Call Mini Bar floating in mock screen */}
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <Video className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white">Live In-Room Video Call</span>
                    <span className="text-zinc-400 text-[11px]">(2 connected)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 text-white font-bold text-[10px] flex items-center justify-center shadow">
                      Y
                    </div>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-pink-500 text-white font-bold text-[10px] flex items-center justify-center shadow">
                      P
                    </div>
                    <span className="text-emerald-400 text-xs font-semibold ml-1">● Mic On</span>
                  </div>
                </div>
              </div>

              {/* Right Col: Live Chat & Stickers Preview */}
              <div className="flex flex-col justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs space-y-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-rose-400" />
                      Game & Movie Chat
                    </span>
                    <span className="text-[10px] text-zinc-400">Live</span>
                  </div>

                  {/* Chat Bubbles */}
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        P
                      </div>
                      <div className="p-2 rounded-2xl bg-white/10 text-white text-[11px] max-w-[180px]">
                        This scene is so beautiful! 🥺❤️
                      </div>
                    </div>

                    <div className="flex items-start gap-2 justify-end">
                      <div className="p-2 rounded-2xl bg-rose-600/30 border border-rose-500/40 text-rose-100 text-[11px] max-w-[180px]">
                        Let's play Ludo right after this! 🎲
                      </div>
                      <div className="w-6 h-6 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        Y
                      </div>
                    </div>

                    {/* Cute Animated Sticker Preview */}
                    <div className="flex items-center justify-center p-2 rounded-2xl bg-white/5 border border-rose-500/20">
                      <div className="text-center">
                        <img
                          src="https://media4.giphy.com/media/Pw4DoWaNHDj8YVCWtu/giphy.gif"
                          alt="Bubu Dudu Dance"
                          className="w-14 h-14 object-contain mx-auto"
                        />
                        <span className="text-[9px] font-bold text-rose-300">Bubu Dudu Dance ✨</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Input Preview */}
                <div className="p-2 rounded-xl bg-black/40 border border-white/10 text-zinc-400 text-[11px] flex items-center justify-between">
                  <span>Type message or send stickers...</span>
                  <Smile className="w-3.5 h-3.5 text-rose-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. HOW IT WORKS: 3 EASY STEPS TO REGISTER & PLAY                      */}
      {/* ===================================================================== */}
      <section id="how-it-works" className="relative z-10 px-4 sm:px-8 py-16 bg-[#14151b] border-y border-white/[0.08]">
        <div className="max-w-5xl mx-auto text-center">
          <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
            Super Simple • No Tech Skills Needed
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white mt-2 mb-4">
            How to Use StitchByte in 3 Easy Steps
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto mb-12">
            Anyone can use this website in seconds. No heavy application, no confusing passwords, and no complicated setup.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Step 1 */}
            <div className="p-6 rounded-3xl bg-[#181a24] border border-white/10 shadow-lg relative group hover:border-rose-500/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-500/40 text-rose-400 font-black text-xl flex items-center justify-center mb-4">
                1
              </div>
              <h3 className="text-base font-black text-white mb-2">Create Free Account</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Click <strong>"Get Started"</strong>, type your name, and create your free account. It takes only 10 seconds.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-3xl bg-[#181a24] border border-white/10 shadow-lg relative group hover:border-pink-500/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-pink-600/20 border border-pink-500/40 text-pink-400 font-black text-xl flex items-center justify-center mb-4">
                2
              </div>
              <h3 className="text-base font-black text-white mb-2">Pick a Video or Game</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Paste any YouTube video link you love, or click <strong>Ludo</strong> or <strong>Four-in-a-Row</strong> to start a match.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-3xl bg-[#181a24] border border-white/10 shadow-lg relative group hover:border-amber-500/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-amber-600/20 border border-amber-500/40 text-amber-400 font-black text-xl flex items-center justify-center mb-4">
                3
              </div>
              <h3 className="text-base font-black text-white mb-2">Send Link on WhatsApp</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Copy your secret room link and send it to your partner or friend. When they open it, you both enjoy together instantly!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 4. 100% REAL FEATURES (NO FAKE CLAIMS OR FAKE TECH JARGON)            */}
      {/* ===================================================================== */}
      <section id="features" className="relative z-10 px-4 sm:px-8 py-16 max-w-6xl mx-auto text-center">
        <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
          100% Real • Actually Works Every Time
        </span>
        <h2 className="text-2xl sm:text-4xl font-black text-white mt-2 mb-4">
          Everything You Need to Feel Close Together
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto mb-12">
          No fake promises or complicated tech words. Here is exactly what StitchByte lets you do right now:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
          {/* Feature 1 */}
          <div className="p-6 rounded-3xl bg-[#14151c] border border-white/10 hover:border-rose-500/40 transition flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <Play className="w-5 h-5 fill-current" />
              </div>
              <h3 className="text-base font-black text-white">Exact Same-Second Video Sync</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Paste any YouTube video or movie link. When you click pause, it pauses for your partner at the exact same second. No delays, no countdowns.
              </p>
            </div>
            <div className="text-[11px] font-bold text-rose-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Works with any YouTube video</span>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="p-6 rounded-3xl bg-[#14151c] border border-white/10 hover:border-pink-500/40 transition flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-pink-600/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
                <Video className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-white">Live Video Call on Screen</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                See each other’s smiles and expressions with live camera and microphone. You can move the video call box anywhere on your screen.
              </p>
            </div>
            <div className="text-[11px] font-bold text-rose-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Moveable picture-in-picture window</span>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="p-6 rounded-3xl bg-[#14151c] border border-white/10 hover:border-amber-500/40 transition flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-white">Real 2-Player Ludo & Connect 4</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Play Ludo with 3D cute ceramic animal gotis (teddy bears and frogs) or Four in a Row. Strict zero-bots policy: only real people play.
              </p>
            </div>
            <div className="text-[11px] font-bold text-rose-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero bots • 100% human duels</span>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="p-6 rounded-3xl bg-[#14151c] border border-white/10 hover:border-rose-500/40 transition flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <Smile className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-white">Cute Animated GIPHY Stickers</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Send looping animated stickers of Bubu & Dudu, Milk & Mocha, Peach & Goma, and Capybara directly in chat with one single click.
              </p>
            </div>
            <div className="text-[11px] font-bold text-rose-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Bubu & Dudu + Gen-Z stickers</span>
            </div>
          </div>

          {/* Feature 5 */}
          <div className="p-6 rounded-3xl bg-[#14151c] border border-white/10 hover:border-indigo-500/40 transition flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-white">100% Private & Secret Rooms</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Rooms cannot be searched by strangers on Google or the website. Only you and whoever you give your private room code can join.
              </p>
            </div>
            <div className="text-[11px] font-bold text-rose-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Safe for couples & families</span>
            </div>
          </div>

          {/* Feature 6 */}
          <div className="p-6 rounded-3xl bg-[#14151c] border border-white/10 hover:border-teal-500/40 transition flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-teal-600/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-white">Works on Any Mobile or Laptop</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Open StitchByte on your Android phone, iPhone, iPad, Windows laptop, or MacBook. Doesn't use extra storage or heat up your phone.
              </p>
            </div>
            <div className="text-[11px] font-bold text-rose-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero installation required</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 5. WHO IS STITCHBYTE FOR? (STUDENT & COUPLE FRIENDLY)                   */}
      {/* ===================================================================== */}
      <section className="relative z-10 px-4 sm:px-8 py-16 bg-[#14151b] border-y border-white/[0.08]">
        <div className="max-w-5xl mx-auto text-center">
          <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
            Real People • Real Connections
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white mt-2 mb-4">
            Who is StitchByte Made For?
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto mb-12">
            Built with care so distance never stops you from spending memorable time with the people who matter most.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Persona 1: Long Distance Couples */}
            <div className="p-6 rounded-3xl bg-[#191b24] border border-rose-500/30 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="space-y-3">
                <div className="text-3xl">💕</div>
                <h3 className="text-lg font-black text-white">Long Distance Couples</h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Living in different cities or away for college? Watch your favorite romantic movies, see each other’s reactions on camera, and fall asleep together on call.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-200 font-semibold">
                "Feels like we are sitting on the same sofa together!"
              </div>
            </div>

            {/* Persona 2: Best Friends & Roommates */}
            <div className="p-6 rounded-3xl bg-[#191b24] border border-amber-500/30 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="space-y-3">
                <div className="text-3xl">🍿</div>
                <h3 className="text-lg font-black text-white">Best Friends & Groups</h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Binge-watch funny YouTube clips, roast each other during intense Ludo rounds, and spam hilarious Bubu & Dudu stickers in late-night gaming sessions.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 font-semibold">
                "No more counting 3-2-1 to press play on YouTube!"
              </div>
            </div>

            {/* Persona 3: Study Buddies */}
            <div className="p-6 rounded-3xl bg-[#191b24] border border-indigo-500/30 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="space-y-3">
                <div className="text-3xl">📚</div>
                <h3 className="text-lg font-black text-white">Study & Lofi Hangouts</h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Studying for board exams, college finals, or competitive tests? Put on synchronized Lofi Girl study beats and keep each other motivated while studying together.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-200 font-semibold">
                "Keeps you focused and less lonely while studying!"
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 6. PLAY 2-PLAYER GAMES SHOWCASE                                       */}
      {/* ===================================================================== */}
      <section id="games" className="relative z-10 px-4 sm:px-8 py-16 max-w-5xl mx-auto text-center">
        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
          Pure Fun • Zero Bots Guarantee
        </span>
        <h2 className="text-2xl sm:text-4xl font-black text-white mt-2 mb-4">
          Play 2-Player Games with Live Video Call
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto mb-10">
          Tired of boring bots on other apps? Play live duels with real people in real time.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
          {/* Game 1: Cottagecore Ludo */}
          <div
            onClick={() => router.push('/games/ludo')}
            className="p-6 rounded-3xl bg-gradient-to-b from-[#1b1c28] to-[#14151f] border border-amber-500/30 shadow-2xl cursor-pointer group hover:border-amber-400 hover:scale-[1.02] transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-4xl">🐻 🐸</span>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Ludo 2-Player
              </span>
            </div>
            <h3 className="text-xl font-black text-white mb-2 group-hover:text-amber-300 transition">
              Cottagecore 3D Ludo
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Play with handcrafted ceramic animal tokens: Teddy Bears vs Happy Frogs. Features 7 dynamic background themes, turn nudges, and live camera feed right above the board!
            </p>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <span>Play Ludo Now</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Game 2: Four in a Row */}
          <div
            onClick={() => router.push('/games/four-in-a-row')}
            className="p-6 rounded-3xl bg-gradient-to-b from-[#1c141d] to-[#140e16] border border-rose-500/30 shadow-2xl cursor-pointer group hover:border-rose-400 hover:scale-[1.02] transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-4xl">🔴 🟡</span>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                Connect 4 Duel
              </span>
            </div>
            <h3 className="text-xl font-black text-white mb-2 group-hover:text-rose-300 transition">
              Four in a Row (Connect 4)
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Drop discs into a vertical 7x6 stand board to connect 4 in a row. Comes with live camera feeds, floating call window, animated Bubu & Dudu chat stickers, and instant rematch.
            </p>
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
              <span>Play Four in a Row</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 7. FREQUENTLY ASKED QUESTIONS (PLAIN ENGLISH ACCORDION)                */}
      {/* ===================================================================== */}
      <section id="faq" className="relative z-10 px-4 sm:px-8 py-16 bg-[#14151b] border-y border-white/[0.08]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
              Got Questions?
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-2 mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Clear answers in plain language — no technical terms or confusing jargon.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-[#181a24] border border-white/10 overflow-hidden transition"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-white hover:text-rose-300 transition"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-rose-400' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs text-zinc-400 leading-relaxed border-t border-white/5 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 8. BOTTOM CALL TO ACTION                                              */}
      {/* ===================================================================== */}
      <section className="relative z-10 px-4 sm:px-8 py-16 max-w-4xl mx-auto text-center">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-rose-900/40 via-pink-900/30 to-amber-900/30 border border-rose-500/40 shadow-2xl backdrop-blur-2xl flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center text-white mb-4 shadow-lg shadow-rose-600/40">
            <Heart className="w-6 h-6 fill-current" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white mb-3">
            Ready to Watch & Play Together?
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 max-w-md mb-8 leading-relaxed">
            Create your free room in 10 seconds. Share the link on WhatsApp with your partner or friend and make long distance feel like no distance.
          </p>

          <button
            onClick={handleGetStarted}
            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-sm shadow-xl shadow-rose-600/40 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Start For Free Right Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 9. FOOTER (Dashboard Brand Parity)                                    */}
      {/* ===================================================================== */}
      <footer className="relative z-10 border-t border-white/[0.08] px-4 sm:px-8 py-8 bg-[#0e0f14] text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="p-1 bg-rose-600 rounded-lg text-white">
              <Film className="w-3.5 h-3.5 fill-current" />
            </div>
            <span className="font-bold text-white text-sm">
              StitchByte<span className="text-rose-600">.</span>
            </span>
            <span className="text-zinc-600">|</span>
            <span>Watch Together & Play Games Online</span>
          </div>

          <div className="flex items-center space-x-6 text-[11px] font-semibold text-zinc-400">
            <button onClick={() => router.push('/dashboard')} className="hover:text-white transition">
              Dashboard
            </button>
            <button onClick={() => router.push('/games/ludo')} className="hover:text-white transition">
              Ludo
            </button>
            <button onClick={() => router.push('/games/four-in-a-row')} className="hover:text-white transition">
              Four in a Row
            </button>
            <button onClick={() => setIsAuthModalOpen(true)} className="hover:text-white transition">
              Sign In
            </button>
          </div>

          <div className="text-[11px] text-zinc-600">
            © {new Date().getFullYear()} StitchByte. 100% Free for couples and friends.
          </div>
        </div>
      </footer>

      {/* Auth Modal for Sign In / Sign Up */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
