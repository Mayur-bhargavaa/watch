'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AppIcon } from '../../../components/ui/AppIcon';
import { useGameRoom } from '../../../hooks/useGameRoom';
import { getGameRoute, getStoredSession, pingPartner, type FriendWithStreak } from '../../../lib/api';
import { isSpectateRequested } from '../../../lib/spectator';
import { emojiCharadesErrorText } from '../../../lib/emojiCharadesView';
import { SpectatorBanner } from '../../../components/games/common/SpectatorBanner';
import { GameFriendSelectorDrawer } from '../../../components/games/GameFriendSelectorDrawer';
import { EmojiCharadesEntry } from '../../../components/games/emoji-charades/EmojiCharadesEntry';
import { EmojiCharadesLobby } from '../../../components/games/emoji-charades/EmojiCharadesLobby';
import { EmojiCharadesGameScreen } from '../../../components/games/emoji-charades/EmojiCharadesGameScreen';
import type { EmojiCharadesGameView } from '@synccinema/common';

const PAGE_BG = 'min-h-screen w-full bg-[#fdf8f6] text-slate-800 dark:bg-[#0c0f1d] dark:text-white';

function Shell({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  return (
    <div className={`${PAGE_BG} px-4 pb-10 pt-4 sm:px-6`}>
      <div className="mx-auto mb-4 flex w-full max-w-5xl items-center gap-3">
        {onBack && (
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-white dark:bg-white/10 dark:text-white dark:hover:bg-white/15">
            <ArrowLeft className="h-4 w-4" />
            Games
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Notice({ icon, title, text, actions }: { icon: string; title: string; text: string; actions: React.ReactNode }) {
  return (
    <div className="mx-auto mt-10 w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-8 text-center shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#121629]/80">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/15">
        <AppIcon name={icon} className="h-7 w-7" />
      </div>
      <h2 className="text-xl font-black text-[#16132b] dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">{text}</p>
      <div className="mt-5 flex flex-col gap-2">{actions}</div>
    </div>
  );
}

function EmojiCharadesRoom({ roomCode, spectate }: { roomCode: string; spectate: boolean }) {
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
    rematchStatus,
    rematchUnavailable,
    startEmojiCharadesGame,
    sendEmojiCharadesGuess,
    rematch,
    sendChat,
    sendLeave
  } = useGameRoom(roomCode, 'emoji-charades', { spectate, create: false });

  const [friendsOpen, setFriendsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const session = useMemo(() => (typeof window === 'undefined' ? null : getStoredSession()), []);

  useEffect(() => {
    if (room?.gameType && room.gameType !== 'emoji-charades' && room.roomCode) router.replace(getGameRoute(room.gameType, room.roomCode));
  }, [room?.gameType, room?.roomCode, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const leave = () => {
    sendLeave();
    router.push('/games');
  };

  const invite = async (friend: FriendWithStreak) => {
    if (!room) return;
    try {
      await pingPartner({ targetCode: friend.friendUser.partnerCode, roomCode: room.roomCode, gameType: 'emoji-charades', customMessage: 'Join my Emoji Charades game!' });
      setToast(`Invite sent to ${friend.friendUser.displayName}`);
    } catch (e: any) {
      setToast(e?.message || 'Could not send the invite');
    }
  };

  const actionError = gameError ? emojiCharadesErrorText(gameError.code, gameError.message) : null;

  if (connectionStopped === 'UPGRADE_REQUIRED') {
    return (
      <Shell onBack={() => router.push('/games')}>
        <Notice icon="lock" title="Hosting needs VIP" text="Emoji Charades rooms are created by Watch+ (VIP Pass) members. You can join a friend's room for free." actions={<button type="button" onClick={() => router.push('/games/emoji-charades')} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white">Back</button>} />
      </Shell>
    );
  }
  if (notAPlayer || connectionStopped === 'NOT_A_PLAYER') {
    return (
      <Shell onBack={() => router.push('/games')}>
        <Notice
          icon="warning"
          title="You cannot join this game"
          text="It is full, already started, or you left it. If you are friends with a player you can watch it instead."
          actions={
            <>
              <button type="button" onClick={() => router.push(`/games/emoji-charades?room=${encodeURIComponent(roomCode)}&spectate=1`)} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white">Watch the game</button>
              <button type="button" onClick={() => router.push('/games')} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 dark:border-white/10 dark:text-white">Back to games</button>
            </>
          }
        />
      </Shell>
    );
  }
  if (connectionStopped === 'ROOM_GONE') {
    return (
      <Shell onBack={() => router.push('/games')}>
        <Notice icon="search" title="Room not found" text="That room does not exist or has expired. Check the code with your host." actions={<button type="button" onClick={() => router.push('/games/emoji-charades')} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white">Enter another code</button>} />
      </Shell>
    );
  }
  if (connectionStopped && connectionStopped !== 'KICKED') {
    return (
      <Shell onBack={() => router.push('/games')}>
        <Notice icon="warning" title="Connection lost" text="We could not stay connected to the game." actions={<button type="button" onClick={() => window.location.reload()} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white">Try again</button>} />
      </Shell>
    );
  }

  if (!room) {
    return (
      <Shell>
        <div className="mx-auto mt-16 flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/60 bg-white/80 p-8 text-center shadow-xl dark:border-white/10 dark:bg-[#121629]/80">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-violet-500" />
          <h2 className="text-lg font-black text-[#16132b] dark:text-white">Joining the room</h2>
          <p className="mt-1 font-mono text-xs font-bold text-violet-600 dark:text-violet-300">{roomCode}</p>
        </div>
      </Shell>
    );
  }

  const view: EmojiCharadesGameView | null = gameState && gameState.game === 'emoji-charades' ? (gameState as EmojiCharadesGameView) : null;
  const waiting = room.status === 'WAITING' || !view;
  // a finished room whose last view was not terminal (the host left, a restart...) is shown as ended instead of frozen
  const effectiveView: EmojiCharadesGameView | null = view && room.status === 'FINISHED' && view.phase !== 'FINAL' && view.phase !== 'ABORTED'
    ? { ...view, phase: 'ABORTED', phaseEndsAt: null, statusMessage: view.statusMessage || 'The game ended.' }
    : view;

  return (
    <Shell onBack={isSpectator ? undefined : leave}>
      {isSpectator && (
        <div className="mx-auto mb-4 w-full max-w-5xl">
          <SpectatorBanner count={spectatorCount} names={spectators} onLeave={leave} status={effectiveView ? `Round ${effectiveView.round} of ${effectiveView.totalRounds}` : null} />
        </div>
      )}
      {connectionStatus === 'RECONNECTING' && (
        <p className="mx-auto mb-3 w-full max-w-5xl rounded-2xl bg-amber-100 px-4 py-2 text-center text-xs font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-100" role="status">Reconnecting... your seat is kept for a short while.</p>
      )}

      {waiting || !effectiveView ? (
        <EmojiCharadesLobby
          room={room}
          myUserId={myUserId}
          chatMessages={chatMessages}
          onInviteFriends={() => setFriendsOpen(true)}
          onStart={startEmojiCharadesGame}
          onSendChat={sendChat}
          onLeave={leave}
          error={actionError}
        />
      ) : (
        <EmojiCharadesGameScreen
          view={effectiveView}
          myUserId={myUserId}
          isSpectator={isSpectator}
          chatMessages={chatMessages}
          rematchStatus={rematchStatus}
          rematchUnavailable={rematchUnavailable}
          actionError={actionError}
          onGuess={sendEmojiCharadesGuess}
          onSendChat={sendChat}
          onRematch={rematch}
          onLeave={leave}
        />
      )}

      <GameFriendSelectorDrawer
        isOpen={friendsOpen}
        onClose={() => setFriendsOpen(false)}
        token={session?.token}
        gameTitle="Emoji Charades"
        inviteMode
        shareText="Join my Emoji Charades room!"
        onSelectFriend={(f) => void invite(f)}
      />
      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-[120] -translate-x-1/2 rounded-full bg-[#16132b] px-5 py-2.5 text-sm font-bold text-white shadow-xl dark:bg-white dark:text-[#16132b]">
          {toast}
        </div>
      )}
    </Shell>
  );
}

function EmojiCharadesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomCodeParam = searchParams.get('room');
  const spectate = isSpectateRequested(searchParams.get('spectate'));

  if (!roomCodeParam) {
    return (
      <Shell onBack={() => router.push('/games')}>
        <EmojiCharadesEntry />
      </Shell>
    );
  }
  return <EmojiCharadesRoom key={roomCodeParam} roomCode={roomCodeParam.trim().toUpperCase()} spectate={spectate} />;
}

export default function EmojiCharadesPage() {
  return (
    <Suspense
      fallback={
        <div className={`${PAGE_BG} flex items-center justify-center`}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      }
    >
      <EmojiCharadesPageContent />
    </Suspense>
  );
}
