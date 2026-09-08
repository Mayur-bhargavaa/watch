'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Film,
  Users,
  Zap,
  Shield,
  Play,
  ArrowRight,
  Sparkles,
  Tv,
  Globe,
  MessageSquare,
  Flame,
  Radio,
  Clock,
  Layers,
  Heart,
  ChevronRight,
  Share2,
  CheckCircle2,
  Volume2
} from 'lucide-react';
import { API_BASE, getStoredSession, clearStoredSession, createPartyRoom, UserSession } from '../lib/api';
import { AuthModal } from '../components/auth/AuthModal';
import { LandingHeroStage } from '../components/landing/LandingHeroStage';
import { LandingSyncSimulator } from '../components/landing/LandingSyncSimulator';
import { LandingComparisonTable } from '../components/landing/LandingComparisonTable';
import { LandingFAQ } from '../components/landing/LandingFAQ';

export default function LandingPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<(() => void) | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [joinSlug, setJoinSlug] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [roomTitle, setRoomTitle] = useState('Friday Movie Night');
  const [displayName, setDisplayName] = useState('');
  const [mediaUrl, setMediaUrl] = useState('https://www.youtube.com/watch?v=L_LUpnjgPso');
  const [providerType, setProviderType] = useState<'youtube' | 'direct_html5' | 'ott_fallback'>('youtube');
  const [activityMode, setActivityMode] = useState<'CINEMA' | 'GAMING'>('CINEMA');

  React.useEffect(() => {
    setSession(getStoredSession());
  }, []);

  // Quick preset pills
  const presets = [
    {
      title: 'Action Movie Night 🍿',
      url: 'https://www.youtube.com/watch?v=L_LUpnjgPso',
      provider: 'youtube' as const,
      activityMode: 'CINEMA' as const
    },
    {
      title: 'Trivia & Party Games Lounge 🎮',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      provider: 'youtube' as const,
      activityMode: 'GAMING' as const
    },
    {
      title: 'Anime Season Premiere ⚔️',
      url: 'https://www.youtube.com/watch?v=d_p_k29b2p4',
      provider: 'youtube' as const,
      activityMode: 'CINEMA' as const
    },
    {
      title: 'Open Source Direct MP4 🎬',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      provider: 'direct_html5' as const,
      activityMode: 'CINEMA' as const
    },
    {
      title: 'Netflix & Chill Browser Sync 🔒',
      url: 'https://www.netflix.com/browse',
      provider: 'ott_fallback' as const,
      activityMode: 'CINEMA' as const
    }
  ];

  const openCreateModalGated = (presetCallback?: () => void) => {
    const current = getStoredSession();
    if (!current || current.user.isAnonymous) {
      setIsAuthModalOpen(true);
      return;
    }
    // Logged in users must go to dashboard to launch room or game
    router.push('/dashboard');
  };

  const handleApplyPreset = (preset: typeof presets[0]) => {
    const current = getStoredSession();
    if (!current || current.user.isAnonymous) {
      setIsAuthModalOpen(true);
      return;
    }
    router.push('/dashboard');
  };

  const handleAuthSuccess = (newSession: UserSession) => {
    setSession(newSession);
    setIsAuthModalOpen(false);
    // User is taken immediately to the dashboard to launch room or games
    router.push('/dashboard');
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const current = getStoredSession();
    if (!current || current.user.isAnonymous) {
      setIsAuthModalOpen(true);
      setIsLoading(false);
      return;
    }

    try {
      const data = await createPartyRoom({
        title: roomTitle,
        sourceUrl: activityMode === 'GAMING' ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : mediaUrl,
        mediaTitle: roomTitle,
        activityMode,
        token: current.token
      });

      router.push(`/room/${data.room.slug}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
      setIsLoading(false);
    }
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinSlug.trim()) return;
    const cleanSlug = joinSlug.trim().replace(/^.*\/room\//, '');
    router.push(`/room/${cleanSlug}`);
  };

  return (
    <main className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-between relative overflow-x-hidden selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Background Ambient Glow Orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-emerald-600/15 via-indigo-600/10 to-transparent blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[600px] h-[600px] bg-pink-600/10 blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute top-[75%] left-[-10%] w-[700px] h-[500px] bg-teal-600/10 blur-[150px] rounded-full pointer-events-none" />

      {/* --------------------------------------------------------------------- */}
      {/* 1. Header / Navigation Bar                                            */}
      {/* --------------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#07090e]/80 border-b border-white/[0.07] px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & StitchByte Brand */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl text-black shadow-lg shadow-emerald-500/20 flex items-center justify-center">
              <Film className="w-5 h-5 fill-current" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-black tracking-tight text-white">
                STITCH<span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">BYTE</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                CINEMA
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center space-x-6 text-xs font-medium text-zinc-400">
            <a href="#demo" className="hover:text-white transition">
              Live Stage
            </a>
            <a href="#sync-engine" className="hover:text-white transition">
              NTP Sync Engine
            </a>
            <a href="#features" className="hover:text-white transition">
              Features
            </a>
            <a href="#comparison" className="hover:text-white transition">
              Comparison
            </a>
            <a href="#faq" className="hover:text-white transition">
              FAQ
            </a>
          </nav>

          {/* Quick Join & Create Actions */}
          <div className="flex items-center space-x-2.5">
            <form onSubmit={handleJoinByCode} className="hidden sm:flex items-center space-x-1.5">
              <input
                type="text"
                placeholder="Enter room code"
                value={joinSlug}
                onChange={(e) => setJoinSlug(e.target.value)}
                className="bg-[#121624] text-xs text-slate-100 placeholder-zinc-500 px-3 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-emerald-400 transition w-36"
              />
              <button
                type="submit"
                disabled={!joinSlug.trim()}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 text-xs font-semibold text-slate-200 rounded-xl border border-white/10 transition"
              >
                Join
              </button>
            </form>

            {session && !session.user.isAnonymous ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-xs font-bold text-white rounded-xl shadow-lg shadow-emerald-500/20 transition transform active:scale-95 flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Go to Dashboard</span>
                </button>
                <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-black text-[10px] flex items-center justify-center">
                    {session.user.displayName[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-zinc-200 font-medium max-w-[110px] truncate">{session.user.displayName}</span>
                </div>
                <button
                  onClick={() => {
                    clearStoredSession();
                    setSession(null);
                  }}
                  className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200 rounded-xl border border-white/10 transition"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-xs font-bold text-white rounded-xl shadow-lg shadow-emerald-500/20 transition transform active:scale-95 flex items-center space-x-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Create Party</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------------- */}
      {/* 2. Hero Section                                                       */}
      {/* --------------------------------------------------------------------- */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-12 text-center space-y-6">
        {/* Status Pill */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-xs font-medium text-emerald-300">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>StitchByte Cinema 2.0 • Ultra-Low Latency Co-Watching & Games</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-[1.1]">
          Watch together. <br />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            In true millisecond sync.
          </span>
        </h1>

        {/* Hero Description */}
        <p className="text-sm sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Create an ultra-low latency virtual cinema room or multiplayer game lounge in seconds. Experience movies, shows, trivia duels, and live arcade co-op with continuous Cristian NTP clock sync, P2P facecams, and crystal voice.
        </p>

        {/* Hero CTAs */}
        <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <button
            onClick={() => openCreateModalGated()}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-2xl shadow-xl shadow-emerald-500/25 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center space-x-2 text-sm sm:text-base"
          >
            <span>Start a Viewing Room / Lounge</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <a
            href="#demo"
            className="w-full sm:w-auto px-6 py-3.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-2xl border border-white/10 text-sm font-semibold transition flex items-center justify-center space-x-2"
          >
            <span>See Live Interactive Demo</span>
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>

        {/* Quick Join Mobile Bar */}
        <form onSubmit={handleJoinByCode} className="sm:hidden pt-2 flex items-center space-x-2 max-w-xs mx-auto">
          <input
            type="text"
            placeholder="Paste room code or invite URL"
            value={joinSlug}
            onChange={(e) => setJoinSlug(e.target.value)}
            className="flex-1 bg-[#121624] text-xs text-slate-100 placeholder-zinc-500 px-3.5 py-3 rounded-xl border border-white/10"
          />
          <button
            type="submit"
            className="px-4 py-3 bg-white/10 border border-white/10 rounded-xl font-bold text-xs"
          >
            Join
          </button>
        </form>

        {/* Highlight Trust Badges */}
        <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto text-left">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center space-x-1.5 text-emerald-400 text-xs font-bold">
              <Zap className="w-3.5 h-3.5" />
              <span>&lt; 15ms Precision</span>
            </div>
            <p className="text-[11px] text-zinc-500">Continuous NTP clock sync</p>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center space-x-1.5 text-teal-400 text-xs font-bold">
              <Shield className="w-3.5 h-3.5" />
              <span>100% DRM-Compliant</span>
            </div>
            <p className="text-[11px] text-zinc-500">Zero black screens or copyright risk</p>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center space-x-1.5 text-indigo-400 text-xs font-bold">
              <Users className="w-3.5 h-3.5" />
              <span>Zero Extensions</span>
            </div>
            <p className="text-[11px] text-zinc-500">Runs 100% in modern browsers</p>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center space-x-1.5 text-pink-400 text-xs font-bold">
              <Flame className="w-3.5 h-3.5" />
              <span>P2P WebRTC Mesh</span>
            </div>
            <p className="text-[11px] text-zinc-500">Crystal facecams & HD voice</p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 3. Interactive Live Cinema Stage Preview                              */}
      {/* --------------------------------------------------------------------- */}
      <section id="demo" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <LandingHeroStage />
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 4. Instant One-Click Preset Launcher                                 */}
      {/* --------------------------------------------------------------------- */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="p-5 rounded-2xl bg-[#0f1320] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>One-Click Party Presets</span>
            </span>
            <span className="text-[11px] text-zinc-500 hidden sm:inline">
              Select a vibe to prefill your room instantly
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {presets.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleApplyPreset(p)}
                className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-emerald-500/40 text-left transition group"
              >
                <div className="text-xs font-semibold text-zinc-200 group-hover:text-emerald-300 truncate">
                  {p.title}
                </div>
                <div className="text-[10px] text-zinc-500 truncate pt-0.5">
                  {p.provider === 'youtube' ? 'YouTube HD Sync' : p.provider === 'direct_html5' ? 'Raw MP4 Video' : 'In-App Browser'}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 5. Deep-Dive Feature Pillars (6 Visual Cards)                         */}
      {/* --------------------------------------------------------------------- */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5" />
            <span>Built for Modern Co-Watching</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Everything you need for the ultimate watch party.
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Engineered with modern WebRTC mesh architectures, continuous NTP Cristian clock sync, and zero-compromise privacy.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="p-6 sm:p-7 rounded-3xl bg-[#0f1320] border border-white/10 space-y-3.5 hover:border-emerald-500/30 transition duration-300 group">
            <div className="p-3 bg-emerald-500/15 w-fit rounded-2xl text-emerald-400 group-hover:scale-110 transition">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Sub-15ms Cristian NTP Sync</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Our continuous Cristian algorithm measures round-trip times and eliminates clock drift through micro-playback rate scaling (1.02x or 0.98x). No abrupt pause-stutters or chipmunk voice warping.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-6 sm:p-7 rounded-3xl bg-[#0f1320] border border-white/10 space-y-3.5 hover:border-teal-500/30 transition duration-300 group">
            <div className="p-3 bg-teal-500/15 w-fit rounded-2xl text-teal-400 group-hover:scale-110 transition">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">P2P Encrypted Mesh Video & Cam</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Real-time peer-to-peer WebRTC video grid. Experience zero-latency mirrored facecams, active speaker halo detection, and spatial crystal voice chat directly between friends.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-6 sm:p-7 rounded-3xl bg-[#0f1320] border border-white/10 space-y-3.5 hover:border-indigo-500/30 transition duration-300 group">
            <div className="p-3 bg-indigo-500/15 w-fit rounded-2xl text-indigo-400 group-hover:scale-110 transition">
              <Flame className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Floating Canvas Emoji Bursts</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Express hype moments together. Click quick emojis to blast floating animated bursts across every viewer's theater canvas at the exact millisecond mark of the scene.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-6 sm:p-7 rounded-3xl bg-[#0f1320] border border-white/10 space-y-3.5 hover:border-pink-500/30 transition duration-300 group">
            <div className="p-3 bg-pink-500/15 w-fit rounded-2xl text-pink-400 group-hover:scale-110 transition">
              <Globe className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">StitchByte Virtual In-App Browser</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Co-browse streaming platforms and OTT video portals inside a synchronized virtual tab. Avoid browser DRM black screen issues without needing hacky screen captures.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="p-6 sm:p-7 rounded-3xl bg-[#0f1320] border border-white/10 space-y-3.5 hover:border-amber-500/30 transition duration-300 group">
            <div className="p-3 bg-amber-500/15 w-fit rounded-2xl text-amber-400 group-hover:scale-110 transition">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Post-Watch AI Reaction Heatmap</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              When the movie ends, review an automated heatmap timeline showing where your group laughed, screamed, or reacted the most, with jump-to-moment bookmarks.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="p-6 sm:p-7 rounded-3xl bg-[#0f1320] border border-white/10 space-y-3.5 hover:border-emerald-500/30 transition duration-300 group">
            <div className="p-3 bg-emerald-500/15 w-fit rounded-2xl text-emerald-400 group-hover:scale-110 transition">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Zero Extensions & Pure Web</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              No Chrome extensions to download, no permissions to grant, and no software to update. Works natively on macOS Safari, Windows Chrome, iPad, iPhone, and Android.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 6. Interactive Sync Simulator Component                               */}
      {/* --------------------------------------------------------------------- */}
      <section id="sync-engine" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <LandingSyncSimulator />
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 7. Supported Platforms Showcase                                       */}
      {/* --------------------------------------------------------------------- */}
      <section id="platforms" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-8">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold uppercase tracking-wider">
            <Tv className="w-3.5 h-3.5" />
            <span>Universal Media Support</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Stream anything with anyone.
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            From 4K YouTube videos to personal MP4s, anime series, and major streaming services.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {[
            { name: 'YouTube 4K', desc: 'Direct embed sync & 60fps', tag: 'Native' },
            { name: 'Netflix', desc: 'Via In-App Browser', tag: 'Synced' },
            { name: 'Disney+', desc: 'Watch parties together', tag: 'Synced' },
            { name: 'Prime Video', desc: 'Movies & series', tag: 'Synced' },
            { name: 'Direct MP4 / HLS', desc: 'Raw file & cloud storage', tag: 'Direct' },
            { name: 'Twitch & Streams', desc: 'Live esports & keynotes', tag: 'Live' }
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-[#0f1320] border border-white/10 hover:border-emerald-500/40 transition text-center space-y-1.5 group"
            >
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-400">
                {item.tag}
              </span>
              <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                {item.name}
              </div>
              <div className="text-[10px] text-zinc-500">
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 8. Comparison Table Component                                         */}
      {/* --------------------------------------------------------------------- */}
      <section id="comparison" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <LandingComparisonTable />
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 9. How It Works (3 Steps)                                             */}
      {/* --------------------------------------------------------------------- */}
      <section id="how-it-works" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 space-y-10">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5" />
            <span>Three Simple Steps</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Up and streaming in under 30 seconds.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-[#0f1320] border border-white/10 space-y-3 relative">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-sm flex items-center justify-center">
              1
            </div>
            <h3 className="text-base font-bold text-white">Create Your Theater</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Choose a room name and paste a YouTube URL, direct MP4 link, or launch with our In-App Browser. No registration needed.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[#0f1320] border border-white/10 space-y-3 relative">
            <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 font-black text-sm flex items-center justify-center">
              2
            </div>
            <h3 className="text-base font-bold text-white">Share Secret Invite</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Copy your private room link. Your friends click it on desktop or mobile and enter immediately with guest access.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[#0f1320] border border-white/10 space-y-3 relative">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-black text-sm flex items-center justify-center">
              3
            </div>
            <h3 className="text-base font-bold text-white">Watch & React Together</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Play, pause, and seek in lockstep sync. Turn on your webcam, talk with HD voice, and blast floating emoji reactions in real-time.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 10. Community & Social Proof                                          */}
      {/* --------------------------------------------------------------------- */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Loved by long-distance couples & squad movie nights.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-[#0f1320] border border-white/10 space-y-3">
            <div className="flex items-center space-x-1 text-amber-400 text-xs">
              {'★'.repeat(5)}
            </div>
            <p className="text-xs text-zinc-300 italic leading-relaxed">
              "My partner and I live in different time zones (London & Tokyo). StitchByte Cinema is the only watch party app where audio actually matches down to the second without annoying pauses!"
            </p>
            <div className="text-[11px] font-semibold text-zinc-400">
              — Chloe & Kenji
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0f1320] border border-white/10 space-y-3">
            <div className="flex items-center space-x-1 text-amber-400 text-xs">
              {'★'.repeat(5)}
            </div>
            <p className="text-xs text-zinc-300 italic leading-relaxed">
              "We used to use Discord screen share and it always lagged or showed black screens for copyrighted videos. StitchByte Cinema runs directly in the browser and looks 4K native."
            </p>
            <div className="text-[11px] font-semibold text-zinc-400">
              — Marcus, Anime Club Host
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0f1320] border border-white/10 space-y-3">
            <div className="flex items-center space-x-1 text-amber-400 text-xs">
              {'★'.repeat(5)}
            </div>
            <p className="text-xs text-zinc-300 italic leading-relaxed">
              "Floating emojis plus the post-watch reaction heatmap is legendary. The fact that guests don't have to install any extension makes hosting completely effortless."
            </p>
            <div className="text-[11px] font-semibold text-zinc-400">
              — Priya, Design Team Lead
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 11. FAQ Component                                                     */}
      {/* --------------------------------------------------------------------- */}
      <section id="faq" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <LandingFAQ />
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 12. Bottom High-Energy Call to Action Banner                          */}
      {/* --------------------------------------------------------------------- */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="relative rounded-3xl p-8 sm:p-12 overflow-hidden bg-gradient-to-r from-emerald-900/40 via-[#0d1424] to-teal-900/40 border border-emerald-500/30 text-center space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-300 text-black flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <Film className="w-6 h-6 fill-current" />
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Ready to host your next movie night?
          </h2>

          <p className="text-xs sm:text-sm text-zinc-300 max-w-md mx-auto">
            Zero sign-up required. Create a private theater room, invite your friends, and start co-watching in seconds.
          </p>

          <div className="pt-2">
            <button
              onClick={() => openCreateModalGated()}
              className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl shadow-xl shadow-emerald-500/30 transition transform hover:-translate-y-0.5 active:scale-95 text-sm"
            >
              Launch Viewing Room Now
            </button>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 13. Footer                                                            */}
      {/* --------------------------------------------------------------------- */}
      <footer className="relative z-10 max-w-7xl mx-auto w-full pt-12 pb-8 px-4 sm:px-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-zinc-300">STITCHBYTE Cinema</span>
          <span>•</span>
          <span>Crafted by <a href="https://stitchbyte.in" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">StitchByte Agency</a></span>
        </div>

        <div className="flex items-center space-x-4">
          <span>Sub-15ms Cristian NTP</span>
          <span>•</span>
          <span>WebRTC P2P Mesh</span>
          <span>•</span>
          <span>100% DRM-Compliant</span>
        </div>
      </footer>

      {/* --------------------------------------------------------------------- */}
      {/* 14. Create Room Modal                                                 */}
      {/* --------------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0f1320] max-w-lg w-full rounded-3xl border border-white/15 p-6 sm:p-7 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400">
                  <Film className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-white">Create StitchByte Cinema Room</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-4">
              {/* Activity Mode Option Cards */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">
                  Choose Party Activity Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setActivityMode('CINEMA');
                      setRoomTitle('Friday Movie Night');
                    }}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1 ${
                      activityMode === 'CINEMA'
                        ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-lg shadow-emerald-500/15'
                        : 'bg-[#161c2c] border-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎬</span>
                      <span className="text-xs font-bold text-white">Watch Movies</span>
                    </div>
                    <span className="text-[11px] text-zinc-400 leading-tight">
                      Synchronized cinema playback with YouTube, MP4 & streams
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActivityMode('GAMING');
                      setRoomTitle('Party Games & Trivia');
                    }}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1 ${
                      activityMode === 'GAMING'
                        ? 'bg-amber-500/20 border-amber-400 text-white shadow-lg shadow-amber-500/15'
                        : 'bg-[#161c2c] border-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎮</span>
                      <span className="text-xs font-bold text-white">Play Games</span>
                    </div>
                    <span className="text-[11px] text-zinc-400 leading-tight">
                      Cinema Trivia, co-op Pictionary & Reaction Duel
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Room Name
                </label>
                <input
                  type="text"
                  value={roomTitle}
                  onChange={(e) => setRoomTitle(e.target.value)}
                  required
                  className="w-full bg-[#161c2c] text-xs text-slate-100 px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-emerald-400 transition"
                  placeholder="e.g. Friday Movie Night"
                />
              </div>

              {activityMode === 'CINEMA' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Content Service
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setProviderType('youtube');
                          setMediaUrl('https://www.youtube.com/watch?v=L_LUpnjgPso');
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-semibold transition ${
                          providerType === 'youtube'
                            ? 'bg-emerald-500/20 border-emerald-400 text-white'
                            : 'bg-[#161c2c] border-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        YouTube
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setProviderType('direct_html5');
                          setMediaUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-semibold transition ${
                          providerType === 'direct_html5'
                            ? 'bg-emerald-500/20 border-emerald-400 text-white'
                            : 'bg-[#161c2c] border-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        Direct MP4
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setProviderType('ott_fallback');
                          setMediaUrl('https://www.netflix.com/title/81234567');
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-semibold transition ${
                          providerType === 'ott_fallback'
                            ? 'bg-emerald-500/20 border-emerald-400 text-white'
                            : 'bg-[#161c2c] border-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        Netflix / OTT
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Video URL or Streaming Link
                    </label>
                    <input
                      type="url"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      required
                      className="w-full bg-[#161c2c] text-xs text-slate-100 px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-emerald-400 transition"
                      placeholder="https://..."
                    />
                  </div>
                </>
              ) : (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-start gap-2.5">
                  <span className="text-lg">🎮</span>
                  <div>
                    <div className="font-semibold text-white">Multiplayer Party Game Lounge Active</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                      Your room will launch directly into the Game Lounge with synchronized Cinema Trivia, real-time shared drawing board, and Reaction Duel. You can toggle between Movie Theater and Games at any time!
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition"
                >
                  {isLoading ? 'Creating Room...' : `Launch StitchByte ${activityMode === 'GAMING' ? 'Game Lounge' : 'Cinema Room'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auth Modal for Mandatory Sign In Gate */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        title="Sign In to StitchByte Cinema"
        subtitle="Please log in or register your account to create a room, launch party games, or start watching movies."
      />
    </main>
  );
}
