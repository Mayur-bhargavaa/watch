'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  Settings,
  Users,
  Trophy,
  Sparkles,
  Share2,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { useGameRoom } from '../../../hooks/useGameRoom';
import { getStoredSession, UserSession, createGameRoomWithPartner } from '../../../lib/api';
import { BingoLobby } from '../../../components/games/bingo/BingoLobby';
import { BingoWaitingRoom } from '../../../components/games/bingo/BingoWaitingRoom';
import { BingoCaller } from '../../../components/games/bingo/BingoCaller';
import { BingoTicket } from '../../../components/games/bingo/BingoTicket';
import { WinningProgress } from '../../../components/games/bingo/WinningProgress';
import { ClaimBingoButton } from '../../../components/games/bingo/ClaimBingoButton';
import { BingoVictory } from '../../../components/games/bingo/BingoVictory';
import { BingoBottomDock } from '../../../components/games/bingo/BingoBottomDock';
import { BingoChatDrawer } from '../../../components/games/bingo/BingoChatDrawer';
import { BingoRoomSettings } from '../../../components/games/bingo/BingoRoomSettings';
import { BingoGameHistory } from '../../../components/games/bingo/BingoGameHistory';
import { GameFriendSelectorDrawer } from '../../../components/games/GameFriendSelectorDrawer';
import { BingoRoomConfig, BingoWinCondition } from '@synccinema/common';

const DEFAULT_CONFIG: BingoRoomConfig = {
  mode: '90-ball',
  winConditions: {
    early5: true,
    topLine: true,
    middleLine: true,
    bottomLine: true,
    fourCorners: true,
    housefull: true,
    xPattern: false,
    crossPattern: false,
    starPattern: false,
    diamond: false,
    fullBorder: false,
    customPattern: false
  },
  callingSpeed: 3000,
  autoCall: true,
  points: {
    early5: 10,
    topLine: 20,
    middleLine: 20,
    bottomLine: 20,
    fourCorners: 30,
    housefull: 100,
    xPattern: 25,
    crossPattern: 25,
    starPattern: 40,
    diamond: 30,
    fullBorder: 35,
    customPattern: 50
  },
  falseClaimPenalty: 0
};

function BingoGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomCodeParam = searchParams.get('room');

  const [session, setSession] = useState<UserSession | null>(null);
  const [showFriendDrawer, setShowFriendDrawer] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [activeMobileTab, setActiveMobileTab] = useState<'me' | 'opponent'>('me');
  const [roomConfig, setRoomConfig] = useState<BingoRoomConfig>(DEFAULT_CONFIG);

  // Claim Feedback Toast State
  const [claimToast, setClaimToast] = useState<{
    valid: boolean;
    message: string;
    timestamp: number;
  } | null>(null);

  // Load user session
  useEffect(() => {
    const s = getStoredSession();
    if (s && s.token) {
      setSession(s);
    }
  }, []);

  const {
    room,
    players,
    gameState,
    myPlayer,
    myUserId,
    lastBingoCall,
    lastBingoClaimResult,
    lastBingoConditionWon,
    chatMessages,
    floatingReactions,
    connectionStatus,
    startBingoGame,
    callNextBingoNumber,
    claimBingo,
    markBingoNumber,
    updateBingoConfig,
    sendChat,
    sendReaction,
    sendLeave,
    sendVoiceState,
    sendCameraState,
    rematch
  } = useGameRoom(roomCodeParam);

  // Sync config from gameState when active
  useEffect(() => {
    if (gameState?.config) {
      setRoomConfig(gameState.config);
    }
  }, [gameState?.config]);

  // Show claim result feedback toast
  useEffect(() => {
    if (lastBingoClaimResult) {
      setClaimToast({
        valid: lastBingoClaimResult.valid,
        message: lastBingoClaimResult.message,
        timestamp: Date.now()
      });
      const timer = setTimeout(() => setClaimToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [lastBingoClaimResult]);

  // Determine players
  const me = players.find(p => p.userId === (myUserId || session?.user.id)) || players[0];
  const opponent = players.find(p => p.userId !== me?.userId);

  const isHost = room?.hostUserId === (myUserId || session?.user.id);
  const isPlaying = room && room.status === 'PLAYING' && gameState !== null;
  const isFinished = room && (room.status === 'FINISHED' || gameState?.phase === 'FINISHED');

  // Handle leave room
  const handleLeave = () => {
    sendLeave();
    router.push('/games');
  };

  // Handle invite friend
  const handleInviteFriend = () => {
    setShowFriendDrawer(true);
  };

  // Handle toggle mic
  const handleToggleMic = () => {
    const next = !isMuted;
    setIsMuted(next);
    sendVoiceState(next);
  };

  // Handle toggle camera
  const handleToggleCamera = () => {
    const next = !isCameraOn;
    setIsCameraOn(next);
    sendCameraState(next);
  };

  // 1. NO ROOM PARAM -> Render Lobby
  if (!roomCodeParam) {
    return (
      <div className="min-h-screen bg-[#080a12] text-white flex flex-col justify-between selection:bg-rose-600 selection:text-white">
        {/* Top Minimal Bar */}
        <header className="h-16 border-b border-white/[0.08] px-4 sm:px-8 flex items-center justify-between bg-black/40 backdrop-blur-md">
          <button
            type="button"
            onClick={() => router.push('/games')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-bold transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Games</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-base">🎱</span>
            <span className="text-sm font-black text-white">Bingo Duel</span>
          </div>
          <div className="w-16" />
        </header>

        <main className="flex-1 flex flex-col items-center justify-center">
          <BingoLobby
            session={session}
            onOpenFriendSelector={() => setShowFriendDrawer(true)}
          />
        </main>

        <footer className="h-10 border-t border-white/[0.05] px-6 flex items-center justify-center text-[11px] text-zinc-500">
          Watch Cinema Gaming Platform · Stitchbyte
        </footer>

        {/* Friend Selector Drawer */}
        <GameFriendSelectorDrawer
          isOpen={showFriendDrawer}
          onClose={() => setShowFriendDrawer(false)}
          token={session?.token}
          gameTitle="Bingo Duel"
          onSelectFriend={async (friend) => {
            try {
              const res = await createGameRoomWithPartner('bingo', friend.friendUser.id);
              if (res?.room?.roomCode) {
                router.push(`/games/bingo?room=${res.room.roomCode}`);
              }
            } catch (e) {
              console.error(e);
            }
          }}
        />
      </div>
    );
  }

  // 2. ROOM WAITING / READY -> Render Waiting Room
  if (!isPlaying && !isFinished && room) {
    return (
      <>
        <BingoWaitingRoom
          room={room}
          myUserId={myUserId || session?.user.id || ''}
          config={roomConfig}
          onStartGame={(cfg) => {
            startBingoGame(cfg);
          }}
          onUpdateConfig={(cfg) => {
            setRoomConfig(cfg);
            updateBingoConfig(cfg);
          }}
          onLeave={handleLeave}
          onInviteFriend={handleInviteFriend}
        />

        <GameFriendSelectorDrawer
          isOpen={showFriendDrawer}
          onClose={() => setShowFriendDrawer(false)}
          token={session?.token}
          gameTitle="Bingo Duel"
          onSelectFriend={async (friend) => {
            try {
              const res = await createGameRoomWithPartner('bingo', friend.friendUser.id);
              if (res?.room?.roomCode) {
                router.push(`/games/bingo?room=${res.room.roomCode}`);
              }
            } catch (e) {
              console.error(e);
            }
          }}
        />
      </>
    );
  }

  // 3. LIVE GAME / FINISHED SCREEN
  const currentNum = gameState?.currentNumber ?? null;
  const currentWord = gameState?.currentNumberWord ?? null;
  const lastCalled = gameState?.lastCalledNumbers ?? [];
  const remaining = gameState?.callQueue?.length ?? 90;

  const myTicket = gameState?.tickets?.[me?.userId || ''] || { cells: [] };
  const opponentTicket = opponent ? gameState?.tickets?.[opponent.userId] || { cells: [] } : null;

  const myMarked = gameState?.playerMarked?.[me?.userId || ''] || [];
  const opponentMarked = opponent ? gameState?.playerMarked?.[opponent.userId] || [] : [];

  const myScore = gameState?.scores?.[me?.userId || ''] || 0;
  const opponentScore = opponent ? gameState?.scores?.[opponent.userId] || 0 : 0;

  const myProgress = gameState?.conditionProgress?.[me?.userId || ''] || {};
  const opponentProgress = opponent ? gameState?.conditionProgress?.[opponent.userId] || {} : {};

  return (
    <div className="min-h-screen bg-[#080a12] text-white flex flex-col justify-between selection:bg-rose-600 selection:text-white relative overflow-hidden font-sans">
      
      {/* Floating Reactions Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 animate-bounce text-3xl font-bold flex items-center gap-2 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-2xl"
          >
            <span>{r.emoji}</span>
            <span className="text-xs text-rose-300 font-semibold">{r.userName}</span>
          </div>
        ))}
      </div>

      {/* Claim Result Toast Notification */}
      {claimToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-3 duration-200">
          <div
            className={`px-5 py-3 rounded-2xl border shadow-2xl flex items-center gap-2.5 text-xs font-black ${
              claimToast.valid
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200 shadow-emerald-950/50'
                : 'bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-rose-950/50'
            }`}
          >
            {claimToast.valid ? <Sparkles className="w-4 h-4 text-yellow-300" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{claimToast.message}</span>
          </div>
        </div>
      )}

      {/* Condition Won Banner */}
      {lastBingoConditionWon && (
        <div className="bg-gradient-to-r from-rose-950 via-purple-950 to-rose-950 border-b border-rose-500/30 px-4 py-2 text-center text-xs font-black text-white flex items-center justify-center gap-2 z-20">
          <Trophy className="w-3.5 h-3.5 text-yellow-400" />
          <span>
            {lastBingoConditionWon.displayName} won {lastBingoConditionWon.conditionName}! (+{lastBingoConditionWon.points} pts)
          </span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-white/[0.08] px-4 sm:px-8 flex items-center justify-between bg-black/50 backdrop-blur-md z-20">
        <button
          type="button"
          onClick={handleLeave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-bold transition"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Leave</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-base">🎱</span>
          <span className="text-xs sm:text-sm font-black text-white tracking-wide">Bingo Duel</span>
          <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] text-zinc-300 font-mono">
            {players.length} / 2
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition"
            title="Game History & Scores"
          >
            <Trophy className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition"
            title="Room Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Game Arena */}
      <main className="flex-1 flex flex-col justify-between p-3 sm:p-6 z-10 max-w-7xl mx-auto w-full">
        
        {/* DESKTOP LAYOUT (Left Ticket, Center Caller, Right Ticket) */}
        <div className="hidden lg:grid grid-cols-12 gap-5 items-start">
          
          {/* LEFT: Player 1 (Me) */}
          <div className="col-span-4 space-y-3">
            <BingoTicket
              ticket={myTicket}
              mode={roomConfig.mode}
              playerName={me?.displayName || 'You'}
              avatarUrl={me?.avatarUrl}
              score={myScore}
              isHost={isHost}
              isMe={true}
              calledNumbers={gameState?.calledNumbers || []}
              markedNumbers={myMarked}
              onToggleMark={(n) => markBingoNumber(n)}
              accentColor="rose"
            />
            <WinningProgress
              progress={myProgress}
              playerName={me?.displayName || 'You'}
            />
          </div>

          {/* CENTER: Bingo Caller */}
          <div className="col-span-4 flex flex-col items-center justify-center space-y-4">
            <BingoCaller
              currentNumber={currentNum}
              currentNumberWord={currentWord}
              lastCalledNumbers={lastCalled}
              remainingCount={remaining}
              totalNumbers={roomConfig.mode === '75-ball' ? 75 : 90}
              isAutoCall={roomConfig.autoCall}
              callingSpeed={roomConfig.callingSpeed}
              isHost={isHost}
              onCallNext={callNextBingoNumber}
            />

            {/* Claim Bingo Button (Desktop) */}
            <div className="pt-2">
              <ClaimBingoButton
                conditionProgress={myProgress}
                claimedConditions={gameState?.claimedConditions || {}}
                onClaim={(c) => claimBingo(c)}
                penaltyUntil={gameState?.penaltyUntil?.[me?.userId || '']}
                lastClaimResult={lastBingoClaimResult}
              />
            </div>
          </div>

          {/* RIGHT: Player 2 (Opponent) */}
          <div className="col-span-4 space-y-3">
            {opponent && opponentTicket ? (
              <>
                <BingoTicket
                  ticket={opponentTicket}
                  mode={roomConfig.mode}
                  playerName={opponent.displayName}
                  avatarUrl={opponent.avatarUrl}
                  score={opponentScore}
                  isHost={!isHost}
                  isMe={false}
                  calledNumbers={gameState?.calledNumbers || []}
                  markedNumbers={opponentMarked}
                  accentColor="violet"
                />
                <WinningProgress
                  progress={opponentProgress}
                  playerName={opponent.displayName}
                />
              </>
            ) : (
              <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 text-center text-zinc-500 text-xs flex flex-col items-center justify-center h-64">
                <Users className="w-8 h-8 opacity-30 mb-2" />
                <span>Opponent seat open</span>
              </div>
            )}
          </div>

        </div>

        {/* MOBILE LAYOUT (Tabs between Me & Opponent) */}
        <div className="lg:hidden flex-1 flex flex-col justify-between space-y-4">
          
          {/* Mobile Caller */}
          <BingoCaller
            currentNumber={currentNum}
            currentNumberWord={currentWord}
            lastCalledNumbers={lastCalled}
            remainingCount={remaining}
            totalNumbers={roomConfig.mode === '75-ball' ? 75 : 90}
            isAutoCall={roomConfig.autoCall}
            callingSpeed={roomConfig.callingSpeed}
            isHost={isHost}
            onCallNext={callNextBingoNumber}
          />

          {/* Player Switcher Tabs */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setActiveMobileTab('me')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                activeMobileTab === 'me'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'bg-white/5 text-zinc-400'
              }`}
            >
              {me?.displayName || 'You'} ({myScore} pts)
            </button>
            {opponent && (
              <button
                type="button"
                onClick={() => setActiveMobileTab('opponent')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                  activeMobileTab === 'opponent'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                    : 'bg-white/5 text-zinc-400'
                }`}
              >
                {opponent.displayName} ({opponentScore} pts)
              </button>
            )}
          </div>

          {/* Active Mobile Ticket */}
          <div className="space-y-3">
            {activeMobileTab === 'me' ? (
              <>
                <BingoTicket
                  ticket={myTicket}
                  mode={roomConfig.mode}
                  playerName={me?.displayName || 'You'}
                  avatarUrl={me?.avatarUrl}
                  score={myScore}
                  isHost={isHost}
                  isMe={true}
                  calledNumbers={gameState?.calledNumbers || []}
                  markedNumbers={myMarked}
                  onToggleMark={(n) => markBingoNumber(n)}
                  accentColor="rose"
                />
                <WinningProgress
                  progress={myProgress}
                  playerName={me?.displayName || 'You'}
                />
              </>
            ) : opponent && opponentTicket ? (
              <>
                <BingoTicket
                  ticket={opponentTicket}
                  mode={roomConfig.mode}
                  playerName={opponent.displayName}
                  avatarUrl={opponent.avatarUrl}
                  score={opponentScore}
                  isHost={!isHost}
                  isMe={false}
                  calledNumbers={gameState?.calledNumbers || []}
                  markedNumbers={opponentMarked}
                  accentColor="violet"
                />
                <WinningProgress
                  progress={opponentProgress}
                  playerName={opponent.displayName}
                />
              </>
            ) : null}
          </div>

          {/* Mobile Claim Button */}
          <div className="py-2 flex justify-center">
            <ClaimBingoButton
              conditionProgress={myProgress}
              claimedConditions={gameState?.claimedConditions || {}}
              onClaim={(c) => claimBingo(c)}
              penaltyUntil={gameState?.penaltyUntil?.[me?.userId || '']}
              lastClaimResult={lastBingoClaimResult}
            />
          </div>

        </div>

        {/* Bottom Social Controls Dock */}
        <div className="pt-4 pb-2">
          <BingoBottomDock
            isMuted={isMuted}
            isCameraOn={isCameraOn}
            unreadChatCount={chatMessages.length}
            onToggleMic={handleToggleMic}
            onToggleCamera={handleToggleCamera}
            onToggleChat={() => setIsChatOpen(!isChatOpen)}
            onSendReaction={(emoji) => sendReaction(emoji)}
            onOpenSettings={() => setShowSettingsModal(true)}
          />
        </div>

      </main>

      {/* Side Chat Drawer */}
      <BingoChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        myUserId={myUserId || session?.user.id || ''}
        onSendMessage={(text) => sendChat(text)}
      />

      {/* Victory Celebration Modal */}
      {isFinished && (
        <BingoVictory
          conditionWon={lastBingoConditionWon}
          isHousefull={Boolean(gameState?.claimedConditions?.housefull)}
          winnerDisplayName={gameState?.winnerDisplayName || gameState?.gameSummary?.winnerDisplayName || 'Winner'}
          winnerUserId={gameState?.winnerUserId || ''}
          myUserId={myUserId || session?.user.id || ''}
          finalScores={gameState?.scores || gameState?.gameSummary?.finalScores || {}}
          roundsWon={gameState?.gameSummary?.roundsWon || []}
          onRematch={rematch}
          onBackToPlan={() => router.push('/plans')}
          onBackToLobby={() => router.push('/games')}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <BingoRoomSettings
          config={roomConfig}
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          onSave={(cfg) => {
            setRoomConfig(cfg);
            updateBingoConfig(cfg);
          }}
          isHost={isHost}
        />
      )}

      {/* Game History Modal */}
      {showHistoryModal && (
        <BingoGameHistory
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          winnerDisplayName={gameState?.winnerDisplayName}
          finalScores={gameState?.scores}
          roundsWon={gameState?.gameSummary?.roundsWon || Object.values(gameState?.claimedConditions || {}).map((c: any) => ({
            condition: c.condition,
            winnerName: c.claimedByDisplayName,
            points: c.points
          }))}
          players={players.map(p => ({ userId: p.userId, displayName: p.displayName }))}
        />
      )}
    </div>
  );
}

export default function BingoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#080a12] flex flex-col items-center justify-center text-white space-y-3">
          <div className="w-10 h-10 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-zinc-400">Loading Bingo Duel...</span>
        </div>
      }
    >
      <BingoGameContent />
    </Suspense>
  );
}
