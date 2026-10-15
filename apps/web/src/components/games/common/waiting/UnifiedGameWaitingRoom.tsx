'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Palette,
  Dices,
  Crown,
  Sparkles,
  Ticket,
  Grid,
  CircleDot,
  Users,
  Clock,
  BookOpen,
  Settings2,
  Copy,
  Check,
  Share2,
  UserPlus,
  ArrowRight,
  Play,
  Lock,
  User,
  Ghost,
  Trophy,
  Search
} from 'lucide-react';
import { GameRoom } from '@synccinema/common';
import { GameChatMessage } from '../../../../hooks/useGameRoom';
import { WatchHeader } from '../../doodle/waiting/WatchHeader';
import { PlayerCard } from '../../doodle/waiting/PlayerCard';
import { VersusIndicator } from '../../doodle/waiting/VersusIndicator';
import { ChatPanel } from '../../doodle/waiting/ChatPanel';
import { useTheme } from '../../../../context/ThemeContext';
import { VideoGrid, type ParticipantStream } from '../../../voice/VideoGrid';
import { TournamentMatchBanner } from '../TournamentMatchBanner';

export type GameId =
  | 'doodle-duel'
  | 'ludo'
  | 'bingo'
  | 'tambola'
  | 'chess'
  | 'tic-tac-toe'
  | 'four-in-a-row'
  | 'imposter'
  | 'mafia-night'
  | 'quiz-show'
  | 'murder-mystery'
  | 'tournament';

interface GamePreset {
  id: GameId;
  name: string;
  tagline: string;
  annotation: string;
  icon: React.ElementType;
  iconColor: string;
  bgImage: string;
  chips: { label: string; icon: React.ElementType; color: string }[];
  rules: string[];
  maxPlayers: number;
}

export const GAME_PRESETS: Record<GameId, GamePreset> = {
  'doodle-duel': {
    id: 'doodle-duel',
    name: 'Doodle Duel',
    tagline: 'Draw it. Guess it. Switch.',
    annotation: 'Good Drawings Better Friends.',
    icon: Palette,
    iconColor: '#ff2b70',
    bgImage: '/images/doodle-cozy-workspace.jpg',
    chips: [
      { label: '2 Players', icon: Users, color: '#ff2b70' },
      { label: 'Real-time', icon: Clock, color: '#0ea5e9' },
      { label: 'Creative', icon: Sparkles, color: '#f59e0b' }
    ],
    rules: [
      'One player gets a secret word and draws it.',
      'The other player guesses live in real-time.',
      'Roles switch automatically every round!',
      'Most correct guesses win the match!'
    ],
    maxPlayers: 2
  },
  ludo: {
    id: 'ludo',
    name: 'Ludo Royale',
    tagline: 'Roll six. Capture tokens. Race home.',
    annotation: 'Roll High Stay Lucky.',
    icon: Dices,
    iconColor: '#e11d48',
    bgImage: '/images/ludo-cozy-workspace.jpg',
    chips: [
      { label: '2-4 Players', icon: Users, color: '#e11d48' },
      { label: 'Real-time', icon: Clock, color: '#0ea5e9' },
      { label: 'Strategy', icon: Sparkles, color: '#f59e0b' }
    ],
    rules: [
      'Roll a 6 to release tokens onto the track.',
      'Land on opponent tokens to send them home.',
      'Navigate all tokens safely into the home triangle.',
      'First player to get all tokens home wins!'
    ],
    maxPlayers: 4
  },
  chess: {
    id: 'chess',
    name: 'Chess Masters',
    tagline: 'Think ahead. Control the center. Checkmate.',
    annotation: 'Grandmaster Moves Only.',
    icon: Crown,
    iconColor: '#8b5cf6',
    bgImage: '/images/chess-cozy-workspace.jpg',
    chips: [
      { label: '2 Players', icon: Users, color: '#8b5cf6' },
      { label: 'Real-time', icon: Clock, color: '#0ea5e9' },
      { label: 'Pure Skill', icon: Sparkles, color: '#f59e0b' }
    ],
    rules: [
      'White moves first, followed by Black.',
      'Control the center squares and develop pieces.',
      'Protect your King with castling and tactics.',
      'Deliver checkmate to claim victory!'
    ],
    maxPlayers: 2
  },
  bingo: {
    id: 'bingo',
    name: 'Bingo Duel',
    tagline: 'Fill lines. Claim patterns. Shout Bingo!',
    annotation: 'Lucky Numbers Today.',
    icon: Sparkles,
    iconColor: '#f43f5e',
    bgImage: '/images/bingo_cozy_romantic_bg.jpg',
    chips: [
      { label: '2 Players', icon: Users, color: '#f43f5e' },
      { label: 'Real-time', icon: Clock, color: '#0ea5e9' },
      { label: 'Instant Win', icon: Sparkles, color: '#f59e0b' }
    ],
    rules: [
      'Mark called numbers on your 5x5 grid.',
      'Complete horizontal, vertical, or diagonal rows.',
      'Complete 5 lines to complete B-I-N-G-O.',
      'First to achieve 5 lines claims the win!'
    ],
    maxPlayers: 2
  },
  tambola: {
    id: 'tambola',
    name: 'Tambola Party',
    tagline: 'Early five. Top line. Full house!',
    annotation: 'Family Fun Night.',
    icon: Ticket,
    iconColor: '#ec4899',
    bgImage: '/images/romantic_room_ambient_bg.jpg',
    chips: [
      { label: '2-10 Players', icon: Users, color: '#ec4899' },
      { label: 'Multiplayer', icon: Clock, color: '#0ea5e9' },
      { label: 'Prizes', icon: Sparkles, color: '#f59e0b' }
    ],
    rules: [
      'Numbers 1–90 are drawn and announced live.',
      'Mark matched numbers on your 3x9 ticket.',
      'Claim Early 5, Rows, Corners, or Full House.',
      'Valid claims win instant victory points!'
    ],
    maxPlayers: 10
  },
  'tic-tac-toe': {
    id: 'tic-tac-toe',
    name: 'Tic Tac Toe',
    tagline: 'Three in a row. Block and win.',
    annotation: 'Simple Classic Fun.',
    icon: Grid,
    iconColor: '#0ea5e9',
    bgImage: '/images/card-tictactoe.jpg',
    chips: [
      { label: '2 Players', icon: Users, color: '#0ea5e9' },
      { label: 'Turn-based', icon: Clock, color: '#f43f5e' },
      { label: 'Quick Duel', icon: Sparkles, color: '#f59e0b' }
    ],
    rules: [
      'Take turns placing your mark (X or O).',
      'Get 3 marks in a line (horizontal, vertical, diagonal).',
      'Block your opponent before they complete 3.',
      'First to connect 3 marks wins the round!'
    ],
    maxPlayers: 2
  },
  'four-in-a-row': {
    id: 'four-in-a-row',
    name: 'Four in a Row',
    tagline: 'Drop discs. Connect four. Claim victory.',
    annotation: 'Connect & Conquer.',
    icon: CircleDot,
    iconColor: '#ff2b70',
    bgImage: '/images/four-in-a-row-waiting-bg.jpg',
    chips: [
      { label: '2 Players', icon: Users, color: '#ff2b70' },
      { label: 'Turn-based', icon: Clock, color: '#0ea5e9' },
      { label: 'Gravity Duel', icon: Sparkles, color: '#f59e0b' }
    ],
    rules: [
      'Take turns dropping discs into the 7 vertical columns.',
      'Discs fall to the lowest unoccupied space.',
      'Connect 4 discs horizontally, vertically, or diagonally.',
      'First player to connect four wins!'
    ],
    maxPlayers: 2
  },
  imposter: {
    id: 'imposter',
    name: 'Imposter',
    tagline: 'One of you does not know the word. Find them.',
    annotation: 'Trust No One.',
    icon: Ghost,
    iconColor: '#ee1d49',
    bgImage: '/images/romantic_room_ambient_bg.jpg',
    chips: [
      { label: '4-8 Players', icon: Users, color: '#71717a' },
      { label: 'VIP game', icon: Crown, color: '#f59e0b' },
      { label: 'Bluffing', icon: Sparkles, color: '#71717a' }
    ],
    rules: [
      'Everyone sees a category. All but one player also see the secret word.',
      'Give one-word clues, twice around. Do not say the word!',
      'Discuss, then vote for who you think is bluffing.',
      'Caught? The imposter gets one last guess at the word.'
    ],
    maxPlayers: 8
  },
  'mafia-night': {
    id: 'mafia-night',
    name: 'Mafia Night',
    tagline: 'Night falls. Find the mafia before they find you.',
    annotation: 'Trust No One.',
    icon: Ghost,
    iconColor: '#ee1d49',
    bgImage: '/images/romantic_room_ambient_bg.jpg',
    chips: [
      { label: '5-10 Players', icon: Users, color: '#71717a' },
      { label: 'VIP game', icon: Crown, color: '#f59e0b' },
      { label: 'Secret roles', icon: Sparkles, color: '#71717a' }
    ],
    rules: [
      'Secret roles: Mafia, Doctor, Detective and Villagers.',
      'At night the mafia pick a victim, the Doctor saves one player, the Detective checks one.',
      'By day the town discusses and votes someone out.',
      'Town wins when the mafia are gone. Mafia win when they match the town.'
    ],
    maxPlayers: 10
  },
  'quiz-show': {
    id: 'quiz-show',
    name: 'Quiz Show Studio',
    tagline: 'Your quiz. Your questions. Live leaderboard.',
    annotation: 'Buzz In.',
    icon: Trophy,
    iconColor: '#ee1d49',
    bgImage: '/images/romantic_room_ambient_bg.jpg',
    chips: [
      { label: '1-30 Players', icon: Users, color: '#71717a' },
      { label: 'Creator game', icon: Crown, color: '#f59e0b' },
      { label: 'Live quiz', icon: Sparkles, color: '#71717a' }
    ],
    rules: [
      'The host is the quiz master and writes the questions.',
      'Pick an answer before the timer runs out: faster answers score more.',
      'On a buzzer question the first to buzz answers, the host judges.',
      'The leaderboard updates after every question. Top of the podium wins!'
    ],
    maxPlayers: 31
  },
  'murder-mystery': {
    id: 'murder-mystery',
    name: 'Murder Mystery Night',
    tagline: 'One of you did it. Find out who.',
    annotation: 'Everyone Is A Suspect.',
    icon: Search,
    iconColor: '#ee1d49',
    bgImage: '/images/romantic_room_ambient_bg.jpg',
    chips: [
      { label: '6-12 Players', icon: Users, color: '#71717a' },
      { label: 'Creator game', icon: Crown, color: '#f59e0b' },
      { label: 'Whodunit', icon: Sparkles, color: '#71717a' }
    ],
    rules: [
      'Everyone plays a suspect with a secret. One of you is the murderer.',
      'Four clue rounds: some clues are public, some only you see.',
      'Discuss in chat or whisper to one player. Share a clue to earn points.',
      'Then accuse the murderer in secret. The truth is revealed at the end.'
    ],
    maxPlayers: 12
  },
  tournament: {
    id: 'tournament',
    name: 'Tournament Arena',
    tagline: 'Brackets, byes and one champion.',
    annotation: 'Win The Bracket.',
    icon: Trophy,
    iconColor: '#ee1d49',
    bgImage: '/images/romantic_room_ambient_bg.jpg',
    chips: [
      { label: '4-32 Players', icon: Users, color: '#71717a' },
      { label: 'Creator game', icon: Crown, color: '#f59e0b' },
      { label: 'Bracket', icon: Sparkles, color: '#71717a' }
    ],
    rules: [
      'The organiser picks the game and starts the bracket. They do not play.',
      'Players are seeded by join order. Top seeds get a bye when the count is uneven.',
      'Each match opens in its own room: open it within 2 minutes or you forfeit.',
      'Win your matches to reach the Final. A drawn game is replayed.'
    ],
    maxPlayers: 33
  }
};

/**
 * Opt-in group lobby (Imposter): a min-max player range and a host start gated by a rule, instead of the 1v1
 * "opponent" wording. Games that do not pass it keep the original behaviour.
 */
export interface GroupLobbyConfig {
  minPlayers: number;
  maxPlayers: number;
  /** players currently connected (the start rule counts these) */
  readyCount: number;
  /** line under the title */
  subtitle: string;
  canStart: boolean;
  /** why the host cannot start yet (or "Ready to start") */
  startHint?: string | null;
  error?: string | null;
  /** opens the friends picker (replaces the plain share link on the invite card) */
  onInviteFriends?: () => void;
  /** host settings rendered above the Start button (for example the round count) */
  extraControls?: React.ReactNode;
  /** opt-in (Quiz Show Studio): only the seated players are drawn, without empty "Waiting..." seats (the room may hold 31) */
  hideEmptySeats?: boolean;
  /** opt-in (Quiz Show Studio): a full width panel below the lobby (the host's quiz builder) */
  lobbyPanel?: React.ReactNode;
  /** opt-in (Tournament Arena): what the host's seat is called when empty seats are hidden (default "Quiz master") */
  hostLabel?: string;
  /** opt-in (Tournament Arena): what players read while the host has not started (default "Waiting for Host to start the match...") */
  waitingForHostText?: string;
}

interface UnifiedGameWaitingRoomProps {
  gameType: GameId;
  room: GameRoom;
  myUserId: string;
  gameState?: any;
  chatMessages: GameChatMessage[];
  isMicMuted?: boolean;
  isCameraOn?: boolean;
  onToggleMic?: () => void;
  onToggleCamera?: () => void;
  onSendChat: (text: string) => void;
  onSendReaction?: (emoji: string) => void;
  onStartGame: (config?: any) => void;
  onUpdateConfig?: (config: any) => void;
  onLeave: () => void;
  customSettingsComponent?: React.ReactNode;
  groupLobby?: GroupLobbyConfig;
  /** live camera / voice tiles of the players (shown above the seats when given) */
  videoParticipants?: ParticipantStream[];
  /**
   * Opt-in surface style. 'solid' (Imposter only) renders flat opaque cards on a plain page: no background photo, no blur,
   * no glows, no gradients. Omitted (every other game) keeps the original look exactly.
   */
  surface?: 'default' | 'solid';
}

export const UnifiedGameWaitingRoom: React.FC<UnifiedGameWaitingRoomProps> = ({
  gameType,
  room,
  myUserId,
  gameState,
  chatMessages,
  isMicMuted = true,
  isCameraOn = false,
  onToggleMic = () => {},
  onToggleCamera = () => {},
  onSendChat,
  onSendReaction,
  onStartGame,
  onUpdateConfig,
  onLeave,
  customSettingsComponent,
  groupLobby,
  videoParticipants,
  surface
}) => {
  const solid = surface === 'solid';
  const accent = solid ? 'text-[#ee1d49]' : 'text-[#ff2b70]';
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isMyReady, setIsMyReady] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const preset = GAME_PRESETS[gameType] || GAME_PRESETS['doodle-duel'];
  const Icon = preset.icon;

  let myStoredAvatar = '';
  if (typeof window !== 'undefined') {
    try {
      const stored = JSON.parse(localStorage.getItem('synccinema_session') || '{}');
      myStoredAvatar = stored?.user?.avatarUrl || '';
    } catch {}
  }

  const rawMyPlayer = room.players.find(p => p.userId === myUserId);
  const myPlayer = {
    userId: myUserId,
    displayName: rawMyPlayer?.displayName || 'You',
    avatarUrl: (rawMyPlayer?.avatarUrl && !rawMyPlayer.avatarUrl.includes('/bottts/'))
      ? rawMyPlayer.avatarUrl
      : myStoredAvatar,
    seat: rawMyPlayer?.seat ?? 0,
    isConnected: rawMyPlayer?.isConnected ?? true
  };

  // Players who left (status LEFT) are not present: never show them as the opponent.
  const opponentPlayer = room.players.find(p => p.userId !== myUserId && (p as any).status !== 'LEFT') || null;
  const isHost = room.hostUserId === myUserId;
  const hasOpponent = Boolean(opponentPlayer);
  const maxSeats = groupLobby ? Math.max(room.maxPlayers || groupLobby.maxPlayers, groupLobby.minPlayers) : (room.maxPlayers || preset.maxPlayers || 2);
  const isMultiplayer = maxSeats > 2;
  // Group lobbies only show players who are still in (a player who left is not a seat holder)
  const seatPlayers = groupLobby ? room.players.filter(p => (p as any).status !== 'LEFT') : room.players;
  const showStart = groupLobby ? true : hasOpponent;

  const handleStartGame = () => {
    if (isStarting) return;
    setIsStarting(true);
    onStartGame();
    // The server answers with game:started; if it refused (game:error) the spinner must not stay forever.
    setTimeout(() => setIsStarting(false), 4000);
  };

  const handleCopyCode = () => {
    if (typeof window === 'undefined') return;
    void navigator.clipboard.writeText(room.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareLink = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `Join my ${preset.name} Room!`,
        text: `Play ${preset.name} with me! Room Code: ${room.roomCode}`,
        url
      }).catch(() => {});
      return;
    }
    void navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className={solid ? "relative min-h-screen min-h-[100dvh] w-full flex flex-col justify-between overflow-x-hidden overflow-y-auto transition-colors bg-[#f7f8fa] dark:bg-[#0c0d12] text-zinc-900 dark:text-white select-none" : "relative min-h-screen min-h-[100dvh] w-full flex flex-col justify-between overflow-x-hidden overflow-y-auto transition-colors bg-[#fdf8f6] dark:bg-[#0c0f1d] text-slate-800 dark:text-white select-none"}>
      {/* 1. Photorealistic Clean Background Layer (No baked containers) */}
      {!solid && (
      <div className="fixed inset-0 pointer-events-none z-0 select-none overflow-hidden">
        <img
          src={preset.bgImage}
          alt={preset.name}
          className="w-full h-full object-cover object-center opacity-65 dark:opacity-25 transition-opacity"
        />
        {/* Soft pastel overlay blending into UI */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/15 to-white/45 dark:from-[#0c0f1d]/80 dark:via-[#0c0f1d]/60 dark:to-[#0c0f1d]/85" />
        {/* Ambient bokeh glows */}
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-pink-200/25 dark:bg-pink-900/15 blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 rounded-full bg-rose-200/20 dark:bg-rose-900/10 blur-3xl" />
      </div>
      )}

      {/* 2. Main Page Container */}
      <div className="relative z-10 flex-1 flex flex-col justify-between max-w-6xl mx-auto w-full p-2.5 sm:p-4 md:px-5 md:py-4 min-h-full gap-3 sm:gap-4">
        {/* Top Header */}
        <WatchHeader
          roomCode={room.roomCode}
          playerCount={seatPlayers.length}
          maxPlayers={groupLobby ? maxSeats : preset.maxPlayers}
          isMicMuted={isMicMuted}
          isCameraOn={isCameraOn}
          unreadChatCount={0}
          isDark={isDark}
          onToggleMic={onToggleMic}
          onToggleCamera={onToggleCamera}
          onToggleChat={() => setIsChatOpen(prev => !prev)}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setShowSettingsModal(true)}
          onLeaveGame={onLeave}
          onBackToGames={() => router.push('/games')}
        />

        {/* A tournament match room only: "Tournament match" with a way back to the bracket (renders nothing for every other room) */}
        <TournamentMatchBanner room={room} className="mx-auto w-full max-w-5xl" />

        {/* Center Main Stage */}
        <main className="flex-1 my-0 sm:my-auto py-2.5 sm:py-4 flex flex-col lg:flex-row gap-3.5 sm:gap-6 items-center justify-center max-w-5xl mx-auto w-full min-h-0">
          {/* Left Column: Game Overview & How to Play */}
          <div className="w-full lg:w-[280px] xl:w-[300px] shrink-0 flex flex-col gap-2.5 sm:gap-3 order-2 lg:order-1">
            {/* Card 1: Game Overview */}
            <div className={solid ? "relative w-full rounded-2xl p-3 bg-white dark:bg-[#14151b] border border-zinc-200 dark:border-white/10 overflow-hidden" : "relative w-full rounded-2xl sm:rounded-3xl p-3 sm:p-4 bg-white/80 dark:bg-[#121629]/80 border border-white/70 dark:border-white/10 shadow-[0_4px_20px_rgba(255,43,112,0.05)] backdrop-blur-xl overflow-hidden transition-all"}>
              <div className={solid ? "hidden" : "absolute top-2.5 right-3.5 pointer-events-none select-none text-right hidden sm:block"}>
                <span className="font-serif italic text-[11px] font-bold text-[#ec4899] dark:text-[#f472b6] leading-tight block -rotate-3">
                  {preset.annotation}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-2.5">
                <div
                  className={solid ? "w-9 h-9 rounded-xl border border-zinc-200 dark:border-white/10 shrink-0 flex items-center justify-center" : "w-10 h-10 rounded-xl p-0.5 shadow-xs shrink-0 flex items-center justify-center"}
                  style={solid ? undefined : { background: `linear-gradient(135deg, ${preset.iconColor}, #f59e0b)` }}
                >
                  <div className={solid ? "w-full h-full rounded-[10px] bg-zinc-50 dark:bg-white/5 flex items-center justify-center" : "w-full h-full rounded-[10px] bg-white dark:bg-[#121629] flex items-center justify-center"}>
                    <Icon className="w-5 h-5" style={{ color: preset.iconColor }} />
                  </div>
                </div>

                <div>
                  <h2 className={solid ? "text-base font-bold text-zinc-900 dark:text-white tracking-tight leading-tight" : "text-base sm:text-lg font-black text-[#16132b] dark:text-white tracking-tight leading-tight"}>
                    {preset.name}
                  </h2>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                    {preset.tagline}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 pt-0.5">
                {preset.chips.map((chip, idx) => {
                  const ChipIcon = chip.icon;
                  return (
                    <div
                      key={idx}
                      className={solid ? "flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300" : "flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg bg-slate-50/80 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-[10px] font-bold text-slate-600 dark:text-zinc-300"}
                    >
                      <ChipIcon className="w-2.5 h-2.5" style={{ color: chip.color }} />
                      <span>{groupLobby && idx === 0 ? `${groupLobby.minPlayers}-${groupLobby.maxPlayers} Players` : chip.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 2: How To Play */}
            <div className={solid ? "relative w-full rounded-2xl p-3 bg-white dark:bg-[#14151b] border border-zinc-200 dark:border-white/10 space-y-2" : "relative w-full rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 bg-white/80 dark:bg-[#121629]/80 border border-white/70 dark:border-white/10 shadow-[0_4px_20px_rgba(255,43,112,0.05)] backdrop-blur-xl transition-all space-y-2"}>
              <div className="flex items-center gap-1.5 pb-0.5">
                <div className={solid ? "w-5 h-5 rounded-lg bg-zinc-100 dark:bg-white/10 text-[#ee1d49] flex items-center justify-center" : "w-5 h-5 rounded-lg bg-pink-100 dark:bg-pink-950/40 text-[#ff2b70] flex items-center justify-center"}>
                  <BookOpen className="w-3 h-3" />
                </div>
                <h3 className={solid ? "text-xs sm:text-sm font-bold text-zinc-900 dark:text-white tracking-tight" : "text-xs sm:text-sm font-black text-[#16132b] dark:text-white tracking-tight"}>
                  How to Play?
                </h3>
              </div>

              <div className="space-y-1.5">
                {preset.rules.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className={solid ? "w-4 h-4 rounded-full bg-[#ee1d49] text-white font-bold text-[9px] flex items-center justify-center shrink-0" : "w-4 h-4 rounded-full bg-[#ff2b70] text-white font-extrabold text-[9px] flex items-center justify-center shrink-0 shadow-2xs"}>
                      {idx + 1}
                    </span>
                    <span className={solid ? "text-[11px] font-medium text-zinc-700 dark:text-zinc-300 leading-tight" : "text-[11px] font-semibold text-slate-700 dark:text-zinc-300 leading-tight"}>
                      {rule}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center Column: Matchmaking Title, Player Cards VS, Actions */}
          <div className="flex-1 w-full max-w-xl flex flex-col items-center justify-center gap-3 sm:gap-3.5 order-1 lg:order-2">
            {/* Status Hero Title */}
            <div className="relative text-center w-full max-w-lg mx-auto select-none pt-0 pb-1">
              <h1 className={solid ? "text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight leading-tight" : "text-2xl sm:text-3xl font-black text-[#16132b] dark:text-white tracking-tight leading-tight"}>
                {groupLobby ? (
                  groupLobby.readyCount >= groupLobby.minPlayers ? (
                    <>
                      Players <span className={accent}>Ready</span>
                    </>
                  ) : (
                    <>
                      Waiting for <span className={accent}>Players</span>
                    </>
                  )
                ) : hasOpponent ? (
                  <>
                    Opponent <span className={accent}>Found</span>
                  </>
                ) : (
                  <>
                    Waiting for <span className={accent}>Opponent</span>
                  </>
                )}
              </h1>
              <p className={solid ? "text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium max-w-md mx-auto mt-0.5 leading-snug" : "text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 font-medium max-w-md mx-auto mt-0.5 leading-snug"}>
                {groupLobby ? (
                  <span>{groupLobby.subtitle}</span>
                ) : hasOpponent ? (
                  <span>Players connected! Host can start the match.</span>
                ) : (
                  <span>Match will begin when another human player joins the room.</span>
                )}
              </p>
            </div>

            {/* Live camera / voice tiles (opt-in) */}
            {videoParticipants && videoParticipants.length > 0 && (
              <div
                data-testid="lobby-video-tiles"
                className={solid ? "w-full rounded-2xl p-2 bg-[#14151b] border border-white/10" : "w-full rounded-2xl sm:rounded-3xl p-2 sm:p-2.5 bg-[#14102a]/85 border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.25)] backdrop-blur-xl"}
              >
                <VideoGrid participants={videoParticipants} isCompact onToggleSelfCamera={onToggleCamera} onToggleSelfMic={onToggleMic} />
              </div>
            )}

            {/* Player Cards (2-Player VS or Multi-player grid) */}
            {isMultiplayer ? (
              <div className="w-full grid grid-cols-2 gap-2 sm:gap-2.5">
                {(groupLobby?.hideEmptySeats ? [...seatPlayers].sort((a, b) => a.seat - b.seat) : Array.from({ length: maxSeats })).map((slot, idx) => {
                  const p = groupLobby?.hideEmptySeats ? (slot as typeof seatPlayers[number]) : (seatPlayers.find(player => player.seat === idx) || seatPlayers[idx]);
                  const isCurrent = p?.userId === myUserId;
                  return (
                    <div
                      key={idx}
                      className={`relative ${solid ? 'rounded-xl p-2 border flex items-center gap-2 transition-colors' : 'rounded-xl sm:rounded-2xl p-2 sm:p-3 border backdrop-blur-xl flex items-center gap-2 sm:gap-3 transition-all'} ${
                        solid
                          ? p
                            ? isCurrent
                              ? 'bg-white dark:bg-[#18121f] border-[#ee1d49]'
                              : 'bg-white dark:bg-[#14151b] border-zinc-200 dark:border-white/10'
                            : 'border-dashed border-zinc-300 dark:border-white/15 bg-transparent'
                          : p
                          ? isCurrent
                            ? 'bg-gradient-to-r from-white/95 to-rose-50/50 dark:from-[#15192e]/95 dark:to-[#1a1c35]/90 border-pink-300/80 dark:border-pink-500/40 ring-1 ring-pink-300/40'
                            : 'bg-white/90 dark:bg-[#15192e]/90 border-white/70 dark:border-white/10'
                          : 'border-dashed border-slate-300 dark:border-white/15 bg-white/30 dark:bg-white/5'
                      }`}
                    >
                      {p ? (
                        <>
                          <div className="relative shrink-0">
                            <div className={solid ? "w-8 h-8 sm:w-10 sm:h-10 rounded-full p-0.5 bg-zinc-200 dark:bg-white/15 flex items-center justify-center overflow-hidden" : "w-8 h-8 sm:w-10 sm:h-10 rounded-full p-0.5 bg-gradient-to-tr from-[#ff2b70] to-amber-400 flex items-center justify-center overflow-hidden"}>
                              {p.avatarUrl && !p.avatarUrl.includes('/bottts/') ? (
                                <img
                                  src={p.avatarUrl}
                                  alt={p.displayName}
                                  className="w-full h-full rounded-full object-cover bg-white dark:bg-slate-800"
                                />
                              ) : (
                                <div className={solid ? "w-full h-full rounded-full bg-zinc-700 flex items-center justify-center text-white font-bold text-xs" : "w-full h-full rounded-full bg-gradient-to-br from-[#ff2b70] to-[#f43f5e] flex items-center justify-center text-white font-black text-xs"}>
                                  {(p.displayName?.[0] || 'P').toUpperCase()}
                                </div>
                              )}
                            </div>
                            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-1 ${solid ? 'ring-white dark:ring-[#14151b]' : 'ring-white'} ${groupLobby && p.isConnected === false ? 'bg-slate-400' : 'bg-emerald-500'}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className={solid ? "text-xs font-bold text-zinc-900 dark:text-white truncate" : "text-xs font-black text-[#16132b] dark:text-white truncate"}>
                                {p.displayName}
                              </span>
                              {p.userId === room.hostUserId && (
                                <Crown className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                              )}
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                              {isCurrent ? 'You' : groupLobby?.hideEmptySeats && p.userId === room.hostUserId ? (groupLobby.hostLabel ?? 'Quiz master') : `Player ${idx + 1}`}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-200/70 dark:bg-white/10 flex items-center justify-center shrink-0 text-slate-400">
                            <User className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 block truncate">
                              Waiting...
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                              {groupLobby && idx < groupLobby.minPlayers ? 'Needed' : `Player ${idx + 1}`}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="w-full flex flex-row items-center justify-center gap-1.5 sm:gap-3.5 relative">
                <PlayerCard
                  isCurrentUser={true}
                  player={myPlayer}
                  isHost={isHost}
                  isReady={isMyReady}
                  canToggleReady={hasOpponent && !isHost}
                  onToggleReady={() => setIsMyReady(prev => !prev)}
                  statusText={hasOpponent ? (isMyReady ? 'Ready' : 'Not Ready') : 'Waiting for opponent...'}
                  isDark={isDark}
                />

                <VersusIndicator isDark={isDark} />

                <PlayerCard
                  isCurrentUser={false}
                  player={opponentPlayer}
                  isHost={opponentPlayer?.userId === room.hostUserId}
                  isReady={Boolean(opponentPlayer)}
                  statusText={opponentPlayer ? (opponentPlayer.isConnected === false ? 'Reconnecting...' : 'Connected') : undefined}
                  isDark={isDark}
                />
              </div>
            )}

            {/* Launch / Start Match Button */}
            {showStart && (
              <div className="w-full max-w-md mx-auto text-center select-none animate-in fade-in slide-in-from-bottom-2 duration-150">
                {groupLobby?.extraControls}
                {isHost ? (
                  <button
                    type="button"
                    disabled={isStarting || (groupLobby ? !groupLobby.canStart : false)}
                    onClick={handleStartGame}
                    className={`${solid ? 'w-full h-10 px-5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 text-white bg-[#ee1d49] hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0c0d12] transition-colors cursor-pointer' : 'w-full py-3 sm:py-3.5 px-6 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 text-white bg-gradient-to-r from-[#ff2b70] via-[#f43f5e] to-[#e11d48] hover:brightness-110 shadow-[0_6px_25px_rgba(255,43,112,0.35)] transition-all active:scale-[0.98] cursor-pointer'} ${
                      isStarting ? 'opacity-80 animate-pulse' : ''
                    } ${groupLobby && !groupLobby.canStart ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Play className={`w-4 h-4 fill-current ${isStarting ? 'animate-spin' : ''}`} />
                    <span>{isStarting ? 'Starting Match...' : `Start ${preset.name}`}</span>
                  </button>
                ) : (
                  <div className={solid ? "p-2.5 rounded-xl bg-white dark:bg-[#14151b] border border-zinc-200 dark:border-white/10 flex items-center justify-center gap-2 text-zinc-600 dark:text-zinc-300 text-xs font-semibold" : "p-3 rounded-2xl bg-white/80 dark:bg-[#121629]/80 border border-white/70 dark:border-white/10 shadow-xs flex items-center justify-center gap-2 text-slate-600 dark:text-zinc-300 text-xs font-bold"}>
                    <span className={solid ? "w-2 h-2 rounded-full bg-[#ee1d49] motion-safe:animate-pulse" : "w-2 h-2 rounded-full bg-[#ff2b70] animate-ping"} />
                    <span>{groupLobby?.waitingForHostText ?? 'Waiting for Host to start the match...'}</span>
                  </div>
                )}
                {groupLobby?.startHint && (
                  <p className={solid ? "mt-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-300" : "mt-2 text-[11px] font-semibold text-slate-600 dark:text-zinc-300"} role="status">{groupLobby.startHint}</p>
                )}
                {groupLobby?.error && (
                  <p className={solid ? "mt-1 text-[11px] font-semibold text-red-700 dark:text-red-300" : "mt-1 text-[11px] font-bold text-rose-600 dark:text-rose-300"} role="alert">{groupLobby.error}</p>
                )}
              </div>
            )}

            {/* Room Code Card */}
            <div className={solid ? "relative w-full rounded-2xl p-3 bg-white dark:bg-[#14151b] border border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3" : "relative w-full rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 bg-white/80 dark:bg-[#121629]/80 border border-white/70 dark:border-white/10 shadow-[0_4px_20px_rgba(255,43,112,0.05)] backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 transition-all"}>
              <div className="text-center sm:text-left flex-1 min-w-0">
                <span className={solid ? "text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block" : "text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-400 block"}>
                  Room Code
                </span>
                <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-0.5">
                  <span className={solid ? "text-xl font-mono font-bold text-zinc-900 dark:text-white tracking-wider leading-tight" : "text-xl sm:text-2xl font-mono font-black text-[#ff2b70] tracking-wider leading-tight"}>
                    {room.roomCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className={solid ? "p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-500 hover:text-[#ee1d49] transition-colors cursor-pointer" : "p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-[#ff2b70] transition active:scale-95 cursor-pointer"}
                    title="Copy Code"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleShareLink}
                className={solid ? "w-full sm:w-auto flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl bg-[#ee1d49] hover:bg-[#d6143c] text-white text-xs font-semibold transition-colors cursor-pointer" : "w-full sm:w-auto flex items-center justify-center gap-1.5 py-2 px-5 rounded-xl bg-gradient-to-r from-[#ff2b70] to-[#f43f5e] hover:from-[#e11d48] text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{copiedLink ? 'Link Copied!' : 'Share Link'}</span>
              </button>
            </div>

            {/* Invite a Friend Pill Card */}
            <div
              onClick={groupLobby?.onInviteFriends ?? handleShareLink}
              className={solid ? "w-full max-w-md mx-auto rounded-2xl p-2 pl-3 bg-white dark:bg-[#14151b] border border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3 cursor-pointer hover:border-zinc-300 dark:hover:border-white/20 transition-colors select-none" : "w-full max-w-md mx-auto rounded-full p-2 sm:p-2.5 pl-3.5 sm:pl-4 bg-white/80 dark:bg-[#121629]/80 border border-white/70 dark:border-white/10 shadow-[0_4px_20px_rgba(255,43,112,0.05)] backdrop-blur-xl flex items-center justify-between gap-3 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all active:scale-[0.99] select-none"}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={solid ? "w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/10 text-[#ee1d49] flex items-center justify-center shrink-0" : "w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-950/40 text-[#ff2b70] flex items-center justify-center shrink-0"}>
                  <UserPlus className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 text-left">
                  <h4 className={solid ? "text-xs font-bold text-zinc-900 dark:text-white leading-tight truncate" : "text-xs font-black text-[#16132b] dark:text-white leading-tight truncate"}>
                    Invite a Friend
                  </h4>
                  <p className={solid ? "text-[10px] text-zinc-500 dark:text-zinc-400 font-medium truncate mt-0.5" : "text-[10px] text-slate-500 dark:text-zinc-400 font-medium truncate mt-0.5"}>
                    Share the room code and start playing together!
                  </p>
                </div>
              </div>
              <div className={solid ? "w-7 h-7 rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-[#ee1d49] flex items-center justify-center shrink-0" : "w-7 h-7 rounded-full border border-pink-200 dark:border-pink-800/40 bg-pink-50 dark:bg-pink-950/30 text-[#ff2b70] flex items-center justify-center shrink-0 shadow-2xs"}>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </main>

        {groupLobby?.lobbyPanel && <section className="mx-auto w-full max-w-5xl select-text">{groupLobby.lobbyPanel}</section>}

        {/* Footer Subtext */}
        <div className={solid ? "hidden" : "pointer-events-none select-none py-1 hidden sm:flex items-center justify-between text-xs text-pink-400/80 font-serif italic"}>
          <span>..Same Game Different Hearts</span>
          <span className="not-italic text-[10px] text-slate-400 font-sans">
            Strict human-only matchmaking active.
          </span>
        </div>
      </div>

      {/* Slide-over Chat Drawer (Triggered exclusively via header chat button) */}
      <ChatPanel
        room={room}
        chatMessages={chatMessages}
        myUserId={myUserId}
        onSendMessage={onSendChat}
        onSendReaction={onSendReaction}
        isDrawerMode={true}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        isDark={isDark}
      />

      {/* Settings Modal (Triggered exclusively via header ⚙️ gear icon) */}
      {showSettingsModal && (
        <div className={solid ? "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" : "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"}>
          <div className={solid ? "relative w-full max-w-md rounded-2xl p-4 bg-white dark:bg-[#14151b] border border-zinc-200 dark:border-white/10 space-y-4" : "relative w-full max-w-md rounded-3xl p-5 bg-white dark:bg-[#121629] border border-white/60 dark:border-white/10 shadow-2xl space-y-4"}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[#ff2b70]" />
                <h3 className="text-sm font-black text-[#16132b] dark:text-white">
                  {preset.name} Settings
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            {/* Custom Game Settings if provided */}
            {customSettingsComponent ? (
              customSettingsComponent
            ) : (
              <div className="space-y-3 py-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="text-slate-500 font-medium">Room Code</span>
                  <span className="font-mono font-black text-[#ff2b70]">{room.roomCode}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="text-slate-500 font-medium">Strict Anti-Bot</span>
                  <span className="text-emerald-500 font-bold">Enabled</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#ff2b70] hover:bg-[#e11d48] text-white text-xs font-black uppercase tracking-wider transition active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
