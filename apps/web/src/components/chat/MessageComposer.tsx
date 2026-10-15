'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Send, Smile } from 'lucide-react';
import type { ChatMessage, ChatPlanPayload, ChatGamePayload, ChatMoviePayload, ChatMessageMetadata } from '@/types/chat';
import { StickerPicker } from './StickerPicker';
import { DrawStickerModal } from './DrawStickerModal';
import { ModalPortal } from './ModalPortal';
import { serializeStickerMessage, STICKER_PACK } from './StickersData';
import { uploadChatImage } from '@/lib/uploadMedia';
import { AttachMenu, AttachAction } from './composer/AttachMenu';
import { GameDialog } from './composer/GameDialog';
import { MovieDialog } from './composer/MovieDialog';
import { PendingImageBar } from './composer/PendingImageBar';
import { PlanDialog } from './composer/PlanDialog';
import { RecordingBar } from './composer/RecordingBar';
import { ReplyBanner } from './composer/ReplyBanner';
import { ViewOnceDialog } from './composer/ViewOnceDialog';
import { usePendingImage } from './composer/usePendingImage';
import { useTypingIndicator } from './composer/useTypingIndicator';
import { useVoiceRecorder } from './composer/useVoiceRecorder';

interface MessageComposerProps {
  onSendMessage: (
    content: string,
    type?: 'text' | 'image' | 'sticker' | 'voice' | 'view_once',
    mediaUrl?: string,
    metadata?: ChatMessageMetadata
  ) => void;
  onSendVoice?: (duration: number, audioUrl?: string, waveform?: number[]) => void;
  onSendPlan?: (plan: ChatPlanPayload) => void;
  onSendGame?: (game: ChatGamePayload) => void;
  onSendMovie?: (movie: ChatMoviePayload) => void;
  replyingTo: ChatMessage | null;
  onCancelReply: () => void;
  onTyping?: (isTyping: boolean) => void;
}

type DialogName = 'plan' | 'game' | 'movie' | 'draw' | 'viewOnce' | null;

const EMOJI_ONLY = /^\p{Extended_Pictographic}+$/u;

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  onSendVoice,
  onSendPlan,
  onSendGame,
  onSendMovie,
  replyingTo,
  onCancelReply,
  onTyping
}) => {
  const [text, setText] = useState('');
  const [menu, setMenu] = useState<'attach' | 'stickers' | null>(null);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachRef = useRef<HTMLDivElement | null>(null);
  const stickerRef = useRef<HTMLDivElement | null>(null);

  const typing = useTypingIndicator(onTyping);
  const image = usePendingImage();

  const showNotice = useCallback((message: string) => setNotice(message), []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const voice = useVoiceRecorder({
    onFinished: ({ audioDataUrl, durationSec, waveform }) => onSendVoice?.(durationSec, audioDataUrl, waveform),
    onError: showNotice
  });

  const resetInput = () => {
    setText('');
    typing.stop();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const send = async () => {
    if (isUploading) return;

    if (image.pending) {
      const { file, isViewOnce } = image.pending;
      setIsUploading(true);
      try {
        const uploadedUrl = await uploadChatImage(file);
        const meta: ChatMessageMetadata = {
          fileName: file.name,
          fileSize: `${(file.size / 1024).toFixed(0)} KB`,
          ...(isViewOnce ? { isViewOnce: true, viewOnceOpened: false } : {})
        };
        onSendMessage(text.trim(), isViewOnce ? 'view_once' : 'image', uploadedUrl, meta);
        image.clear();
        resetInput();
      } catch (err) {
        console.error('Failed to send image:', err);
        showNotice("Couldn't upload the photo. Check your connection and try again.");
      } finally {
        setIsUploading(false);
      }
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;
    onSendMessage(trimmed, 'text');
    resetInput();
  };

  // ---- menus: close on outside click / touch -------------------------------------------------------------
  useEffect(() => {
    if (!menu) return;
    const onOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      const container = menu === 'attach' ? attachRef.current : stickerRef.current;
      if (container && !container.contains(target)) setMenu(null);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [menu]);

  // ---- auto-grow textarea ----------------------------------------------------------------------------------
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  // ---- global typing shortcut: any key focuses the box, Enter sends. Registered ONCE; reads latest state via refs.
  const latest = useRef({ send, text, hasImage: false, dialog: null as DialogName });
  latest.current = { send, text, hasImage: Boolean(image.pending), dialog };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = latest.current;
      if (s.dialog) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        textareaRef.current?.focus();
        if (s.text.trim() || s.hasImage) void s.send();
      } else if (e.key.length === 1) {
        textareaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- handlers ---------------------------------------------------------------------------------------------
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    typing.input(e.target.value.length > 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const error = image.select(file);
      if (error) showNotice(error);
      setMenu(null);
    }
    e.target.value = '';
  };

  const handleAttach = (action: AttachAction) => {
    setMenu(null);
    if (action === 'image') fileInputRef.current?.click();
    else setDialog(action);
  };

  const handleToggleViewOnce = () => {
    if (!image.pending) return;
    if (image.pending.isViewOnce) image.setViewOnce(false);
    else setDialog('viewOnce'); // explain the screenshot caveat first
  };

  const handleSelectSticker = (sticker: string, caption?: string) => {
    if (EMOJI_ONLY.test(sticker.trim())) {
      setText((prev) => prev + sticker);
      textareaRef.current?.focus();
      return;
    }
    const found = STICKER_PACK.find((s) => s.id.toLowerCase() === sticker.trim().toLowerCase());
    const mediaUrl = found?.gifUrl || found?.webpUrl || (sticker.startsWith('http') || sticker.startsWith('data:') ? sticker : undefined);
    onSendMessage(serializeStickerMessage(sticker, caption), 'sticker', mediaUrl, found ? { sticker: found } : undefined);
    setMenu(null);
  };

  const closeDialog = useCallback(() => setDialog(null), []);
  const canSend = Boolean(text.trim() || image.pending);

  return (
    <div className="relative z-20 w-full max-w-full border-t border-slate-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-2 sm:p-3 shrink-0">
      {notice && (
        <div role="alert" className="flex items-start justify-between gap-2 px-3 py-2 mb-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-medium border border-red-200 dark:border-red-900/50">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="font-bold shrink-0 cursor-pointer">✕</button>
        </div>
      )}

      {replyingTo && <ReplyBanner message={replyingTo} onCancel={onCancelReply} />}
      {image.pending && <PendingImageBar image={image.pending} onToggleViewOnce={handleToggleViewOnce} onRemove={image.clear} />}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

      {voice.isRecording ? (
        <RecordingBar seconds={voice.seconds} bars={voice.bars} onCancel={voice.cancel} onSend={voice.stopAndSend} />
      ) : (
        <div className="flex items-end gap-1 sm:gap-2 w-full max-w-full min-w-0">
          <AttachMenu
            containerRef={attachRef}
            open={menu === 'attach'}
            onToggle={(e) => {
              e?.stopPropagation();
              setMenu((m) => (m === 'attach' ? null : 'attach'));
            }}
            onClose={() => setMenu(null)}
            onSelect={handleAttach}
          />

          <div className="relative shrink-0" ref={stickerRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenu((m) => (m === 'stickers' ? null : 'stickers'));
              }}
              aria-expanded={menu === 'stickers'}
              className={`p-2 sm:p-2.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0 ${
                menu === 'stickers' ? 'bg-slate-100 dark:bg-zinc-800 text-[#ee1d49]' : ''
              }`}
              title="Stickers & Emojis"
            >
              <Smile className="w-5 h-5" />
            </button>

            {menu === 'stickers' && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
                <div onClick={(e) => e.stopPropagation()} className="absolute bottom-14 left-0 z-50">
                  <StickerPicker
                    onSelectSticker={handleSelectSticker}
                    onOpenDrawModal={() => {
                      setMenu(null);
                      setDialog('draw');
                    }}
                    onClose={() => setMenu(null)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex-1 min-w-0 relative flex items-center bg-slate-100/90 dark:bg-zinc-800/80 rounded-2xl px-2.5 sm:px-3.5 py-1 sm:py-1.5 focus-within:ring-2 focus-within:ring-[#ee1d49]/30 transition border-0 outline-none">
            <textarea
              ref={textareaRef}
              value={text}
              onFocus={() => setMenu(null)}
              onBlur={() => typing.stop()}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={image.pending ? 'Add caption...' : 'Type a message...'}
              rows={1}
              maxLength={4000}
              aria-label="Message"
              style={{ outline: 'none', boxShadow: 'none' }}
              className="w-full bg-transparent border-0 resize-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 max-h-32 py-1 leading-normal shadow-none"
            />
          </div>

          {canSend ? (
            <button
              type="button"
              onClick={() => void send()}
              disabled={isUploading}
              className="p-2 sm:p-2.5 rounded-xl bg-[#ee1d49] hover:bg-[#d61840] disabled:opacity-60 text-white shadow-xs transition active:scale-95 cursor-pointer shrink-0"
              title={image.pending ? 'Send photo' : 'Send message'}
              aria-label={image.pending ? 'Send photo' : 'Send message'}
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void voice.start()}
              className="p-2 sm:p-2.5 rounded-xl text-slate-500 hover:text-[#ee1d49] hover:bg-rose-50 dark:hover:bg-rose-950/30 transition active:scale-95 cursor-pointer shrink-0"
              title="Record voice message"
              aria-label="Record voice message"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {dialog === 'viewOnce' && (
        <ViewOnceDialog
          onConfirm={() => {
            image.setViewOnce(true);
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}
      {dialog === 'draw' && (
        <ModalPortal>
          <DrawStickerModal
            isOpen
            onClose={closeDialog}
            onSendDrawnSticker={(formatted) => {
              onSendMessage(formatted, 'sticker');
              closeDialog();
            }}
          />
        </ModalPortal>
      )}
      {dialog === 'plan' && <PlanDialog onSend={(plan) => onSendPlan?.(plan)} onClose={closeDialog} />}
      {dialog === 'game' && <GameDialog onSend={(game) => onSendGame?.(game)} onError={showNotice} onClose={closeDialog} />}
      {dialog === 'movie' && <MovieDialog onSend={(movie) => onSendMovie?.(movie)} onClose={closeDialog} />}
    </div>
  );
};
