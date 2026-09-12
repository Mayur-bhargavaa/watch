'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Film,
  Play,
  Video,
  MessageSquare,
  ArrowRight,
  Sparkles,
  Heart,
  Gamepad2,
  Smile,
  Lock,
  Smartphone,
  ChevronDown,
  LogOut,
  Zap,
  Shield,
  Star,
  CheckCircle2,
  Tv,
  Laptop,
  Check,
  Volume2,
  Users,
  Copy,
  Flame,
  Radio,
  Share2
} from 'lucide-react';
import { getStoredSession, clearStoredSession, UserSession } from '../lib/api';
import { AuthModal } from '../components/auth/AuthModal';

export default function LandingPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [joinSlug, setJoinSlug] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('🐻');
  const [customNickname, setCustomNickname] = useState<string>('Alex');
  const [hostOnlyControl, setHostOnlyControl] = useState<boolean>(true);

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

  // Avatar choices for the customization showcase
  const avatarOptions = [
    { icon: '🐻', name: 'Teddy Bear' },
    { icon: '🐸', name: 'Happy Frog' },
    { icon: '🐼', name: 'Panda' },
    { icon: '🐱', name: 'Kitty' },
    { icon: '🍿', name: 'Popcorn' },
    { icon: '🍕', name: 'Pizza' },
    { icon: '🍪', name: 'Cookie' },
    { icon: '🍦', name: 'Ice Cream' },
    { icon: '🚀', name: 'Rocket' },
    { icon: '💖', name: 'Heart' },
    { icon: '🎮', name: 'Gamer' },
    { icon: '👑', name: 'Crown' },
  ];

  // How It Works Steps data for the interactive Teleparty-style stepper
  const howItWorksSteps = [
    {
      title: '1. Create a Free Room',
      subtitle: 'Zero installation required',
      desc: 'Click "Start Free Watch Party" or "Play Games". No Chrome extension to download, no credit card, no sign-up hassle. Your private room is ready in 3 seconds.',
      badge: 'Instant Setup',
      image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1000&auto=format&fit=crop&q=80',
      caption: 'Private Room Room-812 is ready. Instant link generated.'
    },
    {
      title: '2. Pick a Video or Instant Game',
      subtitle: 'YouTube, Movies, Ludo, Four-in-a-Row',
      desc: 'Paste any YouTube link you want to binge, or launch high-stakes 2-player games like Cottagecore Ludo and Four-in-a-Row directly in the room.',
      badge: 'Video + Games Together',
      image: 'https://img.youtube.com/vi/zSWdZVtXT7E/maxresdefault.jpg',
      caption: 'Stream 4K YouTube in sync or roll the dice in 3D Ludo.'
    },
    {
      title: '3. Share Secret Link on WhatsApp',
      subtitle: 'One-click invite link',
      desc: 'Copy your unique room URL and send it to your partner or friends on WhatsApp, Telegram, or Discord. They click it and drop right in.',
      badge: 'Private & Encrypted',
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80',
      caption: 'Only people with your secret link can join your room.'
    },
    {
      title: '4. Stream & Play in Perfect Sync',
      subtitle: 'Sub-15ms playback sync engine',
      desc: 'When anyone hits Play or Pause, it reacts simultaneously for everyone in the room. No counting down "3, 2, 1, press play!" ever again.',
      badge: 'Sub-second Sync',
      image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1000&auto=format&fit=crop&q=80',
      caption: 'Synced frame-for-frame across phones, laptops, and tablets.'
    },
    {
      title: '5. Face-to-Face Video Call & Stickers',
      subtitle: 'Live reactions on camera',
      desc: 'See their genuine smiles, laugh together on camera with picture-in-picture video call, and spam cute looping Bubu & Dudu animated stickers in chat.',
      badge: 'Picture-in-Picture Call',
      image: 'https://images.unsplash.com/photo-1516251193007-45ef944ab0c6?w=1000&auto=format&fit=crop&q=80',
      caption: 'Talk, react, and feel like you are sitting together on the couch.'
    },
  ];

  // Gallery cards of Shows & Games
  const catalogCards = [
    { title: 'Stranger Things', type: 'Sci-Fi Series', tag: 'Streaming', img: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500&auto=format&fit=crop&q=80' },
    { title: 'Cottagecore Ludo 3D', type: '2-Player Board Game', tag: 'Instant Game', img: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=500&auto=format&fit=crop&q=80', isGame: true },
    { title: 'Interstellar (4K)', type: 'Cinema Masterpiece', tag: 'Streaming', img: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80' },
    { title: 'Four in a Row Duel', type: 'Connect 4 Strategy', tag: 'Instant Game', img: 'https://images.unsplash.com/photo-1606167668584-78701c57f13d?w=500&auto=format&fit=crop&q=80', isGame: true },
    { title: 'Anime & Demon Slayer', type: 'Animation Party', tag: 'Streaming', img: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80' },
    { title: 'Lofi Girl Live Beats', type: 'Study & Chill', tag: 'Streaming', img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80' },
  ];

  const faqs = [
    {
      q: 'What is Watch? Is it completely free to use?',
      a: 'Watch is 100% free! It is the modern social entertainment platform designed for couples and friends. You can stream videos in exact sub-second sync, talk on live face-to-face video call, and play 2-player games like Cottagecore Ludo and Four-in-a-Row together in one room. No subscriptions or hidden fees.'
    },
    {
      q: 'Do I or my friend need to download a browser extension like Teleparty?',
      a: 'No! Unlike Teleparty which forces you to install desktop Chrome extensions, Watch requires ZERO downloads and zero extensions. It runs natively right inside Safari, Chrome, Edge, Brave, or Firefox on both iPhones, Android devices, Macs, and Windows PCs.'
    },
    {
      q: 'How do the 2-player games work during a watch party?',
      a: 'You can launch games right from your room or directly from the Games lobby. Both Ludo and Four-in-a-Row feature real-time WebSocket communication, 3D ceramic animal gotis (Teddy Bears vs Frogs), instant rematch buttons, turn nudges, and keep your live camera feed active above the board.'
    },
    {
      q: 'Can strangers or search engines find our room?',
      a: 'No, never. Rooms are strictly invite-only with randomized secure room codes. Only people with whom you share the private link or code can join. All chats and video streams are private.'
    },
    {
      q: 'Are the game opponents real people or computer bots?',
      a: 'We operate on a strict Zero-Bots Policy. Every match of Ludo and Four-in-a-Row is played against a real human friend or partner in real time.'
    },
    {
      q: 'How do I link with my partner?',
      a: 'Click "Start Watch Party", enter your name, and copy your Partner Code from the dashboard. Once your partner inputs it, your accounts are paired permanently.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0d0710] text-slate-100 flex flex-col selection:bg-rose-600 selection:text-white font-sans antialiased overflow-x-hidden" style={{ scrollbarWidth: 'none' }}>

      {/* GLOBAL AURORA AMBIENT GLOW */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] bg-gradient-to-b from-rose-600/20 via-pink-700/10 to-transparent blur-[140px] rounded-full" />
        <div className="absolute top-[35%] -right-40 w-[600px] h-[600px] bg-purple-700/15 blur-[170px] rounded-full" />
        <div className="absolute top-[65%] -left-40 w-[700px] h-[600px] bg-rose-800/10 blur-[180px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)', backgroundSize: '64px 64px' }} />
      </div>

      {/* ===================================================================== */}
      {/* 1. TOP NAVBAR (Teleparty Style + Our Brand Parity)                     */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-2xl bg-[#0d0710]/85 border-b border-white/[0.08] px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo with "Powered by StitchByte" subtext */}
          <div onClick={() => router.push('/')} className="flex items-center space-x-3 cursor-pointer select-none shrink-0 group">
            <div className="p-2 bg-gradient-to-br from-rose-600 to-pink-600 rounded-xl text-white shadow-lg shadow-rose-600/30 group-hover:scale-105 transition-transform">
              <Film className="w-4 h-4 fill-current" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black tracking-tight text-white flex items-center gap-0.5">
                Watch<span className="text-rose-500 text-2xl leading-none">.</span>
              </span>
              <span className="text-[8.5px] font-bold text-zinc-400 tracking-widest uppercase mt-0.5">
                Powered by StitchByte
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8 text-xs font-bold text-zinc-300 tracking-wide">
            <a href="#features" className="hover:text-rose-400 transition-colors">Features</a>
            <a href="#catalog" className="hover:text-rose-400 transition-colors">Movies & Shows</a>
            <a href="#games" className="hover:text-rose-400 transition-colors flex items-center gap-1.5">
              <span>Games</span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">New</span>
            </a>
            <a href="#customize" className="hover:text-rose-400 transition-colors">Customize</a>
            <a href="#how-it-works" className="hover:text-rose-400 transition-colors">How It Works</a>
            <a href="#faq" className="hover:text-rose-400 transition-colors">FAQ</a>
          </nav>

          {/* Right Header CTAs */}
          <div className="flex items-center space-x-3">
            {/* Quick Room Code Entry */}
            <form onSubmit={handleJoinByCode} className="hidden lg:flex items-center space-x-1.5">
              <input
                type="text"
                placeholder="Room code..."
                value={joinSlug}
                onChange={(e) => setJoinSlug(e.target.value.toUpperCase())}
                className="bg-white/5 text-xs font-mono uppercase text-slate-100 placeholder:text-zinc-500 px-3.5 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-rose-500 transition w-36"
              />
              <button
                type="submit"
                disabled={!joinSlug.trim()}
                className="px-3.5 py-2 bg-white/10 hover:bg-rose-600 disabled:opacity-30 text-xs font-bold text-white rounded-xl transition"
              >
                Join
              </button>
            </form>

            {/* Auth / Get Started button */}
            {session && !session.user.isAnonymous ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-xs font-black text-white rounded-xl shadow-lg shadow-rose-600/30 transition active:scale-95 flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => { clearStoredSession(); setSession(null); }}
                  className="p-2 text-xs text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold text-zinc-200 rounded-xl border border-white/10 transition"
                >
                  Log In
                </button>
                <button
                  onClick={handleGetStarted}
                  className="px-5 py-2.5 bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500 text-xs font-black text-white rounded-xl shadow-xl shadow-rose-600/35 transition transform active:scale-95 flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Start Free</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 2. HERO SECTION (Teleparty Split Style: Visual Left, Bold Pitch Right) */}
      {/* ===================================================================== */}
      <section className="relative z-10 px-4 sm:px-8 pt-12 sm:pt-20 pb-16 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Big Sleek Theater + Live Chat Mockup (Similar to Teleparty Hero Image) */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div className="relative rounded-3xl p-[2px] bg-gradient-to-b from-white/25 via-rose-500/20 to-transparent shadow-[0_30px_90px_rgba(0,0,0,0.85)] group">
              <div className="rounded-[22px] bg-[#140a14] border border-white/10 overflow-hidden relative">
                
                {/* Mock Browser Header */}
                <div className="px-4 py-3 bg-[#1c0e1c] border-b border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 font-mono text-zinc-400 text-[11px] truncate max-w-[200px] sm:max-w-none">
                      watch.stitchbyte.in/room/ROMANTIC-NIGHT-♥
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 font-bold text-[10px] border border-rose-500/30 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                      Synced (0ms lag)
                    </span>
                  </div>
                </div>

                {/* Theater Screen with Synchronized Video + In-Room Chat Sidebar */}
                <div className="grid grid-cols-1 md:grid-cols-12">
                  
                  {/* Left video area (8 cols) */}
                  <div className="md:col-span-8 p-3 sm:p-4 flex flex-col justify-between space-y-3">
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-inner group">
                      <img
                        src="https://img.youtube.com/vi/zSWdZVtXT7E/maxresdefault.jpg"
                        alt="Cinema Synchronized Player"
                        className="w-full h-full object-cover opacity-85"
                      />
                      
                      {/* Dark gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 flex flex-col justify-between p-4">
                        {/* Top tag */}
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-bold text-white border border-white/10">
                            4K HDR ULTRA
                          </span>
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px] font-semibold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Live Call (Mic On)
                          </div>
                        </div>

                        {/* Player Controls Bar */}
                        <div>
                          <div className="flex items-center justify-between text-xs text-white mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/50">
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              </div>
                              <span className="font-black text-xs">Interstellar: Space Horizon</span>
                            </div>
                            <span className="text-[11px] font-mono text-rose-300">1:28:44 / 2:49:00</span>
                          </div>
                          
                          {/* Progress Line */}
                          <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div className="w-[58%] h-full bg-gradient-to-r from-rose-600 to-pink-500 rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Integrated 2-Player Game Bar right inside the room preview! */}
                    <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-600/30 to-pink-600/30 border border-rose-500/40 flex items-center justify-center text-rose-300">
                          <Gamepad2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-white flex items-center gap-1.5">
                            <span>Ready to Play Ludo?</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold">2-Player</span>
                          </div>
                          <div className="text-[10px] text-zinc-400">Teddy Bears vs Happy Frogs · Zero Bots</div>
                        </div>
                      </div>
                      <button
                        onClick={() => router.push('/games/ludo')}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-[11px] font-bold text-white transition shadow-md shadow-rose-600/30"
                      >
                        Launch Game
                      </button>
                    </div>
                  </div>

                  {/* Right Chat & Reactions Column (4 cols) */}
                  <div className="md:col-span-4 p-3 sm:p-4 border-t md:border-t-0 md:border-l border-white/10 flex flex-col justify-between space-y-3 bg-black/20">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <span className="font-bold text-xs text-white flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-rose-400" />
                          Party Chat
                        </span>
                        <span className="text-[10px] text-zinc-400">3 online</span>
                      </div>

                      {/* Message Bubbles */}
                      <div className="space-y-2.5">
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                            P
                          </div>
                          <div className="p-2 rounded-2xl bg-white/10 text-white text-[11px] leading-tight">
                            The music is giving me goosebumps! 😭✨
                          </div>
                        </div>

                        <div className="flex items-start gap-2 justify-end">
                          <div className="p-2 rounded-2xl bg-rose-600/30 border border-rose-500/30 text-rose-100 text-[11px] leading-tight">
                            Same here! After this movie, rematch on Four-in-a-Row? 🔴
                          </div>
                          <div className="w-6 h-6 rounded-full bg-pink-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                            Y
                          </div>
                        </div>

                        {/* Animated Sticker Box */}
                        <div className="p-2 rounded-2xl bg-white/5 border border-rose-500/20 text-center">
                          <img
                            src="https://media4.giphy.com/media/Pw4DoWaNHDj8YVCWtu/giphy.gif"
                            alt="Bubu Dudu Dance"
                            className="w-12 h-12 object-contain mx-auto"
                          />
                          <span className="text-[9px] font-bold text-rose-300">Bubu & Dudu Reaction</span>
                        </div>
                      </div>
                    </div>

                    {/* Chat Input placeholder */}
                    <div className="p-2 rounded-xl bg-black/40 border border-white/10 text-[11px] text-zinc-500 flex items-center justify-between">
                      <span>Type message...</span>
                      <Smile className="w-3.5 h-3.5 text-rose-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Value Proposition (Teleparty Style: Bold Headline & Subhead) */}
          <div className="lg:col-span-5 order-1 lg:order-2 text-left space-y-6">
            
            {/* Category Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-rose-400" />
              <span>WATCH & PLAY WITH FRIENDS</span>
            </div>

            {/* Massive Bold Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.08]">
              A new way to <br />
              <span className="bg-gradient-to-r from-rose-400 via-pink-400 to-rose-300 bg-clip-text text-transparent">
                watch & play together
              </span>
            </h1>

            {/* Explanatory Lead Paragraph */}
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed font-normal">
              Watch is the modern social entertainment platform to stream videos and play live games with your favorite people online.
            </p>

            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Watch synchronizes video playback with sub-second accuracy, adds in-room face-to-face video calls, real-time group chat with cute stickers, and live 2-player games like Cottagecore Ludo and Four-in-a-Row.
            </p>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={handleGetStarted}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500 text-white font-black text-sm shadow-xl shadow-rose-600/35 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Get Watch for free!</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => router.push('/games/ludo')}
                className="px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-zinc-200 hover:text-white font-bold text-sm transition flex items-center justify-center gap-2"
              >
                <Gamepad2 className="w-4 h-4 text-rose-400" />
                <span>Play 2-Player Games</span>
              </button>
            </div>

            {/* Key Differentiator Notice (No Extension Needed!) */}
            <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>100% Free · No Chrome extension or downloads required · Works on iOS, Android & Desktop</span>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* PLATFORM & GAMES BADGE ROW (Teleparty's "Host a Watch Party on...") */}
        {/* =================================================================== */}
        <div className="mt-16 pt-8 border-t border-white/[0.08] text-center">
          <p className="text-[11px] font-bold tracking-widest text-zinc-500 uppercase mb-6">
            STREAM VIDEOS & PLAY GAMES TOGETHER ON
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 opacity-80 hover:opacity-100 transition-opacity">
            {/* YouTube */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-sm font-black text-white">YouTube 4K</span>
            </div>

            {/* Cottagecore Ludo 3D */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
              <span className="text-base">🎲</span>
              <span className="text-sm font-black text-rose-300">Cottagecore Ludo 3D</span>
            </div>

            {/* Four in a Row */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-500/10 border border-pink-500/30">
              <span className="text-base">🔴</span>
              <span className="text-sm font-black text-pink-300">Four in a Row (Connect 4)</span>
            </div>

            {/* Live Video Call */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <Video className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-black text-white">Face-to-Face Video Calls</span>
            </div>

            {/* Animated Stickers */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <Smile className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-black text-white">Bubu & Dudu Stickers</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. SHOWS, MOVIES & GAMES CATALOG (Teleparty Screenshot 2 Style)        */}
      {/* ===================================================================== */}
      <section id="catalog" className="relative z-10 px-4 sm:px-8 py-20 border-y border-white/[0.08] bg-[#110812]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Left Text Column */}
          <div className="lg:col-span-5 text-left space-y-5">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
              MILLIONS OF SHOWS, MOVIES & MATCHES
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Watch your favorite streams & play instant games
            </h2>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Create watch parties in seconds for YouTube clips, music livestreams, film trailers, anime series, or jump right into high-stakes 2-player matches of 3D Ludo and Connect 4 without ever switching applications.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Exact same-second video sync with Cristian NTP engine</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Zero bots guarantee: strictly 100% human duels</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Live video call & audio chat while playing or watching</span>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleGetStarted}
                className="px-6 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-lg shadow-rose-600/30 flex items-center gap-2"
              >
                <span>Browse & Watch Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Posters & Games Grid (Teleparty Screenshot 2 Gallery) */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {catalogCards.map((card, idx) => (
              <div
                key={idx}
                onClick={() => {
                  if (card.isGame) {
                    if (card.title.includes('Ludo')) router.push('/games/ludo');
                    else router.push('/games/four-in-a-row');
                  } else {
                    handleGetStarted();
                  }
                }}
                className="group relative rounded-2xl overflow-hidden aspect-[3/4] bg-[#1a0f1b] border border-white/10 hover:border-rose-500/50 cursor-pointer shadow-lg hover:shadow-rose-600/20 transition-all hover:-translate-y-1.5"
              >
                <img
                  src={card.img}
                  alt={card.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80 group-hover:opacity-100"
                />
                
                {/* Gradient shade */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-between p-3.5">
                  <div className="flex justify-end">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                      card.isGame
                        ? 'bg-rose-600 text-white border border-rose-400/50'
                        : 'bg-black/60 text-zinc-300 border border-white/20'
                    }`}>
                      {card.tag}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-white group-hover:text-rose-300 transition-colors leading-tight">
                      {card.title}
                    </h3>
                    <p className="text-[10px] text-zinc-400 mt-0.5 font-medium">{card.type}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 4. SYNC IN HD & MULTI-SCREEN (Teleparty Screenshot 3 Style)            */}
      {/* ===================================================================== */}
      <section className="relative z-10 px-4 sm:px-8 py-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text Column */}
          <div className="lg:col-span-5 text-left space-y-5">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
              SYNCHRONIZE WITH YOUR FRIENDS
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Sync Watch Parties & Games in HD
            </h2>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed font-normal">
              Always stay precisely in sync when you are watching shows or throwing dice in Ludo. Enjoy ultra-low latency, crystal-clear HD video quality, and fast buffering on both desktop and mobile.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <div className="text-xl font-black text-white flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-rose-400" />
                  <span>Desktop</span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">Full-screen theater & picture-in-picture call</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <div className="text-xl font-black text-white flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-pink-400" />
                  <span>Mobile</span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">Zero app install on iPhone & Android</div>
              </div>
            </div>
          </div>

          {/* Right Dual-Device Mockup (Laptop + Phone Synchronized side-by-side) */}
          <div className="lg:col-span-7 flex items-center justify-center relative">
            
            {/* Laptop Frame */}
            <div className="w-full max-w-[480px] rounded-2xl bg-[#1e0f1e] p-2.5 border border-white/15 shadow-2xl relative">
              <div className="rounded-xl overflow-hidden aspect-video bg-black relative">
                <img
                  src="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80"
                  alt="Desktop Watch Sync"
                  className="w-full h-full object-cover opacity-80"
                />
                
                {/* Synced playhead indicator */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-bold border border-white/10 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Desktop: In Sync</span>
                </div>

                {/* Video call floating bubble */}
                <div className="absolute top-3 right-3 w-16 h-12 rounded-xl bg-rose-600/30 border border-rose-500/50 backdrop-blur-md flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-rose-600 text-[10px] font-bold flex items-center justify-center text-white">Y</div>
                </div>
              </div>
              <div className="h-3 bg-[#140a14] rounded-b-lg mt-1 mx-8" />
            </div>

            {/* Mobile Phone Mockup overlapping the laptop */}
            <div className="absolute -bottom-6 -right-2 sm:right-6 w-36 sm:w-44 rounded-3xl bg-[#1c0c1c] p-2 border-2 border-rose-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-20">
              <div className="rounded-2xl overflow-hidden aspect-[9/16] bg-black relative flex flex-col justify-between p-2">
                <img
                  src="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80"
                  alt="Mobile Watch Sync"
                  className="absolute inset-0 w-full h-full object-cover opacity-80"
                />
                
                {/* Mobile Sync Pill */}
                <div className="relative z-10 px-2 py-0.5 rounded-full bg-black/70 text-[8px] font-bold text-rose-300 border border-rose-500/30 text-center">
                  ● Mobile Synced
                </div>

                {/* Mobile Floating PIP */}
                <div className="relative z-10 self-end w-10 h-10 rounded-xl bg-pink-600/40 border border-pink-400/50 flex items-center justify-center">
                  <span className="text-[10px] font-black text-white">P</span>
                </div>

                {/* Chat bubble overlay */}
                <div className="relative z-10 p-1.5 rounded-xl bg-black/80 backdrop-blur-md text-[8.5px] text-white">
                  "Watching together in sync!"
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 5. CUSTOMIZATION & AVATAR PICKER (Teleparty Screenshot 4 Style)        */}
      {/* ===================================================================== */}
      <section id="customize" className="relative z-10 px-4 sm:px-8 py-20 border-y border-white/[0.08] bg-[#110812]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Left Text Column */}
          <div className="lg:col-span-5 text-left space-y-5">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
              MAKE IT YOURS
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Customize your Watch Room & Avatars
            </h2>
            <p className="text-sm text-zinc-300 leading-relaxed font-normal">
              Customize your experience by picking fun handcrafted avatars (Teddy Bears, Happy Frogs, Panda, Kitten, food & cinema icons) and custom nicknames.
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Set host-only playback controls so nobody accidentally skips ahead, toggle in-room live camera feeds, and express every laugh with animated stickers.
            </p>

            <div className="pt-2">
              <button
                onClick={handleGetStarted}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs transition shadow-lg shadow-rose-600/30 flex items-center gap-2"
              >
                <span>Create Your Custom Room</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Interactive Customizer Card (Teleparty Screenshot 4 Mockup) */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl p-6 bg-[#180d19] border border-rose-500/30 shadow-2xl relative">
              
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                
                {/* Left part: Nickname & Control Toggle */}
                <div className="sm:col-span-6 space-y-4 text-left">
                  
                  {/* Set a Nickname */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5 uppercase tracking-wider">
                      Set a Nickname
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={customNickname}
                        onChange={(e) => setCustomNickname(e.target.value)}
                        placeholder="My name is..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold focus:outline-none focus:border-rose-500 transition"
                      />
                    </div>
                  </div>

                  {/* Active Preview Tag */}
                  <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-pink-600 flex items-center justify-center text-xl shadow">
                      {selectedAvatar}
                    </div>
                    <div>
                      <div className="text-xs font-black text-white">{customNickname || 'Anonymous'}</div>
                      <div className="text-[10px] text-rose-300 font-medium">Ready to Watch & Play</div>
                    </div>
                  </div>

                  {/* Room Controls Toggle (Host Only Control) */}
                  <div className="p-3.5 rounded-2xl bg-black/30 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">Host-Only Control</div>
                        <div className="text-[10px] text-zinc-400">Only host can play/pause video</div>
                      </div>
                      
                      {/* Interactive Switch */}
                      <button
                        type="button"
                        onClick={() => setHostOnlyControl(!hostOnlyControl)}
                        className={`w-11 h-6 rounded-full transition-colors relative ${
                          hostOnlyControl ? 'bg-rose-600' : 'bg-zinc-700'
                        }`}
                      >
                        <span
                          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            hostOnlyControl ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Start Button */}
                  <button
                    onClick={handleGetStarted}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500 text-xs font-black text-white shadow-lg shadow-rose-600/30 transition"
                  >
                    Start the Party with this Profile
                  </button>
                </div>

                {/* Right part: Choose Avatar Grid (Just like Teleparty Screenshot 4) */}
                <div className="sm:col-span-6 text-left">
                  <label className="block text-xs font-bold text-zinc-300 mb-2 uppercase tracking-wider">
                    Choose a profile avatar
                  </label>

                  <div className="grid grid-cols-4 gap-2.5 p-3 rounded-2xl bg-black/40 border border-white/10">
                    {avatarOptions.map((av, i) => {
                      const isSelected = selectedAvatar === av.icon;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedAvatar(av.icon)}
                          title={av.name}
                          className={`aspect-square rounded-xl text-xl flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-rose-600 text-white scale-110 shadow-lg shadow-rose-600/50 ring-2 ring-rose-400'
                              : 'bg-white/5 hover:bg-white/10 text-white'
                          }`}
                        >
                          {av.icon}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-2 text-center">
                    Select an avatar to use on the video call & game boards!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 6. HOW WATCH WORKS (Teleparty Screenshot 5 Interactive Stepper)        */}
      {/* ===================================================================== */}
      <section id="how-it-works" className="relative z-10 px-4 sm:px-8 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
            STEP-BY-STEP SIMPLICITY
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2 mb-3">
            How Watch works
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto">
            Everything runs in the web browser. No plugins, no desktop applications, and no complicated setup.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left: Interactive Vertical Step List with Active Red/Rose Bar (Teleparty Screenshot 5) */}
          <div className="lg:col-span-5 space-y-2.5 text-left">
            {howItWorksSteps.map((step, idx) => {
              const isActive = activeStep === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all relative border ${
                    isActive
                      ? 'bg-[#1e0f1e] border-rose-500/40 shadow-lg shadow-rose-600/10'
                      : 'bg-[#150a15]/70 border-white/[0.06] hover:bg-white/5'
                  }`}
                >
                  {/* Active Indicator Left Bar (Just like Teleparty Screenshot 5) */}
                  {isActive && (
                    <div className="absolute left-0 top-3 bottom-3 w-1.5 bg-gradient-to-b from-rose-500 to-pink-500 rounded-r-full" />
                  )}

                  <div className="pl-2">
                    <h3 className={`text-sm font-black transition-colors ${
                      isActive ? 'text-rose-300' : 'text-zinc-300'
                    }`}>
                      {step.title}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 font-normal">
                      {step.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Quick Action under the steps */}
            <div className="pt-2 pl-2">
              <button
                onClick={handleGetStarted}
                className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition flex items-center gap-2"
              >
                <span>Try Step 1: Create Room Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right: Big Dynamic Preview Stage for the Selected Step */}
          <div className="lg:col-span-7 text-left">
            <div className="rounded-3xl p-3 sm:p-5 bg-[#170c18] border border-rose-500/30 shadow-2xl relative overflow-hidden">
              
              {/* Media image preview */}
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-inner">
                <img
                  src={howItWorksSteps[activeStep].image}
                  alt={howItWorksSteps[activeStep].title}
                  className="w-full h-full object-cover opacity-85 transition-opacity duration-300"
                />
                
                {/* Step badge overlay */}
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-rose-600 text-white font-bold text-[10px] shadow-lg flex items-center gap-1.5">
                  <Check className="w-3 h-3" />
                  <span>{howItWorksSteps[activeStep].badge}</span>
                </div>

                <div className="absolute bottom-3 left-3 right-3 p-2.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-[11px] text-zinc-300 font-medium">
                  {howItWorksSteps[activeStep].caption}
                </div>
              </div>

              {/* Explanatory description below the stage */}
              <div className="mt-4 p-2">
                <h3 className="text-base font-black text-rose-300 mb-1">
                  {howItWorksSteps[activeStep].title}
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {howItWorksSteps[activeStep].desc}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 7. DEDICATED GAMES SPOTLIGHT (Ludo & Four-in-a-Row Duels)              */}
      {/* ===================================================================== */}
      <section id="games" className="relative z-10 px-4 sm:px-8 py-20 border-y border-white/[0.08] bg-[#110812]/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto text-center">
          <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
            STRICT ZERO-BOTS POLICY • 100% HUMAN DUELS
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2 mb-4">
            Play 2-Player Games with Live Video Call
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto mb-12">
            No fake bots, no boring computerized moves. Play real strategic duels face-to-face on live camera.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-left">
            
            {/* Ludo Card */}
            <div
              onClick={() => router.push('/games/ludo')}
              className="group relative rounded-3xl p-7 bg-gradient-to-b from-[#1f0f20] to-[#140815] border border-rose-500/30 hover:border-rose-400/60 cursor-pointer transition-all hover:-translate-y-1.5 shadow-2xl hover:shadow-[0_20px_60px_rgba(244,63,94,0.25)] flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-5xl">🐻 🐸</span>
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    2-Player Classic
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white group-hover:text-rose-300 transition-colors">
                  Cottagecore 3D Ludo
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Play with cute ceramic tokens: Teddy Bears vs Happy Frogs. Features 7 dynamic board themes, live camera feed right above the board, turn nudges, and dice sound effects!
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-xs font-black text-rose-400 flex items-center gap-1.5">
                  <span>Start Ludo Duel</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="text-[10px] text-zinc-400 font-bold">2 Players · Live Call</span>
              </div>
            </div>

            {/* Four-in-a-Row Card */}
            <div
              onClick={() => router.push('/games/four-in-a-row')}
              className="group relative rounded-3xl p-7 bg-gradient-to-b from-[#1f0c1d] to-[#140814] border border-pink-500/30 hover:border-pink-400/60 cursor-pointer transition-all hover:-translate-y-1.5 shadow-2xl hover:shadow-[0_20px_60px_rgba(236,72,153,0.25)] flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-5xl">🔴 🟣</span>
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-pink-500/20 text-pink-300 border border-pink-500/40">
                    Connect 4 Stand
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white group-hover:text-pink-300 transition-colors">
                  Four in a Row (Connect 4)
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Drop discs into a vertical 7x6 stand board to connect 4 in a row. Comes with live camera feeds, floating picture-in-picture window, animated stickers, and instant rematch.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-xs font-black text-pink-400 flex items-center gap-1.5">
                  <span>Play Four in a Row</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="text-[10px] text-zinc-400 font-bold">Connect 4 · Rematch Ready</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 8. FAQ ACCORDION                                                      */}
      {/* ===================================================================== */}
      <section id="faq" className="relative z-10 px-4 sm:px-8 py-20 max-w-3xl mx-auto w-full">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
            GOT QUESTIONS?
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2 mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Clear, honest answers in plain language — no technical terms or confusing jargon.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  isOpen
                    ? 'bg-[#1e0f1f]/95 border-rose-500/40'
                    : 'bg-[#150a15]/80 border-white/[0.08] hover:border-white/15'
                }`}
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
                  <div className="px-5 pb-5 text-xs text-zinc-400 leading-relaxed border-t border-rose-500/15 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 9. BOTTOM RADIANT CALL TO ACTION                                      */}
      {/* ===================================================================== */}
      <section className="relative z-10 px-4 sm:px-8 py-20 max-w-4xl mx-auto w-full text-center">
        <div className="relative overflow-hidden p-10 sm:p-16 rounded-3xl bg-gradient-to-r from-rose-950/60 via-[#1d0a1b] to-pink-950/60 border border-rose-500/40 shadow-2xl backdrop-blur-2xl flex flex-col items-center">
          
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-600 to-pink-600 flex items-center justify-center text-white mb-5 shadow-xl shadow-rose-600/40">
            <Heart className="w-7 h-7 fill-current" />
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Ready to Watch & Play Together?
          </h2>

          <p className="text-xs sm:text-sm text-zinc-300 max-w-md mb-8 leading-relaxed">
            Create your free room in 10 seconds. Send your link on WhatsApp to your favorite person and make long distance feel like sitting on the same couch.
          </p>

          <button
            onClick={handleGetStarted}
            className="px-10 py-4 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500 text-white font-black text-sm shadow-2xl shadow-rose-600/40 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Start For Free Right Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 10. FOOTER                                                            */}
      {/* ===================================================================== */}
      <footer className="relative z-10 border-t border-white/[0.08] px-4 sm:px-8 py-8 bg-[#09040a] text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-gradient-to-br from-rose-600 to-pink-600 rounded-lg text-white">
              <Film className="w-3.5 h-3.5 fill-current" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-white text-sm">
                Watch<span className="text-rose-500">.</span>
              </span>
              <span className="text-[8px] font-semibold text-zinc-500 tracking-widest uppercase mt-0.5">
                Powered by StitchByte
              </span>
            </div>
            <span className="text-zinc-700">|</span>
            <span className="text-zinc-400">Stream in sync & play 2-player games online</span>
          </div>

          <div className="flex items-center space-x-6 text-[11px] font-semibold text-zinc-400">
            <button onClick={() => router.push('/dashboard')} className="hover:text-white transition">
              Dashboard
            </button>
            <button onClick={() => router.push('/games/ludo')} className="hover:text-white transition">
              Ludo 3D
            </button>
            <button onClick={() => router.push('/games/four-in-a-row')} className="hover:text-white transition">
              Four in a Row
            </button>
            <button onClick={() => setIsAuthModalOpen(true)} className="hover:text-white transition">
              Sign In
            </button>
          </div>

          <div className="text-[11px] text-zinc-600">
            © {new Date().getFullYear()} Watch · Powered by StitchByte. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
