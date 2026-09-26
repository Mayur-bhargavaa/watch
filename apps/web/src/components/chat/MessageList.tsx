'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { ChatMessage } from '@/types/chat';
import { getStoredSession } from '@/lib/api';
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

  const isUserNearBottomRef = useRef(true);

  // Auto scroll to bottom when new messages arrive or view opens
  const scrollToBottom = (smooth = false) => {
    if (scrollRef.current) {
      if (smooth) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const firstMsgId = messages.length > 0 ? messages[0]?.id : '';
  const lastMsgId = messages.length > 0 ? messages[messages.length - 1]?.id : '';

  useEffect(() => {
    if (!lastMsgId) return;

    // If older messages were prepended at top, preserve viewport scroll offset
    if (firstMsgId !== prevFirstMsgIdRef.current && prevFirstMsgIdRef.current !== '' && scrollRef.current) {
      const currentScrollHeight = scrollRef.current.scrollHeight;
      const diff = currentScrollHeight - prevScrollHeightRef.current;
      if (diff > 0) {
        scrollRef.current.scrollTop += diff;
      }
    } else {
      // New message at bottom, or fresh conversation load
      scrollToBottom(false);
      const r1 = requestAnimationFrame(() => scrollToBottom(false));
      const t1 = setTimeout(() => scrollToBottom(false), 50);
      const t2 = setTimeout(() => scrollToBottom(false), 200);
      return () => {
        cancelAnimationFrame(r1);
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    prevLastMsgIdRef.current = lastMsgId;
    prevFirstMsgIdRef.current = firstMsgId;
    if (scrollRef.current) {
      prevScrollHeightRef.current = scrollRef.current.scrollHeight;
    }
  }, [messages.length, lastMsgId, firstMsgId]);

  // Keep pinned to bottom on container resize if user was near bottom
  useEffect(() => {
    if (!scrollRef.current) return;
    const observer = new ResizeObserver(() => {
      if (isUserNearBottomRef.current && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const isUp = distanceToBottom > 60;
    isUserNearBottomRef.current = !isUp;
    setShowScrollBottom(isUp);

    // If scrolled near the top, trigger loading earlier messages
    if (scrollTop < 40 && onLoadMore && !loadingMoreRef.current && scrollHeight > clientHeight) {
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
            const s = typeof window !== 'undefined' ? getStoredSession() : null;
            const realMyId = (currentUserId && currentUserId !== 'current-user')
              ? currentUserId
              : s?.user?.id;
            const myDisplayName = s?.user?.displayName || 'You';

            const isSender = Boolean(
              (realMyId && message.senderId === realMyId) ||
              message.senderId === 'current-user' ||
              (message.senderName && (message.senderName === 'You' || (myDisplayName && message.senderName.trim().toLowerCase() === myDisplayName.trim().toLowerCase())))
            );
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
          onClick={() => {
            isUserNearBottomRef.current = true;
            scrollToBottom(true);
          }}
          className="absolute bottom-4 right-4 z-30 px-3.5 py-1.5 rounded-full bg-[#d2281e] text-white shadow-xl hover:bg-[#b82017] flex items-center gap-1.5 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer animate-in fade-in"
          title="Scroll to latest messages"
        >
          <span>Latest messages</span>
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
