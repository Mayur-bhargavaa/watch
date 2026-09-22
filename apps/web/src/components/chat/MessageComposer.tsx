'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Plus,
  Smile,
  Mic,
  X,
  Film,
  Gamepad2,
  Calendar,
  Image as ImageIcon,
  Square,
  Trash2,
} from 'lucide-react';
import { ChatMessage, ChatPlanPayload, ChatGamePayload, ChatMoviePayload } from '@/types/chat';
import { StickerPicker } from './StickerPicker';
import { DrawStickerModal } from './DrawStickerModal';
import { serializeStickerMessage } from './StickersData';
import { ModalPortal } from './ModalPortal';

interface MessageComposerProps {
  onSendMessage: (content: string, type?: 'text' | 'image' | 'sticker' | 'voice', mediaUrl?: string) => void;
  onSendVoice?: (duration: number, audioUrl?: string) => void;
  onSendPlan?: (plan: ChatPlanPayload) => void;
  onSendGame?: (game: ChatGamePayload) => void;
  onSendMovie?: (movie: ChatMoviePayload) => void;
  replyingTo: ChatMessage | null;
  onCancelReply: () => void;
  onTyping?: (isTyping: boolean) => void;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  onSendVoice,
  onSendPlan,
  onSendGame,
  onSendMovie,
  replyingTo,
  onCancelReply,
  onTyping,
}) => {
  const [text, setText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showDrawSticker, setShowDrawSticker] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Quick modals for plan/game/movie
  const [showPlanPrompt, setShowPlanPrompt] = useState(false);
  const [showGamePrompt, setShowGamePrompt] = useState(false);
  const [showMoviePrompt, setShowMoviePrompt] = useState(false);

  // Form states for quick action creation
  const [planTitle, setPlanTitle] = useState('');
  const [planDate, setPlanDate] = useState('This Friday');
  const [planTime, setPlanTime] = useState('9:00 PM');

  const [selectedGame, setSelectedGame] = useState<'ludo' | 'chess' | 'bingo' | 'trivia' | 'doodle'>('ludo');

  const [movieTitle, setMovieTitle] = useState('');
  const [movieGenres, setMovieGenres] = useState('Sci-Fi, Adventure');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle textarea autosize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (onTyping) {
      onTyping(e.target.value.length > 0);
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendMessage(trimmed, 'text');
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    if (onTyping) onTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Voice Recording Simulator / Handlers
  const startRecording = () => {
    setIsRecording(true);
    setRecordingSeconds(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopAndSendRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const duration = Math.max(recordingSeconds, 3);
    setIsRecording(false);
    setRecordingSeconds(0);
    if (onSendVoice) {
      onSendVoice(duration);
    }
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fakeUrl = URL.createObjectURL(file);
      onSendMessage(file.name, 'image', fakeUrl);
    }
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planTitle.trim()) return;
    if (onSendPlan) {
      onSendPlan({
        planId: `plan-${Date.now()}`,
        title: planTitle.trim(),
        scheduledAt: planDate,
        time: planTime,
        status: 'upcoming',
      });
    }
    setPlanTitle('');
    setShowPlanPrompt(false);
  };

  const handleCreateGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSendGame) {
      const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
      onSendGame({
        gameType: selectedGame,
        roomId: roomCode,
        title: `${selectedGame.toUpperCase()} Challenge`,
        playersCount: 1,
        maxPlayers: selectedGame === 'chess' ? 2 : 4,
        status: 'waiting',
      });
    }
    setShowGamePrompt(false);
  };

  const handleCreateMovie = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movieTitle.trim()) return;
    if (onSendMovie) {
      onSendMovie({
        movieId: `m-${Date.now()}`,
        title: movieTitle.trim(),
        year: '2024',
        duration: '2h 15m',
        genres: movieGenres.split(',').map((g) => g.trim()),
        rating: '8.6',
        posterUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&auto=format&fit=crop&q=80',
      });
    }
    setMovieTitle('');
    setShowMoviePrompt(false);
  };

  return (
    <div className="relative border-t border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-2.5 sm:p-3">
      {/* Replying banner */}
      {replyingTo && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 mb-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs border-l-3 border-[#ee1d49] animate-in fade-in slide-in-from-bottom-1">
          <div className="truncate">
            <span className="font-bold text-[#ee1d49] mr-1.5">
              Replying to {replyingTo.senderName}:
            </span>
            <span className="text-slate-600 dark:text-zinc-300 truncate">
              {replyingTo.content}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />

      {/* Voice Recording Active Mode */}
      {isRecording ? (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#ee1d49] animate-ping" />
            <span className="text-sm font-bold text-[#ee1d49]">
              Recording: {Math.floor(recordingSeconds / 60)}:
              {recordingSeconds % 60 < 10 ? '0' : ''}
              {recordingSeconds % 60}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="p-2 rounded-full text-slate-500 hover:text-rose-600 hover:bg-white/60 dark:hover:bg-zinc-800 transition cursor-pointer"
              title="Cancel recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={stopAndSendRecording}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#ee1d49] hover:bg-[#d61840] text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Voice</span>
            </button>
          </div>
        </div>
      ) : (
        /* Normal Typing Mode */
        <div className="flex items-end gap-1.5 sm:gap-2">
          {/* Action Menu [ + ] */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAttachMenu((prev) => !prev)}
              className={`p-2.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer ${
                showAttachMenu ? 'rotate-45 bg-slate-100 dark:bg-zinc-800' : ''
              }`}
              title="Add plan, game, movie or image"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Attach Drawer Popup */}
            {showAttachMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-12 left-0 w-52 p-1.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl border border-slate-200/80 dark:border-zinc-800 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95"
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    setShowPlanPrompt(true);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-left cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-[#ee1d49]" />
                  <span>Create Watch Plan</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    setShowGamePrompt(true);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-left cursor-pointer"
                >
                  <Gamepad2 className="w-4 h-4 text-amber-500" />
                  <span>Invite to Game</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    setShowMoviePrompt(true);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-left cursor-pointer"
                >
                  <Film className="w-4 h-4 text-indigo-500" />
                  <span>Share Movie</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    setShowDrawSticker(true);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-left cursor-pointer"
                >
                  <span className="text-sm">🎨</span>
                  <span>Draw Sticker</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    fileInputRef.current?.click();
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-left cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-500" />
                  <span>Attach Image</span>
                </button>
              </div>
            )}
          </div>

          {/* Emoji / Sticker Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowStickerPicker((prev) => !prev)}
              className="p-2.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              title="Stickers & Emojis"
            >
              <Smile className="w-5 h-5" />
            </button>

            {showStickerPicker && (
              <div className="absolute bottom-12 left-0 z-50">
                <StickerPicker
                  onSelectSticker={(sticker) => {
                    const serialized = serializeStickerMessage(sticker);
                    onSendMessage(serialized, 'sticker');
                    setShowStickerPicker(false);
                  }}
                  onOpenDrawModal={() => {
                    setShowStickerPicker(false);
                    setShowDrawSticker(true);
                  }}
                  onClose={() => setShowStickerPicker(false)}
                />
              </div>
            )}
          </div>

          {/* Text Input Area */}
          <div className="flex-1 relative flex items-center bg-slate-100/90 dark:bg-zinc-800/80 rounded-2xl px-3.5 py-1.5 focus-within:ring-2 focus-within:ring-[#ee1d49]/30 transition">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full bg-transparent border-0 resize-none outline-hidden text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 max-h-32 py-1 leading-normal"
            />
          </div>

          {/* Send or Voice Record Button */}
          {text.trim() ? (
            <button
              type="button"
              onClick={handleSend}
              className="p-2.5 rounded-xl bg-[#ee1d49] hover:bg-[#d61840] text-white shadow-xs transition active:scale-95 cursor-pointer shrink-0"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="p-2.5 rounded-xl text-slate-500 hover:text-[#ee1d49] hover:bg-rose-50 dark:hover:bg-rose-950/30 transition active:scale-95 cursor-pointer shrink-0"
              title="Record voice message"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Draw Sticker Modal */}
      {showDrawSticker && (
        <ModalPortal>
          <DrawStickerModal
            isOpen={showDrawSticker}
            onClose={() => setShowDrawSticker(false)}
            onSendDrawnSticker={(formattedStickerMessage) => {
              onSendMessage(formattedStickerMessage, 'sticker');
              setShowDrawSticker(false);
            }}
          />
        </ModalPortal>
      )}

      {/* Quick Plan Modal */}
      {showPlanPrompt && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <form
              onSubmit={handleCreatePlan}
              className="w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 p-5 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#ee1d49]" />
                  <span>Create Watch Plan</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPlanPrompt(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  Plan Name
                </label>
                <input
                  type="text"
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="e.g. 🍿 Friday Movie Night"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-[#ee1d49]/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    Date
                  </label>
                  <input
                    type="text"
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value)}
                    placeholder="e.g. Friday"
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm text-slate-900 dark:text-white outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    Time
                  </label>
                  <input
                    type="text"
                    value={planTime}
                    onChange={(e) => setPlanTime(e.target.value)}
                    placeholder="e.g. 9:00 PM"
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm text-slate-900 dark:text-white outline-hidden"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPlanPrompt(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-600 dark:text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#ee1d49] hover:bg-[#d61840] text-xs font-bold text-white shadow-xs cursor-pointer"
                >
                  Share Plan
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Quick Game Modal */}
      {showGamePrompt && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <form
              onSubmit={handleCreateGame}
              className="w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 p-5 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-amber-500" />
                  <span>Invite to Game</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGamePrompt(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400">
                  Choose Game
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'ludo', label: '🎲 Ludo' },
                    { id: 'chess', label: '♟️ Chess' },
                    { id: 'bingo', label: '🔢 Bingo' },
                    { id: 'trivia', label: '💡 Trivia' },
                    { id: 'doodle', label: '🎨 Doodle' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGame(g.id as any)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition text-left cursor-pointer ${
                        selectedGame === g.id
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-[#ee1d49] text-[#ee1d49]'
                          : 'bg-slate-100 dark:bg-zinc-800 border-transparent text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGamePrompt(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-600 dark:text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-xs cursor-pointer"
                >
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Quick Movie Modal */}
      {showMoviePrompt && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <form
              onSubmit={handleCreateMovie}
              className="w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 p-5 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Film className="w-4 h-4 text-indigo-500" />
                  <span>Share Movie</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowMoviePrompt(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  Movie Title
                </label>
                <input
                  type="text"
                  value={movieTitle}
                  onChange={(e) => setMovieTitle(e.target.value)}
                  placeholder="e.g. Interstellar, Inception, Dune..."
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-[#ee1d49]/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  Genres
                </label>
                <input
                  type="text"
                  value={movieGenres}
                  onChange={(e) => setMovieGenres(e.target.value)}
                  placeholder="e.g. Sci-Fi, Adventure"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm text-slate-900 dark:text-white outline-hidden"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMoviePrompt(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-600 dark:text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#ee1d49] hover:bg-[#d61840] text-xs font-bold text-white shadow-xs cursor-pointer"
                >
                  Share Movie
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
