'use client';
import React, { useState, useEffect } from 'react';
import { Phone, Video } from 'lucide-react';
import { getStoredSession } from '@/lib/api';
import {
  ChatConversation,
  ChatUser,
  ChatMessage,
  ChatPlanPayload,
  ChatGamePayload,
  ChatMoviePayload,
  ChatMessageRequest,
  ChatMessageMetadata,
} from '@/types/chat';
import { ChatStore } from '@/lib/chatStore';
import { ChatSidebar } from './ChatSidebar';
import { ConversationHeader } from './ConversationHeader';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { FriendProfileSheet } from './FriendProfileSheet';
import { CreateGroupModal } from './CreateGroupModal';
import { ChatSearchModal } from './ChatSearchModal';
import { ModalPortal } from './ModalPortal';

export const ChatLayout: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const currentUserId = session?.user?.id || 'current-user';

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [users, setUsers] = useState<Record<string, ChatUser>>({});
  const [requests, setRequests] = useState<ChatMessageRequest[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Active call modal simulation
  const [activeCall, setActiveCall] = useState<{
    type: 'voice' | 'video';
    user: ChatUser;
    duration: number;
  } | null>(null);

  // Initialize store and subscribe
  useEffect(() => {
    const s = getStoredSession();
    if (s) setSession(s);

    ChatStore.initialize();
    const updateFromStore = () => {
      setConversations(ChatStore.getConversations());
      setUsers(ChatStore.getUsers());
      setRequests(ChatStore.getRequests());
    };

    updateFromStore();
    const unsubscribe = ChatStore.subscribe(updateFromStore);
    return () => {
      unsubscribe();
    };
  }, []);

  // Default to first conversation on larger screens if none selected
  useEffect(() => {
    if (!activeConversationId && conversations.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  const rawOtherUser = activeConversation?.participants?.find((p) => p && p.id !== currentUserId) || activeConversation?.participants?.[0];
  const otherUser = rawOtherUser ? (users[rawOtherUser.id] || rawOtherUser) : undefined;

  // Mark conversation as read and sync remote messages when opened
  useEffect(() => {
    if (activeConversationId) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('watch_active_conv_id', activeConversationId);
      }
      ChatStore.markAsRead(activeConversationId, otherUser?.id);
      ChatStore.fetchRemoteMessages(activeConversationId);
    } else {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('watch_active_conv_id');
      }
    }
  }, [activeConversationId, otherUser?.id]);

  // Periodic sync of remote messages for active conversation
  useEffect(() => {
    if (!activeConversationId) return;
    const interval = setInterval(() => {
      ChatStore.fetchRemoteMessages(activeConversationId);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeConversationId]);

  // Mark conversation as read when opened
  const handleSelectConversation = (conv: ChatConversation) => {
    setActiveConversationId(conv.id);
    const targetOther = conv.participants?.find((p) => p && p.id !== currentUserId) || conv.participants?.[0];
    ChatStore.markAsRead(conv.id, targetOther?.id);
    ChatStore.fetchRemoteMessages(conv.id);
  };

  const myName = session?.user?.displayName || 'You';
  const myAvatar = session?.user?.avatarUrl || undefined;

  const handleSendMessage = (
    content: string,
    type: 'text' | 'image' | 'sticker' | 'voice' = 'text',
    mediaUrl?: string,
    metadata?: ChatMessageMetadata
  ) => {
    if (!activeConversationId) return;

    ChatStore.sendMessage({
      conversationId: activeConversationId,
      senderId: currentUserId,
      senderName: myName,
      senderAvatar: myAvatar,
      content,
      type,
      mediaUrl,
      metadata,
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            senderName: replyingTo.senderName,
            content: replyingTo.content,
          }
        : undefined,
    });

    setReplyingTo(null);
  };

  const handleSendVoice = (duration: number, audioUrl?: string, waveform?: number[]) => {
    if (!activeConversationId) return;
    ChatStore.sendMessage({
      conversationId: activeConversationId,
      senderId: currentUserId,
      senderName: myName,
      senderAvatar: myAvatar,
      content: '🎤 Voice message',
      type: 'voice',
      mediaUrl: audioUrl,
      metadata: {
        voice: {
          duration,
          audioUrl,
          waveform: waveform || [30, 45, 75, 90, 60, 40, 80, 100, 70, 50, 65, 85, 45, 95, 60, 40, 70, 85, 60, 35, 50, 40],
        },
      },
    });
  };

  const handleSendPlan = (plan: ChatPlanPayload) => {
    if (!activeConversationId) return;
    ChatStore.sendMessage({
      conversationId: activeConversationId,
      senderId: currentUserId,
      senderName: myName,
      senderAvatar: myAvatar,
      content: `🍿 Created plan: ${plan.title}`,
      type: 'plan',
      metadata: { plan },
    });
  };

  const handleSendGame = (game: ChatGamePayload) => {
    if (!activeConversationId) return;
    ChatStore.sendMessage({
      conversationId: activeConversationId,
      senderId: currentUserId,
      senderName: myName,
      senderAvatar: myAvatar,
      content: `🎮 Invited to ${game.title || game.gameType}`,
      type: 'game_invite',
      metadata: { game },
    });
  };

  const handleSendMovie = (movie: ChatMoviePayload) => {
    if (!activeConversationId) return;
    ChatStore.sendMessage({
      conversationId: activeConversationId,
      senderId: currentUserId,
      senderName: myName,
      senderAvatar: myAvatar,
      content: `🎬 Shared movie: ${movie.title}`,
      type: 'movie_share',
      metadata: { movie },
    });
  };

  const handleReact = (messageId: string, emoji: string) => {
    if (!activeConversationId) return;
    ChatStore.toggleReaction(activeConversationId, messageId, emoji, currentUserId);
  };

  const handlePin = (messageId: string) => {
    if (!activeConversationId) return;
    ChatStore.togglePin(activeConversationId, messageId);
  };

  const handleDelete = (messageId: string) => {
    if (!activeConversationId) return;
    ChatStore.deleteMessage(activeConversationId, messageId);
  };

  const handleCreateGroup = (title: string, memberIds: string[]) => {
    const newConv = ChatStore.createGroupConversation(title, [currentUserId, ...memberIds]);
    setActiveConversationId(newConv.id);
  };

  const handleStartDirectChat = (targetUser: ChatUser) => {
    const conv = ChatStore.getOrCreateDirectConversation(targetUser);
    setActiveConversationId(conv.id);
  };

  const handleAcceptRequest = (requestId: string) => {
    ChatStore.acceptRequest(requestId);
  };

  const handleDeclineRequest = (requestId: string) => {
    ChatStore.declineRequest(requestId);
  };

  // Call simulation timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (activeCall) {
      timer = setInterval(() => {
        setActiveCall((prev) => (prev ? { ...prev, duration: prev.duration + 1 } : null));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeCall?.type]);

  const startCall = (type: 'voice' | 'video') => {
    if (otherUser) {
      setActiveCall({
        type,
        user: otherUser,
        duration: 0,
      });
    }
  };

  return (
    <div className="flex h-full w-full bg-[#F8F9FC] dark:bg-zinc-950 overflow-hidden relative font-sans antialiased">
      {/* Sidebar: Responsive show/hide on mobile */}
      <div
        className={`${
          activeConversationId ? 'hidden md:flex' : 'flex'
        } w-full md:w-80 lg:w-96 shrink-0 h-full`}
      >
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          users={users}
          currentUserId={currentUserId}
          requests={requests}
          onAcceptRequest={handleAcceptRequest}
          onDeclineRequest={handleDeclineRequest}
          onOpenCreateGroup={() => setShowCreateGroup(true)}
          onOpenSearchModal={() => setShowSearchModal(true)}
          onStartDirectChatWithUser={handleStartDirectChat}
        />
      </div>

      {/* Main Chat Area */}
      <div
        className={`${
          !activeConversationId ? 'hidden md:flex' : 'flex'
        } flex-1 flex-col h-full min-w-0 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-xs relative`}
      >
        {activeConversation ? (
          <>
            {/* Conversation Header */}
            <ConversationHeader
              conversation={activeConversation}
              otherUser={otherUser}
              onBack={() => setActiveConversationId(null)}
              onToggleProfile={() => setShowProfileSheet((prev) => !prev)}
              onStartVoiceCall={() => startCall('voice')}
              onStartVideoCall={() => startCall('video')}
              onOpenSearch={() => setShowSearchModal(true)}
            />

            {/* Messages Scroll Area */}
            <MessageList
              messages={activeConversation.messages || []}
              currentUserId={currentUserId}
              onReply={(msg) => setReplyingTo(msg)}
              onReact={handleReact}
              onDelete={handleDelete}
              onPin={handlePin}
            />

            {/* Input Composer */}
            <MessageComposer
              onSendMessage={handleSendMessage}
              onSendVoice={handleSendVoice}
              onSendPlan={handleSendPlan}
              onSendGame={handleSendGame}
              onSendMovie={handleSendMovie}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
            />
          </>
        ) : (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none">
            <div className="w-20 h-20 rounded-3xl bg-rose-500/10 text-[#ee1d49] flex items-center justify-center text-4xl mb-4 shadow-sm">
              💬
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Watch Chat
            </h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm mb-6">
              Connect with friends, send voice notes, plan movie nights, and challenge each other to games in real time.
            </p>

            <div className="flex flex-wrap gap-2 justify-center">
              <button
                type="button"
                onClick={() => setShowCreateGroup(true)}
                className="px-4 py-2 rounded-2xl bg-[#ee1d49] hover:bg-[#d61840] text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Create Group
              </button>
              <button
                type="button"
                onClick={() => setShowSearchModal(true)}
                className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold transition cursor-pointer"
              >
                Find Friends
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Drawer: Friend Profile Sheet */}
      {showProfileSheet && activeConversation && (
        <FriendProfileSheet
          conversation={activeConversation}
          user={otherUser}
          onClose={() => setShowProfileSheet(false)}
          onStartVoiceCall={() => startCall('voice')}
          onStartVideoCall={() => startCall('video')}
          onOpenCreatePlan={() => {
            setShowProfileSheet(false);
          }}
          onOpenInviteGame={() => {
            setShowProfileSheet(false);
          }}
        />
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <ModalPortal>
          <CreateGroupModal
            friends={Object.values(users).filter((u) => u.id !== currentUserId)}
            onClose={() => setShowCreateGroup(false)}
            onCreateGroup={handleCreateGroup}
          />
        </ModalPortal>
      )}

      {/* Global Chat Search Modal */}
      {showSearchModal && (
        <ModalPortal>
          <ChatSearchModal
            conversations={conversations}
            users={users}
            currentUserId={currentUserId}
            onClose={() => setShowSearchModal(false)}
            onSelectConversation={(conversationId) => {
              setActiveConversationId(conversationId);
              setShowSearchModal(false);
            }}
          />
        </ModalPortal>
      )}

      {/* Live Active Call Overlay Modal */}
      {activeCall && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 p-6 flex flex-col items-center text-center shadow-2xl animate-in zoom-in-95">
              <div className="relative mb-4">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center font-bold text-3xl text-zinc-300 ring-4 ring-[#ee1d49]/30">
                  {activeCall.user.avatar ? (
                    <img
                      src={activeCall.user.avatar}
                      alt={activeCall.user.displayName || activeCall.user.name || 'User'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (activeCall.user.displayName || activeCall.user.name || 'U').slice(0, 1).toUpperCase()
                  )}
                </div>
                <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 ring-4 ring-zinc-900 flex items-center justify-center">
                  {activeCall.type === 'video' ? (
                    <Video className="w-3 h-3 text-white" />
                  ) : (
                    <Phone className="w-3 h-3 text-white" />
                  )}
                </span>
              </div>

              <h3 className="text-lg font-bold text-white mb-1">
                {activeCall.user.displayName || activeCall.user.name}
              </h3>
              <p className="text-xs text-emerald-400 font-semibold mb-6 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  Connected · {Math.floor(activeCall.duration / 60)}:
                  {activeCall.duration % 60 < 10 ? '0' : ''}
                  {activeCall.duration % 60}
                </span>
              </p>

              {/* Simulated Video Placeholder */}
              {activeCall.type === 'video' && (
                <div className="w-full h-40 rounded-2xl bg-zinc-800/80 mb-6 flex items-center justify-center text-zinc-500 border border-zinc-700/60 overflow-hidden relative">
                  <Video className="w-8 h-8 opacity-40 animate-pulse" />
                  <span className="absolute bottom-2 left-2 text-[10px] bg-black/60 px-2 py-0.5 rounded-md text-white font-mono">
                    HD · 1080p
                  </span>
                </div>
              )}

              {/* End Call Button */}
              <button
                type="button"
                onClick={() => setActiveCall(null)}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer"
                title="End Call"
              >
                <Phone className="w-6 h-6 rotate-[135deg]" />
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
