'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, MessageSquare, Share2 } from 'lucide-react';
import { useGameRoom } from '../../../hooks/useGameRoom';
import { getGameRoute, getStoredSession, pingPartner, type FriendWithStreak } from '../../../lib/api';
import { isSpectateRequested } from '../../../lib/spectator';
import { AppSidebar } from '../../../components/layout/AppSidebar';
import { AppHeader } from '../../../components/layout/AppHeader';
import { SpectatorBanner } from '../../../components/games/common/SpectatorBanner';
import { GameFriendSelectorDrawer } from '../../../components/games/GameFriendSelectorDrawer';
import { ChatPanel } from '../../../components/games/doodle/waiting/ChatPanel';
import { PartyPoppers } from '../../../components/games/common/PartyPoppers';
import { ClashEntry } from '../../../components/games/color-clash/ClashEntry';
import { ClashWaitingRoom } from '../../../components/games/color-clash/ClashWaitingRoom';
import { ClashTable } from '../../../components/games/color-clash/ClashTable';
import { isClashState, isLive, resultTitle } from '../../../lib/clashView';
import { useTheme } from '../../../context/ThemeContext';
import type { ClashCard, ClashColor, ClashPublicState } from '@synccinema/common';

const PAGE_BG = 'min-h-screen w-full text-zinc-900 dark:text-white bg-[#f7f8fa] dark:bg-[#0c0d12]';

/** The same platform shell as the other games: sidebar and header around the game. */
function Shell({ children, bg = '/images/color-clash-bg.jpg' }: { children: React.ReactNode; bg?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className={`${PAGE_BG} flex font-sans`} style={{ backgroundImage: `linear-gradient(rgba(8,8,14,0.55),rgba(8,8,14,0.78)), url('${bg}')`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <AppSidebar activeNav="games" isMobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
      <main className="relative flex min-h-screen min-w-0 flex-1 flex-col overflow-y-auto px-2 py-3 sm:px-6 sm:py-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <AppHeader onOpenMobileSidebar={() => setSidebarOpen(true)} backHref="/games" />
        <div className="mx-auto mt-3 flex w-full flex-1 flex-col animate-fadeIn sm:mt-4">{children}</div>
      </main>
    </div>
  );
}

function Notice({ title, text, actions }: { title: string; text: string; actions: React.ReactNode }) {
  return (
    <div className="mx-auto mt-8 w-full max-w-md rounded-2xl border border-white/10 bg-[#14151b]/95 p-5 text-center text-white">
      <h2 className="text-base font-bold">{title}</h2>
      <p className="mt-1 text-sm text-zinc-300">{text}</p>
      <div className="mt-4 flex flex-col gap-2">{actions}</div>
    </div>
  );
}

function ClashRoom({ roomCode, spectate }: { roomCode: string; spectate: boolean }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const {
    room, gameState, myUserId, chatMessages, connectionStatus, connectionStopped, notAPlayer, isSpectator, spectatorCount, spectators,
    gameError, rematchStatus, rematch, sendChat, sendLeave, sendReaction, floatingReactions,
    clashLobby, clashReady, clashConfig, clashStart, clashPlay, clashDraw, clashPass, clashDeclare, clashCatch, clashChallenge, clashCancel, zeroCrossOffset
  } = useGameRoom(roomCode, 'color-clash', { spectate, create: false });

  const [friendsOpen, setFriendsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const session = useMemo(() => (typeof window === 'undefined' ? null : getStoredSession()), []);
  const errSeq = useRef(0);
  const [rejection, setRejection] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    if (room?.gameType && room.gameType !== 'color-clash' && room.roomCode) router.replace(getGameRoute(room.gameType, room.roomCode));
  }, [room?.gameType, room?.roomCode, router]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  // the server refused something: say why for a moment
  useEffect(() => {
    if (!gameError) return;
    errSeq.current += 1;
    setRejection({ id: errSeq.current, message: gameError.message });
    const t = setTimeout(() => setRejection(null), 3000);
    return () => clearTimeout(t);
  }, [gameError]);

  const leave = () => {
    sendLeave();
    router.push('/games');
  };
  const invite = async (friend: FriendWithStreak) => {
    if (!room) return;
    try {
      await pingPartner({ targetCode: friend.friendUser.partnerCode, roomCode: room.roomCode, gameType: 'color-clash', customMessage: 'Join my Color Clash table!' });
      setToast(`Invite sent to ${friend.friendUser.displayName}`);
    } catch (e: any) {
      setToast(e?.message || 'Could not send the invite');
    }
  };

  if (notAPlayer || connectionStopped === 'NOT_A_PLAYER') {
    return (
      <Shell>
        <Notice
          title="You cannot join this table"
          text="It is full, already started, or you left it. If you are friends with a player you can watch instead."
          actions={<>
            <button type="button" onClick={() => router.push(`/games/color-clash?room=${encodeURIComponent(roomCode)}&spectate=1`)} className="h-10 rounded-xl bg-[#ee1d49] px-4 text-sm font-semibold text-white cursor-pointer">Watch the game</button>
            <button type="button" onClick={() => router.push('/games')} className="h-10 rounded-xl border border-white/20 px-4 text-sm font-semibold text-zinc-200 cursor-pointer">Back to games</button>
          </>}
        />
      </Shell>
    );
  }
  if (connectionStopped === 'ROOM_GONE') {
    return (
      <Shell>
        <Notice title="Table not found" text="That room does not exist or has expired. Check the code with your host." actions={<button type="button" onClick={() => router.push('/games/color-clash')} className="h-10 rounded-xl bg-[#ee1d49] px-4 text-sm font-semibold text-white cursor-pointer">Back</button>} />
      </Shell>
    );
  }
  if (connectionStopped && connectionStopped !== 'KICKED') {
    return (
      <Shell>
        <Notice title="Connection lost" text="We could not stay connected to the game." actions={<button type="button" onClick={() => window.location.reload()} className="h-10 rounded-xl bg-[#ee1d49] px-4 text-sm font-semibold text-white cursor-pointer">Reconnect</button>} />
      </Shell>
    );
  }
  if (!room) {
    return (
      <Shell>
        <div className="mx-auto mt-12 flex w-full max-w-sm flex-col items-center rounded-2xl border border-white/10 bg-[#14151b]/95 p-5 text-center text-white">
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-[#ee1d49]" />
          <h2 className="text-base font-bold">Joining the table</h2>
          <p className="mt-1 font-mono text-xs font-semibold text-zinc-400">{roomCode}</p>
        </div>
      </Shell>
    );
  }

  const state: ClashPublicState | null = isClashState(gameState) ? gameState : null;
  const waiting = room.status === 'WAITING' || !state;
  const reconnecting = connectionStatus === 'RECONNECTING';
  const friendDrawer = (
    <GameFriendSelectorDrawer isOpen={friendsOpen} onClose={() => setFriendsOpen(false)} token={session?.token} gameTitle="Color Clash" onSelectFriend={(f) => void invite(f)} />
  );
  const toastEl = toast ? <div role="status" className="fixed bottom-5 left-1/2 z-[120] -translate-x-1/2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-white">{toast}</div> : null;
  const reconnectBanner = reconnecting ? <p className="mx-auto mb-2 w-full max-w-3xl rounded-xl border border-amber-300/40 bg-amber-500/15 px-3 py-2 text-center text-xs font-semibold text-amber-200">Reconnecting to the table…</p> : null;

  if (waiting && !isSpectator) {
    return (
      <>
        {reconnecting && <p className="fixed inset-x-4 top-2 z-[100] mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800">Reconnecting…</p>}
        <ClashWaitingRoom
          room={room}
          myUserId={myUserId}
          chatMessages={chatMessages}
          ready={clashLobby?.ready ?? []}
          rules={clashLobby?.rules ?? null}
          onSendChat={sendChat}
          onSendReaction={sendReaction}
          onInviteFriends={() => setFriendsOpen(true)}
          onReady={clashReady}
          onConfig={clashConfig}
          onStart={clashStart}
          onLeave={leave}
          error={rejection?.message ?? null}
        />
        {friendDrawer}
        {toastEl}
      </>
    );
  }

  const connectedIds = new Set(room.players.filter((p) => p.isConnected !== false).map((p) => p.userId));
  const avatarOf = (userId: string) => room.players.find((p) => p.userId === userId)?.avatarUrl ?? null;
  const finished = !!state && !isLive(state);

  return (
    <Shell>
      {reconnectBanner}
      <div className="mx-auto mb-2 flex w-full max-w-3xl items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-white">
          <h1 className="truncate text-base font-black sm:text-lg"><span className="text-[#ee1d49]">Color</span> Clash</h1>
          <span className="rounded-full bg-black/40 border border-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-200">{state ? `${state.players.filter((p) => !p.left).length} players` : ''}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setChatOpen((v) => !v)} aria-label="Chat and reactions" className="h-9 w-9 rounded-xl border border-white/15 bg-black/40 text-white flex items-center justify-center cursor-pointer"><MessageSquare className="h-4 w-4" /></button>
          {!isSpectator && <button type="button" onClick={() => setFriendsOpen(true)} aria-label="Invite friends" className="h-9 w-9 rounded-xl border border-white/15 bg-black/40 text-white flex items-center justify-center cursor-pointer"><Share2 className="h-4 w-4" /></button>}
          <button type="button" onClick={() => (isSpectator || finished ? leave() : setConfirmLeave(true))} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-black/40 px-3 text-xs font-semibold text-white cursor-pointer"><ArrowLeft className="h-4 w-4" />Leave</button>
          {!isSpectator && state && isLive(state) && room.hostUserId === myUserId && <button type="button" onClick={() => clashCancel()} className="hidden sm:inline-flex h-9 items-center rounded-xl border border-white/15 bg-black/40 px-3 text-xs font-semibold text-zinc-300 cursor-pointer">Cancel game</button>}
        </div>
      </div>

      {isSpectator && <div className="mx-auto mb-3 w-full max-w-3xl"><SpectatorBanner count={spectatorCount} names={spectators} onLeave={leave} status={null} /></div>}

      {state ? (
        <ClashTable
          state={state}
          online={connectionStatus === 'CONNECTED' && !isSpectator}
          clockOffsetMs={zeroCrossOffset}
          connectedIds={connectedIds}
          avatarOf={avatarOf}
          onPlay={(card: ClashCard, color: ClashColor | undefined, moveId, baseVersion) => clashPlay(card.id, color, moveId, baseVersion)}
          onDraw={clashDraw}
          onPass={clashPass}
          onDeclare={clashDeclare}
          onCatch={clashCatch}
          onChallenge={clashChallenge}
          rejection={rejection}
        />
      ) : (
        <p className="mx-auto mt-10 max-w-sm text-center text-sm text-zinc-300">The game has not started yet. You will see it as soon as it does.</p>
      )}

      {/* floating reactions */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center gap-2" aria-hidden>
        {floatingReactions.slice(-4).map((r) => <span key={r.id} className="rounded-full bg-black/70 px-2.5 py-1 text-lg motion-safe:animate-bounce">{r.emoji}</span>)}
      </div>

      {/* the result */}
      {finished && state && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cc-result-title">
          {state.winnerSeat !== null && state.mySeat === state.winnerSeat && <PartyPoppers />}
          <div className="w-[calc(100vw-2rem)] max-w-sm rounded-[28px] p-6 bg-[#161220]/95 border border-white/20 text-center text-white shadow-2xl space-y-3">
            <h2 id="cc-result-title" className="text-2xl font-black">{resultTitle(state)}</h2>
            {state.points !== null && state.winnerSeat !== null && <p className="text-sm text-zinc-200">Scores <span className="font-black text-amber-300">{state.points}</span> points</p>}
            <p className="text-xs text-zinc-400">{state.statusMessage}</p>
            <div className="flex flex-col gap-2 pt-1">
              {!isSpectator && (
                <button type="button" onClick={rematch} className="h-11 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-sm font-black text-white cursor-pointer active:scale-[0.98]">
                  {rematchStatus ? `Play again (${rematchStatus.votedCount}/${rematchStatus.totalNeeded})` : 'Play again'}
                </button>
              )}
              <button type="button" onClick={leave} className="h-10 rounded-xl border border-white/20 text-xs font-bold text-zinc-200 cursor-pointer">Return to games</button>
            </div>
          </div>
        </div>
      )}

      {/* leaving a running game */}
      {confirmLeave && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cc-leave-title">
          <div className="w-[calc(100vw-2rem)] max-w-sm rounded-3xl p-5 bg-[#161220] border border-white/20 text-white shadow-2xl space-y-3">
            <h3 id="cc-leave-title" className="text-lg font-black">Leave this game?</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">Your cards go back into the pile and the others play on without you. {state && state.players.filter((p) => !p.left).length === 2 ? 'With only two players, your opponent wins.' : ''}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" autoFocus onClick={() => setConfirmLeave(false)} className="py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer">Stay</button>
              <button type="button" onClick={leave} className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-black cursor-pointer">Leave game</button>
            </div>
          </div>
        </div>
      )}

      <ChatPanel room={room} chatMessages={chatMessages} myUserId={myUserId} onSendMessage={sendChat} onSendReaction={sendReaction} isDrawerMode isOpen={chatOpen} onClose={() => setChatOpen(false)} isDark={resolvedTheme !== 'light'} />
      {friendDrawer}
      {toastEl}
    </Shell>
  );
}

function ClashPageContent() {
  const searchParams = useSearchParams();
  const roomCodeParam = searchParams.get('room');
  const spectate = isSpectateRequested(searchParams.get('spectate'));
  if (!roomCodeParam) {
    return (
      <Shell>
        <ClashEntry />
      </Shell>
    );
  }
  return <ClashRoom key={roomCodeParam} roomCode={roomCodeParam.trim().toUpperCase()} spectate={spectate} />;
}

export default function ColorClashPage() {
  return (
    <Suspense fallback={<div className={`${PAGE_BG} flex items-center justify-center`}><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ee1d49] border-t-transparent" /></div>}>
      <ClashPageContent />
    </Suspense>
  );
}
