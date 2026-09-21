'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  Users,
  UserCheck,
  Search,
  Plus,
  Flame,
  Check,
  X,
  UserPlus,
} from 'lucide-react';
import { ChatConversation, ChatUser, ChatMessageRequest } from '@/types/chat';
import { ConversationList } from './ConversationList';

interface ChatSidebarProps {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  onSelectConversation: (conv: ChatConversation) => void;
  users: Record<string, ChatUser>;
  currentUserId: string;
  requests: ChatMessageRequest[];
  onAcceptRequest: (requestId: string) => void;
  onDeclineRequest: (requestId: string) => void;
  onOpenCreateGroup: () => void;
  onOpenSearchModal: () => void;
  onStartDirectChatWithUser: (user: ChatUser) => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  users,
  currentUserId,
  requests,
  onAcceptRequest,
  onDeclineRequest,
  onOpenCreateGroup,
  onOpenSearchModal,
  onStartDirectChatWithUser,
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'friends' | 'requests'>('chats');
  const [localSearch, setLocalSearch] = useState('');

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const friendsList = Object.values(users).filter((u) => u.id !== currentUserId);

  return (
    <div className="w-full md:w-80 lg:w-96 h-full flex flex-col border-r border-slate-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md shrink-0 select-none">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-200/60 dark:border-zinc-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
            Chats
          </h2>
          {totalUnread > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#ee1d49] text-white text-xs font-bold shadow-xs">
              {totalUnread}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenCreateGroup}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs font-bold text-slate-800 dark:text-zinc-200 transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#ee1d49]" />
          <span>New Group</span>
        </button>
      </div>

      {/* Search Bar Input */}
      <div className="px-3 pt-3 pb-1">
        <div
          onClick={onOpenSearchModal}
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-100/90 dark:bg-zinc-800/80 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition cursor-pointer"
        >
          <Search className="w-4 h-4" />
          <span className="text-xs font-medium">Search people, plans, games...</span>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center justify-around px-3 pt-2 pb-1 border-b border-slate-200/60 dark:border-zinc-800/60 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('chats')}
          className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'chats'
              ? 'text-[#ee1d49] border-b-2 border-[#ee1d49] rounded-b-none'
              : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Messages</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'friends'
              ? 'text-[#ee1d49] border-b-2 border-[#ee1d49] rounded-b-none'
              : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Friends</span>
          <span className="text-[10px] opacity-70">({friendsList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'requests'
              ? 'text-[#ee1d49] border-b-2 border-[#ee1d49] rounded-b-none'
              : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Requests</span>
          {requests.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'chats' && (
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={onSelectConversation}
            users={users}
            currentUserId={currentUserId}
            searchQuery={localSearch}
          />
        )}

        {activeTab === 'friends' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {friendsList.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No friends found yet. Connect with people on Watch!
              </div>
            ) : (
              friendsList.map((friend) => (
                <div
                  key={friend.id}
                  onClick={() => onStartDirectChatWithUser(friend)}
                  className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-zinc-800/80 cursor-pointer transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-xs">
                        {friend.avatar ? (
                          <img src={friend.avatar} alt={friend.displayName || friend.name || 'Friend'} className="w-full h-full object-cover" />
                        ) : (
                          (friend.displayName || friend.name || 'F').slice(0, 1).toUpperCase()
                        )}
                      </div>
                      {friend.isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
                      )}
                    </div>

                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {friend.displayName || friend.name}
                        </span>
                        {friend.streakDays && friend.streakDays > 0 ? (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500">
                            <Flame className="w-3 h-3 fill-current" />
                            {friend.streakDays}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                        {friend.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartDirectChatWithUser(friend);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-[#ee1d49] text-[11px] font-bold hover:bg-rose-100 dark:hover:bg-rose-900/50 transition cursor-pointer"
                  >
                    Chat
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {requests.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No pending message requests
              </div>
            ) : (
              requests.map((req) => (
                <div
                  key={req.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-800 space-y-2"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-xs">
                      {req.senderName.slice(0, 1)}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {req.senderName}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-zinc-300 italic line-clamp-2">
                    &ldquo;{req.previewText}&rdquo;
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onAcceptRequest(req.id)}
                      className="flex-1 py-1.5 rounded-xl bg-[#ee1d49] hover:bg-[#d61840] text-white text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeclineRequest(req.id)}
                      className="flex-1 py-1.5 rounded-xl bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-300 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Ignore</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
