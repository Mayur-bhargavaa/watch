'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  WifiOff,
  Crown,
  LogOut,
  PhoneOff,
  Share2,
  MessageSquare,
  Gamepad2
} from 'lucide-react';
import { useRoomSocket } from '../../../hooks/useRoomSocket';
import { useWebRTC } from '../../../hooks/useWebRTC';
import { CinemaPlayer } from '../../../components/player/CinemaPlayer';
import { FloatingReactionsCanvas } from '../../../components/social/FloatingReactionsCanvas';
import { VideoGrid } from '../../../components/voice/VideoGrid';
import { ContextualChat } from '../../../components/chat/ContextualChat';
import { GameLounge } from '../../../components/games/GameLounge';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const {
    connectionStatus,
    room,
    members,
    myRole,
    myUserId,
    clockOffsetMs,
    rttMs,
    chatMessages,
    latestReactions,
    screenPresenter,
    error,
    typingUsers,
    getAuthoritativePosition,
    sendPlaybackCommand,
    sendReaction,
    sendChatMessage,
    deleteChatMessage,
    sendTyping,
    transferHost,
    sendWebRTCSignal,
    sendScreenState,
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener,
    sendGameAction,
    registerGameListener,
    sendCountdownStart,
    registerCountdownListener,
    leaveRoom,
    endRoomForAll
  } = useRoomSocket(slug);

  const {
    screenStream,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    isCameraOn,
    isMicMuted,
    localUserStream,
    remoteCameraStates,
    toggleCamera,
    toggleMic,
    stopAllMediaTracks,
    videoGridParticipants
  } = useWebRTC({
    myUserId,
    members,
    screenPresenter,
    sendWebRTCSignal,
    sendScreenState,
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener
  });

  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showHostTransferModal, setShowHostTransferModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [browserUrl, setBrowserUrl] = useState('https://watch.stitchbyte.in');
  const [countdownActive, setCountdownActive] = useState(false);
  const [sideSection, setSideSection] = useState<'chat' | 'games'>('chat');

  useEffect(() => {
    const unregister = registerCountdownListener(() => {
      setCountdownActive(true);
    });
    return unregister;
  }, [registerCountdownListener]);

  // Record real watch history for "Continue Watching"
  useEffect(() => {
    if (!room || typeof window === 'undefined') return;

    const recordHistory = () => {
      try {
        const authPos = getAuthoritativePosition();
        const duration = room.currentMedia?.durationSeconds || 0;
        const historyItem = {
          slug: room.slug,
          roomId: room.id,
          title: room.title || room.currentMedia?.title || 'Watch Party',
          sourceUrl: room.currentMedia?.sourceUrl || '',
          position: Math.round(authPos),
          duration: Math.round(duration),
          progressPercent: duration > 0 ? Math.min(100, Math.round((authPos / duration) * 100)) : (authPos > 0 ? 40 : 15),
          activityMode: room.activityMode || 'CINEMA',
          lastWatchedAt: new Date().toISOString()
        };

        const existingRaw = localStorage.getItem('stitchbyte_watch_history');
        let historyList: any[] = existingRaw ? JSON.parse(existingRaw) : [];
        historyList = historyList.filter((item: any) => item.slug !== room.slug);
        historyList.unshift(historyItem);
        localStorage.setItem('stitchbyte_watch_history', JSON.stringify(historyList.slice(0, 10)));
      } catch {}
    };

    recordHistory();
    const interval = setInterval(recordHistory, 5000);
    return () => clearInterval(interval);
  }, [room, getAuthoritativePosition]);

  const isHost = myRole === 'HOST' || myRole === 'CO_HOST';
  const currentPos = getAuthoritativePosition();
  
  // Only consider active, connected members (never stale disconnected sessions)
  const activeMembers = members.filter((m) => m.isConnected !== false);
  const selfMember = activeMembers.find((m) => m.userId === myUserId);
  const selfDisplayName = selfMember?.displayName || 'You';

  const handleCopyInvite = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  };

  const handleReact = (code: string, emoji: string) => {
    sendReaction(code, emoji, currentPos);
  };

  const handleToggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
      sendCountdownStart();
    }
  };

  const handleStartParty = () => {
    startScreenShare();
    sendCountdownStart();
  };

  const handleLeaveRoom = () => {
    if (isHost && activeMembers.length > 1) {
      setShowLeaveModal(true);
    } else {
      stopAllMediaTracks();
      leaveRoom();
      router.push('/');
    }
  };

  const handleEndRoomForAll = () => {
    stopAllMediaTracks();
    endRoomForAll();
    setShowLeaveModal(false);
    router.push('/');
  };

  const handleHostLeaveOnly = () => {
    stopAllMediaTracks();
    leaveRoom();
    setShowLeaveModal(false);
    router.push('/');
  };

  // Map real connected members to participant streams for the VideoGrid (100% real members)
  const gridParticipants = activeMembers.map((member) => {
    const isSelf = member.userId === myUserId;
    const rtcParticipant = videoGridParticipants.find((p) => p.userId === member.userId || (isSelf && p.isSelf));
    const selfStream = isCameraOn ? localUserStream : null;
    const peerStream = rtcParticipant?.stream || null;
    const stream = isSelf ? selfStream : peerStream;

    const cameraFlag = isSelf ? isCameraOn : remoteCameraStates.get(member.userId);
    const hasLiveVideoTrack = Boolean(
      stream &&
      stream.getVideoTracks().length > 0 &&
      stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live' && !t.muted)
    );

    const peerCameraOn = isSelf
      ? (isCameraOn && Boolean(localUserStream))
      : (cameraFlag === true || (cameraFlag !== false && hasLiveVideoTrack));

    return {
      userId: member.userId,
      displayName: isSelf ? `${member.displayName}` : member.displayName,
      stream,
      isCameraOn: peerCameraOn,
      isMuted: isSelf ? isMicMuted : (rtcParticipant?.isMuted ?? member.isMuted ?? false),
      isSpeaking: rtcParticipant?.isSpeaking ?? false,
      isSelf,
      isHost: member.role === 'HOST' || (isHost && isSelf)
    };
  });

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4 bg-[#08070d]">
        <div className="p-4 bg-rose-500/20 text-rose-400 rounded-full border border-rose-500/30">
          <WifiOff className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-white">Viewing Room Notice</h1>
        <p className="text-xs text-zinc-300 max-w-sm">{error}</p>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-xs font-bold text-white rounded-xl shadow-lg transition"
          >
            Return to Dashboard
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-xs font-semibold text-zinc-300 rounded-xl transition"
          >
            Home
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-3 bg-[#08070d]">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-xs text-indigo-300 font-semibold tracking-wider">
          Entering Virtual Cinema...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen flex flex-col bg-[#0b0e17] text-slate-100 selection:bg-rose-500 selection:text-white overflow-hidden p-3 lg:p-4">
      {/* Top Header Bar: Branding, Room Title, Seats Count, Invite Link & Dedicated Red Leave Button */}
      <div className="flex-shrink-0 flex items-center justify-between pb-2 px-1">
        {/* Left: Branding & Room Title */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2.5">
            <div className="flex flex-col leading-none">
              <span className="text-base sm:text-lg font-black tracking-tighter text-[#E50914] select-none">watch.</span>
              <span className="text-[7.5px] font-semibold tracking-wider text-zinc-400/80 uppercase select-none mt-0.5">stitchbyte watchparty</span>
            </div>
            <span className="text-zinc-600 text-sm hidden sm:inline">/</span>
            <span className="text-xs sm:text-sm font-semibold text-white tracking-wide truncate max-w-[130px] sm:max-w-[280px]">
              {room.title || 'Watch Party'}
            </span>
          </div>

          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[11px] text-zinc-300 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{Math.min(6, activeMembers.length)}/6 connected</span>
          </div>
        </div>

        {/* Right: Copy Invite Link & Dedicated Red Leave Button */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={handleCopyInvite}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-lg transition flex items-center space-x-1.5 border border-white/10 shadow-sm"
            title="Copy room link to invite friends"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{copiedInvite ? '✓ Copied' : 'Invite Friends'}</span>
            <span className="sm:hidden">{copiedInvite ? '✓' : 'Invite'}</span>
          </button>

          <button
            onClick={handleLeaveRoom}
            className="px-3 py-1.5 bg-[#E50914] hover:bg-red-600 text-white text-xs font-bold rounded-lg transition shadow-md shadow-red-600/30 flex items-center space-x-1.5 active:scale-95"
            title="Leave this watch party"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        </div>
      </div>

      {/* Reconnection Alert Banner */}
      {connectionStatus === 'RECONNECTING' && (
        <div className="bg-amber-500/20 border border-amber-500/30 mb-2 px-4 py-1.5 rounded-xl text-center text-xs text-amber-300 font-medium flex items-center justify-center space-x-2 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Reconnecting to session...</span>
        </div>
      )}

      {/* Main Cinema & Chat Layout matching reference image */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 overflow-hidden min-h-0">
        {/* Left/Main Column: Top Horizontal Video Strip (6 seats) + Center Cinema Player Stage */}
        <div className="flex-1 flex flex-col min-w-0 h-full gap-2.5 overflow-hidden">
          {/* 1. Top Horizontal Participant Strip (Up to 6 participants) */}
          <div className="flex-shrink-0 w-full">
            <VideoGrid
              participants={gridParticipants.slice(0, 6)}
              onCopyInvite={handleCopyInvite}
              copiedInvite={copiedInvite}
            />
          </div>

          {/* 2. Cinema Theater Player Stage with embedded call controls dock */}
          <div className="flex-1 min-h-0 relative rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black flex flex-col">
            <CinemaPlayer
              media={room.currentMedia}
              playbackState={room.playbackState}
              isHost={isHost}
              rttMs={rttMs}
              clockOffsetMs={clockOffsetMs}
              getAuthoritativePosition={getAuthoritativePosition}
              onHostCommand={sendPlaybackCommand}
              screenStream={screenStream}
              isScreenSharing={isScreenSharing}
              screenPresenter={screenPresenter}
              onStartScreenShare={startScreenShare}
              onStopScreenShare={stopScreenShare}
              isMicMuted={isMicMuted}
              isCameraOn={isCameraOn}
              onToggleMic={toggleMic}
              onToggleCamera={toggleCamera}
              onLeaveRoom={handleLeaveRoom}
              roomTitle={room.title || 'Watch Party'}
              onNavigateUrl={(url) => setBrowserUrl(url)}
              countdownActive={countdownActive}
              onCountdownFinished={() => setCountdownActive(false)}
              onStartParty={handleStartParty}
            />
            <FloatingReactionsCanvas latestReactions={latestReactions} />
          </div>
        </div>

        {/* Right Column: FlixParty Live Side Section (Chat & Game Lounge) */}
        <div className="w-full lg:w-80 xl:w-96 h-full flex flex-col flex-shrink-0 min-h-0">
          {/* Side Section Tab Switcher */}
          <div className="flex items-center p-1 bg-[#141721] rounded-xl border border-white/10 mb-2 shrink-0">
            <button
              onClick={() => setSideSection('chat')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                sideSection === 'chat'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setSideSection('games')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                sideSection === 'games'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>Party Games</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                LIVE
              </span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {sideSection === 'chat' ? (
              <ContextualChat
                messages={chatMessages}
                currentPlaybackPosition={currentPos}
                myUserId={myUserId}
                isHost={isHost}
                roomTitle={room.title || 'Watch Party'}
                memberCount={Math.min(6, activeMembers.length)}
                members={activeMembers}
                onSendMessage={sendChatMessage}
                onDeleteMessage={deleteChatMessage}
                onSeekToTimestamp={(sec) => {
                  if (isHost) {
                    sendPlaybackCommand('SEEK', sec);
                  }
                }}
                onCopyInvite={handleCopyInvite}
                copiedInvite={copiedInvite}
                onSendReaction={handleReact}
                onPassHost={(userId) => transferHost(userId)}
                typingUsers={typingUsers}
                onSendTyping={sendTyping}
              />
            ) : (
              <GameLounge
                roomId={room?.id || slug}
                myUserId={myUserId}
                myUserName={activeMembers.find((m) => m.userId === myUserId)?.displayName || 'Player'}
                members={activeMembers}
                sendGameAction={sendGameAction}
                registerGameListener={registerGameListener}
                isCompact={true}
              />
            )}
          </div>
        </div>
      </div>


      {/* Host Transfer Modal */}
      {showHostTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#121622] max-w-sm w-full rounded-2xl border border-[#1e2538] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-white">
              <Crown className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold">Pass the Cinema Remote</h3>
            </div>
            <p className="text-xs text-zinc-400">
              Select who should take control of room playback:
            </p>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {activeMembers
                .filter((m) => m.role !== 'HOST' && m.isConnected)
                .map((m) => (
                  <button
                    key={m.userId}
                    onClick={() => {
                      transferHost(m.userId);
                      setShowHostTransferModal(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition text-left text-xs text-zinc-200 border border-white/5"
                  >
                    <span>{m.displayName}</span>
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowHostTransferModal(false)}
                className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-xs text-zinc-300 rounded-xl transition border border-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Host Leave Options Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#121622] max-w-sm w-full rounded-2xl border border-[#1e2538] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-white">
              <LogOut className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold">Leave Watch Party</h3>
            </div>
            <p className="text-xs text-zinc-400">
              You are the host of this watch party. How would you like to exit?
            </p>

            <div className="space-y-2.5 pt-1">
              <button
                onClick={handleEndRoomForAll}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold shadow-md shadow-red-500/20 transition flex items-center justify-center space-x-2"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>End Watch Party for Everyone</span>
              </button>

              <button
                onClick={handleHostLeaveOnly}
                className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 hover:text-white text-xs font-medium border border-white/10 transition flex items-center justify-center space-x-2"
              >
                <span>Leave Room & Pass Host Role</span>
              </button>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-xs text-zinc-400 hover:text-zinc-200 rounded-xl transition border border-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
