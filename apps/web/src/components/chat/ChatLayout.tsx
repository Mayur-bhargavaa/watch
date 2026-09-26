'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { ChatStore, extractParticipantIdsFromConvId, toCanonicalConvId } from '@/lib/chatStore';
import { ChatSidebar } from './ChatSidebar';
import { ConversationHeader } from './ConversationHeader';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { FriendProfileSheet } from './FriendProfileSheet';
import { CreateGroupModal } from './CreateGroupModal';
import { ChatSearchModal } from './ChatSearchModal';
import { ForwardMessageModal } from './ForwardMessageModal';
import { ModalPortal } from './ModalPortal';
import { useCall } from '@/context/CallContext';

export const ChatLayout: React.FC = () => {
  const searchParams = useSearchParams();
  const urlUserId = searchParams.get('userId') || searchParams.get('u');
  const urlConvId = searchParams.get('c') || searchParams.get('convId');

  const [session, setSession] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      return getStoredSession();
    }
    return null;
  });
  const currentUserId = session?.user?.id || (typeof window !== 'undefined' ? getStoredSession()?.user?.id : '') || 'current-user';

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<Record<string, ChatUser>>({});
  const [requests, setRequests] = useState<ChatMessageRequest[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Ref keeps the latest activeConversationId accessible inside the subscription
  // callback without needing it in the useEffect dependency array.
  const activeConvRef = useRef<string | null>(null);
  useEffect(() => {
    activeConvRef.current = activeConversationId;
  }, [activeConversationId]);

  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Global Call Provider hook
  const { startCall } = useCall();

  // Initialize store and subscribe
  useEffect(() => {
    const s = getStoredSession();
    if (s) setSession(s);

    ChatStore.initialize();
    const updateFromStore = () => {
      setConversations(ChatStore.getConversations());
      setUsers(ChatStore.getUsers());
      setRequests(ChatStore.getRequests());
      // Use the ref to get the CURRENT activeConversationId, not the stale closure value
      const curActive = activeConvRef.current;
      if (curActive) {
        setMessages(ChatStore.getMessages(curActive));
      }
    };

    updateFromStore();
    const unsubscribe = ChatStore.subscribe(updateFromStore);
    return () => {
      unsubscribe();
    };
  }, []);

  // Sync activeConversationId from URL parameters if provided
  useEffect(() => {
    if (urlUserId) {
      const targetUser = users[urlUserId] || { id: urlUserId, displayName: 'Friend', onlineStatus: 'ONLINE' as const, isOnline: true };
      const conv = ChatStore.getOrCreateDirectConversation(targetUser);
      setActiveConversationId(conv.id);
    } else if (urlConvId) {
      setActiveConversationId(urlConvId);
    }
  }, [urlUserId, urlConvId, users]);

  const realMyId = session?.user?.id || (typeof window !== 'undefined' ? getStoredSession()?.user?.id : '') || currentUserId;

  const { userIds: activeUserIds, otherUserId: activeOtherId } = activeConversationId
    ? extractParticipantIdsFromConvId(activeConversationId, realMyId)
    : { userIds: [], otherUserId: undefined };
  const activeTargetUserId = activeOtherId || activeUserIds.find((id) => id && id !== realMyId && id !== 'current-user');
  const targetUserFromId = activeTargetUserId ? users[activeTargetUserId] : null;

  // Update messages and ensure active conversation exists in store whenever active conversation changes
  useEffect(() => {
    if (activeConversationId) {
      setMessages(ChatStore.getMessages(activeConversationId));
      if (targetUserFromId) {
        ChatStore.getOrCreateDirectConversation(targetUserFromId);
      }
    } else {
      setMessages([]);
    }
  }, [activeConversationId, targetUserFromId]);

  // Fix poisoned activeConversationId with 'current-user'
  useEffect(() => {
    if (activeConversationId && activeConversationId.includes('current-user') && currentUserId && currentUserId !== 'current-user') {
      const fixedId = activeConversationId.replace('current-user', currentUserId);
      setActiveConversationId(fixedId);
    }
  }, [activeConversationId, currentUserId]);

  // Default to first conversation on larger screens if none selected and no URL parameter provided
  useEffect(() => {
    if (!urlUserId && !urlConvId && !activeConversationId && conversations.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
      const firstConv = conversations[0];
      setActiveConversationId(firstConv.id);
    }
  }, [conversations, activeConversationId, urlUserId, urlConvId]);

  const activeConversation = conversations.find((c) => {
    if (!activeConversationId) return false;
    // 1. Direct ID match
    if (c.id === activeConversationId) return true;

    // 2. Extract partner target ID match
    if (activeTargetUserId && activeTargetUserId !== realMyId && activeTargetUserId !== 'current-user') {
      if (c.id.includes(activeTargetUserId) || c.participants?.some((p) => p && p.id === activeTargetUserId)) {
        return true;
      }
    }

    // 3. Substring / alias match
    if (c.id && activeConversationId && (c.id.includes(activeConversationId) || activeConversationId.includes(c.id))) {
      return true;
    }

    return false;
  }) || (activeConversationId && targetUserFromId ? {
    id: activeConversationId,
    type: 'direct' as const,
    name: targetUserFromId.displayName || targetUserFromId.name || 'Friend',
    title: targetUserFromId.displayName || targetUserFromId.name || 'Friend',
    avatarUrl: targetUserFromId.avatarUrl || targetUserFromId.avatar || null,
    avatar: targetUserFromId.avatarUrl || targetUserFromId.avatar || undefined,
    participants: [targetUserFromId],
    messages: messages,
    lastMessage: messages.length > 0 ? messages[messages.length - 1] : null,
    unreadCount: 0,
    updatedAt: new Date().toISOString()
  } : undefined);

  const rawOtherUser = activeConversation?.participants?.find((p) => p && p.id && p.id !== realMyId && p.id !== 'current-user') || activeConversation?.participants?.[0] || targetUserFromId;
  const storeUser = rawOtherUser?.id ? users[rawOtherUser.id] : undefined;
  const otherUser = rawOtherUser ? {
    ...rawOtherUser,
    ...(storeUser || {}),
    displayName: storeUser?.displayName || storeUser?.name || rawOtherUser.displayName || rawOtherUser.name || 'Friend',
    name: storeUser?.displayName || storeUser?.name || rawOtherUser.displayName || rawOtherUser.name || 'Friend',
    avatarUrl: storeUser?.avatarUrl || storeUser?.avatar || rawOtherUser.avatarUrl || rawOtherUser.avatar || null,
    avatar: storeUser?.avatarUrl || storeUser?.avatar || rawOtherUser.avatarUrl || rawOtherUser.avatar || undefined,
  } : undefined;

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

  // Handle loading older messages when scrolling to top (cursor pagination with 'before')
  const handleLoadMore = () => {
    if (!activeConversationId) return;
    const msgs = ChatStore.getMessages(activeConversationId);
    const firstMsg = msgs.length > 0 ? msgs[0] : null;
    if (firstMsg?.createdAt) {
      ChatStore.fetchRemoteMessages(activeConversationId, { before: firstMsg.createdAt, limit: 50 });
    }
  };

  // Periodic sync of remote messages for active conversation (fetch latest 50 messages)
  useEffect(() => {
    if (!activeConversationId) return;
    const interval = setInterval(() => {
      ChatStore.fetchRemoteMessages(activeConversationId, { limit: 50 });
    }, 3000);
    return () => clearInterval(interval);
  }, [activeConversationId]);

  // Mark conversation as read when opened
  const handleSelectConversation = (conv: ChatConversation) => {
    const targetOther = conv.participants?.find((p) => p && p.id !== currentUserId && (!session?.user?.id || p.id !== session.user.id)) || conv.participants?.[0];
    const { otherUserId } = extractParticipantIdsFromConvId(conv.id, currentUserId);
    const friendId = targetOther?.id || otherUserId;
    setActiveConversationId(conv.id);
    ChatStore.markAsRead(conv.id, friendId);
    ChatStore.fetchRemoteMessages(conv.id);
  };

  const myName = session?.user?.displayName || 'You';
  const myAvatar = session?.user?.avatarUrl || undefined;

  const handleSendMessage = (
    content: string,
    type: 'text' | 'image' | 'sticker' | 'voice' | 'view_once' = 'text',
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

    setMessages(ChatStore.getMessages(activeConversationId));
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
    setMessages(ChatStore.getMessages(activeConversationId));
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
    setMessages(ChatStore.getMessages(activeConversationId));
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
    setMessages(ChatStore.getMessages(activeConversationId));
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
    setMessages(ChatStore.getMessages(activeConversationId));
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
    setConversations(ChatStore.getConversations());
    setUsers(ChatStore.getUsers());
    setActiveConversationId(conv.id);
  };

  const handleAcceptRequest = (requestId: string) => {
    ChatStore.acceptRequest(requestId);
  };

  const handleDeclineRequest = (requestId: string) => {
    ChatStore.declineRequest(requestId);
  };

  const handleStartCall = (type: 'voice' | 'video') => {
    if (otherUser) {
      startCall(
        otherUser.id,
        otherUser.displayName || otherUser.name || 'Friend',
        otherUser.avatarUrl || otherUser.avatar,
        type
      );
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
              onStartVoiceCall={() => handleStartCall('voice')}
              onStartVideoCall={() => handleStartCall('video')}
              onOpenSearch={() => setShowSearchModal(true)}
            />

            {/* Messages Scroll Area */}
            <MessageList
              key={activeConversationId || activeConversation?.id || 'chat-list'}
              messages={messages}
              currentUserId={currentUserId}
              onReply={(msg) => setReplyingTo(msg)}
              onForward={(msg) => setForwardingMessage(msg)}
              onReact={handleReact}
              onDelete={handleDelete}
              onPin={handlePin}
              onLoadMore={handleLoadMore}
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
          onStartVoiceCall={() => handleStartCall('voice')}
          onStartVideoCall={() => handleStartCall('video')}
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

      {/* Forward Message Modal */}
      {forwardingMessage && (
        <ForwardMessageModal
          isOpen={Boolean(forwardingMessage)}
          onClose={() => setForwardingMessage(null)}
          message={forwardingMessage}
          conversations={conversations}
        />
      )}
    </div>
  );
};
