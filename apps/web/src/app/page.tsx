'use client';

import React, { useState, useEffect } from 'react';
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
  Laptop,
  Check,
  CheckCircle2,
  Menu,
  X
} from 'lucide-react';
import { getStoredSession, clearStoredSession, UserSession } from '../lib/api';
import { AuthModal } from '../components/auth/AuthModal';

export default function LandingPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('🐻');
  const [customNickname, setCustomNickname] = useState<string>('Alex');
  const [hostOnlyControl, setHostOnlyControl] = useState<boolean>(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const stored = getStoredSession();
    if (stored && !stored.user.isAnonymous) {
      // User is logged in: ALWAYS redirect directly to dashboard with any query params
      const search = typeof window !== 'undefined' ? window.location.search : '';
      router.replace(`/dashboard${search}`);
      return;
    }
    setSession(stored);
  }, [router]);

  const handleAuthSuccess = (newSession: UserSession) => {
    setSession(newSession);
    setIsAuthModalOpen(false);
    const search = typeof window !== 'undefined' ? window.location.search : '';
    router.push(`/dashboard${search}`);
  };

  const handleGetStarted = () => {
    const current = getStoredSession();
    const search = typeof window !== 'undefined' ? window.location.search : '';
    if (current && !current.user.isAnonymous) {
      router.push(`/dashboard${search}`);
    } else {
      setIsAuthModalOpen(true);
    }
  };

  const handlePlayGame = (gamePath: string) => {
    const current = getStoredSession();
    if (current && !current.user.isAnonymous) {
      router.push(gamePath);
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
      desc: 'Click "Get Started" or "Sign In". No Chrome extension to download, no credit card, no sign-up hassle. Your private room is ready in 3 seconds.',
      badge: 'Instant Setup',
      image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1000&auto=format&fit=crop&q=80',
      caption: 'Private Room is ready. Secure invite link generated.'
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
    { title: 'Stranger Things', type: 'Sci-Fi Series', tag: 'Streaming', img: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500&auto=format&fit=crop&q=80', isGame: false },
    { title: 'Cottagecore Ludo 3D', type: '2-Player Board Game', tag: 'Instant Game', img: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=500&auto=format&fit=crop&q=80', isGame: true },
    { title: 'Interstellar (4K)', type: 'Cinema Masterpiece', tag: 'Streaming', img: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80', isGame: false },
    { title: 'Four in a Row Duel', type: 'Connect 4 Strategy', tag: 'Instant Game', img: 'https://images.unsplash.com/photo-1606167668584-78701c57f13d?w=500&auto=format&fit=crop&q=80', isGame: true },
    { title: 'Anime & Demon Slayer', type: 'Animation Party', tag: 'Streaming', img: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80', isGame: false },
    { title: 'Lofi Girl Live Beats', type: 'Study & Chill', tag: 'Streaming', img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80', isGame: false },
  ];

  const faqs = [
    {
      q: 'What is Watch? Is it completely free to use?',
      a: 'Watch is 100% free! It is the modern social entertainment platform designed for couples and friends. You can stream videos in exact sub-second sync, talk on live face-to-face video call, and play 2-player games like Cottagecore Ludo and Four-in-a-Row together in one room. No subscriptions or hidden fees.'
    },
    {
      q: 'Do I or my friend need to download a browser extension like Teleparty?',
      a: 'No! Unlike Teleparty which forces you to install desktop Chrome extensions, Watch requires ZERO downloads and zero extensions. It runs natively right inside Safari, Chrome, Edge, Brave, or Firefox on iPhones, Android phones, Macs, and Windows PCs.'
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
      a: 'Click "Get Started", enter your name, and copy your Partner Code from the dashboard. Once your partner inputs it, your accounts are paired permanently.'
    }
  ];

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col selection:bg-rose-500 selection:text-white font-sans antialiased overflow-x-hidden">

      {/* ===================================================================== */}
      {/* 1. TOP NAVBAR (Fully Responsive with Mobile Hamburger)                */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/95 border-b border-zinc-200/80 px-4 sm:px-8 py-3 transition-all shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Brand Logo with "Powered by StitchByte" subtext */}
          <div onClick={() => router.push('/')} className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer select-none shrink-0 group">
            <div className="p-2 bg-gradient-to-br from-rose-600 to-pink-600 rounded-xl text-white shadow-md shadow-rose-600/30 group-hover:scale-105 transition-transform">
              <Film className="w-4 h-4 fill-current" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg sm:text-xl font-black tracking-tight text-zinc-950 flex items-center gap-0.5">
                Watch<span className="text-rose-600 text-xl sm:text-2xl leading-none">.</span>
              </span>
              <span className="text-[7.5px] sm:text-[8.5px] font-bold text-zinc-500 tracking-widest uppercase mt-0.5">
                Powered by StitchByte
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-6 lg:space-x-8 text-xs font-bold text-zinc-600 tracking-wide">
            <a href="#features" className="hover:text-rose-600 transition-colors">Features</a>
            <a href="#catalog" className="hover:text-rose-600 transition-colors">Movies & Shows</a>
            <a href="#games" className="hover:text-rose-600 transition-colors flex items-center gap-1.5">
              <span>Games</span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 text-rose-700 border border-rose-200">New</span>
            </a>
            <a href="#customize" className="hover:text-rose-600 transition-colors">Customize</a>
            <a href="#how-it-works" className="hover:text-rose-600 transition-colors">How It Works</a>
            <a href="#faq" className="hover:text-rose-600 transition-colors">FAQ</a>
          </nav>

          {/* Right Header CTAs (Desktop & Mobile) */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {session && !session.user.isAnonymous ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    const search = typeof window !== 'undefined' ? window.location.search : '';
                    router.push(`/dashboard${search}`);
                  }}
                  className="px-3.5 sm:px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-xs font-black text-white rounded-xl shadow-md shadow-rose-600/25 transition active:scale-95 flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => { clearStoredSession(); setSession(null); }}
                  className="p-2 text-xs text-zinc-500 hover:text-zinc-900 rounded-xl hover:bg-zinc-100 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-3 sm:px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-800 rounded-xl border border-zinc-200 transition"
                >
                  Sign In
                </button>
                <button
                  onClick={handleGetStarted}
                  className="px-3.5 sm:px-5 py-2 bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500 text-xs font-black text-white rounded-xl shadow-md shadow-rose-600/30 transition transform active:scale-95 flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 hidden sm:inline" />
                  <span>Get Started</span>
                </button>
              </div>
            )}

            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-zinc-600 hover:text-zinc-950 rounded-xl hover:bg-zinc-100 transition"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Sheet */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-200 mt-3 pt-3 pb-4 space-y-2 px-2 bg-white animate-in fade-in slide-in-from-top-2">
            <a
              href="#features"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-bold text-zinc-700 hover:bg-zinc-100 transition"
            >
              Features
            </a>
            <a
              href="#catalog"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-bold text-zinc-700 hover:bg-zinc-100 transition"
            >
              Movies & Shows
            </a>
            <a
              href="#games"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-bold text-zinc-700 hover:bg-zinc-100 transition flex items-center justify-between"
            >
              <span>Games</span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 text-rose-700 border border-rose-200">New</span>
            </a>
            <a
              href="#customize"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-bold text-zinc-700 hover:bg-zinc-100 transition"
            >
              Customize
            </a>
            <a
              href="#how-it-works"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-bold text-zinc-700 hover:bg-zinc-100 transition"
            >
              How It Works
            </a>
            <a
              href="#faq"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-bold text-zinc-700 hover:bg-zinc-100 transition"
            >
              FAQ
            </a>
          </div>
        )}
      </header>

      {/* ===================================================================== */}
      {/* 2. HERO SECTION (White Background, Teleparty Split Screen Layout)      */}
      {/* ===================================================================== */}
      <section className="relative z-10 px-4 sm:px-8 pt-8 sm:pt-16 pb-12 sm:pb-16 max-w-7xl mx-auto bg-white">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Big Sleek Theater Preview Mockup on Clean White */}
          <div className="lg:col-span-7 order-2 lg:order-1 w-full">
            <div className="relative rounded-2xl sm:rounded-3xl p-1 sm:p-1.5 bg-gradient-to-b from-zinc-200 via-rose-100 to-zinc-200 shadow-[0_15px_40px_rgba(0,0,0,0.1)] group">
              <div className="rounded-xl sm:rounded-[22px] bg-zinc-950 text-white overflow-hidden relative shadow-inner">
                
                {/* Mock Browser Header */}
                <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900 border-b border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-rose-500/80" />
                    <span className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-amber-500/80" />
                    <span className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-emerald-500/80" />
                    <span className="ml-1 sm:ml-2 font-mono text-zinc-400 text-[10px] sm:text-[11px] truncate max-w-[140px] sm:max-w-none">
                      watch.stitchbyte.in/room/ROMANTIC-NIGHT-♥
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold text-[9px] sm:text-[10px] border border-rose-500/40 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                      Synced (0ms lag)
                    </span>
                  </div>
                </div>

                {/* Theater Screen with Synchronized Video + In-Room Chat Sidebar */}
                <div className="grid grid-cols-1 md:grid-cols-12">
                  
                  {/* Left video area (8 cols) */}
                  <div className="md:col-span-8 p-2.5 sm:p-4 flex flex-col justify-between space-y-2.5 sm:space-y-3 bg-black">
                    <div className="relative aspect-video rounded-xl sm:rounded-2xl overflow-hidden bg-black border border-white/10 shadow-inner group">
                      <img
                        src="https://img.youtube.com/vi/zSWdZVtXT7E/maxresdefault.jpg"
                        alt="Cinema Synchronized Player"
                        className="w-full h-full object-cover opacity-85"
                      />
                      
                      {/* Dark gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 flex flex-col justify-between p-2.5 sm:p-4">
                        {/* Top tag */}
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] sm:text-[10px] font-bold text-white border border-white/10">
                            4K HDR ULTRA
                          </span>
                          <div className="flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] sm:text-[11px] font-semibold">
                            <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Live Call
                          </div>
                        </div>

                        {/* Player Controls Bar */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] sm:text-xs text-white mb-1.5 sm:mb-2">
                            <div className="flex items-center gap-1.5 sm:gap-2 truncate mr-2">
                              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-md shrink-0">
                                <Play className="w-3 h-3 fill-current ml-0.5" />
                              </div>
                              <span className="font-black truncate">Interstellar: Space Horizon</span>
                            </div>
                            <span className="text-[10px] sm:text-[11px] font-mono text-rose-300 shrink-0">1:28:44</span>
                          </div>
                          
                          {/* Progress Line */}
                          <div className="w-full h-1 sm:h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div className="w-[58%] h-full bg-gradient-to-r from-rose-600 to-pink-500 rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Integrated 2-Player Game Bar right inside the room preview */}
                    <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-gradient-to-br from-rose-600/40 to-pink-600/40 border border-rose-500/50 flex items-center justify-center text-rose-300 shrink-0">
                          <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] sm:text-xs font-black text-white flex items-center gap-1 sm:gap-1.5 truncate">
                            <span className="truncate">Ready for Ludo?</span>
                            <span className="text-[8.5px] px-1 py-0.2 rounded bg-rose-500/30 text-rose-300 font-bold shrink-0">2-Player</span>
                          </div>
                          <div className="text-[9.5px] sm:text-[10px] text-zinc-400 truncate">Teddy Bears vs Happy Frogs · Zero Bots</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePlayGame('/games/ludo')}
                        className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-rose-600 hover:bg-rose-500 text-[10px] sm:text-[11px] font-bold text-white transition shadow-sm shrink-0"
                      >
                        Launch
                      </button>
                    </div>
                  </div>

                  {/* Right Chat & Reactions Column (4 cols) */}
                  <div className="md:col-span-4 p-2.5 sm:p-4 border-t md:border-t-0 md:border-l border-white/10 flex flex-col justify-between space-y-2 sm:space-y-3 bg-zinc-900/90">
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-white/10">
                        <span className="font-bold text-xs text-white flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-rose-400" />
                          Party Chat
                        </span>
                        <span className="text-[10px] text-zinc-400">3 online</span>
                      </div>

                      {/* Message Bubbles */}
                      <div className="space-y-2">
                        <div className="flex items-start gap-1.5 sm:gap-2">
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-rose-600 text-white font-bold text-[9px] sm:text-[10px] flex items-center justify-center shrink-0">
                            P
                          </div>
                          <div className="p-1.5 sm:p-2 rounded-xl sm:rounded-2xl bg-white/10 text-white text-[10px] sm:text-[11px] leading-tight">
                            The music is giving me goosebumps! 😭✨
                          </div>
                        </div>

                        <div className="flex items-start gap-1.5 sm:gap-2 justify-end">
                          <div className="p-1.5 sm:p-2 rounded-xl sm:rounded-2xl bg-rose-600/40 border border-rose-500/40 text-rose-100 text-[10px] sm:text-[11px] leading-tight">
                            Rematch on Four-in-a-Row after this? 🔴
                          </div>
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-pink-600 text-white font-bold text-[9px] sm:text-[10px] flex items-center justify-center shrink-0">
                            Y
                          </div>
                        </div>

                        {/* Animated Sticker Box */}
                        <div className="p-1.5 sm:p-2 rounded-xl sm:rounded-2xl bg-white/5 border border-rose-500/20 text-center">
                          <img
                            src="https://media4.giphy.com/media/Pw4DoWaNHDj8YVCWtu/giphy.gif"
                            alt="Bubu Dudu Dance"
                            className="w-10 h-10 sm:w-12 sm:h-12 object-contain mx-auto"
                          />
                          <span className="text-[8.5px] sm:text-[9px] font-bold text-rose-300">Bubu & Dudu Reaction</span>
                        </div>
                      </div>
                    </div>

                    {/* Chat Input placeholder */}
                    <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-black/50 border border-white/10 text-[10px] sm:text-[11px] text-zinc-400 flex items-center justify-between">
                      <span>Type message...</span>
                      <Smile className="w-3.5 h-3.5 text-rose-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Value Proposition (Teleparty Style: Bold Headline & Subhead) */}
          <div className="lg:col-span-5 order-1 lg:order-2 text-left space-y-4 sm:space-y-6">
            
            {/* Category Pill */}
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-rose-600" />
              <span>WATCH & PLAY WITH FRIENDS</span>
            </div>

            {/* Massive Bold Headline on White */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-950 leading-[1.1]">
              A new way to <br />
              <span className="bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 bg-clip-text text-transparent">
                watch & play together
              </span>
            </h1>

            {/* Explanatory Lead Paragraph */}
            <p className="text-sm sm:text-base lg:text-lg text-zinc-700 leading-relaxed font-normal">
              Watch is the modern social entertainment platform to stream videos and play live games with your favorite people online.
            </p>

            <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
              Watch synchronizes video playback with sub-second accuracy, adds in-room face-to-face video calls, real-time group chat with cute stickers, and live 2-player games like Cottagecore Ludo and Four-in-a-Row.
            </p>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={handleGetStarted}
                className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500 text-white font-black text-sm shadow-xl shadow-rose-600/30 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Get Watch for free!</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => handlePlayGame('/games/ludo')}
                className="w-full sm:w-auto px-5 sm:px-6 py-3.5 sm:py-4 rounded-2xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-300/80 text-zinc-900 font-bold text-sm transition flex items-center justify-center gap-2"
              >
                <Gamepad2 className="w-4 h-4 text-rose-600" />
                <span>Play 2-Player Games</span>
              </button>
            </div>

            {/* Key Differentiator Notice (No Extension Needed!) */}
            <div className="text-[11px] sm:text-xs text-zinc-500 flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
              <span>*100% Free · No Chrome extension required · Runs natively on iOS, Android & PC</span>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* PLATFORM & GAMES BADGE ROW (Teleparty's "Host a Watch Party on...") */}
        {/* =================================================================== */}
        <div className="mt-12 sm:mt-16 pt-6 sm:pt-8 border-t border-zinc-200 text-center">
          <p className="text-[10px] sm:text-xs font-bold tracking-widest text-zinc-400 uppercase mb-4 sm:mb-6">
            STREAM VIDEOS & PLAY GAMES TOGETHER ON
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            {/* YouTube */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-900 font-black text-xs sm:text-sm">
              <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-red-600" />
              <span>YouTube 4K</span>
            </div>

            {/* Cottagecore Ludo 3D */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-black text-xs sm:text-sm">
              <span className="text-sm sm:text-base">🎲</span>
              <span>Cottagecore Ludo 3D</span>
            </div>

            {/* Four in a Row */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-pink-50 border border-pink-200 text-pink-700 font-black text-xs sm:text-sm">
              <span className="text-sm sm:text-base">🔴</span>
              <span>Four in a Row</span>
            </div>

            {/* Live Video Call */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-900 font-black text-xs sm:text-sm">
              <Video className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-emerald-600" />
              <span>Live Video Calls</span>
            </div>

            {/* Animated Stickers */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-900 font-black text-xs sm:text-sm">
              <Smile className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-amber-500" />
              <span>Bubu & Dudu</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. SHOWS, MOVIES & GAMES CATALOG (Teleparty Screenshot 2 Style)        */}
      {/* ===================================================================== */}
      <section id="catalog" className="relative z-10 px-4 sm:px-8 py-14 sm:py-20 border-y border-zinc-200 bg-zinc-50">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          
          {/* Left Text Column */}
          <div className="lg:col-span-5 text-left space-y-4 sm:space-y-5">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
              MILLIONS OF SHOWS, MOVIES & MATCHES
            </span>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-zinc-950 tracking-tight leading-tight">
              Watch right on your favorite streams & play instant games
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
              Create watch parties in seconds for YouTube clips, music livestreams, film trailers, anime series, or jump right into high-stakes 2-player matches of 3D Ludo and Connect 4 without ever switching applications.
            </p>

            <div className="space-y-2.5 sm:space-y-3 pt-1 sm:pt-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
                <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Exact same-second video sync with Cristian NTP engine</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
                <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Zero bots guarantee: strictly 100% human duels</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
                <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Live video call & audio chat while playing or watching</span>
              </div>
            </div>

            <div className="pt-2 sm:pt-4">
              <button
                onClick={handleGetStarted}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-md shadow-rose-600/30 flex items-center justify-center gap-2"
              >
                <span>Browse & Watch Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Posters & Games Grid (Teleparty Screenshot 2 Gallery) */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {catalogCards.map((card, idx) => (
              <div
                key={idx}
                onClick={() => {
                  if (card.isGame) {
                    if (card.title.includes('Ludo')) handlePlayGame('/games/ludo');
                    else handlePlayGame('/games/four-in-a-row');
                  } else {
                    handleGetStarted();
                  }
                }}
                className="group relative rounded-xl sm:rounded-2xl overflow-hidden aspect-[3/4] bg-zinc-200 border border-zinc-300 hover:border-rose-500 cursor-pointer shadow-sm hover:shadow-lg transition-all hover:-translate-y-1"
              >
                <img
                  src={card.img}
                  alt={card.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* Gradient shade */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex flex-col justify-between p-2.5 sm:p-3.5">
                  <div className="flex justify-end">
                    <span className={`px-2 py-0.5 rounded-full text-[8.5px] sm:text-[9px] font-black uppercase ${
                      card.isGame
                        ? 'bg-rose-600 text-white shadow'
                        : 'bg-black/60 text-white backdrop-blur-md'
                    }`}>
                      {card.tag}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-white group-hover:text-rose-200 transition-colors leading-tight">
                      {card.title}
                    </h3>
                    <p className="text-[9.5px] sm:text-[10px] text-zinc-300 mt-0.5 font-medium">{card.type}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 4. SYNC IN HD & MULTI-SCREEN (Fully Responsive Devices Mockup)         */}
      {/* ===================================================================== */}
      <section className="relative z-10 px-4 sm:px-8 py-14 sm:py-20 max-w-7xl mx-auto bg-white">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Text Column */}
          <div className="lg:col-span-5 text-left space-y-4 sm:space-y-5">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
              SYNCHRONIZE WITH YOUR FRIENDS
            </span>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-zinc-950 tracking-tight leading-tight">
              Sync Watch Parties & Games in HD
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 leading-relaxed font-normal">
              Always stay precisely in sync when you are watching shows or throwing dice in Ludo. Enjoy ultra-low latency, crystal-clear HD video quality, and fast buffering on both desktop and mobile.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1 sm:pt-2">
              <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
                <div className="text-base sm:text-lg font-black text-zinc-950 flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-rose-600" />
                  <span>Desktop</span>
                </div>
                <div className="text-[11px] sm:text-xs text-zinc-500 mt-1">Full-screen theater & PIP video call</div>
              </div>
              <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
                <div className="text-base sm:text-lg font-black text-zinc-950 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-pink-600" />
                  <span>Mobile</span>
                </div>
                <div className="text-[11px] sm:text-xs text-zinc-500 mt-1">Zero app install on iPhone & Android</div>
              </div>
            </div>
          </div>

          {/* Right Dual-Device Mockup (Laptop + Phone Synchronized side-by-side) */}
          <div className="lg:col-span-7 flex items-center justify-center relative pt-4 pb-8 sm:py-0">
            
            {/* Laptop Frame */}
            <div className="w-full max-w-[340px] sm:max-w-[480px] rounded-2xl bg-zinc-900 p-2 sm:p-2.5 shadow-2xl relative border border-zinc-700">
              <div className="rounded-xl overflow-hidden aspect-video bg-black relative">
                <img
                  src="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80"
                  alt="Desktop Watch Sync"
                  className="w-full h-full object-cover opacity-85"
                />
                
                {/* Synced playhead indicator */}
                <div className="absolute top-2 sm:top-3 left-2 sm:left-3 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold border border-white/10 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Desktop: In Sync</span>
                </div>

                {/* Video call floating bubble */}
                <div className="absolute top-2 sm:top-3 right-2 sm:right-3 w-12 sm:w-16 h-9 sm:h-12 rounded-lg sm:rounded-xl bg-rose-600/40 border border-rose-500/60 backdrop-blur-md flex items-center justify-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-rose-600 text-[9px] sm:text-[10px] font-bold flex items-center justify-center text-white">Y</div>
                </div>
              </div>
              <div className="h-2.5 sm:h-3 bg-zinc-800 rounded-b-lg mt-1 mx-6 sm:mx-8" />
            </div>

            {/* Mobile Phone Mockup overlapping the laptop */}
            <div className="absolute -bottom-4 sm:-bottom-6 right-0 sm:right-6 w-32 sm:w-44 rounded-2xl sm:rounded-3xl bg-zinc-900 p-1.5 sm:p-2 border-2 border-rose-500 shadow-2xl z-20">
              <div className="rounded-xl sm:rounded-2xl overflow-hidden aspect-[9/16] bg-black relative flex flex-col justify-between p-2">
                <img
                  src="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80"
                  alt="Mobile Watch Sync"
                  className="absolute inset-0 w-full h-full object-cover opacity-85"
                />
                
                {/* Mobile Sync Pill */}
                <div className="relative z-10 px-1.5 py-0.5 rounded-full bg-black/70 text-[8px] font-bold text-rose-300 border border-rose-500/40 text-center">
                  ● Mobile Synced
                </div>

                {/* Mobile Floating PIP */}
                <div className="relative z-10 self-end w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-pink-600/50 border border-pink-400 flex items-center justify-center">
                  <span className="text-[9px] sm:text-[10px] font-black text-white">P</span>
                </div>

                {/* Chat bubble overlay */}
                <div className="relative z-10 p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-black/80 backdrop-blur-md text-[8px] sm:text-[8.5px] text-white">
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
      <section id="customize" className="relative z-10 px-4 sm:px-8 py-14 sm:py-20 border-y border-zinc-200 bg-zinc-50">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          
          {/* Left Text Column */}
          <div className="lg:col-span-5 text-left space-y-4 sm:space-y-5">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
              MAKE IT YOURS
            </span>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-zinc-950 tracking-tight leading-tight">
              Customize your Watch Room & Avatars
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 leading-relaxed font-normal">
              Customize your experience by picking fun handcrafted avatars (Teddy Bears, Happy Frogs, Panda, Kitten, food & cinema icons) and custom nicknames.
            </p>
            <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
              Set host-only playback controls so nobody accidentally skips ahead, toggle in-room live camera feeds, and express every laugh with animated stickers.
            </p>

            <div className="pt-1 sm:pt-2">
              <button
                onClick={handleGetStarted}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs transition shadow-md shadow-rose-600/30 flex items-center justify-center gap-2"
              >
                <span>Create Your Custom Room</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Interactive Customizer Card (Teleparty Screenshot 4 Mockup on White) */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-white border border-zinc-200 shadow-xl relative">
              
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 sm:gap-6">
                
                {/* Left part: Nickname & Control Toggle */}
                <div className="sm:col-span-6 space-y-3 sm:space-y-4 text-left">
                  
                  {/* Set a Nickname */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">
                      Set a Nickname
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={customNickname}
                        onChange={(e) => setCustomNickname(e.target.value)}
                        placeholder="My name is..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-300 text-zinc-900 text-xs font-bold focus:outline-none focus:border-rose-500 transition"
                      />
                    </div>
                  </div>

                  {/* Active Preview Tag */}
                  <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-rose-600 to-pink-600 flex items-center justify-center text-lg sm:text-xl shadow-md text-white shrink-0">
                      {selectedAvatar}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-zinc-900 truncate">{customNickname || 'Anonymous'}</div>
                      <div className="text-[10px] text-rose-600 font-bold">Ready to Watch & Play</div>
                    </div>
                  </div>

                  {/* Room Controls Toggle (Host Only Control) */}
                  <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-900">Host-Only Control</div>
                        <div className="text-[10px] text-zinc-500">Only host can play/pause video</div>
                      </div>
                      
                      {/* Interactive Switch */}
                      <button
                        type="button"
                        onClick={() => setHostOnlyControl(!hostOnlyControl)}
                        className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                          hostOnlyControl ? 'bg-rose-600' : 'bg-zinc-300'
                        }`}
                      >
                        <span
                          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow ${
                            hostOnlyControl ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Start Button */}
                  <button
                    onClick={handleGetStarted}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500 text-xs font-black text-white shadow-md shadow-rose-600/30 transition"
                  >
                    Start the Party with this Profile
                  </button>
                </div>

                {/* Right part: Choose Avatar Grid (Just like Teleparty Screenshot 4) */}
                <div className="sm:col-span-6 text-left">
                  <label className="block text-xs font-bold text-zinc-700 mb-2 uppercase tracking-wider">
                    Choose a profile avatar
                  </label>

                  <div className="grid grid-cols-4 gap-2 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-zinc-50 border border-zinc-200">
                    {avatarOptions.map((av, i) => {
                      const isSelected = selectedAvatar === av.icon;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedAvatar(av.icon)}
                          title={av.name}
                          className={`aspect-square rounded-xl text-lg sm:text-xl flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-rose-600 text-white scale-105 shadow-md shadow-rose-600/50 ring-2 ring-rose-400'
                              : 'bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200'
                          }`}
                        >
                          {av.icon}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-2 text-center">
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
      <section id="how-it-works" className="relative z-10 px-4 sm:px-8 py-14 sm:py-20 max-w-7xl mx-auto bg-white">
        <div className="text-center mb-8 sm:mb-12">
          <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
            STEP-BY-STEP SIMPLICITY
          </span>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-zinc-950 tracking-tight mt-1.5 sm:mt-2 mb-2 sm:mb-3">
            How Watch works
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 max-w-xl mx-auto">
            Everything runs directly in the web browser. No plugins, no desktop applications, and no complicated setup.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          
          {/* Left: Interactive Vertical Step List with Active Red/Rose Bar (Teleparty Screenshot 5) */}
          <div className="lg:col-span-5 space-y-2 text-left">
            {howItWorksSteps.map((step, idx) => {
              const isActive = activeStep === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl cursor-pointer transition-all relative border ${
                    isActive
                      ? 'bg-rose-50/70 border-rose-300 shadow-sm'
                      : 'bg-zinc-50 border-zinc-200/80 hover:bg-zinc-100'
                  }`}
                >
                  {/* Active Indicator Left Bar (Just like Teleparty Screenshot 5) */}
                  {isActive && (
                    <div className="absolute left-0 top-2.5 bottom-2.5 w-1 sm:w-1.5 bg-gradient-to-b from-rose-600 to-pink-600 rounded-r-full" />
                  )}

                  <div className="pl-1.5 sm:pl-2">
                    <h3 className={`text-xs sm:text-sm font-black transition-colors ${
                      isActive ? 'text-rose-700' : 'text-zinc-900'
                    }`}>
                      {step.title}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-zinc-500 mt-0.5 sm:mt-1 font-normal">
                      {step.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Quick Action under the steps */}
            <div className="pt-2">
              <button
                onClick={handleGetStarted}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/30 transition flex items-center justify-center gap-2"
              >
                <span>Try Step 1: Create Room Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right: Big Dynamic Preview Stage for the Selected Step */}
          <div className="lg:col-span-7 text-left">
            <div className="rounded-2xl sm:rounded-3xl p-3 sm:p-5 bg-white border border-zinc-200 shadow-xl relative overflow-hidden">
              
              {/* Media image preview */}
              <div className="relative aspect-video rounded-xl sm:rounded-2xl overflow-hidden bg-black border border-zinc-200 shadow-inner">
                <img
                  src={howItWorksSteps[activeStep].image}
                  alt={howItWorksSteps[activeStep].title}
                  className="w-full h-full object-cover opacity-90 transition-opacity duration-300"
                />
                
                {/* Step badge overlay */}
                <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-rose-600 text-white font-bold text-[9px] sm:text-[10px] shadow-md flex items-center gap-1.5">
                  <Check className="w-3 h-3" />
                  <span>{howItWorksSteps[activeStep].badge}</span>
                </div>

                <div className="absolute bottom-2.5 sm:bottom-3 left-2.5 sm:left-3 right-2.5 sm:right-3 p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-[10px] sm:text-[11px] text-zinc-200 font-medium">
                  {howItWorksSteps[activeStep].caption}
                </div>
              </div>

              {/* Explanatory description below the stage */}
              <div className="mt-3 sm:mt-4 p-1 sm:p-2">
                <h3 className="text-sm sm:text-base font-black text-rose-700 mb-1">
                  {howItWorksSteps[activeStep].title}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
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
      <section id="games" className="relative z-10 px-4 sm:px-8 py-14 sm:py-20 border-y border-zinc-200 bg-zinc-50">
        <div className="max-w-6xl mx-auto text-center">
          <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
            STRICT ZERO-BOTS POLICY • 100% HUMAN DUELS
          </span>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-zinc-950 tracking-tight mt-1.5 sm:mt-2 mb-3 sm:mb-4">
            Play 2-Player Games with Live Video Call
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 max-w-xl mx-auto mb-8 sm:mb-12">
            No fake bots, no boring computerized moves. Play real strategic duels face-to-face on live camera.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8 text-left">
            
            {/* Ludo Card */}
            <div
              onClick={() => handlePlayGame('/games/ludo')}
              className="group relative rounded-2xl sm:rounded-3xl p-5 sm:p-7 bg-white border border-zinc-200 hover:border-rose-500 cursor-pointer transition-all hover:-translate-y-1 shadow-md hover:shadow-xl flex flex-col justify-between space-y-4 sm:space-y-6"
            >
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-4xl sm:text-5xl">🐻 🐸</span>
                  <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase bg-rose-100 text-rose-700 border border-rose-200">
                    2-Player Classic
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-zinc-950 group-hover:text-rose-600 transition-colors">
                  Cottagecore 3D Ludo
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                  Play with cute ceramic tokens: Teddy Bears vs Happy Frogs. Features 7 dynamic board themes, live camera feed right above the board, turn nudges, and dice sound effects!
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                <span className="text-xs font-black text-rose-600 flex items-center gap-1.5">
                  <span>Start Ludo Duel</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="text-[10px] text-zinc-500 font-bold">2 Players · Live Call</span>
              </div>
            </div>

            {/* Four-in-a-Row Card */}
            <div
              onClick={() => handlePlayGame('/games/four-in-a-row')}
              className="group relative rounded-2xl sm:rounded-3xl p-5 sm:p-7 bg-white border border-zinc-200 hover:border-pink-500 cursor-pointer transition-all hover:-translate-y-1 shadow-md hover:shadow-xl flex flex-col justify-between space-y-4 sm:space-y-6"
            >
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-4xl sm:text-5xl">🔴 🟣</span>
                  <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase bg-pink-100 text-pink-700 border border-pink-200">
                    Connect 4 Stand
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-zinc-950 group-hover:text-pink-600 transition-colors">
                  Four in a Row (Connect 4)
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                  Drop discs into a vertical 7x6 stand board to connect 4 in a row. Comes with live camera feeds, floating picture-in-picture window, animated stickers, and instant rematch.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                <span className="text-xs font-black text-pink-600 flex items-center gap-1.5">
                  <span>Play Four in a Row</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="text-[10px] text-zinc-500 font-bold">Connect 4 · Rematch Ready</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 8. FAQ ACCORDION                                                      */}
      {/* ===================================================================== */}
      <section id="faq" className="relative z-10 px-4 sm:px-8 py-14 sm:py-20 max-w-3xl mx-auto w-full bg-white">
        <div className="text-center mb-8 sm:mb-12">
          <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
            GOT QUESTIONS?
          </span>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-zinc-950 tracking-tight mt-1.5 sm:mt-2 mb-2 sm:mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500">
            Clear, honest answers in plain language — no technical terms or confusing jargon.
          </p>
        </div>

        <div className="space-y-2.5 sm:space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className={`rounded-xl sm:rounded-2xl border transition-all overflow-hidden ${
                  isOpen
                    ? 'bg-rose-50/50 border-rose-300'
                    : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full px-4 sm:px-5 py-3.5 sm:py-4 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-zinc-900 hover:text-rose-600 transition"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-rose-600' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-xs sm:text-sm text-zinc-600 leading-relaxed border-t border-rose-100 pt-2.5 sm:pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 9. BOTTOM CALL TO ACTION                                              */}
      {/* ===================================================================== */}
      <section className="relative z-10 px-4 sm:px-8 py-12 sm:py-20 max-w-4xl mx-auto w-full text-center">
        <div className="relative overflow-hidden p-6 sm:p-12 lg:p-16 rounded-3xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 text-white shadow-2xl flex flex-col items-center">
          
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-rose-600 to-pink-600 flex items-center justify-center text-white mb-4 sm:mb-5 shadow-xl shadow-rose-600/40">
            <Heart className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
          </div>

          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-3 sm:mb-4">
            Ready to Watch & Play Together?
          </h2>

          <p className="text-xs sm:text-sm text-zinc-300 max-w-md mb-6 sm:mb-8 leading-relaxed">
            Create your free room in 10 seconds. Send your link on WhatsApp to your favorite person and make long distance feel like sitting on the same couch.
          </p>

          <button
            onClick={handleGetStarted}
            className="w-full sm:w-auto px-8 sm:px-10 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500 text-white font-black text-sm shadow-2xl shadow-rose-600/40 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2.5"
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
      <footer className="relative z-10 border-t border-zinc-200 px-4 sm:px-8 py-6 sm:py-8 bg-zinc-50 text-xs text-zinc-600">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-gradient-to-br from-rose-600 to-pink-600 rounded-lg text-white">
              <Film className="w-3.5 h-3.5 fill-current" />
            </div>
            <div className="flex flex-col leading-none text-left">
              <span className="font-black text-zinc-950 text-sm">
                Watch<span className="text-rose-600">.</span>
              </span>
              <span className="text-[8px] font-semibold text-zinc-500 tracking-widest uppercase mt-0.5">
                Powered by StitchByte
              </span>
            </div>
            <span className="text-zinc-300">|</span>
            <span className="text-zinc-500">Stream in sync & play 2-player games online</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[11px] font-semibold text-zinc-600">
            <button onClick={() => router.push('/dashboard')} className="hover:text-zinc-950 transition">
              Dashboard
            </button>
            <button onClick={() => handlePlayGame('/games/ludo')} className="hover:text-zinc-950 transition">
              Ludo 3D
            </button>
            <button onClick={() => handlePlayGame('/games/four-in-a-row')} className="hover:text-zinc-950 transition">
              Four in a Row
            </button>
            <button onClick={() => setIsAuthModalOpen(true)} className="hover:text-zinc-950 transition">
              Sign In
            </button>
          </div>

          <div className="text-[11px] text-zinc-500">
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
