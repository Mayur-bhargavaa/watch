'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameRoom } from '../../../hooks/useGameRoom';
import { useWebRTC } from '../../../hooks/useWebRTC';
import { getStoredSession, UserSession, getGameRoute } from '../../../lib/api';
import { DoodleWaitingPage } from '../../../components/games/doodle/waiting/DoodleWaitingPage';
import { DoodlePreRoomLobby } from '../../../components/games/doodle/DoodlePreRoomLobby';
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';

function DoodleDuelPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomCodeParam = searchParams.get('room');

  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    const s = getStoredSession();
    if (s) setSession(s);
  }, []);

  const {
    room,
    players,
    gameState,
    myPlayer,
    myUserId,
    chatMessages,
    connectionStatus,
    startDoodleGame,
    updateDoodleConfig,
    sendChat,
    sendReaction,
    sendLeave,
    sendWebRTCSignal,
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener
  } = useGameRoom(roomCodeParam, 'doodle-duel');

  // Validate room code prefixes
  useEffect(() => {
    if (roomCodeParam) {
      const code = roomCodeParam.trim().toUpperCase();
      if (!code.startsWith('DOODLE-') && (code.startsWith('BINGO-') || code.startsWith('LUDO-') || code.startsWith('TIC-') || code.startsWith('FOUR-'))) {
        router.replace(getGameRoute(undefined, roomCodeParam));
        return;
      }
    }
    if (room?.gameType && room.gameType !== 'doodle-duel' && room?.roomCode) {
      router.replace(getGameRoute(room.gameType, room.roomCode));
    }
  }, [roomCodeParam, room?.gameType, room?.roomCode, router]);

  // Automatic redirect if match has already started / is playing
  useEffect(() => {
    if (room?.status === 'PLAYING' && room?.roomCode) {
      router.replace(`/games/doodle-duel/play?room=${encodeURIComponent(room.roomCode)}`);
    }
  }, [room?.status, room?.roomCode, router]);

  const storedSessionId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    try {
      return JSON.parse(localStorage.getItem('synccinema_session') || '{}')?.user?.id || '';
    } catch {
      return '';
    }
  }, []);

  const currentUserId = myUserId || session?.user?.id || storedSessionId || '';

  const webRTCMembers = useMemo(() => {
    if (!room?.players) return [];
    return room.players.map(p => ({
      userId: p.userId,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl
    }));
  }, [room?.players]);

  const {
    isCameraOn,
    isMicMuted,
    toggleCamera,
    toggleMic
  } = useWebRTC({
    myUserId: currentUserId,
    members: webRTCMembers as any,
    screenPresenter: null,
    sendWebRTCSignal,
    sendScreenState: () => {},
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener
  });

  const handleLeave = () => {
    sendLeave();
    router.push('/games');
  };

  // If no room query param, render the pre-room creation/join lobby
  if (!roomCodeParam) {
    return <DoodlePreRoomLobby />;
  }

  // Room is loading / connecting
  if (!room) {
    return (
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#fdf8f6] dark:bg-[#0c0f1d] text-slate-800 dark:text-white">
        <div className="w-full max-w-md p-8 rounded-3xl bg-white/80 dark:bg-[#121629]/80 border border-white/60 dark:border-white/10 shadow-xl backdrop-blur-xl flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#ff2b70] to-amber-400 p-0.5 mb-4 shadow-sm">
            <div className="w-full h-full rounded-[14px] bg-white dark:bg-[#121629] flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#ff2b70] animate-spin" />
            </div>
          </div>
          <h2 className="text-xl font-black tracking-tight text-[#16132b] dark:text-white">
            Entering Waiting Room...
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-1">
            Connecting to room <span className="font-mono font-bold text-[#ff2b70]">{roomCodeParam}</span>
          </p>
        </div>
      </div>
    );
  }

  // If room is full and user is not one of the participants
  const isParticipant = room.players.some(p => p.userId === currentUserId);
  if (room.players.length >= 2 && !isParticipant) {
    return (
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#fdf8f6] dark:bg-[#0c0f1d]">
        <div className="w-full max-w-md p-8 rounded-3xl bg-white/80 dark:bg-[#121629]/80 border border-white/60 dark:border-white/10 shadow-xl backdrop-blur-xl flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-[#16132b] dark:text-white">
            Room Full
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-1 max-w-xs">
            This Doodle Duel already has 2 active human players.
          </p>
          <button
            type="button"
            onClick={() => router.push('/games')}
            className="mt-5 flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ff2b70] to-[#f43f5e] text-white font-black text-xs uppercase tracking-wider shadow-sm transition active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Games</span>
          </button>
        </div>
      </div>
    );
  }

  // Render the real-time Doodle Duel Waiting Room
  return (
    <DoodleWaitingPage
      room={room}
      myUserId={currentUserId}
      gameState={gameState}
      chatMessages={chatMessages}
      connectionStatus={connectionStatus}
      isMicMuted={isMicMuted}
      isCameraOn={isCameraOn}
      onToggleMic={toggleMic}
      onToggleCamera={toggleCamera}
      onSendChat={sendChat}
      onSendReaction={sendReaction}
      onUpdateConfig={updateDoodleConfig}
      onStartGame={startDoodleGame}
      onLeave={handleLeave}
    />
  );
}

export default function DoodleDuelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-[#fdf8f6] dark:bg-[#0c0f1d]">
          <div className="w-8 h-8 rounded-full border-2 border-[#ff2b70] border-t-transparent animate-spin" />
        </div>
      }
    >
      <DoodleDuelPageContent />
    </Suspense>
  );
}
