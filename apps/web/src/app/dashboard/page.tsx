'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Film,
  Play,
  Plus,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  Heart,
  Users,
  Settings,
  LogOut,
  Sparkles,
  Zap,
  Check,
  X,
  Copy,
  Clock,
  Tv,
  ArrowRight,
  Trash2,
  Sliders,
  Shield,
  Volume2,
  Video,
  Gamepad2
} from 'lucide-react';
import {
  getStoredSession,
  clearStoredSession,
  createPartyRoom,
  getUserRooms,
  UserSession
} from '../../lib/api';
import { GameLounge } from '../../components/games/GameLounge';

// Helper to extract YouTube Video ID from any format (watch?v=, youtu.be/, embed/, shorts/)
function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

// REAL Curated YouTube Videos for Watch Platform (With verified real YouTube IDs and thumbnails)
const REAL_YOUTUBE_HEROES = [
  {
    id: 'interstellar',
    ytId: 'zSWdZVtXT7E',
    title: 'Interstellar: 4K IMAX Experience',
    match: '99% Match',
    friendsWatching: '+5 friends are watching',
    description: 'Experience Christopher Nolan’s deep-space masterpiece in synchronized ultra-low latency with your friends.',
    bgThumbnail: 'https://img.youtube.com/vi/zSWdZVtXT7E/maxresdefault.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
    category: 'Sci-Fi IMAX',
    maxCapacity: 6
  },
  {
    id: 'tears-of-steel',
    ytId: 'R6MlUcmOul8',
    title: 'Tears of Steel: 4K Sci-Fi Cyberpunk',
    match: '96% Match',
    friendsWatching: '+4 friends are watching',
    description: 'In a dystopian future, a group of scientists in Amsterdam attempt to stage a crucial event from the past.',
    bgThumbnail: 'https://img.youtube.com/vi/R6MlUcmOul8/maxresdefault.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=R6MlUcmOul8',
    category: 'Cyberpunk Cinema',
    maxCapacity: 6
  },
  {
    id: 'cyberpunk',
    ytId: 'qIcTM8WXFjk',
    title: 'Cyberpunk 2077: Phantom Liberty 4K',
    match: '98% Match',
    friendsWatching: '+6 friends are watching',
    description: 'High-octane spy-thriller cinematic adventure set in the lethal Dogtown district of Night City.',
    bgThumbnail: 'https://img.youtube.com/vi/qIcTM8WXFjk/maxresdefault.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=qIcTM8WXFjk',
    category: 'Cinematic Thriller',
    maxCapacity: 6
  },
  {
    id: 'lofi-beats',
    ytId: 'jfKfPfyJRdk',
    title: 'Lofi Girl: Chill Beats to Relax & Study',
    match: '95% Match',
    friendsWatching: '+8 friends are watching',
    description: 'Synchronized calming lofi hip hop beats for social work sessions, chill hangouts, and background study parties.',
    bgThumbnail: 'https://img.youtube.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    category: 'Music Lounge',
    maxCapacity: 6
  }
];

// Multi-Platform Definitions (Netflix, Prime Video, Disney+, YouTube, Direct)
const PLATFORMS = [
  { id: 'netflix', name: 'Netflix', icon: '🔴', tag: 'Netflix Original', color: 'border-red-500/40 text-red-400 bg-red-600/10' },
  { id: 'prime', name: 'Prime Video', icon: '🔵', tag: 'Prime Exclusive', color: 'border-blue-500/40 text-blue-400 bg-blue-600/10' },
  { id: 'disney', name: 'Disney+', icon: '🏰', tag: 'Disney / Marvel', color: 'border-indigo-500/40 text-indigo-400 bg-indigo-600/10' },
  { id: 'youtube', name: 'YouTube', icon: '📺', tag: 'YouTube 4K', color: 'border-rose-500/40 text-rose-400 bg-rose-600/10' },
  { id: 'custom', name: 'Direct Video', icon: '🌐', tag: 'MP4 / HLS', color: 'border-zinc-500/40 text-zinc-300 bg-white/5' }
];

const PLATFORM_SHOWS: Record<string, { title: string; url: string; tag: string }[]> = {
  netflix: [
    { title: 'Stranger Things 4', url: 'https://www.netflix.com/title/80057281', tag: 'Sci-Fi • 4 Seasons' },
    { title: 'Wednesday', url: 'https://www.netflix.com/title/81231974', tag: 'Mystery • Fantasy' },
    { title: 'Squid Game', url: 'https://www.netflix.com/title/81040344', tag: 'Thriller • Drama' },
    { title: 'The Night Agent', url: 'https://www.netflix.com/title/81450827', tag: 'Action • Spy' }
  ],
  prime: [
    { title: 'The Boys Season 4', url: 'https://www.primevideo.com', tag: 'Action • Satire' },
    { title: 'Fallout', url: 'https://www.primevideo.com', tag: 'Sci-Fi • Post-Apocalyptic' },
    { title: 'Reacher Season 2', url: 'https://www.primevideo.com', tag: 'Action • Crime' },
    { title: 'The Rings of Power', url: 'https://www.primevideo.com', tag: 'Fantasy • Adventure' }
  ],
  disney: [
    { title: 'The Mandalorian', url: 'https://www.disneyplus.com', tag: 'Star Wars • Space' },
    { title: 'Loki Season 2', url: 'https://www.disneyplus.com', tag: 'Marvel • Multiverse' },
    { title: 'Avengers: Endgame', url: 'https://www.disneyplus.com', tag: 'Marvel • Blockbuster' }
  ],
  youtube: [
    { title: 'Interstellar: 4K IMAX Experience', url: 'https://www.youtube.com/watch?v=zSWdZVtXT7E', tag: '4K • IMAX' },
    { title: 'Cyberpunk 2077: Phantom Liberty', url: 'https://www.youtube.com/watch?v=qIcTM8WXFjk', tag: '4K • Trailer' },
    { title: 'Lofi Girl Chill Beats', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', tag: 'Live • Chill' }
  ],
  custom: [
    { title: 'Big Buck Bunny 4K MP4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', tag: 'Direct MP4' },
    { title: 'Sintel Open Movie 4K', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', tag: 'Direct WebM' }
  ]
};

// Curated Parties for "Parties" Section (Netflix, Prime, Disney, YouTube)
const REAL_YOUTUBE_PARTIES = [
  {
    id: 'netflix-stranger-things',
    platform: 'NETFLIX',
    platformBadge: 'bg-red-600 text-white font-black',
    title: 'Stranger Things 4',
    tagline: 'Netflix Original • Max 6',
    videoUrl: 'https://www.netflix.com/title/80057281',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=400&fit=crop&q=80',
    avatars: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=face'
    ]
  },
  {
    id: 'prime-the-boys',
    platform: 'PRIME VIDEO',
    platformBadge: 'bg-blue-600 text-white font-black',
    title: 'The Boys Season 4',
    tagline: 'Prime Video Exclusive • Max 6',
    videoUrl: 'https://www.primevideo.com',
    thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&h=400&fit=crop&q=80',
    avatars: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=64&h=64&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=64&h=64&fit=crop&crop=face'
    ]
  },
  {
    id: 'youtube-interstellar',
    platform: 'YOUTUBE 4K',
    platformBadge: 'bg-rose-600 text-white font-black',
    title: 'Interstellar 4K IMAX',
    tagline: 'YouTube 4K • Max 6',
    videoUrl: 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
    thumbnail: 'https://img.youtube.com/vi/zSWdZVtXT7E/hqdefault.jpg',
    selected: true,
    avatars: [
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=64&h=64&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=64&h=64&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=64&h=64&fit=crop&crop=face'
    ]
  },
  {
    id: 'disney-mandalorian',
    platform: 'DISNEY+',
    platformBadge: 'bg-indigo-600 text-white font-black',
    title: 'The Mandalorian',
    tagline: 'Disney+ Star Wars • Max 6',
    videoUrl: 'https://www.disneyplus.com',
    thumbnail: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&h=400&fit=crop&q=80',
    avatars: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=face'
    ]
  }
];

// Default initial items for Watchlist
export interface WatchlistItem {
  id: string;
  title: string;
  url: string;
  platform: string;
  platformBadge: string;
  thumbnail: string;
  category?: string;
  tagline?: string;
}

const DEFAULT_WATCHLIST: WatchlistItem[] = [
  {
    id: 'interstellar',
    title: 'Interstellar: 4K IMAX Experience',
    url: 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
    platform: 'YOUTUBE 4K',
    platformBadge: 'bg-rose-600 text-white',
    thumbnail: 'https://img.youtube.com/vi/zSWdZVtXT7E/maxresdefault.jpg',
    category: 'Sci-Fi IMAX',
    tagline: 'Christopher Nolan Masterpiece'
  },
  {
    id: 'netflix-stranger-things',
    title: 'Stranger Things 4',
    url: 'https://www.netflix.com/title/80057281',
    platform: 'NETFLIX',
    platformBadge: 'bg-red-600 text-white',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=400&fit=crop&q=80',
    category: 'Sci-Fi Drama',
    tagline: 'Netflix Original • 4 Seasons'
  },
  {
    id: 'prime-the-boys',
    title: 'The Boys Season 4',
    url: 'https://www.primevideo.com',
    platform: 'PRIME VIDEO',
    platformBadge: 'bg-blue-600 text-white',
    thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&h=400&fit=crop&q=80',
    category: 'Action Satire',
    tagline: 'Prime Video Exclusive'
  },
  {
    id: 'cyberpunk',
    title: 'Cyberpunk 2077: Phantom Liberty',
    url: 'https://www.youtube.com/watch?v=qIcTM8WXFjk',
    platform: 'YOUTUBE 4K',
    platformBadge: 'bg-rose-600 text-white',
    thumbnail: 'https://img.youtube.com/vi/qIcTM8WXFjk/maxresdefault.jpg',
    category: 'Cinematic Thriller',
    tagline: 'Dogtown Night City'
  }
];

// Watch History Data Model for Continue Watching
interface WatchHistoryItem {
  slug: string;
  roomId: string;
  title: string;
  sourceUrl: string;
  position: number;
  duration: number;
  progressPercent: number;
  activityMode: string;
  lastWatchedAt: string;
}

export type NavSection = 'browse' | 'watchlist' | 'myrooms' | 'parties' | 'games';

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Active navigation menu selection (Strictly working views only)
  const [activeNav, setActiveNav] = useState<NavSection>('browse');

  // Featured carousel state
  const [selectedHeroIndex, setSelectedHeroIndex] = useState(0);
  const activeHero = REAL_YOUTUBE_HEROES[selectedHeroIndex];

  // Hosted rooms from backend
  const [myRooms, setMyRooms] = useState<any[]>([]);

  // Watchlist state (100% real and persisted in localStorage)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  // Real user watch history state for Continue Watching
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);

  // Search & YouTube URL Importer state
  const [searchQuery, setSearchQuery] = useState('');

  // Settings Modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [settingsMuted, setSettingsMuted] = useState(true);
  const [settingsCameraOff, setSettingsCameraOff] = useState(true);
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  // Direct Room Creation & Shareable Link Modal state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdRoomInfo, setCreatedRoomInfo] = useState<{
    slug: string;
    inviteUrl: string;
    title: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  const searchYtId = useMemo(() => extractYouTubeId(searchQuery), [searchQuery]);

  useEffect(() => {
    const current = getStoredSession();
    if (!current || current.user.isAnonymous) {
      router.push('/?auth=required');
      return;
    }
    setSession(current);
    setSettingsName(current.user.displayName || '');
    setLoading(false);

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get('tab');
      if (tab === 'games' || tab === 'watchlist' || tab === 'myrooms' || tab === 'parties') {
        setActiveNav(tab as NavSection);
      }
    }

    // Load real watch history from localStorage
    try {
      const stored = localStorage.getItem('stitchbyte_watch_history');
      if (stored) {
        setWatchHistory(JSON.parse(stored));
      }
    } catch {}

    // Load real watchlist from localStorage
    try {
      const storedWl = localStorage.getItem('stitchbyte_watchlist');
      if (storedWl) {
        setWatchlist(JSON.parse(storedWl));
      } else {
        setWatchlist(DEFAULT_WATCHLIST);
        localStorage.setItem('stitchbyte_watchlist', JSON.stringify(DEFAULT_WATCHLIST));
      }
    } catch {
      setWatchlist(DEFAULT_WATCHLIST);
    }

    // Load audio/video preferences
    try {
      const prefs = localStorage.getItem('stitchbyte_user_prefs');
      if (prefs) {
        const parsed = JSON.parse(prefs);
        if (typeof parsed.muted === 'boolean') setSettingsMuted(parsed.muted);
        if (typeof parsed.cameraOff === 'boolean') setSettingsCameraOff(parsed.cameraOff);
      }
    } catch {}

    getUserRooms(current.token)
      .then((rooms) => {
        setMyRooms(rooms);
        // If local watch history is empty, populate from user's created rooms
        const stored = typeof window !== 'undefined' ? localStorage.getItem('stitchbyte_watch_history') : null;
        if (!stored && rooms && rooms.length > 0) {
          const initialFromRooms: WatchHistoryItem[] = rooms.map((r: any) => ({
            slug: r.slug,
            roomId: r.id,
            title: r.title,
            sourceUrl: r.currentMedia?.sourceUrl || 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
            position: r.playbackState?.position || 0,
            duration: r.currentMedia?.durationSeconds || 0,
            progressPercent: 30,
            activityMode: r.activityMode || 'CINEMA',
            lastWatchedAt: r.createdAt
          }));
          setWatchHistory(initialFromRooms);
          try {
            localStorage.setItem('stitchbyte_watch_history', JSON.stringify(initialFromRooms));
          } catch {}
        }
      })
      .catch(() => {});
  }, [router]);

  const handleLogout = () => {
    clearStoredSession();
    router.push('/');
  };

  // Toggle adding / removing items from Watchlist
  const handleToggleWatchlist = (item: WatchlistItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setWatchlist((prev) => {
      const exists = prev.some((w) => w.id === item.id || w.title === item.title);
      let next: WatchlistItem[];
      if (exists) {
        next = prev.filter((w) => w.id !== item.id && w.title !== item.title);
      } else {
        next = [item, ...prev];
      }
      try {
        localStorage.setItem('stitchbyte_watchlist', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const isInWatchlist = (idOrTitle: string) => {
    return watchlist.some((w) => w.id === idOrTitle || w.title === idOrTitle);
  };

  // Countdown timer for automatic redirect when room is created
  useEffect(() => {
    if (!createdRoomInfo) return;
    if (redirectCountdown <= 0) {
      router.push(`/room/${createdRoomInfo.slug}`);
      return;
    }
    const timer = setTimeout(() => {
      setRedirectCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [createdRoomInfo, redirectCountdown, router]);

  // Directly create room, generate shareable link, and prepare redirect
  const handleDirectCreateRoom = async (
    title?: string,
    sourceUrl?: string
  ) => {
    if (!session) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const roomTitle = title?.trim() || `${session.user.displayName || 'StitchByte'}Watch Party`;
      const roomUrl = sourceUrl?.trim() || 'https://www.netflix.com/browse';

      const data = await createPartyRoom({
        title: roomTitle,
        sourceUrl: roomUrl,
        mediaTitle: roomTitle,
        activityMode: 'CINEMA',
        token: session.token
      });

      const invite = typeof window !== 'undefined'
        ? `${window.location.origin}/room/${data.room.slug}`
        : data.inviteUrl || `/room/${data.room.slug}`;

      // Automatically copy shareable link to clipboard immediately
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(invite).catch(() => {});
      }

      setCreatedRoomInfo({
        slug: data.room.slug,
        inviteUrl: invite,
        title: data.room.title || roomTitle
      });
      setCopiedLink(true);
      setRedirectCountdown(3);
      setIsSubmitting(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start Watch party');
      setIsSubmitting(false);
    }
  };

  // Handle search or quick YouTube URL import
  const handleSearchOrImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Check if user pasted a YouTube video URL or ID
    const extractedId = extractYouTubeId(searchQuery);
    if (extractedId) {
      const fullYtUrl = `https://www.youtube.com/watch?v=${extractedId}`;
      handleDirectCreateRoom(`YouTube Party (${extractedId})`, fullYtUrl);
      return;
    }

    // Otherwise treat as invite code or room slug
    const clean = searchQuery.trim().replace(/^.*\/room\//, '');
    router.push(`/room/${clean}`);
  };

  // Handle saving user settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    const trimmed = settingsName.trim();
    if (trimmed) {
      const updatedUser = { ...session.user, displayName: trimmed };
      const updatedSession = { ...session, user: updatedUser };
      setSession(updatedSession);
      try {
        localStorage.setItem('synccinema_session', JSON.stringify(updatedSession));
        localStorage.setItem('synccinema_guest_name', trimmed);
      } catch {}
    }

    try {
      localStorage.setItem(
        'stitchbyte_user_prefs',
        JSON.stringify({
          muted: settingsMuted,
          cameraOff: settingsCameraOff
        })
      );
    } catch {}

    setSettingsSavedToast(true);
    setTimeout(() => {
      setSettingsSavedToast(false);
      setShowSettingsModal(false);
    }, 900);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111217] flex flex-col items-center justify-center space-y-4 text-white">
        <div className="w-10 h-10 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
        <div className="text-xs font-semibold text-zinc-400 tracking-wider">
          Connecting to Watch...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111217] text-slate-100 flex selection:bg-rose-600 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* ========================================================================= */}
      {/* 1. LEFT SIDEBAR NAVIGATION (STITCHBYTE BRANDING - 100% REAL & WORKING)     */}
      {/* ========================================================================= */}
      <aside className="w-64 bg-[#14151b] border-r border-white/[0.06] p-6 flex flex-col justify-between shrink-0 hidden lg:flex select-none">
        <div className="space-y-8">
          {/* Logo: STITCHBYTE. with Bold Red Accent Dot */}
          <div
            onClick={() => {
              setActiveNav('browse');
              router.push('/dashboard');
            }}
            className="flex items-center space-x-2.5 cursor-pointer select-none"
          >
            <div className="p-1.5 bg-rose-600 rounded-xl text-white shadow-lg shadow-rose-600/30">
              <Film className="w-4 h-4 fill-current" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black tracking-tight text-white">Watch<span className="text-rose-600 text-2xl leading-none">.</span></span>
              <span className="text-[9px] font-semibold text-zinc-500 tracking-widest uppercase mt-0.5">Powered by StitchByte</span>
            </div>
          </div>

          {/* Navigation Groups */}
          <div className="space-y-6">
            {/* Nav Group 1: Menu */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-3 mb-2">
                Menu
              </div>
              <button
                onClick={() => setActiveNav('browse')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold transition ${
                  activeNav === 'browse'
                    ? 'text-white bg-white/[0.08] shadow-sm relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-rose-600 before:rounded-r'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Film className={`w-4 h-4 ${activeNav === 'browse' ? 'text-rose-500' : 'text-zinc-400'}`} />
                <span>Browse Cinema</span>
              </button>

              <button
                onClick={() => setActiveNav('watchlist')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold transition ${
                  activeNav === 'watchlist'
                    ? 'text-white bg-white/[0.08] relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-rose-600 before:rounded-r'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Heart
                  className={`w-4 h-4 ${
                    activeNav === 'watchlist' ? 'text-rose-500 fill-rose-500/20' : 'text-zinc-400'
                  }`}
                />
                <span>Watchlist</span>
                {watchlist.length > 0 && (
                  <span className="ml-auto text-[10px] bg-rose-600/20 text-rose-300 px-1.5 py-0.5 rounded-full font-bold">
                    {watchlist.length}
                  </span>
                )}
              </button>
            </div>

            {/* Nav Group 2: Social / Rooms */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-3 mb-2">
                Social
              </div>
              <button
                onClick={() => setActiveNav('myrooms')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold transition ${
                  activeNav === 'myrooms'
                    ? 'text-white bg-white/[0.08] relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-rose-600 before:rounded-r'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Users className={`w-4 h-4 ${activeNav === 'myrooms' ? 'text-rose-500' : 'text-zinc-400'}`} />
                <span>My Rooms</span>
                {myRooms.length > 0 && (
                  <span className="ml-auto text-[10px] bg-white/10 text-zinc-300 px-1.5 py-0.5 rounded-full font-bold">
                    {myRooms.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveNav('parties')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold transition ${
                  activeNav === 'parties'
                    ? 'text-white bg-white/[0.08] relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-rose-600 before:rounded-r'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Tv className={`w-4 h-4 ${activeNav === 'parties' ? 'text-rose-500' : 'text-zinc-400'}`} />
                <span>Watch Parties</span>
                <span className="ml-auto text-[10px] bg-rose-600/20 text-rose-400 px-1.5 py-0.5 rounded-full font-bold">
                  Max 6
                </span>
              </button>

              <button
                onClick={() => setActiveNav('games')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold transition ${
                  activeNav === 'games'
                    ? 'text-white bg-white/[0.08] relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-rose-600 before:rounded-r'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Gamepad2 className={`w-4 h-4 ${activeNav === 'games' ? 'text-rose-500' : 'text-zinc-400'}`} />
                <span>Game Lounge</span>
                <span className="ml-auto text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full font-bold">
                  PLAY
                </span>
              </button>
            </div>

            {/* Nav Group 3: General */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-3 mb-2">
                General
              </div>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.04] transition"
              >
                <Settings className="w-4 h-4 text-zinc-400" />
                <span>Settings</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Real Action Card: Instant Watch Party (100% Real, replaces fake pass) */}
        <div className="bg-[#1a1b24] p-4 rounded-3xl border border-white/[0.06] space-y-3 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white shadow-md flex-shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">Instant Watch Party</div>
              <div className="text-[10px] text-zinc-400 truncate">Max 6 Persons / Room</div>
            </div>
          </div>
          <button
            onClick={() => handleDirectCreateRoom('Watch Party')}
            className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/20 flex items-center justify-center space-x-1.5 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Room</span>
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN DASHBOARD CONTENT AREA                                            */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Top Header Bar: Navigation arrows, YouTube Link Importer & Search, Profile */}
        <div className="flex items-center justify-between gap-4">
          {/* Back & Forward Controls */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => router.push('/')}
              className="w-9 h-9 rounded-full bg-[#1b1c24] hover:bg-[#242531] border border-white/[0.06] flex items-center justify-center text-zinc-300 transition"
              title="Home"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.forward()}
              className="w-9 h-9 rounded-full bg-[#1b1c24] hover:bg-[#242531] border border-white/[0.06] flex items-center justify-center text-zinc-300 transition"
              title="Forward"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Real YouTube URL Importer & Room Search Bar */}
          <form
            onSubmit={handleSearchOrImport}
            className="flex-1 max-w-xl flex items-center bg-[#1b1c24] border border-white/[0.08] px-4 py-2 rounded-full text-xs text-white focus-within:border-rose-500/60 transition shadow-inner relative"
          >
            <Search className="w-4 h-4 text-zinc-400 shrink-0 mr-2.5" />
            <input
              type="text"
              placeholder="Paste any YouTube link / ID or room code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-xs placeholder-zinc-500 text-white font-mono text-[11px]"
            />

            {/* If a valid YouTube ID is detected in the search bar, show quick launch badge */}
            {searchYtId ? (
              <button
                type="submit"
                className="ml-2 px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] shrink-0 transition flex items-center space-x-1 shadow-md shadow-rose-600/30"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Launch (Max 6)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleDirectCreateRoom('Watch Party')}
                title="Create Instant Watch Party"
                className="text-zinc-400 hover:text-white p-1 ml-1"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Top Right Notifications & User Profile */}
          <div className="flex items-center space-x-3 shrink-0">
            {/* Live Room Limit Indicator */}
            <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-[11px] text-zinc-300">
              <Users className="w-3.5 h-3.5 text-rose-500" />
              <span>Max 6 per room</span>
            </div>

            {/* User Profile Avatar */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center space-x-2.5 p-1 pl-1.5 pr-3 rounded-full bg-[#1b1c24] hover:bg-[#242531] border border-white/[0.06] transition text-left"
              title="Open Settings"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {(session?.user.displayName || 'U')[0].toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-zinc-200 hidden sm:inline max-w-[100px] truncate">
                {session?.user.displayName || 'Guest'}
              </span>
            </button>
          </div>
        </div>

        {/* Global Error Banner if room creation fails */}
        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-2xl flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="p-1 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: BROWSE CINEMA                                                     */}
        {/* ========================================================================= */}
        {activeNav === 'browse' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Featured IMAX Hero Banner */}
            <div className="relative rounded-3xl overflow-hidden bg-[#171821] border border-white/[0.08] shadow-2xl h-[340px] sm:h-[400px] flex flex-col justify-end p-6 sm:p-10">
              <img
                src={activeHero.bgThumbnail}
                alt={activeHero.title}
                className="absolute inset-0 w-full h-full object-cover opacity-60 transition duration-700 ease-out scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#111217] via-[#111217]/50 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#111217] via-[#111217]/60 to-transparent" />

              <div className="relative z-10 max-w-xl space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-600/90 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                    {activeHero.category}
                  </span>
                  <span className="text-xs font-bold text-emerald-400">{activeHero.match}</span>
                  <span className="text-zinc-500 text-xs">•</span>
                  <span className="text-xs text-zinc-300 font-medium">{activeHero.friendsWatching}</span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  {activeHero.title}
                </h1>

                <p className="text-xs sm:text-sm text-zinc-300 line-clamp-2 leading-relaxed">
                  {activeHero.description}
                </p>

                <div className="flex items-center space-x-3 pt-2">
                  <button
                    onClick={() => handleDirectCreateRoom(activeHero.title, activeHero.videoUrl)}
                    disabled={isSubmitting}
                    className="px-6 py-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-rose-600/30 transition flex items-center space-x-2 active:scale-95 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{isSubmitting ? 'Creating Room...' : 'Start Watching'}</span>
                  </button>

                  <button
                    onClick={(e) =>
                      handleToggleWatchlist(
                        {
                          id: activeHero.id,
                          title: activeHero.title,
                          url: activeHero.videoUrl,
                          platform: 'YOUTUBE 4K',
                          platformBadge: 'bg-rose-600 text-white',
                          thumbnail: activeHero.bgThumbnail,
                          category: activeHero.category,
                          tagline: activeHero.description
                        },
                        e
                      )
                    }
                    className={`p-3 rounded-xl border transition ${
                      isInWatchlist(activeHero.title)
                        ? 'bg-rose-600/20 text-rose-500 border-rose-500/40'
                        : 'bg-white/10 hover:bg-white/15 text-white border-white/10'
                    }`}
                    title={isInWatchlist(activeHero.title) ? 'Remove from Watchlist' : 'Add to Watchlist'}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        isInWatchlist(activeHero.title) ? 'fill-current' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Hero switcher carousel thumbnails */}
              <div className="absolute bottom-6 right-6 hidden md:flex items-center space-x-2 z-10">
                {REAL_YOUTUBE_HEROES.map((h, idx) => (
                  <button
                    key={h.id}
                    onClick={() => setSelectedHeroIndex(idx)}
                    className={`w-14 h-9 rounded-lg overflow-hidden border-2 transition ${
                      selectedHeroIndex === idx ? 'border-rose-500 scale-105 shadow' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={h.bgThumbnail} alt={h.title} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Multi-Platform Co-Watching Shortcuts (Netflix, Prime, Disney, YouTube) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">Stream Any Platform Together</h2>
                <span className="text-xs text-zinc-400">Share your screen or paste URL</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {PLATFORMS.map((plat) => (
                  <div
                    key={plat.id}
                    onClick={() => handleDirectCreateRoom(`${plat.name} Watch Party`)}
                    className={`p-4 rounded-2xl border ${plat.color} hover:scale-[1.02] transition cursor-pointer flex flex-col justify-between space-y-3`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{plat.icon}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/40 text-white">
                        Max 6
                      </span>
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white">{plat.name}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">{plat.tag}</div>
                    </div>
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-400">
                      <span>Instant Room</span>
                      <span className="text-rose-400 font-bold">Start →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Featured Watch Parties Row */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-white">Featured Watch Parties</h2>
                  <span className="text-[10px] bg-rose-600/20 text-rose-400 px-2 py-0.5 rounded-full font-bold">
                    Live
                  </span>
                </div>
                <button
                  onClick={() => setActiveNav('parties')}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                >
                  View All Parties →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {REAL_YOUTUBE_PARTIES.map((party) => (
                  <div
                    key={party.id}
                    onClick={() => handleDirectCreateRoom(party.title, party.videoUrl)}
                    className="group p-4 rounded-3xl cursor-pointer transition border border-white/[0.06] hover:border-white/20 bg-[#171821] hover:scale-[1.02] flex flex-col justify-between space-y-3 shadow-lg"
                  >
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black/50">
                      <img
                        src={party.thumbnail}
                        alt={party.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <span className={`absolute top-2 left-2 px-2.5 py-0.5 rounded-md text-[9px] font-black shadow tracking-wider ${party.platformBadge}`}>
                        {party.platform}
                      </span>

                      {/* Heart Watchlist Button */}
                      <button
                        onClick={(e) =>
                          handleToggleWatchlist(
                            {
                              id: party.id,
                              title: party.title,
                              url: party.videoUrl,
                              platform: party.platform,
                              platformBadge: party.platformBadge,
                              thumbnail: party.thumbnail,
                              tagline: party.tagline
                            },
                            e
                          )
                        }
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition z-10"
                        title={isInWatchlist(party.title) ? 'Remove from Watchlist' : 'Save to Watchlist'}
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            isInWatchlist(party.title) ? 'text-rose-500 fill-rose-500' : 'text-zinc-300'
                          }`}
                        />
                      </button>

                      <div className="absolute bottom-2 left-2 flex -space-x-1.5">
                        {party.avatars.map((av, i) => (
                          <img
                            key={i}
                            src={av}
                            className="w-5 h-5 rounded-full border border-black object-cover"
                            alt="Viewer"
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-sm text-white group-hover:text-rose-400 transition truncate">
                        {party.title}
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">{party.tagline}</div>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>Synchronized</span>
                      <span className="text-rose-400 font-bold group-hover:translate-x-0.5 transition">
                        Watch →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Continue Watching Row (Auto-saved user history) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-white">Continue Watching</h2>
                  {watchHistory.length > 0 && (
                    <span className="text-[10px] bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full font-bold">
                      {watchHistory.length} in progress
                    </span>
                  )}
                </div>
                <span className="text-xs text-zinc-500">Auto-saved playback progress</span>
              </div>

              {watchHistory.length === 0 ? (
                <div className="p-6 rounded-3xl bg-[#171821] border border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1 text-center sm:text-left">
                    <div className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                      <Clock className="w-4 h-4 text-rose-500" />
                      <span>No Viewing History Yet</span>
                    </div>
                    <p className="text-xs text-zinc-400 max-w-md">
                      Start any watch party above. Your playback progress will automatically appear here so you and your friends can resume together!
                    </p>
                  </div>
                  <button
                    onClick={() => handleDirectCreateRoom('Watch Party')}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition shrink-0"
                  >
                    + Start a Watch Party
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {watchHistory.map((item) => {
                    const ytId = extractYouTubeId(item.sourceUrl);
                    const thumbnail = ytId
                      ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
                      : 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400&auto=format&fit=crop';
                    return (
                      <div
                        key={item.slug}
                        onClick={() => router.push(`/room/${item.slug}`)}
                        className="group rounded-3xl overflow-hidden bg-[#171821] border border-white/[0.06] hover:border-white/20 transition cursor-pointer shadow-lg flex flex-col justify-between"
                      >
                        <div className="relative aspect-video w-full overflow-hidden bg-black/60">
                          <img
                            src={thumbnail}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold text-white border border-white/10">
                            {item.position > 0 ? `${Math.floor(item.position / 60)}m watched` : 'Just started'}
                          </span>
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                            <div
                              className="h-full bg-rose-600 transition-all duration-300"
                              style={{ width: `${Math.max(8, item.progressPercent || 20)}%` }}
                            />
                          </div>
                        </div>

                        <div className="p-4 flex items-center justify-between">
                          <div className="truncate pr-2">
                            <div className="font-bold text-xs sm:text-sm text-white truncate group-hover:text-rose-400 transition">
                              {item.title}
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                              Room: {item.slug}
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-600/20 text-rose-400 text-xs font-bold group-hover:bg-rose-600 group-hover:text-white transition shrink-0">
                            <Play className="w-3 h-3 fill-current" />
                            <span>Resume</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: DEDICATED WATCHLIST PAGE (Requested: "watchlist will have a diff page") */}
        {/* ========================================================================= */}
        {activeNav === 'watchlist' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.06]">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-rose-600/10 border border-rose-500/20 text-rose-500">
                  <Heart className="w-6 h-6 fill-rose-500/20" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">My Watchlist</h1>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Saved movies and videos ready to stream with up to 6 friends.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/[0.06] text-zinc-300 border border-white/10">
                  {watchlist.length} {watchlist.length === 1 ? 'title' : 'titles'} saved
                </span>
                <button
                  onClick={() => setActiveNav('browse')}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl transition"
                >
                  + Browse More
                </button>
              </div>
            </div>

            {/* Watchlist Grid */}
            {watchlist.length === 0 ? (
              <div className="p-12 rounded-3xl bg-[#171821] border border-white/[0.06] text-center space-y-4 max-w-lg mx-auto mt-8">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 mx-auto">
                  <Heart className="w-7 h-7 text-rose-500/40" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">Your Watchlist is Empty</h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    Explore cinema titles in Browse Cinema and tap the heart icon on any movie to save it here for party nights!
                  </p>
                </div>
                <button
                  onClick={() => setActiveNav('browse')}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition"
                >
                  Browse Cinema Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {watchlist.map((item) => (
                  <div
                    key={item.id}
                    className="group p-4 rounded-3xl border border-white/[0.06] hover:border-white/20 bg-[#171821] transition flex flex-col justify-between space-y-3 shadow-lg hover:scale-[1.01]"
                  >
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black/50">
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <span className={`absolute top-2 left-2 px-2.5 py-0.5 rounded-md text-[9px] font-black shadow tracking-wider ${item.platformBadge || 'bg-rose-600 text-white'}`}>
                        {item.platform || 'CINEMA'}
                      </span>

                      {/* Remove Button */}
                      <button
                        onClick={(e) => handleToggleWatchlist(item, e)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-red-600 text-zinc-300 hover:text-white transition z-10"
                        title="Remove from Watchlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <div className="font-bold text-sm text-white group-hover:text-rose-400 transition truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5 truncate">{item.tagline || item.category || 'Saved to Watchlist'}</div>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                      <button
                        onClick={() => handleDirectCreateRoom(item.title, item.url)}
                        className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow flex items-center justify-center space-x-1.5 active:scale-95"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Start Party</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: DEDICATED MY ROOMS PAGE (Requested: "my room will be shown as new page") */}
        {/* ========================================================================= */}
        {activeNav === 'myrooms' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.06]">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-rose-600/10 border border-rose-500/20 text-rose-500">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">My Watch Rooms</h1>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Manage and re-enter your active and hosted watch party rooms.
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleDirectCreateRoom('Watch Party')}
                className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition flex items-center space-x-2 self-start sm:self-auto active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create New Room</span>
              </button>
            </div>

            {/* My Rooms Grid */}
            {myRooms.length === 0 ? (
              <div className="p-12 rounded-3xl bg-[#171821] border border-white/[0.06] text-center space-y-4 max-w-lg mx-auto mt-8">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 mx-auto">
                  <Film className="w-7 h-7 text-rose-500/40" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">No Rooms Created Yet</h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    Start a watch party room to stream YouTube, Netflix, Prime Video or screen share with up to 6 friends.
                  </p>
                </div>
                <button
                  onClick={() => handleDirectCreateRoom('Watch Party')}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition"
                >
                  Create My First Room
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myRooms.map((r) => (
                  <div
                    key={r.id}
                    className="p-5 rounded-3xl bg-[#171821] border border-white/[0.06] hover:border-white/20 transition flex flex-col justify-between space-y-4 shadow-lg"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-2">
                        <span className="font-bold px-2.5 py-0.5 rounded-full bg-rose-600/20 text-rose-400 border border-rose-600/30">
                          LIVE ROOM (MAX 6)
                        </span>
                        <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                      <h3 className="font-bold text-base text-white truncate">{r.title}</h3>
                      <div className="flex items-center space-x-2 mt-1 text-xs text-zinc-400 font-mono">
                        <span>Code: {r.slug}</span>
                        <button
                          onClick={() => {
                            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                              const url = `${window.location.origin}/room/${r.slug}`;
                              navigator.clipboard.writeText(url);
                            }
                          }}
                          className="text-zinc-500 hover:text-white p-0.5"
                          title="Copy share link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                      <button
                        onClick={() => router.push(`/room/${r.slug}`)}
                        className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition text-center shadow active:scale-95"
                      >
                        Enter Room →
                      </button>
                      <button
                        onClick={() => router.push(`/room/${r.slug}/recap`)}
                        className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold transition"
                      >
                        Recap
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 4: WATCH PARTIES PAGE (Curated public & co-watching parties)         */}
        {/* ========================================================================= */}
        {activeNav === 'parties' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.06]">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-rose-600/10 border border-rose-500/20 text-rose-500">
                  <Tv className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Watch Parties</h1>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Synchronized watch rooms across Netflix, Prime Video, Disney+ and YouTube 4K.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-600/20 text-rose-400 border border-rose-600/30">
                  👥 Max 6 Persons / Room
                </span>
                <button
                  onClick={() => handleDirectCreateRoom('Custom Watch Party')}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow"
                >
                  + Start Custom Party
                </button>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {REAL_YOUTUBE_PARTIES.map((party) => (
                <div
                  key={party.id}
                  onClick={() => handleDirectCreateRoom(party.title, party.videoUrl)}
                  className="group p-4 rounded-3xl cursor-pointer transition border border-white/[0.06] hover:border-white/20 bg-[#171821] hover:scale-[1.02] flex flex-col justify-between space-y-3 shadow-lg"
                >
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black/50">
                    <img
                      src={party.thumbnail}
                      alt={party.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className={`absolute top-2 left-2 px-2.5 py-0.5 rounded-md text-[9px] font-black shadow tracking-wider ${party.platformBadge}`}>
                      {party.platform}
                    </span>

                    <button
                      onClick={(e) =>
                        handleToggleWatchlist(
                          {
                            id: party.id,
                            title: party.title,
                            url: party.videoUrl,
                            platform: party.platform,
                            platformBadge: party.platformBadge,
                            thumbnail: party.thumbnail,
                            tagline: party.tagline
                          },
                          e
                        )
                      }
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition z-10"
                      title={isInWatchlist(party.title) ? 'Remove from Watchlist' : 'Save to Watchlist'}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          isInWatchlist(party.title) ? 'text-rose-500 fill-rose-500' : 'text-zinc-300'
                        }`}
                      />
                    </button>

                    <div className="absolute bottom-2 left-2 flex -space-x-1.5">
                      {party.avatars.map((av, i) => (
                        <img
                          key={i}
                          src={av}
                          className="w-5 h-5 rounded-full border border-black object-cover"
                          alt="Viewer"
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-sm text-white group-hover:text-rose-400 transition truncate">
                      {party.title}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">{party.tagline}</div>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Synchronized</span>
                    <span className="text-rose-400 font-bold group-hover:translate-x-0.5 transition">
                      Watch →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 5: DEDICATED PARTY GAME LOUNGE PAGE (Requested by user)              */}
        {/* ========================================================================= */}
        {activeNav === 'games' && (
          <div className="w-full pb-10 animate-fadeIn">
            <GameLounge
              onLaunchParty={() => handleDirectCreateRoom('Game Night Watch Party')}
              myUserName={session?.user.displayName || 'Host Player'}
              isCompact={false}
              hideHeader={true}
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. INSTANT ROOM READY — SHAREABLE LINK & REDIRECT MODAL                   */}
      {/* ========================================================================= */}
      {createdRoomInfo && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#171821] border border-white/10 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl relative text-center animate-in fade-in zoom-in-95 duration-200">
            {/* Close / Enter Button */}
            <button
              onClick={() => router.push(`/room/${createdRoomInfo.slug}`)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/5 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon Header */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-600 text-white mx-auto flex items-center justify-center shadow-lg shadow-rose-600/30">
              <Check className="w-7 h-7 stroke-[3]" />
            </div>

            <div>
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 mb-2">
                <Check className="w-3.5 h-3.5" />
                <span>Link Copied to Clipboard!</span>
              </div>
              <h3 className="text-xl font-black text-white">{createdRoomInfo.title} is Ready</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Share this link to watch together.
              </p>
            </div>

            {/* Shareable Link Box with 1-Click Copy */}
            <div className="flex items-center space-x-2 bg-[#101115] p-2 rounded-2xl border border-white/10">
              <input
                type="text"
                readOnly
                value={createdRoomInfo.inviteUrl}
                className="bg-transparent text-xs text-zinc-200 px-2 py-1 w-full focus:outline-none font-mono select-all"
              />
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(createdRoomInfo.inviteUrl);
                    setCopiedLink(true);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shrink-0 transition flex items-center space-x-1.5 shadow"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
              <span>👥 Max 6 Persons Allowed</span>
              <span className="text-zinc-400">
                Redirecting in <span className="font-bold text-rose-400">{redirectCountdown}s</span>...
              </span>
            </div>

            {/* Direct Instant Enter Room Button */}
            <button
              type="button"
              onClick={() => router.push(`/room/${createdRoomInfo.slug}`)}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-rose-600/30 transition flex items-center justify-center space-x-2 active:scale-95"
            >
              <span>Enter Room Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SETTINGS MODAL (100% Real User Profile & Preferences)                   */}
      {/* ========================================================================= */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#171821] border border-white/10 rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/5 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Party Preferences</h3>
                <p className="text-xs text-zinc-400">Manage your profile and room defaults</p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              {/* Display Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Display Name</label>
                <input
                  type="text"
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={30}
                  className="w-full bg-[#101115] text-xs text-white placeholder-zinc-500 rounded-xl px-3.5 py-2.5 border border-white/10 focus:outline-none focus:border-rose-500 transition"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-2.5 pt-1">
                <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.05] transition">
                  <div className="flex items-center space-x-2.5">
                    <Volume2 className="w-4 h-4 text-zinc-400" />
                    <span className="text-xs text-zinc-200">Start with microphone muted</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settingsMuted}
                    onChange={(e) => setSettingsMuted(e.target.checked)}
                    className="w-4 h-4 accent-rose-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.05] transition">
                  <div className="flex items-center space-x-2.5">
                    <Video className="w-4 h-4 text-zinc-400" />
                    <span className="text-xs text-zinc-200">Start with camera off</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settingsCameraOff}
                    onChange={(e) => setSettingsCameraOff(e.target.checked)}
                    className="w-4 h-4 accent-rose-600 rounded"
                  />
                </label>
              </div>

              {/* Room Capacity Guarantee Notice */}
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start space-x-2 text-[11px] text-zinc-400">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Rooms are strictly limited to 6 simultaneous participants for ultra-low latency co-watching.</span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-xl shadow-lg shadow-rose-600/30 transition flex items-center space-x-1.5"
                >
                  {settingsSavedToast ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
