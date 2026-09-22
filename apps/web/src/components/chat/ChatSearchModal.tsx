'use client';

import React, { useState } from 'react';
import {
  Search,
  X,
  MessageSquare,
  User,
  Users,
  Calendar,
  Gamepad2,
  Film,
  ArrowRight,
} from 'lucide-react';
import { ChatConversation, ChatUser, ChatMessage } from '@/types/chat';

interface ChatSearchModalProps {
  conversations: ChatConversation[];
  users: Record<string, ChatUser>;
  currentUserId: string;
  onClose: () => void;
  onSelectConversation: (conversationId: string, messageId?: string) => void;
}

export const ChatSearchModal: React.FC<ChatSearchModalProps> = ({
  conversations,
  users,
  currentUserId,
  onClose,
  onSelectConversation,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'messages' | 'people' | 'plans' | 'games'>('all');

  const q = query.toLowerCase().trim();

  // Search people
  const matchedUsers = Object.values(users).filter((u) => {
    if (u.id === currentUserId) return false;
    if (!q) return false;
    const name = u.displayName || u.name || '';
    return (
      name.toLowerCase().includes(q) ||
      (u.username && u.username.toLowerCase().includes(q))
    );
  });

  // Search conversations & messages
  const matchedMessages: { conv: ChatConversation; msg: ChatMessage }[] = [];
  const matchedPlans: { conv: ChatConversation; msg: ChatMessage }[] = [];
  const matchedGames: { conv: ChatConversation; msg: ChatMessage }[] = [];

  if (q) {
    conversations.forEach((conv) => {
      (conv.messages || []).forEach((msg) => {
        if (msg.type === 'plan' && msg.metadata?.plan?.title?.toLowerCase().includes(q)) {
          matchedPlans.push({ conv, msg });
        } else if ((msg.type === 'game_invite' || msg.type === 'game') && (msg.metadata?.game?.title?.toLowerCase().includes(q) || msg.metadata?.game?.gameType?.toLowerCase().includes(q))) {
          matchedGames.push({ conv, msg });
        } else if (msg.content && msg.content.toLowerCase().includes(q)) {
          matchedMessages.push({ conv, msg });
        }
      });
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]"
      >
        {/* Search Input Bar */}
        <div className="p-3 border-b border-slate-200/80 dark:border-zinc-800/80 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0 ml-2" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages, people, plans, games, movies..."
            className="flex-1 bg-transparent border-0 outline-hidden text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
          >
            Esc
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100 dark:border-zinc-800/60 overflow-x-auto shrink-0">
          {(['all', 'messages', 'people', 'plans', 'games'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition ${
                filter === cat
                  ? 'bg-[#ee1d49] text-white'
                  : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!q ? (
            <div className="text-center py-12 text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">Type anything to search across your Watch conversations</p>
            </div>
          ) : (
            <>
              {/* Matched People */}
              {(filter === 'all' || filter === 'people') && matchedUsers.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                    People
                  </h4>
                  <div className="space-y-1">
                    {matchedUsers.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => {
                          const existingConv = conversations.find(
                            (c) => c.type === 'direct' && c.participants.some((p) => p.id === user.id)
                          );
                          if (existingConv) {
                            onSelectConversation(existingConv.id);
                          }
                          onClose();
                        }}
                        className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs">
                            {user.avatar ? (
                              <img src={user.avatar} alt={user.displayName || user.name} className="w-full h-full object-cover" />
                            ) : (
                              (user.displayName || user.name || 'U').slice(0, 1)
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              {user.displayName || user.name}
                            </p>
                            {user.username && (
                              <p className="text-xs text-slate-400">@{user.username}</p>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched Messages */}
              {(filter === 'all' || filter === 'messages') && matchedMessages.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                    Messages ({matchedMessages.length})
                  </h4>
                  <div className="space-y-1">
                    {matchedMessages.slice(0, 10).map(({ conv, msg }) => (
                      <div
                        key={msg.id}
                        onClick={() => {
                          onSelectConversation(conv.id, msg.id);
                          onClose();
                        }}
                        className="p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer transition"
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-[#ee1d49]">{msg.senderName}</span>
                          <span className="text-slate-400">
                            {new Date(msg.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-zinc-300 line-clamp-2">
                          {msg.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched Plans */}
              {(filter === 'all' || filter === 'plans') && matchedPlans.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                    Plans ({matchedPlans.length})
                  </h4>
                  <div className="space-y-1">
                    {matchedPlans.map(({ conv, msg }) => (
                      <div
                        key={msg.id}
                        onClick={() => {
                          onSelectConversation(conv.id, msg.id);
                          onClose();
                        }}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 hover:opacity-90 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#ee1d49]" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {msg.metadata?.plan?.title}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {msg.metadata?.plan?.scheduledAt}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched Games */}
              {(filter === 'all' || filter === 'games') && matchedGames.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                    Games ({matchedGames.length})
                  </h4>
                  <div className="space-y-1">
                    {matchedGames.map(({ conv, msg }) => (
                      <div
                        key={msg.id}
                        onClick={() => {
                          onSelectConversation(conv.id, msg.id);
                          onClose();
                        }}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 hover:opacity-90 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-2">
                          <Gamepad2 className="w-4 h-4 text-amber-500" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {msg.metadata?.game?.title || msg.metadata?.game?.gameType}
                          </span>
                        </div>
                        <span className="text-[11px] text-amber-600 font-semibold">
                          Join Match
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {matchedUsers.length === 0 &&
                matchedMessages.length === 0 &&
                matchedPlans.length === 0 &&
                matchedGames.length === 0 && (
                  <p className="text-center py-10 text-xs text-slate-400">
                    No results found for &ldquo;{query}&rdquo;
                  </p>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
