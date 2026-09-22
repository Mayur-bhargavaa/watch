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
  Loader2,
} from 'lucide-react';
import { ChatMessage, ChatPlanPayload, ChatGamePayload, ChatMoviePayload, ChatMessageMetadata } from '@/types/chat';
import { StickerPicker } from './StickerPicker';
import { DrawStickerModal } from './DrawStickerModal';
import { serializeStickerMessage, STICKER_PACK } from './StickersData';
import { ModalPortal } from './ModalPortal';
import { uploadChatImage } from '@/lib/uploadMedia';
import { formatReplySnippet } from './ChatReplyUI';
import { createGameRoom, getGameTitle, getStoredSession, ensureSession } from '@/lib/api';

interface PendingImage {
  file: File;
  previewUrl: string;
  isViewOnce: boolean;
}

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

  // Pending image & View Once state
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [showViewOnceModal, setShowViewOnceModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Voice recording state & audio references
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveVolumeBars, setLiveVolumeBars] = useState<number[]>([25, 40, 60, 45, 25]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const waveformSamplesRef = useRef<number[]>([]);

  // Quick modals for plan/game/movie
  const [showPlanPrompt, setShowPlanPrompt] = useState(false);
  const [showGamePrompt, setShowGamePrompt] = useState(false);
  const [showMoviePrompt, setShowMoviePrompt] = useState(false);

  // Form states for quick action creation
  const [planTitle, setPlanTitle] = useState('');
  const [planDate, setPlanDate] = useState('This Friday');
  const [planTime, setPlanTime] = useState('9:00 PM');

  const [selectedGame, setSelectedGame] = useState<string>('ludo');
  const [isCreatingGame, setIsCreatingGame] = useState(false);

  const [movieTitle, setMovieTitle] = useState('');
  const [movieGenres, setMovieGenres] = useState('Sci-Fi, Adventure');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);
  const stickerPickerRef = useRef<HTMLDivElement | null>(null);

  const toggleAttachMenu = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowStickerPicker(false);
    setShowAttachMenu((prev) => !prev);
  };

  const toggleStickerPicker = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowAttachMenu(false);
    setShowStickerPicker((prev) => !prev);
  };

  const closeAllMenus = () => {
    setShowAttachMenu(false);
    setShowStickerPicker(false);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        showAttachMenu &&
        attachMenuRef.current &&
        !attachMenuRef.current.contains(target)
      ) {
        setShowAttachMenu(false);
      }
      if (
        showStickerPicker &&
        stickerPickerRef.current &&
        !stickerPickerRef.current.contains(target)
      ) {
        setShowStickerPicker(false);
      }
    };

    if (showAttachMenu || showStickerPicker) {
      document.addEventListener('mousedown', handleDocumentClick);
      document.addEventListener('touchstart', handleDocumentClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('touchstart', handleDocumentClick);
    };
  }, [showAttachMenu, showStickerPicker]);

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

  const handleCancelPendingImage = () => {
    if (pendingImage?.previewUrl) {
      URL.revokeObjectURL(pendingImage.previewUrl);
    }
    setPendingImage(null);
  };

  const handleToggleViewOnce = () => {
    if (!pendingImage) return;
    if (!pendingImage.isViewOnce) {
      // Show browser disclaimer modal first as requested
      setShowViewOnceModal(true);
    } else {
      setPendingImage((prev) => (prev ? { ...prev, isViewOnce: false } : null));
    }
  };

  const handleConfirmViewOnce = () => {
    setPendingImage((prev) => (prev ? { ...prev, isViewOnce: true } : null));
    setShowViewOnceModal(false);
  };

  const handleSend = async () => {
    if (isUploading) return;

    if (pendingImage) {
      try {
        setIsUploading(true);
        const uploadedUrl = await uploadChatImage(pendingImage.file);
        const isVO = Boolean(pendingImage.isViewOnce);
        const caption = text.trim();
        const messageType: 'view_once' | 'image' = isVO ? 'view_once' : 'image';

        const meta: any = {
          fileName: pendingImage.file.name,
          fileSize: `${(pendingImage.file.size / 1024).toFixed(0)} KB`,
        };
        if (isVO) {
          meta.isViewOnce = true;
          meta.viewOnceOpened = false;
        }

        onSendMessage(
          caption,
          messageType,
          uploadedUrl,
          meta
        );
        handleCancelPendingImage();
        setText('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        if (onTyping) onTyping(false);
      } catch (err) {
        console.error('Failed to send image:', err);
      } finally {
        setIsUploading(false);
      }
      return;
    }

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

  // Global keydown typing listener: typing any key anywhere auto-focuses the chat input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if any modal/prompt is currently open
      if (
        showPlanPrompt ||
        showGamePrompt ||
        showMoviePrompt ||
        showDrawSticker ||
        showViewOnceModal
      ) {
        return;
      }

      // Check if user is typing in another input / textarea / editable element
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      // Ignore browser hotkeys (Cmd, Ctrl, Alt)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // If enter pressed outside input bar, focus and send
      if (e.key === 'Enter') {
        e.preventDefault();
        textareaRef.current?.focus();
        if (text.trim() || pendingImage) {
          handleSend();
        }
        return;
      }

      // For any printable single character key: auto-focus textarea so it types into it
      if (e.key.length === 1) {
        textareaRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    showPlanPrompt,
    showGamePrompt,
    showMoviePrompt,
    showDrawSticker,
    showViewOnceModal,
    text,
    pendingImage,
    isUploading,
  ]);

  // Cleanup audio tracks and timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Real Voice Recording with MediaRecorder
  const startRecording = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      alert('Microphone recording is not supported in this browser environment.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Select best supported audio format
      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      waveformSamplesRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      // Set up live AudioContext to sample real voice levels and animate waveform
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const sampleAudio = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const normalized = Math.min(100, Math.max(15, Math.round((avg / 255) * 100)));
            waveformSamplesRef.current.push(normalized);
            setLiveVolumeBars((prev) => [...prev.slice(1), normalized]);
            animationFrameRef.current = requestAnimationFrame(sampleAudio);
          };
          animationFrameRef.current = requestAnimationFrame(sampleAudio);
        }
      } catch (err) {
        console.warn('AudioContext visualization setup error:', err);
      }

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Microphone access was denied. Please allow microphone permission in your browser address bar to record and send voice notes.');
      } else {
        alert('Could not access microphone: ' + (err.message || 'Please check your microphone connection.'));
      }
    }
  };

  const stopAndSendRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    const recorder = mediaRecorderRef.current;
    const finalDuration = Math.max(recordingSeconds, 1);

    // Downsample collected waveform into 22 bars
    let finalWaveform = [30, 45, 75, 90, 60, 40, 80, 100, 70, 50, 65, 85, 45, 95, 60, 40, 70, 85, 60, 35, 50, 40];
    if (waveformSamplesRef.current.length > 5) {
      const samples = waveformSamplesRef.current;
      const step = samples.length / 22;
      finalWaveform = Array.from({ length: 22 }, (_, i) => samples[Math.floor(i * step)] || 30);
    }

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const blobType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });

        // Release hardware mic stream
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }

        // Convert audio to data URL for complete self-contained persistence & cross-device playback
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const audioDataUrl = reader.result as string;
          if (onSendVoice && audioDataUrl) {
            onSendVoice(finalDuration, audioDataUrl, finalWaveform);
          }
        };
      };

      recorder.stop();
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (onSendVoice) {
        onSendVoice(finalDuration);
      }
    }

    setIsRecording(false);
    setRecordingSeconds(0);
    mediaRecorderRef.current = null;
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    audioChunksRef.current = [];
    waveformSamplesRef.current = [];
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setPendingImage({
        file,
        previewUrl,
        isViewOnce: false,
      });
      setShowAttachMenu(false);
    }
    if (e.target) {
      e.target.value = '';
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

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingGame) return;
    setIsCreatingGame(true);
    try {
      let session = getStoredSession();
      if (!session) {
        session = await ensureSession();
      }

      const rawType = selectedGame;
      const cleanType = (rawType === 'doodle' ? 'doodle-duel' : (rawType === 'tictactoe' ? 'tic-tac-toe' : rawType)) as any;
      const maxPlayers = cleanType === 'ludo' ? 4 : (cleanType === 'tambola' ? 20 : 2);

      let roomCode = '';
      try {
        const res = await createGameRoom(session.token, cleanType, maxPlayers, false);
        if (res?.room?.roomCode) {
          roomCode = res.room.roomCode;
        }
      } catch (createErr) {
        console.warn('Could not pre-create room via API, falling back to prefix room code:', createErr);
      }

      if (!roomCode) {
        let prefix = 'LUDO';
        if (cleanType.includes('bingo')) prefix = 'BINGO';
        else if (cleanType.includes('chess')) prefix = 'CHESS';
        else if (cleanType.includes('doodle')) prefix = 'DOODLE';
        else if (cleanType.includes('tic')) prefix = 'TIC';
        else if (cleanType.includes('four') || cleanType.includes('connect')) prefix = 'FOUR';
        else if (cleanType.includes('tambola')) prefix = 'TAMBOLA';
        roomCode = `${prefix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      }

      if (onSendGame) {
        onSendGame({
          gameType: cleanType,
          roomCode: roomCode,
          roomId: roomCode,
          title: `${getGameTitle(cleanType)} Challenge`,
          playersCount: 1,
          maxPlayers: cleanType === 'ludo' ? 4 : (cleanType === 'tambola' ? 20 : 2),
          hostName: session.user.displayName,
          status: 'waiting',
        });
      }
      setShowGamePrompt(false);
    } catch (err: any) {
      console.error('Failed to create game challenge:', err);
    } finally {
      setIsCreatingGame(false);
    }
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
              {formatReplySnippet(replyingTo.content)}
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

      {/* Pending Image Preview Bar (before sending) */}
      {pendingImage && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 mb-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-800/95 border border-slate-200/80 dark:border-zinc-700/60 shadow-xs animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-black/10 shrink-0 border border-black/10 dark:border-white/10">
              <img
                src={pendingImage.previewUrl}
                alt="Selected preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate max-w-[140px] sm:max-w-xs">
                {pendingImage.file.name}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                {(pendingImage.file.size / 1024).toFixed(0)} KB • Ready to send
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* WhatsApp-Style View Once Button (1) */}
            <button
              type="button"
              onClick={handleToggleViewOnce}
              className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-bold transition cursor-pointer select-none ${
                pendingImage.isViewOnce
                  ? 'bg-[#ee1d49] text-white shadow-xs shadow-[#ee1d49]/30 ring-2 ring-[#ee1d49]/40'
                  : 'bg-white dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-600 hover:border-[#ee1d49]/50'
              }`}
              title={pendingImage.isViewOnce ? 'View once is enabled (tap to disable)' : 'Set photo to view once (tap to enable)'}
            >
              <div
                className={`w-4 h-4 rounded-full border-1.5 flex items-center justify-center text-[10px] font-black ${
                  pendingImage.isViewOnce ? 'border-white text-white' : 'border-current'
                }`}
              >
                1
              </div>
              <span className="text-[11px] font-semibold">
                {pendingImage.isViewOnce ? 'View once ON' : 'View once'}
              </span>
            </button>

            {/* Cancel / Remove Image */}
            <button
              type="button"
              onClick={handleCancelPendingImage}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-700 transition cursor-pointer"
              title="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-[#ee1d49] animate-ping shrink-0" />
            <span className="text-sm font-bold text-[#ee1d49] tabular-nums shrink-0">
              Recording: {Math.floor(recordingSeconds / 60)}:
              {recordingSeconds % 60 < 10 ? '0' : ''}
              {recordingSeconds % 60}
            </span>

            {/* Live Volume Bars */}
            <div className="flex items-center gap-0.5 h-6 pl-1">
              {liveVolumeBars.map((val, idx) => (
                <div
                  key={idx}
                  className="w-1 bg-[#ee1d49] rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(4, (val / 100) * 22)}px` }}
                />
              ))}
            </div>
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
          <div className="relative" ref={attachMenuRef}>
            <button
              type="button"
              onClick={toggleAttachMenu}
              className={`p-2.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer ${
                showAttachMenu ? 'rotate-45 bg-slate-100 dark:bg-zinc-800' : ''
              }`}
              title="Add plan, game, movie or image"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Attach Drawer Popup */}
            {showAttachMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowAttachMenu(false)}
                />
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-12 left-0 w-52 p-1.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl border border-slate-200/80 dark:border-zinc-800 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95"
                >
                  <button
                    type="button"
                    onClick={() => {
                      closeAllMenus();
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
                      closeAllMenus();
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
                      closeAllMenus();
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
                      closeAllMenus();
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
                      closeAllMenus();
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-left cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-500" />
                    <span>Attach Image</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Emoji / Sticker Button */}
          <div className="relative" ref={stickerPickerRef}>
            <button
              type="button"
              onClick={toggleStickerPicker}
              className={`p-2.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer ${
                showStickerPicker ? 'bg-slate-100 dark:bg-zinc-800 text-[#ee1d49]' : ''
              }`}
              title="Stickers & Emojis"
            >
              <Smile className="w-5 h-5" />
            </button>

            {showStickerPicker && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowStickerPicker(false)}
                />
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-14 left-0 z-50"
                >
                  <StickerPicker
                    onSelectSticker={(sticker, caption) => {
                      if (/^\p{Extended_Pictographic}+$/u.test(sticker.trim())) {
                        setText((prev) => prev + sticker);
                        textareaRef.current?.focus();
                        return;
                      }
                      const serialized = serializeStickerMessage(sticker, caption);
                      const foundSticker = STICKER_PACK.find(
                        (s) => s.id.toLowerCase() === sticker.trim().toLowerCase()
                      );
                      const mediaUrl =
                        foundSticker?.gifUrl ||
                        foundSticker?.webpUrl ||
                        (sticker.startsWith('http') || sticker.startsWith('data:') ? sticker : undefined);

                      onSendMessage(
                        serialized,
                        'sticker',
                        mediaUrl,
                        foundSticker ? { sticker: foundSticker } : undefined
                      );
                      setShowStickerPicker(false);
                    }}
                    onOpenDrawModal={() => {
                      closeAllMenus();
                      setShowDrawSticker(true);
                    }}
                    onClose={() => setShowStickerPicker(false)}
                  />
                </div>
              </>
            )}
          </div>

          {/* Text / Caption Input Area */}
          <div className="flex-1 relative flex items-center bg-slate-100/90 dark:bg-zinc-800/80 rounded-2xl px-3.5 py-1.5 focus-within:ring-2 focus-within:ring-[#ee1d49]/30 transition border-0 outline-none">
            <textarea
              ref={textareaRef}
              value={text}
              onFocus={closeAllMenus}
              onClick={closeAllMenus}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={pendingImage ? "Add a caption (optional)..." : "Type a message..."}
              rows={1}
              style={{ outline: 'none', boxShadow: 'none' }}
              className="w-full bg-transparent border-0 resize-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 max-h-32 py-1 leading-normal shadow-none"
            />
          </div>

          {/* Send or Voice Record Button */}
          {text.trim() || pendingImage ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={isUploading}
              className="p-2.5 rounded-xl bg-[#ee1d49] hover:bg-[#d61840] disabled:opacity-60 text-white shadow-xs transition active:scale-95 cursor-pointer shrink-0"
              title={pendingImage ? "Send photo" : "Send message"}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
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

      {/* View Once Browser Disclaimer Modal */}
      {showViewOnceModal && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setShowViewOnceModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4 text-center animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="w-14 h-14 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-[#ee1d49] mx-auto flex items-center justify-center font-black text-xl border-2 border-[#ee1d49]">
                1
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Photo Set to View Once
                </h3>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-300 px-2">
                  For privacy, this photo can only be opened once. However, as this is a web-based app, recipients can still take screenshots or screen recordings. Please send images at your own risk.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleConfirmViewOnce}
                  className="w-full py-2.5 rounded-2xl bg-[#ee1d49] hover:bg-[#d61840] text-white font-bold text-xs shadow-md shadow-rose-500/20 transition active:scale-98 cursor-pointer"
                >
                  Send as View Once
                </button>
                <button
                  type="button"
                  onClick={() => setShowViewOnceModal(false)}
                  className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 text-xs font-semibold transition cursor-pointer"
                >
                  Keep as Regular Photo
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
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
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setShowPlanPrompt(false)}
          >
            <form
              onSubmit={handleCreatePlan}
              onClick={(e) => e.stopPropagation()}
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
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setShowGamePrompt(false)}
          >
            <form
              onSubmit={handleCreateGame}
              onClick={(e) => e.stopPropagation()}
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
                    { id: 'ludo', label: '🎲 Ludo Party' },
                    { id: 'bingo', label: '🔢 Bingo Duel' },
                    { id: 'chess', label: '♟️ Chess Duel' },
                    { id: 'doodle-duel', label: '🎨 Doodle Duel' },
                    { id: 'tic-tac-toe', label: '⭕ Tic-Tac-Toe' },
                    { id: 'four-in-a-row', label: '🔴 Four in a Row' },
                    { id: 'tambola', label: '🎟️ Tambola' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGame(g.id)}
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
                  disabled={isCreatingGame}
                  className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-600 dark:text-zinc-300 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingGame}
                  className="flex-1 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isCreatingGame ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Send Invite</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Quick Movie Modal */}
      {showMoviePrompt && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setShowMoviePrompt(false)}
          >
            <form
              onSubmit={handleCreateMovie}
              onClick={(e) => e.stopPropagation()}
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
