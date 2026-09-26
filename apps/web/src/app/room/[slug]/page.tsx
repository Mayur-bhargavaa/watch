'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  WifiOff,
  Crown,
  LogOut,
  PhoneOff,
  Share2,
  MessageSquare,
  Gamepad2,
  Palette,
  Check,
  X,
  Minus,
  Heart,
  Send,
  Smile,
  Users,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Copy,
  Sparkles,
  CornerUpLeft,
  Shield,
  UserCheck,
  UserX,
  Loader2
} from 'lucide-react';
import { ChatReplyTo } from '@synccinema/common';
import { useRoomSocket } from '../../../hooks/useRoomSocket';
import { useWebRTC } from '../../../hooks/useWebRTC';
import { CinemaPlayer } from '../../../components/player/CinemaPlayer';
import { FloatingReactionsCanvas } from '../../../components/social/FloatingReactionsCanvas';
import { VideoGrid } from '../../../components/voice/VideoGrid';
import { ContextualChat } from '../../../components/chat/ContextualChat';
import { GameLounge } from '../../../components/games/GameLounge';
import { DynamicThemeEffects } from '../../../components/theme/DynamicThemeEffects';
import { StickerPicker, StickerMessageView } from '../../../components/chat/StickerPicker';
import { DrawStickerModal } from '../../../components/chat/DrawStickerModal';
import { parseStickerMessage, formatStickerMessage } from '../../../components/chat/StickersData';
import { ChatReplyQuote, ChatReplyingBanner } from '../../../components/chat/ChatReplyUI';
import { getStoredSession, recordFriendStreak } from '../../../lib/api';
import { StreakCelebrationModal } from '../../../components/streaks/StreakCelebrationModal';

export interface RoomTheme {
  id: string;
  name: string;
  bgUrl?: string;
  gradient?: string;
  description?: string;
}

const ROOM_THEMES: RoomTheme[] = [
  {
    id: 'default',
    name: 'Cinema Dark',
    gradient: 'from-[#0b0e17] via-[#0d121f] to-[#08070d]',
    description: 'Classic immersive virtual cinema'
  },
  {
    id: 'theam1',
    name: 'Theme 1 • Candlelit Café',
    bgUrl: '/theams/theam1.jpeg',
    description: 'Romantic candlelit café atmosphere'
  },
  {
    id: 'theam2',
    name: 'Theme 2 • Neon Romance',
    bgUrl: '/theams/theam2.jpeg',
    description: 'Night lights and neon glow'
  },
  {
    id: 'theam3',
    name: 'Theme 3 • Better Together',
    bgUrl: '/theams/theam3.jpeg',
    description: 'Cozy purple couch, fairy lights & wine'
  },
  {
    id: 'theam4',
    name: 'Theme 4 • Watch Together',
    bgUrl: '/theams/theam4.jpeg',
    description: 'Dreamy starry night with purple heart pillows'
  },
  {
    id: 'theam5',
    name: 'Theme 5 • Snuggle Cinema',
    bgUrl: '/theams/theam5.jpeg',
    description: 'Warm blanket snuggles & moonlit city lights'
  },
  {
    id: 'theam6',
    name: 'Theme 6 • Velvet Night',
    bgUrl: '/theams/theam6.jpeg',
    description: 'Romantic evening under glowing neon'
  },
  {
    id: 'cozy',
    name: 'Cozy Cottage',
    bgUrl: '/images/cozy_ludo_bg.jpg',
    description: 'Warm sunlit cottage living room'
  }
];

const AudioSink = React.memo(function AudioSink({ stream }: { stream: MediaStream | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (audioRef.current && stream) {
      if (audioRef.current.srcObject !== stream) {
        audioRef.current.srcObject = stream;
      }
      audioRef.current.play().catch(() => {});
    }
  }, [stream]);
  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
});

interface RoomChatInputBarProps {
  replyingTo: ChatReplyTo | null;
  onClearReply: () => void;
  onSendMessage: (content: string, replyTo?: ChatReplyTo | null) => void;
  chatInputRef: React.RefObject<HTMLInputElement>;
  chatContainerRef: React.RefObject<HTMLDivElement>;
  isUserScrolledUpRef: React.MutableRefObject<boolean>;
}

const RoomChatInputBar = React.memo(function RoomChatInputBar({
  replyingTo,
  onClearReply,
  onSendMessage,
  chatInputRef,
  chatContainerRef,
  isUserScrolledUpRef
}: RoomChatInputBarProps) {
  const [chatInput, setChatInput] = useState('');
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim(), replyingTo);
    setChatInput('');
    onClearReply();
    isUserScrolledUpRef.current = false;
    setTimeout(() => {
      chatContainerRef.current?.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }, 50);
  };

  return (
    <>
      {/* Quick Chat Phrases Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {['Good Luck! 🍀', 'Nice Move! 👏', 'Oops! 🙈', 'Well Played! 🌟', 'Hurry Up! ⏰', 'GG! 🏆'].map(text => (
          <button
            key={text}
            type="button"
            onClick={() => onSendMessage(text, replyingTo)}
            className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-rose-500/20 active:scale-95 text-rose-200 hover:text-white text-[11px] font-semibold border border-white/10 hover:border-rose-400/40 whitespace-nowrap transition-all shrink-0 shadow-sm"
          >
            {text}
          </button>
        ))}
      </div>

      {/* Chat Input Bar with stickers, draw sticker and pink send button */}
      <div className="relative pt-1 shrink-0">
        {/* Floating Sticker Picker Tray */}
        {showStickerPicker && (
          <div className="absolute bottom-14 right-0 z-50 animate-in fade-in zoom-in-95 duration-150">
            <StickerPicker
              onSelectSticker={(stickerIdOrUrl, caption) => {
                onSendMessage(formatStickerMessage(stickerIdOrUrl, caption), replyingTo);
                setShowStickerPicker(false);
                onClearReply();
              }}
              onOpenDrawModal={() => {
                setShowStickerPicker(false);
                setShowDrawModal(true);
              }}
              onClose={() => setShowStickerPicker(false)}
            />
          </div>
        )}

        {/* Interactive Hand-Drawn Animated Sticker Modal */}
        <DrawStickerModal
          isOpen={showDrawModal}
          onClose={() => setShowDrawModal(false)}
          onSendDrawnSticker={(formattedMessage) => {
            onSendMessage(formattedMessage, replyingTo);
            onClearReply();
          }}
        />

        {/* Replying-to Preview Bar */}
        {replyingTo && (
          <ChatReplyingBanner
            replyingTo={replyingTo}
            onCancel={onClearReply}
            accentColor="rose"
          />
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="flex-1 relative flex items-center">
            <input
              ref={chatInputRef}
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape' && replyingTo) {
                  onClearReply();
                }
              }}
              placeholder={replyingTo ? `Replying to ${replyingTo.userName}...` : "Type a message or send stickers..."}
              className="w-full px-3.5 py-2.5 bg-black/40 border border-rose-500/30 rounded-2xl text-xs text-white placeholder-rose-300/40 focus:outline-none focus:border-rose-400 pr-16 backdrop-blur-sm"
            />

            {/* Stickers Button */}
            <button
              type="button"
              onClick={() => setShowStickerPicker(prev => !prev)}
              className={`absolute right-8 p-1 rounded-lg transition ${
                showStickerPicker
                  ? 'text-amber-400 bg-amber-400/20'
                  : 'text-rose-300/70 hover:text-amber-300'
              }`}
              title="Send stickers & GIFs"
            >
              <Sparkles className="w-4 h-4" />
            </button>

            {/* Draw Animated Sticker Button (Replaces static Smile emoji) */}
            <button
              type="button"
              onClick={() => setShowDrawModal(true)}
              className="absolute right-2.5 p-1 rounded-lg text-pink-400 hover:text-white hover:bg-rose-500/20 transition-all cursor-pointer relative group/drawbtn active:scale-95"
              title="Draw animated sticker"
            >
              <Palette className="w-4 h-4 text-pink-400 group-hover/drawbtn:text-amber-300 transition-colors" />
            </button>
          </div>

          <button
            type="submit"
            className="p-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-rose-900/50 active:scale-95 shrink-0 cursor-pointer"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </>
  );
});

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
    sendRoomTheme,
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
    mediaNotice,
    clearMediaNotice,
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
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);
  const [showHostTransferModal, setShowHostTransferModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string>('default');

  // Strict Auth Guard: redirect unauthenticated or anonymous users to login
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const session = getStoredSession();
    if (!session?.token || session.user?.isAnonymous) {
      const currentPath = window.location.pathname + window.location.search;
      router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [router]);

  // 🛡️ Knock-to-Join & Waiting Room States
  const [isAdmitted, setIsAdmitted] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`room_admitted_${slug}`) === 'true';
    }
    return false;
  });
  const [isRejected, setIsRejected] = useState<boolean>(false);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<
    { userId: string; displayName: string; avatarUrl?: string; timestamp: number }[]
  >([]);
  const [browserUrl, setBrowserUrl] = useState('https://watch.stitchbyte.in');
  const [countdownActive, setCountdownActive] = useState(false);
  const [sideSection, setSideSection] = useState<'chat' | 'games'>('chat');
  const [activeSideTab, setActiveSideTab] = useState<'chat' | 'games' | 'call' | 'players'>('chat');
  const [replyingTo, setReplyingTo] = useState<ChatReplyTo | null>(null);
  const handleClearReply = useCallback(() => setReplyingTo(null), []);
  const handleSendChatMessage = useCallback((content: string, replyTo?: ChatReplyTo | null) => {
    sendChatMessage(content, Math.floor(getAuthoritativePosition()), replyTo);
  }, [sendChatMessage, getAuthoritativePosition]);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);

  const handleJumpToMessage = useCallback((msgId: string) => {
    const el = document.getElementById(`chat-msg-${msgId}`);
    if (el) {
      isUserScrolledUpRef.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(msgId);
      setTimeout(() => {
        setHighlightedMsgId((prev) => (prev === msgId ? null : prev));
      }, 2000);
    }
  }, []);

  const handleChatScroll = useCallback(() => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    isUserScrolledUpRef.current = scrollHeight - scrollTop - clientHeight > 60;
  }, []);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatBubbleToast, setChatBubbleToast] = useState<{ sender: string; text: string } | null>(null);
  const prevMessagesCountRef = useRef(chatMessages.length);

  // Draggable Floating Chat Bubble (FAB) state & pointer handlers
  const [fabPosition, setFabPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingFab, setIsDraggingFab] = useState(false);
  const fabDragRef = useRef<{
    startX: number;
    startY: number;
    elemX: number;
    elemY: number;
    hasMoved: boolean;
  }>({ startX: 0, startY: 0, elemX: 0, elemY: 0, hasMoved: false });

  // Initialize and persist FAB position across reloads
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedPos = localStorage.getItem('watch_party_fab_position');
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const clampedX = Math.max(12, Math.min(window.innerWidth - 68, parsed.x));
          const clampedY = Math.max(12, Math.min(window.innerHeight - 68, parsed.y));
          setFabPosition({ x: clampedX, y: clampedY });
          return;
        }
      }
    } catch {}

    setFabPosition({
      x: window.innerWidth - 76,
      y: window.innerHeight - 76
    });

    const handleResize = () => {
      setFabPosition((prev) => {
        if (!prev) return null;
        return {
          x: Math.max(12, Math.min(window.innerWidth - 68, prev.x)),
          y: Math.max(12, Math.min(window.innerHeight - 68, prev.y))
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleFabPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const current = fabPosition || {
      x: window.innerWidth - 76,
      y: window.innerHeight - 76
    };
    fabDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      elemX: current.x,
      elemY: current.y,
      hasMoved: false
    };
    setIsDraggingFab(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleFabPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingFab) return;
    const dx = e.clientX - fabDragRef.current.startX;
    const dy = e.clientY - fabDragRef.current.startY;
    if (!fabDragRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
      fabDragRef.current.hasMoved = true;
    }
    if (fabDragRef.current.hasMoved) {
      const newX = Math.max(12, Math.min(window.innerWidth - 68, fabDragRef.current.elemX + dx));
      const newY = Math.max(12, Math.min(window.innerHeight - 68, fabDragRef.current.elemY + dy));
      setFabPosition({ x: newX, y: newY });
    }
  };

  const handleFabPointerUp = (e: React.PointerEvent) => {
    if (!isDraggingFab) return;
    setIsDraggingFab(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    if (fabDragRef.current.hasMoved && fabPosition) {
      try {
        localStorage.setItem('watch_party_fab_position', JSON.stringify(fabPosition));
      } catch {}
    }
  };

  const handleFabClick = (e: React.MouseEvent) => {
    if (fabDragRef.current.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setIsChatOpen((prev) => !prev);
  };

  // Auto-scroll chat to bottom only when a new message arrives and user isn't reading history
  useEffect(() => {
    if (chatMessages.length > prevMessagesCountRef.current) {
      if (isChatOpen && activeSideTab === 'chat' && !isUserScrolledUpRef.current && chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [chatMessages.length, isChatOpen, activeSideTab]);

  // Unread messages tracking & popup preview toast when chat bubble is collapsed
  useEffect(() => {
    if (chatMessages.length > prevMessagesCountRef.current) {
      const newMessages = chatMessages.slice(prevMessagesCountRef.current);
      const latestFromOther = [...newMessages].reverse().find((m) => m.userId !== myUserId);
      if (!isChatOpen && latestFromOther) {
        setUnreadCount((prev) => prev + (chatMessages.length - prevMessagesCountRef.current));
        const stickerObj = parseStickerMessage(latestFromOther.content);
        setChatBubbleToast({
          sender: latestFromOther.userName || 'Member',
          text: stickerObj ? `Sent sticker: ${stickerObj.emoji || '✨'} ${stickerObj.tagline}` : (latestFromOther.content || '')
        });
        const timer = setTimeout(() => {
          setChatBubbleToast(null);
        }, 4000);
        return () => clearTimeout(timer);
      }
    }
    prevMessagesCountRef.current = chatMessages.length;
  }, [chatMessages, isChatOpen, myUserId]);

  // Reset unread count when chat bubble is opened
  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
      setChatBubbleToast(null);
    }
  }, [isChatOpen]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('watch_party_theme_id');
      if (saved && ROOM_THEMES.some((t) => t.id === saved)) {
        setSelectedTheme(saved);
      }
    }
  }, []);

  // Synchronize room theme in real time for everyone in the room
  useEffect(() => {
    if (room?.themeId && ROOM_THEMES.some((t) => t.id === room.themeId)) {
      setSelectedTheme(room.themeId);
    }
  }, [room?.themeId]);

  const handleSelectTheme = (themeId: string) => {
    setSelectedTheme(themeId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('watch_party_theme_id', themeId);
    }
    // Broadcast theme update to all connected users in this room
    sendRoomTheme(themeId);
  };

  const currentTheme = useMemo(() => {
    return ROOM_THEMES.find((t) => t.id === selectedTheme) || ROOM_THEMES[0];
  }, [selectedTheme]);

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
    const interval = setInterval(recordHistory, 20000);
    return () => clearInterval(interval);
  }, [room, getAuthoritativePosition]);

  const isHost = myRole === 'HOST' || myRole === 'CO_HOST';
  const currentPos = getAuthoritativePosition();
  
  // Only consider active, connected members (never stale disconnected sessions)
  const activeMembers = members.filter((m) => m.isConnected !== false);
  const selfMember = activeMembers.find((m) => m.userId === myUserId);
  const selfDisplayName = selfMember?.displayName || 'You';

  // Friend streak celebration state
  const [streakCelebration, setStreakCelebration] = useState<{
    friendName: string;
    streakCount: number;
    isExtended: boolean;
  } | null>(null);
  const recordedStreaksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const session = getStoredSession();
    if (!session?.token || activeMembers.length < 2) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const otherMembers = activeMembers.filter((m) => m.userId !== myUserId);

    for (const other of otherMembers) {
      const pairKey = `${other.userId}_${todayStr}`;
      if (recordedStreaksRef.current.has(pairKey)) continue;
      recordedStreaksRef.current.add(pairKey);

      recordFriendStreak(session.token, other.userId, 1)
        .then((res) => {
          if (res.success && (res.status === 'EXTENDED' || res.status === 'RESET_STARTED')) {
            setStreakCelebration({
              friendName: other.displayName || 'Friend',
              streakCount: res.streak.currentStreak,
              isExtended: res.status === 'EXTENDED'
            });
          }
        })
        .catch(() => {
          // Silently ignore if member is not on friends list
        });
    }
  }, [activeMembers, myUserId]);

  // 🛡️ Knock-to-Join: Socket listener for join requests and host admission
  useEffect(() => {
    const unregister = registerGameListener((senderId, payload) => {
      if (!payload) return;

      // When guest requests to join
      if (payload.action === 'KNOCK_JOIN_REQUEST') {
        if (isHost && payload.userId !== myUserId) {
          setPendingJoinRequests((prev) => {
            if (prev.some((r) => r.userId === payload.userId)) return prev;
            return [
              ...prev,
              {
                userId: payload.userId,
                displayName: payload.displayName || 'Guest',
                avatarUrl: payload.avatarUrl,
                timestamp: Date.now()
              }
            ];
          });
        }
      }

      // When host approves guest
      if (payload.action === 'KNOCK_JOIN_APPROVED') {
        if (payload.targetUserId === myUserId) {
          setIsAdmitted(true);
          setIsRejected(false);
          if (typeof window !== 'undefined') {
            localStorage.setItem(`room_admitted_${slug}`, 'true');
          }
        }
      }

      // When host declines guest
      if (payload.action === 'KNOCK_JOIN_DECLINED') {
        if (payload.targetUserId === myUserId) {
          setIsRejected(true);
        }
      }
    });

    return unregister;
  }, [registerGameListener, isHost, myUserId, slug]);

  // Non-host sends knock request if room is PRIVATE and not yet admitted
  useEffect(() => {
    if (!room || isHost || isAdmitted || isRejected) return;
    const isPrivate = room.privacy === 'PRIVATE' || (typeof window !== 'undefined' && localStorage.getItem('synccinema_custom_privacy') === 'PRIVATE');
    if (!isPrivate) return;

    // Send knock request after a slight delay to ensure socket readiness
    const timer = setTimeout(() => {
      sendGameAction({
        action: 'KNOCK_JOIN_REQUEST',
        userId: myUserId,
        displayName: selfDisplayName,
        avatarUrl: selfMember?.avatarUrl || getStoredSession()?.user?.avatarUrl
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [room, isHost, isAdmitted, isRejected, myUserId, selfDisplayName, selfMember?.avatarUrl, sendGameAction]);

  const handleApproveGuest = (targetUserId: string) => {
    setPendingJoinRequests((prev) => prev.filter((r) => r.userId !== targetUserId));
    sendGameAction({
      action: 'KNOCK_JOIN_APPROVED',
      targetUserId
    });
  };

  const handleDeclineGuest = (targetUserId: string) => {
    setPendingJoinRequests((prev) => prev.filter((r) => r.userId !== targetUserId));
    sendGameAction({
      action: 'KNOCK_JOIN_DECLINED',
      targetUserId
    });
  };

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
  const gridParticipants = useMemo(() => {
    return activeMembers.map((member) => {
      const isSelf = member.userId === myUserId;
      const rtcParticipant = videoGridParticipants.find((p) => p.userId === member.userId || (isSelf && p.isSelf));
      const selfStream = localUserStream;
      const peerStream = rtcParticipant?.stream || null;
      const stream = isSelf ? selfStream : peerStream;

      const cameraFlag = isSelf ? isCameraOn : remoteCameraStates.get(member.userId);
      const hasLiveVideoTrack = Boolean(
        stream &&
        stream.getVideoTracks().length > 0 &&
        stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live' && !t.muted)
      );

      const peerCameraOn = isSelf
        ? isCameraOn
        : (cameraFlag === true || (cameraFlag !== false && hasLiveVideoTrack));

      return {
        userId: member.userId,
        displayName: isSelf ? `${member.displayName}` : member.displayName,
        stream,
        isCameraOn: peerCameraOn,
        isMuted: isSelf ? isMicMuted : (rtcParticipant?.isMuted ?? member.isMuted ?? false),
        isSpeaking: rtcParticipant?.isSpeaking ?? false,
        isSelf,
        isHost: member.userId === room?.hostId
      };
    });
  }, [activeMembers, myUserId, videoGridParticipants, localUserStream, isCameraOn, remoteCameraStates, isMicMuted, room?.hostId]);

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

  // 🛡️ Knock-to-Join Gate: Check if user is guest in a PRIVATE room and not yet admitted
  const isRoomPrivate = room.privacy === 'PRIVATE' || (typeof window !== 'undefined' && localStorage.getItem('synccinema_custom_privacy') === 'PRIVATE');
  const hostMember = members.find((m) => m.userId === room.hostId);
  const hostDisplayName = hostMember?.displayName || 'The Host';

  if (isRoomPrivate && !isHost && !isAdmitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[#080a11] text-white relative overflow-hidden select-none">
        {/* Ambient background glow */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-rose-600/15 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-md w-full bg-[#11141f]/90 border border-white/15 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] flex flex-col items-center text-center space-y-6 relative z-10 animate-in fade-in zoom-in-95 duration-300">
          {/* Animated Radar Shield Icon */}
          <div className="relative flex items-center justify-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 via-rose-600 to-amber-500 p-0.5 shadow-xl shadow-indigo-600/30">
              <div className="w-full h-full bg-[#0d1017] rounded-[22px] flex items-center justify-center">
                {isRejected ? (
                  <UserX className="w-9 h-9 text-rose-400" />
                ) : (
                  <Shield className="w-9 h-9 text-indigo-400 animate-pulse" />
                )}
              </div>
            </div>
            {!isRejected && (
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-[#11141f]" />
              </span>
            )}
          </div>

          {/* Room Title & Status */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-amber-300 font-semibold tracking-wide">
              <span>🍿 Virtual Cinema Gate</span>
              <span>•</span>
              <span>Private Room</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {room.title || '🍿 Friday Movie Night'}
            </h1>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              {isRejected
                ? 'The host declined admission to this private screening.'
                : `Waiting for host (${hostDisplayName}) to admit you into the cinema...`}
            </p>
          </div>

          {/* User Details card */}
          <div className="w-full p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-rose-500 flex items-center justify-center text-sm font-black text-white shadow">
              {selfDisplayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-white block truncate">{selfDisplayName}</span>
              <span className="text-[10px] text-zinc-400 block truncate">
                {isRejected ? 'Admission Declined' : 'Request sent to host'}
              </span>
            </div>
            {!isRejected && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[10px] font-semibold">Knocked</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="w-full flex items-center gap-3 pt-1">
            {!isRejected ? (
              <button
                type="button"
                onClick={() => {
                  sendGameAction({
                    action: 'KNOCK_JOIN_REQUEST',
                    userId: myUserId,
                    displayName: selfDisplayName,
                    avatarUrl: selfMember?.avatarUrl || getStoredSession()?.user?.avatarUrl
                  });
                }}
                className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl transition border border-white/10 active:scale-95 cursor-pointer"
              >
                Knock Again
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                leaveRoom();
                router.push('/');
              }}
              className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-red-600/30 active:scale-95 cursor-pointer"
            >
              Exit to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen flex flex-col bg-[#0b0e17] text-slate-100 selection:bg-rose-500 selection:text-white overflow-hidden p-3 lg:p-4 relative">
      {/* Dynamic Theme Background & Realistic Ambient Animations */}
      {currentTheme.bgUrl ? (
        <>
          <div
            className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat transition-all duration-700 opacity-90"
            style={{
              backgroundImage: `url('${currentTheme.bgUrl}')`
            }}
          />
          {/* Live Animated Candle Flames, Warm Ambient Halos & Embers */}
          <DynamicThemeEffects themeId={selectedTheme} />

          {/* Ambient cinema tint & glass vignette */}
          <div className="fixed inset-0 pointer-events-none z-0 bg-black/40 backdrop-blur-[1px]" />
        </>
      ) : (
        <div className={`fixed inset-0 pointer-events-none z-0 bg-gradient-to-br ${currentTheme.gradient || 'from-[#0b0e17] via-[#0d121f] to-[#08070d]'}`} />
      )}

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        {/* Top Header Bar: Branding, Room Title, Seats Count, Theme, Invite Link & Dedicated Red Leave Button */}
        <div className="flex-shrink-0 flex items-center justify-between pb-2 px-1 gap-1 sm:gap-2">
          {/* Left: Branding & Room Title */}
          <div className="flex items-center space-x-1.5 sm:space-x-3 min-w-0">
            <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
              <div className="flex flex-col leading-none">
                <span className="text-sm sm:text-lg font-black tracking-tighter text-[#E50914] select-none">watch.</span>
                <span className="text-[6.5px] sm:text-[7.5px] font-semibold tracking-wider text-zinc-400/80 uppercase select-none mt-0.5 hidden xs:inline">stitchbyte</span>
              </div>
              <span className="text-zinc-600 text-xs hidden sm:inline">/</span>
              <span className="text-[11px] sm:text-sm font-semibold text-white tracking-wide truncate max-w-[80px] xs:max-w-[120px] sm:max-w-[280px]">
                {room.title || 'Watch Party'}
              </span>
            </div>

            <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[11px] text-zinc-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{Math.min(6, activeMembers.length)}/6 connected</span>
            </div>
          </div>

          {/* Right: Round Action Button Dock */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Mic Toggle */}
            <button
              onClick={toggleMic}
              className={`w-7.5 h-7.5 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition border ${
                isMicMuted
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-white/10 text-white border-white/10 hover:bg-white/20'
              }`}
              title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMicMuted ? <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>

            {/* Video Toggle */}
            <button
              onClick={toggleCamera}
              className={`w-7.5 h-7.5 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition border ${
                !isCameraOn
                  ? 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/15'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
              }`}
              title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {isCameraOn ? <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <VideoOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>

            {/* Chat Bubble Toggle Button with active highlight ring */}
            <button
              onClick={() => setIsChatOpen((prev) => !prev)}
              className={`w-7.5 h-7.5 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition border relative active:scale-95 ${
                isChatOpen
                  ? 'bg-rose-600/30 text-rose-300 border-rose-500 ring-2 ring-rose-500/50 shadow-md shadow-rose-600/30'
                  : 'bg-white/10 text-white border-white/10 hover:bg-white/20'
              }`}
              title={isChatOpen ? 'Close Chat' : 'Open Chat'}
            >
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {unreadCount > 0 && !isChatOpen && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full text-[8px] sm:text-[9px] font-black bg-amber-400 text-black flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Theme Selector */}
            <button
              onClick={() => setShowThemeModal(true)}
              className="w-7.5 h-7.5 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 text-amber-400 border border-white/10 flex items-center justify-center transition active:scale-95"
              title="Room Themes"
            >
              <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Invite Friends */}
            <button
              onClick={handleCopyInvite}
              className="w-7.5 h-7.5 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 flex items-center justify-center transition active:scale-95"
              title="Copy Room Link"
            >
              {copiedInvite ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>

            {/* Dedicated Red Leave Button */}
            <button
              onClick={handleLeaveRoom}
              className="w-7.5 h-7.5 sm:w-auto px-0 sm:px-3.5 h-7.5 sm:h-9 bg-[#E50914] hover:bg-red-600 text-white text-xs font-bold rounded-full transition shadow-md shadow-red-600/30 flex items-center justify-center space-x-1.5 active:scale-95"
              title="Leave Room"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>

      {/* 🛡️ Knock-to-Join Admission Banner for Host */}
      {isHost && pendingJoinRequests.length > 0 && (
        <div className="mb-2.5 p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-purple-500/20 border border-amber-500/30 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl animate-in slide-in-from-top-2 duration-200 flex-shrink-0">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-9 h-9 rounded-xl bg-amber-500/30 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
              <Shield className="w-5 h-5 animate-pulse" />
            </div>
            <div className="text-left min-w-0">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{pendingJoinRequests[0].displayName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-semibold">
                  Knock-to-Join
                </span>
              </span>
              <p className="text-[11px] text-zinc-300 truncate">
                Requests to enter your private cinema ({pendingJoinRequests.length} waiting)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => handleApproveGuest(pendingJoinRequests[0].userId)}
              className="flex-1 sm:flex-none px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Admit</span>
            </button>
            <button
              onClick={() => handleDeclineGuest(pendingJoinRequests[0].userId)}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white font-medium text-xs rounded-xl transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Decline</span>
            </button>
          </div>
        </div>
      )}

      {/* Reconnection Alert Banner */}
      {connectionStatus === 'RECONNECTING' && (
        <div className="bg-amber-500/20 border border-amber-500/30 mb-2 px-4 py-1.5 rounded-xl text-center text-xs text-amber-300 font-medium flex items-center justify-center space-x-2 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Reconnecting to session...</span>
        </div>
      )}

      {/* Media Notice Banner (Camera/Mic status or permissions) */}
      {mediaNotice && (
        <div className="bg-indigo-500/20 border border-indigo-500/30 mb-2 px-4 py-1.5 rounded-xl text-center text-xs text-indigo-200 font-medium flex items-center justify-between space-x-2 flex-shrink-0 shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span>{mediaNotice}</span>
          </div>
          <button
            onClick={clearMediaNotice}
            className="text-xs text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-white/10 transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* Background WebRTC Audio for Peers */}
      <div className="hidden pointer-events-none" aria-hidden="true">
        {videoGridParticipants
          .filter((p) => !p.isSelf && p.stream)
          .map((p) => (
            <AudioSink key={p.userId} stream={p.stream} />
          ))}
      </div>

      {/* Main Cinema & Chat Layout matching media_1788954723120.png */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 overflow-hidden min-h-0">
        {/* Left/Main Column: Top Horizontal Video Strip (up to 6 participants like Google Meet) + Cinema Player Stage */}
        <div className="flex-1 flex flex-col min-w-0 h-full gap-2.5 overflow-hidden">
          {/* 1. Top Horizontal Participant Strip (Google Meet style camera & avatar preview) */}
          <div className="flex-shrink-0 w-full">
            <VideoGrid
              participants={gridParticipants.slice(0, 6)}
              onCopyInvite={handleCopyInvite}
              copiedInvite={copiedInvite}
              onToggleSelfCamera={toggleCamera}
              onToggleSelfMic={toggleMic}
            />
          </div>

          {/* 2. Cinema Theater Player Stage with embedded call controls dock */}
          <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
            <div className="w-full max-w-4xl h-full relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black flex flex-col transition-all duration-300">
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
                userAvatarUrl={selfMember?.avatarUrl || getStoredSession()?.user?.avatarUrl || undefined}
                userName={selfDisplayName}
                participants={gridParticipants}
                latestReactions={latestReactions}
                onSendReaction={(emoji: string, timestamp?: number) => {
                  const code =
                    emoji === '❤️' ? 'heart' :
                    emoji === '😂' ? 'joy' :
                    emoji === '🔥' ? 'fire' :
                    emoji === '👏' ? 'clap' :
                    emoji === '🎉' ? 'party' :
                    emoji === '🎲' ? 'dice' :
                    emoji === '🥳' ? 'celebrate' :
                    emoji === '🥺' ? 'pleading' : 'emoji';
                  sendReaction(code, emoji, timestamp ?? getAuthoritativePosition());
                }}
                onCopyInvite={handleCopyInvite}
                copiedInvite={copiedInvite}
                isTheaterMode={isTheaterMode}
                onTheaterModeChange={setIsTheaterMode}
                isChatOpen={isChatOpen}
                onToggleChat={() => setIsChatOpen((prev) => !prev)}
                unreadCount={unreadCount}
              />
              <FloatingReactionsCanvas latestReactions={latestReactions} />
            </div>
          </div>
        </div>

        {/* Right Column: Game Chat & Controls Window */}
        {isChatOpen && (
          <div
            className={
              isTheaterMode
                ? 'fixed right-3 top-3 bottom-3 z-[60] w-80 sm:w-96 bg-[#1c0c16]/95 border border-rose-500/30 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col backdrop-blur-2xl transition-all duration-300 animate-in fade-in slide-in-from-right-4 min-h-0'
                : 'fixed inset-x-3 bottom-3 top-16 z-[60] lg:relative lg:inset-auto lg:top-auto lg:bottom-auto w-auto lg:w-80 xl:w-96 shrink-0 bg-[#1c0c16]/95 lg:bg-[#1c0c16]/60 border border-rose-500/30 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col h-[calc(100vh-80px)] lg:h-full backdrop-blur-2xl lg:backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 lg:slide-in-from-right-4 min-h-0'
            }
          >
            {/* Header */}
            <div className="pb-3 border-b border-rose-500/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-white">
                  {activeSideTab === 'chat'
                    ? 'Game Chat'
                    : activeSideTab === 'games'
                    ? 'Party Games'
                    : activeSideTab === 'call'
                    ? 'In-Game Call'
                    : 'Players'}
                </span>
              </div>

              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
                title="Close Drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs: Chat | Games | Call | Players */}
            <div className="flex items-center gap-1.5 mt-2 border-b border-rose-500/20 pb-2 shrink-0">
              <button
                onClick={() => setActiveSideTab('chat')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 relative ${
                  activeSideTab === 'chat'
                    ? 'text-rose-300 font-extrabold after:absolute after:bottom-[-9px] after:left-1/4 after:right-1/4 after:h-0.5 after:bg-rose-400'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
              </button>

              <button
                onClick={() => setActiveSideTab('games')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 relative ${
                  activeSideTab === 'games'
                    ? 'text-rose-300 font-extrabold after:absolute after:bottom-[-9px] after:left-1/4 after:right-1/4 after:h-0.5 after:bg-rose-400'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>Games</span>
                <span className="ml-0.5 px-1 py-0.2 rounded-full text-[8px] font-bold bg-amber-400/20 text-amber-300">
                  LIVE
                </span>
              </button>

              <button
                onClick={() => setActiveSideTab('call')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 relative ${
                  activeSideTab === 'call'
                    ? 'text-rose-300 font-extrabold after:absolute after:bottom-[-9px] after:left-1/4 after:right-1/4 after:h-0.5 after:bg-rose-400'
                    : isCameraOn || !isMicMuted
                    ? 'text-emerald-300 hover:text-emerald-200'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Call {(isCameraOn || videoGridParticipants.some(p => p.isCameraOn)) ? '🔴' : ''}</span>
              </button>

              <button
                onClick={() => setActiveSideTab('players')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 relative ${
                  activeSideTab === 'players'
                    ? 'text-rose-300 font-extrabold after:absolute after:bottom-[-9px] after:left-1/4 after:right-1/4 after:h-0.5 after:bg-rose-400'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Players</span>
              </button>
            </div>

            {/* Tab 1: Chat Stream matching media_1788953825116.png */}
            {activeSideTab === 'chat' && (
              <>
                <div
                  ref={chatContainerRef}
                  onScroll={handleChatScroll}
                  className="flex-1 overflow-y-auto space-y-3 py-2.5 px-2 text-xs min-h-0 scrollbar-none"
                >
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-rose-300/60 py-12 select-none">
                      <Heart className="w-8 h-8 mb-2 text-rose-500/40 animate-pulse" />
                      <p className="text-xs font-medium">Say something sweet or cheer a move!</p>
                    </div>
                  ) : (
                    chatMessages.map(m => {
                      const isMe = m.userId === myUserId;
                      const isSticker = parseStickerMessage(m.content);
                      const isHighlighted = highlightedMsgId === m.id;
                      return (
                        <div
                          key={m.id}
                          id={`chat-msg-${m.id}`}
                          className={`group relative flex items-start gap-2.5 transition-all duration-300 rounded-2xl p-1.5 my-0.5 ${
                            isMe ? 'flex-row-reverse' : ''
                          } ${
                            isHighlighted ? 'ring-2 ring-inset ring-rose-500/80 bg-rose-500/15 shadow-[0_0_15px_rgba(244,63,94,0.35)]' : ''
                          }`}
                        >
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 text-white font-bold text-xs flex items-center justify-center shadow shrink-0">
                            {m.userName ? m.userName[0]?.toUpperCase() : 'U'}
                          </div>
                          <div className={`flex-1 min-w-0 ${isMe ? 'items-end flex flex-col' : ''}`}>
                            <div className="flex items-center justify-between mb-0.5 w-full">
                              <span className="text-[11px] font-bold text-rose-200 truncate">
                                {isMe ? `${m.userName} (You)` : m.userName}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0 ml-1">
                                <span className="text-[9px] text-zinc-500 font-mono">
                                  {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                                {/* Reply action button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingTo({ id: m.id, userName: m.userName, content: m.content });
                                    chatInputRef.current?.focus({ preventScroll: true });
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                                  title="Reply to this message"
                                >
                                  <CornerUpLeft className="w-3 h-3 text-rose-300" />
                                </button>
                              </div>
                            </div>

                            {/* Quoted reply card if replying to another message */}
                            {m.replyTo && (
                              <ChatReplyQuote
                                replyTo={m.replyTo}
                                onJumpToMessage={handleJumpToMessage}
                                accentColor="rose"
                              />
                            )}

                            {isSticker ? (
                              <StickerMessageView content={m.content} />
                            ) : (
                              <div className="p-2.5 rounded-2xl bg-black/35 border border-white/10 text-rose-100 text-xs break-words backdrop-blur-sm">
                                {m.content}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Quick Reactions & Quick Chat Phrases */}
                <div className="pt-2 pb-1 space-y-2 border-t border-rose-500/20 shrink-0">
                  {/* Emoji Reactions Row */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {['❤️', '😂', '🔥', '👏', '🎉', '🎲', '🥳', '🥺'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleReact('emoji', emoji)}
                        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-rose-500/20 active:scale-95 transition-all text-base shrink-0 border border-white/10 hover:border-rose-400/40 flex items-center justify-center shadow-sm"
                        title={`React with ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <RoomChatInputBar
                    replyingTo={replyingTo}
                    onClearReply={handleClearReply}
                    onSendMessage={handleSendChatMessage}
                    chatInputRef={chatInputRef}
                    chatContainerRef={chatContainerRef}
                    isUserScrolledUpRef={isUserScrolledUpRef}
                  />
                </div>
              </>
            )}

            {/* Tab 2: Party Games */}
            {activeSideTab === 'games' && (
              <div className="flex-1 min-h-0 overflow-hidden py-2">
                <GameLounge
                  roomId={room?.id || slug}
                  myUserId={myUserId}
                  myUserName={activeMembers.find((m) => m.userId === myUserId)?.displayName || 'Player'}
                  members={activeMembers}
                  sendGameAction={sendGameAction}
                  registerGameListener={registerGameListener}
                  isCompact={true}
                />
              </div>
            )}

            {/* Tab 3: Call Tab */}
            {activeSideTab === 'call' && (
              <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs">
                <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-pink-500/10 border border-amber-500/20 text-center">
                  <p className="text-white font-bold text-xs mb-0.5">Live Room Video Call</p>
                  <p className="text-[11px] text-zinc-300">
                    {isCameraOn ? '📹 Your camera is on' : '📷 Camera is off'} • {isMicMuted ? '🔇 Mic muted' : '🎙️ Mic unmuted'}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3 py-2">
                  <button
                    onClick={toggleMic}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      isMicMuted ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>{isMicMuted ? 'Unmute' : 'Mute'}</span>
                  </button>

                  <button
                    onClick={toggleCamera}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      !isCameraOn ? 'bg-white/10 text-zinc-300 border border-white/10' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                    <span>{isCameraOn ? 'Camera On' : 'Camera Off'}</span>
                  </button>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Active Participants ({activeMembers.length})
                  </span>
                  {activeMembers.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center">
                          {m.displayName ? m.displayName[0]?.toUpperCase() : 'M'}
                        </div>
                        <span className="text-xs text-zinc-200">{m.displayName} {m.userId === myUserId ? '(You)' : ''}</span>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 4: Players Tab */}
            {activeSideTab === 'players' && (
              <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <span className="text-xs font-bold text-zinc-300">{activeMembers.length} Members in Room</span>
                  <button
                    onClick={handleCopyInvite}
                    className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[11px] font-medium flex items-center gap-1 transition"
                  >
                    {copiedInvite ? <Check className="w-3 h-3 text-emerald-400" /> : <Share2 className="w-3 h-3" />}
                    <span>{copiedInvite ? 'Copied' : 'Invite'}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {activeMembers.map((m) => {
                    const isSelf = m.userId === myUserId;
                    return (
                      <div key={m.userId} className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 text-white font-bold text-xs flex items-center justify-center shadow">
                            {m.displayName ? m.displayName[0]?.toUpperCase() : 'M'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white">{m.displayName}</span>
                              {m.role === 'HOST' && (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  HOST
                                </span>
                              )}
                              {isSelf && (
                                <span className="text-[10px] text-zinc-400 font-medium">(You)</span>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-400">Online</span>
                          </div>
                        </div>

                        {isHost && !isSelf && (
                          <button
                            onClick={() => transferHost(m.userId)}
                            className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 transition"
                          >
                            Pass Host
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Floating Chat Bubble Launcher (Draggable FAB) */}
      <div
        style={
          fabPosition
            ? {
                left: `${fabPosition.x}px`,
                top: `${fabPosition.y}px`,
                right: 'auto',
                bottom: 'auto'
              }
            : {
                right: '20px',
                bottom: '20px'
              }
        }
        className={`fixed ${isTheaterMode ? 'z-[60]' : 'z-40'} flex items-center gap-2 pointer-events-auto touch-none select-none ${
          fabPosition && fabPosition.x < 260 ? 'flex-row-reverse' : 'flex-row'
        } ${isDraggingFab ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        {/* Real-time unread message preview toast */}
        {!isChatOpen && chatBubbleToast && (
          <div
            onClick={() => setIsChatOpen(true)}
            className="cursor-pointer max-w-[220px] sm:max-w-xs bg-[#141721]/95 backdrop-blur-md text-white text-xs px-3.5 py-2 rounded-2xl shadow-2xl border border-white/20 animate-bounce flex items-center gap-2 hover:border-rose-500/50 transition-all select-none"
          >
            <div className="w-2 h-2 rounded-full bg-[#E50914] animate-ping shrink-0" />
            <div className="truncate">
              <span className="font-bold text-rose-400">{chatBubbleToast.sender}: </span>
              <span className="text-zinc-200">{chatBubbleToast.text}</span>
            </div>
          </div>
        )}

        {/* Floating Bubble Button */}
        <button
          onPointerDown={handleFabPointerDown}
          onPointerMove={handleFabPointerMove}
          onPointerUp={handleFabPointerUp}
          onPointerCancel={handleFabPointerUp}
          onClick={handleFabClick}
          className={`group relative flex items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-full shadow-2xl border ${
            isDraggingFab
              ? 'scale-105 shadow-red-600/60 ring-2 ring-white/50 cursor-grabbing transition-none'
              : 'cursor-grab hover:scale-105 transition-transform duration-200'
          } ${
            isChatOpen
              ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-white/20'
              : 'bg-gradient-to-tr from-[#E50914] to-rose-600 hover:from-red-600 hover:to-rose-500 text-white border-red-500/30 shadow-red-600/40'
          }`}
          title={isChatOpen ? 'Minimize chat (drag anywhere on screen)' : 'Open chat & games (drag anywhere on screen)'}
        >
          {isChatOpen ? (
            <X className="w-6 h-6 transition-transform group-hover:rotate-90 duration-200 pointer-events-none" />
          ) : (
            <>
              <MessageSquare className="w-6 h-6 pointer-events-none" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 text-black font-extrabold text-[10px] rounded-full flex items-center justify-center border-2 border-[#0b0e17] shadow-md animate-pulse pointer-events-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* Room Theme Selector Modal */}
      {showThemeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#121622] max-w-md w-full rounded-2xl border border-[#1e2538] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-white">
                <Palette className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold">Room Theme</h3>
              </div>
              <button
                onClick={() => setShowThemeModal(false)}
                className="p-1 rounded-xl bg-white/5 text-zinc-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Personalize your watch party atmosphere. Your selection updates in real time and is saved for future visits:
            </p>

            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1 scrollbar-none">
              {ROOM_THEMES.map((theme) => {
                const isSelected = selectedTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleSelectTheme(theme.id)}
                    className={`group relative rounded-xl overflow-hidden border-2 transition-all flex flex-col items-center shadow-lg text-left ${
                      isSelected
                        ? 'border-rose-500 ring-2 ring-rose-500/40 scale-[1.02]'
                        : 'border-white/10 hover:border-white/30 hover:scale-[1.01]'
                    }`}
                  >
                    <div className="w-full h-24 relative overflow-hidden bg-black/50">
                      {theme.bgUrl ? (
                        <img
                          src={theme.bgUrl}
                          alt={theme.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div
                          className={`w-full h-full bg-gradient-to-br ${
                            theme.gradient || 'from-[#0b0e17] to-[#121622]'
                          } flex flex-col items-center justify-center p-2 text-center`}
                        >
                          <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                            Cinema Dark
                          </span>
                          <span className="text-[9px] text-zinc-500 mt-0.5">Classic View</span>
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className="w-full py-1.5 px-2 bg-[#171b29] text-[11px] font-bold text-white text-center truncate">
                      {theme.name}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setShowThemeModal(false)}
                className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-xs font-bold text-white rounded-xl shadow-lg transition active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Snapchat-Style Friend Streak Celebration Modal */}
      {streakCelebration && (
        <StreakCelebrationModal
          isOpen={!!streakCelebration}
          onClose={() => setStreakCelebration(null)}
          friendName={streakCelebration.friendName}
          streakCount={streakCelebration.streakCount}
          isExtended={streakCelebration.isExtended}
        />
      )}
    </div>
  );
}
