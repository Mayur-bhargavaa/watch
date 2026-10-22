'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AppIcon } from '../../../components/ui/AppIcon';
import { useGameRoom } from '../../../hooks/useGameRoom';
import { getGameRoute, getStoredSession, pingPartner, type FriendWithStreak } from '../../../lib/api';
import { isSpectateRequested } from '../../../lib/spectator';
import { quizErrorText } from '../../../lib/quizShowView';
import { AppSidebar } from '../../../components/layout/AppSidebar';
import { AppHeader } from '../../../components/layout/AppHeader';
import { SpectatorBanner } from '../../../components/games/common/SpectatorBanner';
import { AlertModal } from '../../../components/ui/AlertModal';
import { useWebRTC } from '../../../hooks/useWebRTC';
import { useSpeakingUsers } from '../../../hooks/useSpeakingUsers';
import type { ParticipantStream } from '../../../components/voice/VideoGrid';
import { GAME_ROOM_THEMES, findGameRoomTheme } from '../../../lib/gameRoomThemes';
import { QuizWaitingRoom } from '../../../components/games/quiz-show/QuizWaitingRoom';
import { QuizRoomView } from '../../../components/games/quiz-show/QuizRoomView';
import { GameFriendSelectorDrawer } from '../../../components/games/GameFriendSelectorDrawer';
import { QuizEntry } from '../../../components/games/quiz-show/QuizEntry';
import type { QuizGameView } from '@synccinema/common';

const PAGE_BG = 'min-h-screen w-full bg-[#f7f8fa] text-zinc-900 dark:bg-[#0c0d12] dark:text-white';

/** Platform shell: the same sidebar and header as the rest of the app, with the game content in the main column. */
function Shell({ children, onBack, hideTitle = false, themeBg }: { children: React.ReactNode; onBack?: () => void; hideTitle?: boolean; themeBg?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className={`${PAGE_BG} flex font-sans transition-colors duration-150`}>
      <AppSidebar activeNav="games" isMobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
      <main className="relative flex min-h-screen min-w-0 flex-1 flex-col overflow-y-auto px-3 py-3 sm:px-6 sm:py-4">
        {themeBg && (
          <div aria-hidden="true" data-testid="room-theme-bg" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-32 select-none overflow-hidden">
            <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url('${themeBg}')` }} />
            <div className="absolute inset-0 bg-[#f7f8fa]/90 dark:bg-[#0c0d12]/90" />
          </div>
        )}
        <div className="relative z-10 flex flex-1 flex-col">
        <AppHeader onOpenMobileSidebar={() => setSidebarOpen(true)} backHref="/games" />
        <div className="mx-auto mt-3 flex w-full flex-1 flex-col animate-fadeIn sm:mt-4">
          {!hideTitle && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ee1d49] text-white">
                <AppIcon name="trophy" className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold leading-tight text-zinc-900 dark:text-white sm:text-lg">Quiz Show Studio</h1>
                <p className="truncate text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Your quiz. Your questions. Live leaderboard.</p>
              </div>
            </div>
            {onBack && (
              <button type="button" onClick={onBack} className="inline-flex shrink-0 items-center gap-1.5 h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]">
                <ArrowLeft className="h-4 w-4" />
                Leave
              </button>
            )}
          </div>
          )}
          {children}
        </div>
        </div>
      </main>
    </div>
  );
}

function Notice({ icon, title, text, actions }: { icon: string; title: string; text: string; actions: React.ReactNode }) {
  return (
    <div className="mx-auto mt-8 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 text-center dark:border-white/10 dark:bg-[#14151b]">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
        <AppIcon name={icon} className="h-5 w-5" />
      </div>
      <h2 className="text-base font-bold text-zinc-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{text}</p>
      <div className="mt-4 flex flex-col gap-2">{actions}</div>
    </div>
  );
}

function QuizRoom({ roomCode, spectate }: { roomCode: string; spectate: boolean }) {
  const router = useRouter();
  const {
    room,
    gameState,
    myUserId,
    chatMessages,
    connectionStatus,
    connectionStopped,
    notAPlayer,
    isSpectator,
    spectatorCount,
    spectators,
    gameError,
    startQuizGame,
    sendQuizEdit,
    sendQuizAnswer,
    sendQuizBuzz,
    sendQuizBuzzAnswer,
    sendQuizJudge,
    sendQuizControl,
    quizRematch,
    quizEditAgain,
    sendChat,
    sendLeave,
    sendReaction,
    sendTyping,
    typingUsers,
    floatingReactions,
    roomTheme,
    sendChangeTheme,
    sendWebRTCSignal,
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener
  } = useGameRoom(roomCode, 'quiz-show', { spectate, create: false });

  const [friendsOpen, setFriendsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const session = useMemo(() => (typeof window === 'undefined' ? null : getStoredSession()), []);

  // Voice and camera: the same peer-to-peer wiring Ludo uses, signalled through the game socket. Spectators never publish.
  const sendScreenState = useCallback((_isSharing: boolean) => {}, []);
  const webRTCMembers = useMemo(
    () =>
      (room?.players || [])
        .filter((p) => p.status !== 'LEFT')
        .map((p) => ({ userId: p.userId, displayName: p.displayName, isHost: p.userId === room?.hostUserId, isConnected: p.isConnected !== false, joinedAt: '' })),
    [room?.players, room?.hostUserId]
  );
  const {
    isCameraOn,
    isMicMuted,
    mediaNotice,
    clearMediaNotice,
    toggleCamera,
    toggleMic,
    videoGridParticipants,
    stopAllMediaTracks
  } = useWebRTC({
    myUserId: myUserId || '',
    members: webRTCMembers as any,
    screenPresenter: null,
    sendWebRTCSignal,
    sendScreenState,
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener
  });
  const speakingIds = useSpeakingUsers(videoGridParticipants);
  const videoParticipants = useMemo<ParticipantStream[]>(
    () =>
      isSpectator
        ? []
        : videoGridParticipants.map((p) => {
            const known = room?.players.find((pl) => pl.userId === p.userId);
            return {
              ...p,
              displayName: p.isSelf ? known?.displayName || 'You' : known?.displayName || p.displayName,
              isHost: Boolean(room && p.userId === room.hostUserId),
              isSpeaking: speakingIds.has(p.userId)
            };
          }),
    [isSpectator, videoGridParticipants, room, speakingIds]
  );

  // Room theme (shared with the other players through the room)
  const [themeId, setThemeId] = useState<string>('romantic');
  useEffect(() => {
    if (roomTheme && GAME_ROOM_THEMES.some((t) => t.id === roomTheme)) setThemeId(roomTheme);
  }, [roomTheme]);
  const selectTheme = (id: string) => {
    setThemeId(id);
    sendChangeTheme(id);
  };
  const typingNames = useMemo(
    () => Object.entries(typingUsers || {}).filter(([id]) => id !== myUserId).map(([, v]) => v.userName),
    [typingUsers, myUserId]
  );

  useEffect(() => {
    if (room?.gameType && room.gameType !== 'quiz-show' && room.roomCode) router.replace(getGameRoute(room.gameType, room.roomCode));
  }, [room?.gameType, room?.roomCode, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const leave = () => {
    sendLeave();
    stopAllMediaTracks();
    router.push('/games');
  };

  const invite = async (friend: FriendWithStreak) => {
    if (!room) return;
    try {
      await pingPartner({ targetCode: friend.friendUser.partnerCode, roomCode: room.roomCode, gameType: 'quiz-show', customMessage: 'Join my quiz on Quiz Show Studio!' });
      setToast(`Invite sent to ${friend.friendUser.displayName}`);
    } catch (e: any) {
      setToast(e?.message || 'Could not send the invite');
    }
  };

  const actionError = gameError ? quizErrorText(gameError.code, gameError.message) : null;

  if (connectionStopped === 'UPGRADE_REQUIRED') {
    return (
      <Shell>
        <Notice icon="lock" title="Hosting needs the Creator Pass" text="Quiz Show Studio rooms are created by Creator Pass members. You can join a quiz with its room code for free." actions={<button type="button" onClick={() => router.push('/games/quiz-show')} className="h-10 rounded-xl bg-[#ee1d49] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2">Back</button>} />
      </Shell>
    );
  }
  if (notAPlayer || connectionStopped === 'NOT_A_PLAYER') {
    return (
      <Shell>
        <Notice
          icon="warning"
          title="You cannot join this game"
          text="It is full, already started, or you left it. If you are friends with a player you can watch it instead."
          actions={
            <>
              <button type="button" onClick={() => router.push(`/games/quiz-show?room=${encodeURIComponent(roomCode)}&spectate=1`)} className="h-10 rounded-xl bg-[#ee1d49] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2">Watch the game</button>
              <button type="button" onClick={() => router.push('/games')} className="h-10 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:text-white dark:hover:bg-[#1b1c24]">Back to games</button>
            </>
          }
        />
      </Shell>
    );
  }
  if (connectionStopped === 'ROOM_GONE') {
    return (
      <Shell>
        <Notice icon="search" title="Room not found" text="That room does not exist or has expired. Check the code with your host." actions={<button type="button" onClick={() => router.push('/games/quiz-show')} className="h-10 rounded-xl bg-[#ee1d49] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2">Enter another code</button>} />
      </Shell>
    );
  }
  if (connectionStopped && connectionStopped !== 'KICKED') {
    return (
      <Shell>
        <Notice icon="warning" title="Connection lost" text="We could not stay connected to the game." actions={<button type="button" onClick={() => window.location.reload()} className="h-10 rounded-xl bg-[#ee1d49] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2">Try again</button>} />
      </Shell>
    );
  }

  if (!room) {
    return (
      <Shell>
        <div className="mx-auto mt-12 flex w-full max-w-sm flex-col items-center rounded-2xl border border-zinc-200 bg-white p-5 text-center dark:border-white/10 dark:bg-[#14151b]">
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-[#ee1d49]" />
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">Joining the room</h2>
          <p className="mt-1 font-mono text-xs font-semibold text-zinc-500 dark:text-zinc-400">{roomCode}</p>
        </div>
      </Shell>
    );
  }

  if (room.status === 'CANCELLED') {
    return (
      <Shell>
        <Notice icon="warning" title="The room was closed" text="The quiz master left before the quiz started." actions={<button type="button" onClick={() => router.push('/games/quiz-show')} className="h-10 rounded-xl bg-[#ee1d49] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2">Back</button>} />
      </Shell>
    );
  }

  const view: QuizGameView | null = gameState && gameState.game === 'quiz-show' ? (gameState as QuizGameView) : null;
  const waiting = room.status === 'WAITING' || !view || view.phase === 'LOBBY';
  const effectiveView: QuizGameView | null = view && room.status === 'FINISHED' && view.phase !== 'FINAL' && view.phase !== 'ABORTED'
    ? { ...view, phase: 'ABORTED', phaseEndsAt: null, statusMessage: view.statusMessage || 'The quiz ended.' }
    : view;

  const friendDrawer = (
    <GameFriendSelectorDrawer
      isOpen={friendsOpen}
      onClose={() => setFriendsOpen(false)}
      token={session?.token}
      gameTitle="Quiz Show Studio"
      inviteMode
      shareText="Join my Quiz Show Studio room!"
      onSelectFriend={(f) => void invite(f)}
    />
  );
  const toastEl = toast ? (
    <div role="status" className="fixed bottom-5 left-1/2 z-[120] -translate-x-1/2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:border-zinc-200 dark:bg-white dark:text-zinc-900">
      {toast}
    </div>
  ) : null;
  const reconnecting = connectionStatus === 'RECONNECTING';

  // Players in the waiting lobby get the shared lobby every game uses (the one Ludo shows)
  if (waiting && !isSpectator) {
    return (
      <>
        {reconnecting && (
          <p className="fixed inset-x-4 top-2 z-[100] mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-200" role="status">Reconnecting... your seat is kept for a short while.</p>
        )}
        <QuizWaitingRoom
          room={room}
          view={view}
          myUserId={myUserId}
          chatMessages={chatMessages}
          isMicMuted={isMicMuted}
          isCameraOn={isCameraOn}
          onToggleMic={() => void toggleMic()}
          onToggleCamera={() => void toggleCamera()}
          videoParticipants={videoParticipants}
          onSendChat={sendChat}
          onSendReaction={sendReaction}
          onInviteFriends={() => setFriendsOpen(true)}
          onStart={startQuizGame}
          onEdit={sendQuizEdit}
          onLeave={leave}
          error={actionError}
        />
        {mediaNotice && <AlertModal isOpen onClose={clearMediaNotice} title="Device Notice" message={mediaNotice} type="warning" confirmText="Understood" />}
        {friendDrawer}
        {toastEl}
      </>
    );
  }

  return (
    <Shell onBack={isSpectator || !waiting ? undefined : leave} hideTitle={!waiting} themeBg={waiting ? undefined : findGameRoomTheme(themeId).bgUrl}>
      {reconnecting && (
        <p className="mx-auto mb-3 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-200" role="status">Reconnecting... your seat is kept for a short while.</p>
      )}

      {waiting || !effectiveView ? (
        <>
          {isSpectator && (
            <div className="mx-auto mb-4 w-full">
              <SpectatorBanner count={spectatorCount} names={spectators} onLeave={leave} status={null} />
            </div>
          )}
          <Notice icon="users" title="Waiting for the host" text="The quiz has not started yet. You can watch once it begins." actions={<button type="button" onClick={() => router.push('/games')} className="h-10 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:text-white dark:hover:bg-[#1b1c24]">Back to games</button>} />
        </>
      ) : (
        <QuizRoomView
          roomCode={room.roomCode}
          view={effectiveView}
          myUserId={myUserId}
          isSpectator={isSpectator}
          spectatorCount={spectatorCount}
          spectators={spectators}
          chatMessages={chatMessages}
          typingNames={typingNames}
          floatingReactions={floatingReactions}
          media={{
            participants: videoParticipants,
            isMicMuted,
            isCameraOn,
            onToggleMic: () => void toggleMic(),
            onToggleCamera: () => void toggleCamera(),
            notice: mediaNotice,
            onClearNotice: clearMediaNotice
          }}
          themeId={themeId}
          onSelectTheme={selectTheme}
          actionError={actionError}
          onAnswer={sendQuizAnswer}
          onBuzz={sendQuizBuzz}
          onBuzzAnswer={sendQuizBuzzAnswer}
          onJudge={sendQuizJudge}
          onControl={sendQuizControl}
          onSendChat={sendChat}
          onSendReaction={sendReaction}
          onTyping={sendTyping}
          onRematch={quizRematch}
          onEditAgain={quizEditAgain}
          onLeave={leave}
        />
      )}

      {friendDrawer}
      {toastEl}
    </Shell>
  );
}

function QuizPageContent() {
  const searchParams = useSearchParams();
  const roomCodeParam = searchParams.get('room');
  const spectate = isSpectateRequested(searchParams.get('spectate'));

  if (!roomCodeParam) {
    return (
      <Shell hideTitle>
        <QuizEntry />
      </Shell>
    );
  }
  return <QuizRoom key={roomCodeParam} roomCode={roomCodeParam.trim().toUpperCase()} spectate={spectate} />;
}

export default function QuizShowPage() {
  return (
    <Suspense
      fallback={
        <div className={`${PAGE_BG} flex items-center justify-center`}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ee1d49] border-t-transparent" />
        </div>
      }
    >
      <QuizPageContent />
    </Suspense>
  );
}
