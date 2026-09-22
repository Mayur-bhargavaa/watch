'use client';

import React, { useState } from 'react';
import { X, Search, Forward, Check, MessageSquare } from 'lucide-react';
import { ChatMessage, ChatConversation } from '@/types/chat';
import { ModalPortal } from './ModalPortal';
import { ChatStore } from '@/lib/chatStore';

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage | null;
  conversations: ChatConversation[];
  onForwardSuccess?: (targetConvName: string) => void;
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({
  isOpen,
  onClose,
  message,
  conversations,
  onForwardSuccess,
}) => {
  const [search, setSearch] = useState('');
  const [forwardedConvId, setForwardedConvId] = useState<string | null>(null);

  if (!isOpen || !message) return null;

  const filteredConvs = conversations.filter((c) =>
    (c.title || c.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleForwardTo = (conv: ChatConversation) => {
    setForwardedConvId(conv.id);

    // Forward the message to the target conversation
    ChatStore.sendMessage({
      conversationId: conv.id,
      content: message.content,
      type: message.type,
      mediaUrl: message.mediaUrl,
      metadata: {
        ...message.metadata,
        forwarded: true,
      },
    });

    if (onForwardSuccess) {
      onForwardSuccess(conv.title || conv.name);
    }

    setTimeout(() => {
      setForwardedConvId(null);
      onClose();
    }, 600);
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[220] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-rose-500/10 text-[#ee1d49] flex items-center justify-center">
                <Forward className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Forward Message</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Message Preview Snippet */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-zinc-800/40 border-b border-slate-100 dark:border-zinc-800/60 text-xs text-slate-600 dark:text-zinc-300 truncate">
            <span className="font-semibold text-slate-900 dark:text-white mr-1.5">Forwarding:</span>
            {message.mediaUrl ? (
              <span className="italic">📷 Media Attachment</span>
            ) : message.content?.startsWith('[sticker:') ? (
              <span className="italic">🎨 Sticker</span>
            ) : (
              message.content
            )}
          </div>

          {/* Search Bar */}
          <div className="p-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="relative flex items-center bg-slate-100 dark:bg-zinc-800 rounded-xl px-3 py-1.5">
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search friends or groups..."
                className="w-full bg-transparent border-0 outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-100 dark:divide-zinc-800/40">
            {filteredConvs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No chats found
              </div>
            ) : (
              filteredConvs.map((conv) => {
                const isSent = forwardedConvId === conv.id;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleForwardTo(conv)}
                    disabled={isSent}
                    className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-zinc-800/70 transition text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-9 h-9 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-zinc-200 shrink-0 overflow-hidden">
                        {conv.avatarUrl || conv.avatar ? (
                          <img
                            src={conv.avatarUrl || conv.avatar}
                            alt={conv.title || conv.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (conv.title || conv.name || 'C').slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {conv.title || conv.name}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {conv.type === 'group' ? 'Group Chat' : 'Direct Chat'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 pl-2">
                      {isSent ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full animate-in zoom-in-75">
                          <Check className="w-3.5 h-3.5" /> Sent
                        </span>
                      ) : (
                        <span className="p-2 rounded-xl text-slate-400 group-hover:text-[#ee1d49] group-hover:bg-rose-50 dark:group-hover:bg-rose-950/30 transition">
                          <Forward className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
