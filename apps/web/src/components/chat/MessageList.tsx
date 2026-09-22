'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { ChatMessage } from '@/types/chat';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  typingUsers?: string[];
  onReply?: (message: ChatMessage) => void;
  onForward?: (message: ChatMessage) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onLoadMore?: () => void;
}

function formatDateDivider(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  typingUsers = [],
  onReply,
  onForward,
  onReact,
  onDelete,
  onPin,
  onLoadMore,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const loadingMoreRef = useRef(false);

  const prevLastMsgIdRef = useRef<string>('');
  const prevFirstMsgIdRef = useRef<string>('');
  const prevScrollHeightRef = useRef<number>(0);

  // Auto scroll to bottom when new messages arrive at the bottom
  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const firstMsgId = messages.length > 0 ? messages[0]?.id : '';
  const lastMsgId = messages.length > 0 ? messages[messages.length - 1]?.id : '';

  useEffect(() => {
    if (!lastMsgId) return;

    if (lastMsgId !== prevLastMsgIdRef.current) {
      // New message received at the bottom or conversation switched
      scrollToBottom(false);
    } else if (firstMsgId !== prevFirstMsgIdRef.current && scrollRef.current) {
      // Older messages prepended at the top: preserve viewport scroll offset
      const currentScrollHeight = scrollRef.current.scrollHeight;
      const diff = currentScrollHeight - prevScrollHeightRef.current;
      if (diff > 0) {
        scrollRef.current.scrollTop += diff;
      }
    }

    prevLastMsgIdRef.current = lastMsgId;
    prevFirstMsgIdRef.current = firstMsgId;
    if (scrollRef.current) {
      prevScrollHeightRef.current = scrollRef.current.scrollHeight;
    }
  }, [messages.length, lastMsgId, firstMsgId]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 150;
    setShowScrollBottom(isUp);

    // If scrolled near the top, trigger loading earlier messages
    if (scrollTop < 40 && onLoadMore && !loadingMoreRef.current) {
      loadingMoreRef.current = true;
      onLoadMore();
      setTimeout(() => {
        loadingMoreRef.current = false;
      }, 1000);
    }
  };

  const jumpToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[#ee1d49]/50', 'rounded-2xl');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-[#ee1d49]/50', 'rounded-2xl');
      }, 1500);
    }
  };

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto overflow-x-hidden p-2 sm:p-4 space-y-1"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-zinc-500">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-zinc-800/80 flex items-center justify-center text-2xl mb-3">
              💬
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
              No messages yet
            </p>
            <p className="text-xs max-w-xs mt-1 text-slate-500 dark:text-zinc-400">
              Say hello or invite them to a movie or a game!
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isSender = message.senderId === currentUserId;
            const prevMsg = messages[index - 1];
            const isNewDay =
              !prevMsg ||
              new Date(message.createdAt).toDateString() !==
                new Date(prevMsg.createdAt).toDateString();
            const isSameSenderAsNext =
              messages[index + 1] &&
              messages[index + 1].senderId === message.senderId &&
              new Date(messages[index + 1].createdAt).getTime() - new Date(message.createdAt).getTime() <
                60000;

            return (
              <React.Fragment key={message.id}>
                {isNewDay && (
                  <div className="flex items-center justify-center my-4 select-none">
                    <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800/80 text-[11px] font-medium text-slate-500 dark:text-zinc-400 border border-slate-200/60 dark:border-zinc-700/60">
                      {formatDateDivider(new Date(message.createdAt).getTime())}
                    </span>
                  </div>
                )}

                <MessageBubble
                  message={message}
                  isSender={isSender}
                  showAvatar={!isSameSenderAsNext}
                  currentUserId={currentUserId}
                  onReply={onReply}
                  onForward={onForward}
                  onReact={onReact}
                  onDelete={onDelete}
                  onPin={onPin}
                  onJumpToReply={jumpToMessage}
                />
              </React.Fragment>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-500 dark:text-zinc-400">
            <div className="flex gap-1 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ee1d49] animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#ee1d49] animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#ee1d49] animate-bounce" />
            </div>
            <span>
              {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
            </span>
          </div>
        )}

        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Floating Scroll Down Button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-4 right-4 z-20 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 shadow-lg border border-slate-200/80 dark:border-zinc-700 flex items-center justify-center hover:scale-105 active:scale-95 transition cursor-pointer"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
