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
} from 'lucide-react';
import { getStoredSession, clearStoredSession, UserSession } from '../lib/api';
import { AuthModal } from '../components/auth/AuthModal';

function useCountUp(target: number, duration = 1800) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / duration, 1);
          setVal(Math.floor(p * target));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);
  return { val, ref };
}

export default function LandingPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [joinSlug, setJoinSlug] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const s1 = useCountUp(12400);
  const s2 = useCountUp(98);
  const s3 = useCountUp(2);

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

  const faqs = [
    { q: 'What is StitchByte? Is it free?', a: 'StitchByte is 100% free — made for couples and friends to spend time together online. Watch YouTube at the exact same second, talk on live video call, and play real 2-player games. No hidden fees, ever.' },
    { q: 'Do I need to download anything?', a: 'No download needed. StitchByte runs in any browser (Chrome, Safari, Brave, Firefox) on Android, iPhone, iPad, laptop, or desktop. Just open the link and start.' },
    { q: 'How does the video sync work?', a: 'When you click Play or Pause, it instantly syncs on your partner\'s screen at the exact same millisecond. No more "3, 2, 1, press play!"' },
    { q: 'Can strangers enter our room?', a: 'Absolutely not. Every room has a unique secret code. Only people with your exact link can join — fully private.' },
    { q: 'Are the games played with bots?', a: 'Zero-bots policy. Every Ludo and Four-in-a-Row game is played between real humans in real time — directly with your partner or friend.' },
    { q: 'How do I connect with my partner?', a: 'Click "Get Started", enter your name, and your account is ready in 10 seconds. From the Dashboard, copy your Partner Code and share it on WhatsApp. Once they enter it, you\'re linked forever.' },
  ];

  return (
    <div className="min-h-screen bg-[#0d0710] text-slate-100 flex flex-col selection:bg-rose-600 selection:text-white font-sans antialiased overflow-x-hidden" style={{ scrollbarWidth: 'none' }}>

      {/* AURORA BG */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] bg-gradient-to-b from-rose-600/20 via-pink-700/8 to-transparent blur-[130px] rounded-full" />
        <div className="absolute top-[40%] -right-40 w-[600px] h-[600px] bg-purple-700/10 blur-[160px] rounded-full" />
        <div className="absolute bottom-0 -left-40 w-[700px] h-[500px] bg-rose-800/10 blur-[180px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* NAV */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-2xl bg-[#0d0710]/80 border-b border-white/[0.07] px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div onClick={() => router.push('/')} className="flex items-center space-x-2.5 cursor-pointer select-none shrink-0">
            <div className="p-1.5 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl text-white shadow-lg shadow-rose-600/30">
              <Film className="w-4 h-4 fill-current" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">StitchByte<span className="text-rose-500 text-2xl leading-none">.</span></span>
          </div>

          <nav className="hidden md:flex items-center space-x-7 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            <a href="#features" className="hover:text-rose-300 transition-colors">Features</a>
            <a href="#games" className="hover:text-rose-300 transition-colors">Games</a>
            <a href="#how-it-works" className="hover:text-rose-300 transition-colors">How It Works</a>
            <a href="#faq" className="hover:text-rose-300 transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center space-x-2.5">
            <form onSubmit={handleJoinByCode} className="hidden sm:flex items-center space-x-1.5">
              <input type="text" placeholder="Room code..." value={joinSlug} onChange={(e) => setJoinSlug(e.target.value.toUpperCase())} className="bg-white/5 text-xs font-mono uppercase text-slate-100 placeholder:text-zinc-500 px-3 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-rose-500/70 transition w-36" />
              <button type="submit" disabled={!joinSlug.trim()} className="px-3 py-2 bg-rose-600/80 hover:bg-rose-600 disabled:opacity-30 text-xs font-bold text-white rounded-xl transition">Join</button>
            </form>

            {session && !session.user.isAnonymous ? (
              <div className="flex items-center space-x-2">
                <button onClick={() => router.push('/dashboard')} className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-xs font-black text-white rounded-xl shadow-lg shadow-rose-600/25 transition active:scale-95 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5" /><span>Dashboard</span>
                </button>
                <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-rose-600 to-pink-500 text-white font-black text-[10px] flex items-center justify-center">{session.user.displayName[0]?.toUpperCase() || 'U'}</div>
                  <span className="text-zinc-200 font-medium max-w-[90px] truncate">{session.user.displayName}</span>
                </div>
                <button onClick={() => { clearStoredSession(); setSession(null); }} className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition"><LogOut className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button onClick={() => setIsAuthModalOpen(true)} className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-200 rounded-xl border border-white/10 transition">Sign In</button>
                <button onClick={handleGetStarted} className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-xs font-black text-white rounded-xl shadow-lg shadow-rose-600/25 transition active:scale-95 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5" /><span>Get Started</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 px-4 sm:px-8 pt-16 sm:pt-28 pb-20 max-w-6xl mx-auto flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[11px] font-bold mb-8 backdrop-blur-xl">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
          Made for Couples & Friends · 100% Free · No App Needed
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08] mb-6 max-w-4xl">
          <span className="text-white">Watch Together.</span>
          <br />
          <span className="bg-gradient-to-r from-rose-400 via-pink-400 to-rose-300 bg-clip-text text-transparent" style={{ filter: 'drop-shadow(0 0 40px rgba(244,63,94,0.3))' }}>
            Feel Together.
          </span>
        </h1>

        <p className="text-sm sm:text-lg text-zinc-400 max-w-xl leading-relaxed mb-10">
          Watch YouTube in perfect sync, play real 2-player games, and see each other on live video — all in one private room. Distance doesn't stand a chance.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 mb-14 w-full sm:w-auto">
          <button onClick={handleGetStarted} className="group w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500 text-white font-black text-sm shadow-2xl shadow-rose-600/35 transition-all hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2.5">
            <Sparkles className="w-4 h-4" />
            Create Free Room & Invite
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button onClick={() => { const el = document.getElementById('how-it-works'); el?.scrollIntoView({ behavior: 'smooth' }); }} className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white font-bold text-sm transition flex items-center justify-center gap-2">
            <Play className="w-4 h-4 text-rose-400" />
            See How It Works
          </button>
        </div>

        {/* mobile join */}
        <div className="sm:hidden w-full max-w-sm mb-10">
          <form onSubmit={handleJoinByCode} className="flex gap-2">
            <input type="text" placeholder="Enter room code..." value={joinSlug} onChange={(e) => setJoinSlug(e.target.value.toUpperCase())} className="flex-1 bg-white/5 text-xs font-mono uppercase text-slate-100 placeholder:text-zinc-500 px-3.5 py-3 rounded-xl border border-white/10 focus:outline-none focus:border-rose-500" />
            <button type="submit" disabled={!joinSlug.trim()} className="px-4 py-3 bg-rose-600 disabled:opacity-40 text-xs font-bold text-white rounded-xl">Join</button>
          </form>
        </div>

        {/* MOCKUP CARD */}
        <div className="w-full max-w-4xl rounded-3xl p-[2px] bg-gradient-to-b from-white/20 via-rose-500/10 to-transparent shadow-[0_40px_100px_rgba(0,0,0,0.9)]">
          <div className="rounded-[22px] bg-[#160c16]/95 backdrop-blur-2xl overflow-hidden border border-white/[0.06]">
            <div className="px-4 py-3 bg-[#1a0f1a]/80 border-b border-white/[0.07] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500/50" />
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500/50" />
                <span className="ml-3 font-mono text-zinc-500 text-[11px]">stitchbyte.com/room/MOVIE-NIGHT</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                <span className="text-rose-300 font-bold text-[10px]">Synced · 0ms delay</span>
              </div>
            </div>

            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-3">
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/[0.07]">
                  <img src="https://img.youtube.com/vi/zSWdZVtXT7E/maxresdefault.jpg" alt="Synchronized Watch Party" className="w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-center justify-between text-xs text-white mb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-600 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-600/40">
                          <Play className="w-3 h-3 fill-white" />
                        </div>
                        <span className="font-bold text-xs">Interstellar — Space Travel (4K)</span>
                      </div>
                      <span className="font-mono text-rose-300 text-[11px]">1:42:15 / 2:49:00</span>
                    </div>
                    <div className="w-full h-1 bg-white/15 rounded-full overflow-hidden">
                      <div className="w-[62%] h-full bg-gradient-to-r from-rose-600 to-pink-500 rounded-full" />
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-[11px] font-semibold text-white">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-[9px] font-black">P</div>
                    😭 same feeling rn
                  </div>
                </div>

                <div className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                    <span className="font-bold text-white">Live Video Call</span>
                    <span className="text-zinc-500 text-[11px]">2 connected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-600 to-pink-500 text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-rose-500/30">Y</div>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-600 to-purple-500 text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-indigo-500/30">P</div>
                    <span className="text-rose-400 text-[11px] font-semibold ml-1">● On</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] text-xs space-y-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/[0.07] pb-2">
                    <span className="font-bold text-white flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-rose-400" />Room Chat</span>
                    <span className="text-[10px] text-rose-400 font-bold">● Live</span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-600 to-pink-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">P</div>
                      <div className="p-2 rounded-2xl bg-white/10 text-white text-[11px] leading-relaxed">This scene is so beautiful 🥺❤️</div>
                    </div>
                    <div className="flex items-start gap-2 justify-end">
                      <div className="p-2 rounded-2xl bg-rose-600/25 border border-rose-500/30 text-rose-100 text-[11px] leading-relaxed">Play Ludo after this! 🎲</div>
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-600 to-purple-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">Y</div>
                    </div>
                    <div className="flex items-center justify-center p-2 rounded-2xl bg-white/5 border border-rose-500/15">
                      <div className="text-center">
                        <img src="https://media4.giphy.com/media/Pw4DoWaNHDj8YVCWtu/giphy.gif" alt="Bubu Dudu sticker" className="w-14 h-14 object-contain mx-auto" />
                        <span className="text-[9px] font-bold text-rose-300">Bubu & Dudu ✨</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-black/30 border border-white/[0.07] text-zinc-500 text-[11px] flex items-center justify-between">
                  <span>Send a message or sticker…</span>
                  <Smile className="w-3.5 h-3.5 text-rose-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <div className="relative z-10 border-y border-white/[0.07] bg-[#130a13]/60 backdrop-blur-xl py-6 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl sm:text-4xl font-black text-white tabular-nums"><span ref={s1.ref}>{s1.val.toLocaleString()}</span>+</div>
            <div className="text-[11px] text-zinc-500 font-semibold mt-1 uppercase tracking-wider">Rooms Created</div>
          </div>
          <div className="border-x border-white/[0.07]">
            <div className="text-2xl sm:text-4xl font-black text-white tabular-nums"><span ref={s2.ref}>{s2.val}</span>%</div>
            <div className="text-[11px] text-zinc-500 font-semibold mt-1 uppercase tracking-wider">Sync Accuracy</div>
          </div>
          <div>
            <div className="text-2xl sm:text-4xl font-black text-white tabular-nums"><span ref={s3.ref}>{s3.val}</span> Games</div>
            <div className="text-[11px] text-zinc-500 font-semibold mt-1 uppercase tracking-wider">Zero Bots</div>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" className="relative z-10 px-4 sm:px-8 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold mb-4 uppercase tracking-wider">
            <Zap className="w-3 h-3" /> Real Features · No Fluff
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Everything to Feel <span className="bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">Close Together</span>
          </h2>
          <p className="text-sm text-zinc-400 max-w-lg mx-auto">No complicated setup. Just open the link and everything works — any phone or laptop.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: <Play className="w-5 h-5 fill-current" />, title: 'Exact-Second Video Sync', desc: 'Paste any YouTube link. When you press pause it pauses for your partner at the exact same millisecond — zero lag.', badge: 'Works with all YouTube videos' },
            { icon: <Video className="w-5 h-5" />, title: 'Live Video Call on Screen', desc: 'See each other\'s faces with a floating picture-in-picture video call you can drag anywhere on screen.', badge: 'Moveable · Always visible' },
            { icon: <Gamepad2 className="w-5 h-5" />, title: 'Real 2-Player Games', desc: 'Cottagecore Ludo with 3D ceramic animal tokens and Four-in-a-Row. Zero bots — only real human duels.', badge: '100% human · Zero bots' },
            { icon: <Smile className="w-5 h-5" />, title: 'Animated GIPHY Stickers', desc: 'Send looping Bubu & Dudu, Milk & Mocha, Peach & Goma, and Capybara stickers in one tap.', badge: 'Bubu & Dudu + Gen-Z stickers' },
            { icon: <Lock className="w-5 h-5" />, title: '100% Private Rooms', desc: 'Rooms are invisible to search engines. Only people with your exact secret code can join.', badge: 'Safe for couples & families' },
            { icon: <Smartphone className="w-5 h-5" />, title: 'Any Device, No Install', desc: 'Works on Android, iPhone, iPad, MacBook, or Windows laptop. No extra storage, no heating up your phone.', badge: 'Zero installation required' },
          ].map((f, i) => (
            <div key={i} className="group p-6 rounded-3xl bg-[#160c16]/80 border border-white/[0.07] hover:border-rose-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(244,63,94,0.12)] backdrop-blur-xl flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-600/15 border border-rose-500/25 flex items-center justify-center text-rose-400 group-hover:bg-rose-600/25 transition-colors">{f.icon}</div>
                <h3 className="text-sm font-black text-white">{f.title}</h3>
                <p className="text-[12px] text-zinc-400 leading-relaxed">{f.desc}</p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />{f.badge}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* WHO IS IT FOR */}
      <section className="relative z-10 px-4 sm:px-8 py-20 border-y border-white/[0.07] bg-[#100810]/60 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold mb-4 uppercase tracking-wider">
            <Heart className="w-3 h-3 fill-current" /> Real People · Real Connections
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Made for <span className="bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">People Like You</span>
          </h2>
          <p className="text-sm text-zinc-400 max-w-lg mx-auto mb-14">Distance never stops you from spending real time with the people who matter most.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
            {[
              { emoji: '💕', title: 'Long Distance Couples', desc: 'Living in different cities or away for college? Watch romantic movies together, see each other\'s reactions on camera, and fall asleep on call.', quote: '"Feels like we\'re on the same sofa together!"', border: 'border-rose-500/30', quoteBg: 'bg-rose-500/10 border-rose-500/20 text-rose-200' },
              { emoji: '🍿', title: 'Best Friends & Groups', desc: 'Binge-watch funny clips, roast each other during intense Ludo rounds, and spam hilarious stickers in late-night sessions.', quote: '"No more counting 3-2-1 to press play!"', border: 'border-pink-500/30', quoteBg: 'bg-pink-500/10 border-pink-500/20 text-pink-200' },
              { emoji: '📚', title: 'Study & Lofi Hangouts', desc: 'Studying for exams? Sync a Lofi Girl session and keep each other motivated while studying side-by-side online.', quote: '"Keeps you focused and less lonely!"', border: 'border-purple-500/30', quoteBg: 'bg-purple-500/10 border-purple-500/20 text-purple-200' },
            ].map((p, i) => (
              <div key={i} className={`p-6 rounded-3xl bg-[#160c16]/90 border ${p.border} flex flex-col justify-between space-y-4 backdrop-blur-xl`}>
                <div className="space-y-3">
                  <div className="text-4xl">{p.emoji}</div>
                  <h3 className="text-base font-black text-white">{p.title}</h3>
                  <p className="text-[12px] text-zinc-300 leading-relaxed">{p.desc}</p>
                </div>
                <div className={`p-3 rounded-2xl border ${p.quoteBg} text-[11px] font-semibold italic`}>{p.quote}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GAMES */}
      <section id="games" className="relative z-10 px-4 sm:px-8 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold mb-4 uppercase tracking-wider">
            <Star className="w-3 h-3 fill-current" /> Pure Fun · Zero Bots Guarantee
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">Play Live with Your Person</h2>
          <p className="text-sm text-zinc-400 max-w-lg mx-auto">Tired of bots on other apps? Both games are human-only, real-time duels.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div onClick={() => router.push('/games/ludo')} className="group relative overflow-hidden p-7 rounded-3xl bg-gradient-to-b from-[#1e0f1e] to-[#120712] border border-rose-500/25 hover:border-rose-400/50 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(244,63,94,0.2)]">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-rose-600/15 blur-3xl rounded-full group-hover:bg-rose-600/25 transition-colors" />
            <div className="relative flex items-center justify-between mb-5">
              <span className="text-5xl">🐻 🐸</span>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/35">Ludo · 2 Player</span>
            </div>
            <h3 className="text-xl font-black text-white mb-2 group-hover:text-rose-300 transition-colors">Cottagecore 3D Ludo</h3>
            <p className="text-[12px] text-zinc-400 leading-relaxed mb-5">Handcrafted ceramic animal tokens — Teddy Bears vs Happy Frogs. 7 dynamic themes, live camera feed above the board, and turn nudges.</p>
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">Play Ludo Now<ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" /></div>
          </div>

          <div onClick={() => router.push('/games/four-in-a-row')} className="group relative overflow-hidden p-7 rounded-3xl bg-gradient-to-b from-[#1a0e1e] to-[#110812] border border-pink-500/25 hover:border-pink-400/50 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(236,72,153,0.2)]">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-600/15 blur-3xl rounded-full group-hover:bg-pink-600/25 transition-colors" />
            <div className="relative flex items-center justify-between mb-5">
              <span className="text-5xl">🔴 🟣</span>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-pink-500/20 text-pink-300 border border-pink-500/35">Connect 4 · Duel</span>
            </div>
            <h3 className="text-xl font-black text-white mb-2 group-hover:text-pink-300 transition-colors">Four in a Row (Connect 4)</h3>
            <p className="text-[12px] text-zinc-400 leading-relaxed mb-5">Drop discs into a 7×6 board to connect 4. Floating call window, animated stickers, and instant rematch — pure drama.</p>
            <div className="flex items-center gap-1.5 text-xs font-bold text-pink-400">Play Four in a Row<ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" /></div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative z-10 px-4 sm:px-8 py-20 border-y border-white/[0.07] bg-[#100810]/60 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold mb-4 uppercase tracking-wider">
            <Shield className="w-3 h-3" /> Super Simple · 10 Seconds to Start
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">Up & Running in 3 Steps</h2>
          <p className="text-sm text-zinc-400 max-w-lg mx-auto mb-14">No downloads, no complicated passwords, no tech skills needed.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left relative">
            <div className="hidden md:block absolute top-10 left-[calc(33%+24px)] right-[calc(33%+24px)] h-px bg-gradient-to-r from-rose-500/30 via-pink-500/30 to-rose-500/30" />
            {[
              { n: '1', title: 'Create Free Account', desc: 'Click "Get Started", type your name, and your account is ready in 10 seconds. No email verification.' },
              { n: '2', title: 'Pick a Video or Game', desc: 'Paste any YouTube link you love, or click Ludo / Four-in-a-Row to start a real match.' },
              { n: '3', title: 'Send Link on WhatsApp', desc: 'Copy your private room link and share it. When your partner opens it, you\'re together instantly.' },
            ].map((s, i) => (
              <div key={i} className="p-6 rounded-3xl bg-[#160c16]/90 border border-white/[0.07] hover:border-rose-500/30 transition-all backdrop-blur-xl">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-600/30 to-pink-600/20 border border-rose-500/30 text-rose-300 font-black text-xl flex items-center justify-center mb-5">{s.n}</div>
                <h3 className="text-sm font-black text-white mb-2">{s.title}</h3>
                <p className="text-[12px] text-zinc-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 px-4 sm:px-8 py-20 max-w-3xl mx-auto w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold mb-4 uppercase tracking-wider">Got Questions?</div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-3">Frequently Asked</h2>
          <p className="text-sm text-zinc-400">Plain answers — no technical jargon.</p>
        </div>
        <div className="space-y-2.5">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div key={idx} className={`rounded-2xl border transition-all backdrop-blur-xl overflow-hidden ${isOpen ? 'bg-[#1e0f1e]/90 border-rose-500/30' : 'bg-[#160c16]/80 border-white/[0.07] hover:border-white/15'}`}>
                <button onClick={() => setOpenFaqIndex(isOpen ? null : idx)} className="w-full px-5 py-4 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-white hover:text-rose-300 transition-colors">
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-rose-400' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-[12px] text-zinc-400 leading-relaxed border-t border-rose-500/15 pt-3">{faq.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="relative z-10 px-4 sm:px-8 py-20 max-w-4xl mx-auto w-full">
        <div className="relative overflow-hidden p-10 sm:p-16 rounded-3xl bg-[#1a0818]/90 border border-rose-500/30 backdrop-blur-2xl text-center flex flex-col items-center">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-rose-600/20 to-transparent blur-3xl" />
          </div>
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-600 to-pink-600 flex items-center justify-center text-white mb-5 shadow-2xl shadow-rose-600/40">
            <Heart className="w-7 h-7 fill-current" />
          </div>
          <h2 className="relative text-3xl sm:text-5xl font-black text-white mb-4 tracking-tight">Ready to Watch & Play Together?</h2>
          <p className="relative text-sm text-zinc-300 max-w-md mb-8 leading-relaxed">Create your free room in 10 seconds. Share on WhatsApp. Make long distance feel like no distance.</p>
          <button onClick={handleGetStarted} className="relative group px-10 py-4 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500 text-white font-black text-sm shadow-2xl shadow-rose-600/40 transition-all hover:-translate-y-0.5 active:scale-95 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4" />
            Start For Free Right Now
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/[0.07] px-4 sm:px-8 py-8 bg-[#0a060a] text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="p-1 bg-gradient-to-br from-rose-600 to-pink-600 rounded-lg text-white"><Film className="w-3.5 h-3.5 fill-current" /></div>
            <span className="font-black text-white text-sm">StitchByte<span className="text-rose-500">.</span></span>
            <span className="text-zinc-700">|</span>
            <span>Watch Together & Play Games Online</span>
          </div>
          <div className="flex items-center space-x-6 text-[11px] font-semibold text-zinc-500">
            <button onClick={() => router.push('/dashboard')} className="hover:text-white transition-colors">Dashboard</button>
            <button onClick={() => router.push('/games/ludo')} className="hover:text-white transition-colors">Ludo</button>
            <button onClick={() => router.push('/games/four-in-a-row')} className="hover:text-white transition-colors">Four in a Row</button>
            <button onClick={() => setIsAuthModalOpen(true)} className="hover:text-white transition-colors">Sign In</button>
          </div>
          <div className="text-[11px] text-zinc-700">© {new Date().getFullYear()} StitchByte. 100% Free for couples and friends.</div>
        </div>
      </footer>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onSuccess={handleAuthSuccess} />
    </div>
  );
}
