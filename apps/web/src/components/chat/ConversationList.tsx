'use client';

import React, { useState } from 'react';
import { MessageSquare, Users, MailOpen } from 'lucide-react';
import { ChatConversation, ChatUser } from '@/types/chat';
import { ConversationItem } from './ConversationItem';

interface ConversationListProps {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  onSelectConversation: (conv: ChatConversation) => void;
  users: Record<string, ChatUser>;
  currentUserId: string;
  searchQuery?: string;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  users,
  currentUserId,
  searchQuery = '',
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'groups'>('all');

  const filteredConversations = conversations.filter((conv) => {
    // Tab filter
    if (filterTab === 'unread' && conv.unreadCount === 0) return false;
    if (filterTab === 'groups' && conv.type !== 'group') return false;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const otherUser = conv.participants.find((p) => p.id !== currentUserId) || conv.participants[0];
      const title = conv.type === 'group' ? (conv.title || conv.name) : (otherUser?.displayName || otherUser?.name || conv.title || conv.name || '');
      const lastMsg = conv.lastMessage?.content || '';

      return title.toLowerCase().includes(q) || lastMsg.toLowerCase().includes(q);
    }

    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Segmented Filter Pills */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200/60 dark:border-zinc-800/60 shrink-0">
        <button
          type="button"
          onClick={() => setFilterTab('all')}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
            filterTab === 'all'
              ? 'bg-[#ee1d49] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          All
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('unread')}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
            filterTab === 'unread'
              ? 'bg-[#ee1d49] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <span>Unread</span>
          {conversations.some((c) => c.unreadCount > 0) && (
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('groups')}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
            filterTab === 'groups'
              ? 'bg-[#ee1d49] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          Groups
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredConversations.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-slate-400 dark:text-zinc-500">
            {filterTab === 'unread' ? (
              <>
                <MailOpen className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs font-semibold">No unread messages</p>
              </>
            ) : filterTab === 'groups' ? (
              <>
                <Users className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs font-semibold">No group chats yet</p>
              </>
            ) : (
              <>
                <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs font-semibold">No conversations found</p>
              </>
            )}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const rawOtherUser = conv.participants.find((p) => p.id !== currentUserId) || conv.participants[0];
            const otherUser = rawOtherUser ? (users[rawOtherUser.id] || rawOtherUser) : undefined;

            return (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={conv.id === activeConversationId}
                onSelect={onSelectConversation}
                otherUser={otherUser}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
