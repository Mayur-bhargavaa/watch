'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  STICKER_PACK,
  STICKER_CATEGORIES,
  WHATSAPP_REACTION_TAGS,
  TRENDING_GIFS,
  EMOJI_CATEGORIES,
  StickerItem
} from './StickersData';
import {
  Search,
  X,
  Plus,
  ImagePlus,
  PenTool,
  Clock,
  Sparkles,
  Sticker as StickerIcon,
  Smile,
  Film
} from 'lucide-react';

import { useTheme } from '../../context/ThemeContext';

interface StickerPickerProps {
  onSelectSticker: (stickerIdOrUrl: string, caption?: string) => void;
  onClose: () => void;
  onOpenDrawModal?: () => void;
}

export function StickerPicker({ onSelectSticker, onClose, onOpenDrawModal }: StickerPickerProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [activeMode, setActiveMode] = useState<'emoji' | 'gif' | 'stickers'>('stickers');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeReactionTag, setActiveReactionTag] = useState<string>('');
  const lastClickTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectSticker = (stickerIdOrUrl: string, caption?: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const now = Date.now();
    if (now - lastClickTimeRef.current < 400) return;
    lastClickTimeRef.current = now;
    onSelectSticker(stickerIdOrUrl, caption);
  };

  // Custom Sticker Upload from device
  const handleCustomStickerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (dataUrl) {
        onSelectSticker(dataUrl, 'Custom Sticker');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Filtered stickers based on category and search
  const filteredStickers = useMemo(() => {
    let list = STICKER_PACK;
    if (selectedCategory !== 'all') {
      list = list.filter((s) => s.category === selectedCategory);
    }
    const q = (searchQuery || activeReactionTag).trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        return (
          s.name.toLowerCase().includes(q) ||
          s.tagline.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
        );
      });
    }
    return list;
  }, [selectedCategory, searchQuery, activeReactionTag]);

  // Filtered GIFs
  const filteredGifs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return TRENDING_GIFS;
    return TRENDING_GIFS.filter(
      (g) => g.name.toLowerCase().includes(q) || g.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] w-84 sm:w-[410px] max-w-[95vw] h-[520px] flex flex-col overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150 z-50 font-sans border transition-colors ${
        isDark
          ? 'bg-[#111b21] text-zinc-100 border-[#222e35]'
          : 'bg-[#ffffff] text-slate-900 border-slate-200 shadow-xl'
      }`}
    >
      {/* Hidden File Input for "Create Sticker" */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleCustomStickerUpload}
        className="hidden"
      />

      {/* Top Search Bar (WhatsApp style) */}
      <div
        className={`p-3 pb-2 flex items-center gap-2 border-b ${
          isDark ? 'border-[#202c33]' : 'border-slate-100'
        }`}
      >
        <div className="relative flex-1">
          <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
            isDark ? 'text-zinc-400' : 'text-slate-400'
          }`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActiveReactionTag('');
            }}
            placeholder="Search with text or emoji"
            className={`w-full text-xs sm:text-sm rounded-xl pl-9 pr-8 py-2 border transition focus:outline-hidden ${
              isDark
                ? 'bg-[#202c33] text-white placeholder-zinc-400 border-transparent focus:border-[#00a884]'
                : 'bg-slate-100 text-slate-900 placeholder-slate-400 border-slate-200 focus:border-[#00a884]'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full cursor-pointer ${
                isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {onOpenDrawModal && (
          <button
            type="button"
            onClick={onOpenDrawModal}
            className={`p-2 rounded-xl transition cursor-pointer ${
              isDark
                ? 'text-zinc-300 hover:text-white hover:bg-white/10'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Draw custom sticker"
          >
            <PenTool className="w-4 h-4 text-[#00a884]" />
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className={`p-2 rounded-xl transition cursor-pointer ${
            isDark
              ? 'text-zinc-400 hover:text-white hover:bg-white/10'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Segmented Mode Switcher: Emoji | GIF | Stickers */}
      <div
        className={`flex items-center justify-center pt-2 pb-1 ${
          isDark ? 'bg-[#111b21]' : 'bg-white'
        }`}
      >
        <div
          className={`flex items-center p-0.5 rounded-full border shadow-inner ${
            isDark ? 'bg-[#202c33] border-white/5' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveMode('emoji')}
            className={`flex items-center justify-center w-11 h-7 rounded-full text-sm transition cursor-pointer ${
              activeMode === 'emoji'
                ? 'bg-[#00a884] text-white shadow-xs'
                : isDark
                ? 'text-zinc-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Emojis"
          >
            <Smile className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('gif')}
            className={`flex items-center justify-center px-3.5 h-7 rounded-full text-[11px] font-bold tracking-wider transition cursor-pointer ${
              activeMode === 'gif'
                ? 'bg-[#00a884] text-white shadow-xs'
                : isDark
                ? 'text-zinc-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="GIFs"
          >
            GIF
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('stickers')}
            className={`flex items-center justify-center w-11 h-7 rounded-full transition cursor-pointer ${
              activeMode === 'stickers'
                ? 'bg-[#00a884] text-white shadow-xs'
                : isDark
                ? 'text-zinc-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Stickers"
          >
            <StickerIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* WhatsApp-Style Quick Reaction Tags */}
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto no-scrollbar scroll-smooth shrink-0 border-b ${
          isDark ? 'border-[#202c33]' : 'border-slate-100'
        }`}
      >
        {WHATSAPP_REACTION_TAGS.map((tag) => {
          const isActive =
            (tag.query === '' && !activeReactionTag && !searchQuery) ||
            activeReactionTag === tag.query;
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => {
                setActiveReactionTag(tag.query);
                setSearchQuery('');
                if (activeMode !== 'stickers') setActiveMode('stickers');
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border active:scale-95 ${
                isActive
                  ? 'bg-[#00a884] text-white border-[#00a884] shadow-xs'
                  : isDark
                  ? 'bg-[#202c33] text-zinc-300 hover:text-white border-white/5 hover:bg-[#2a3942]'
                  : 'bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <span>{tag.icon}</span>
              <span>{tag.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div
        className={`flex-1 overflow-y-auto min-h-0 ${
          isDark ? 'bg-[#0c1317]/60' : 'bg-slate-50/70'
        }`}
      >
        {/* MODE 1: STICKERS (WhatsApp Grid) */}
        {activeMode === 'stickers' && (
          <div className="grid grid-cols-4 gap-2.5 p-3">
            {/* First Item: Create Sticker Tile */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`aspect-square rounded-2xl border flex flex-col items-center justify-center p-2 text-center transition cursor-pointer group active:scale-95 shadow-xs ${
                isDark
                  ? 'bg-[#202c33]/90 hover:bg-[#2a3942] border-white/10'
                  : 'bg-white hover:bg-slate-100 border-slate-200'
              }`}
              title="Create custom sticker from photo"
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1 transition ${
                  isDark
                    ? 'bg-white/5 group-hover:bg-[#00a884]/20'
                    : 'bg-slate-100 group-hover:bg-[#00a884]/15'
                }`}
              >
                <ImagePlus
                  className={`w-4 h-4 group-hover:text-[#00a884] ${
                    isDark ? 'text-zinc-300' : 'text-slate-600'
                  }`}
                />
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-bold leading-tight ${
                  isDark ? 'text-zinc-200' : 'text-slate-800'
                }`}
              >
                Create sticker
              </span>
            </div>

            {/* Sticker Items: Pure transparent sticker graphics */}
            {filteredStickers.map((sticker) => (
              <div
                key={sticker.id}
                onClick={(e) => handleSelectSticker(sticker.id, sticker.name, e)}
                className={`aspect-square flex items-center justify-center p-1 rounded-2xl transition duration-150 cursor-pointer group select-none active:scale-90 relative ${
                  isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
                }`}
                title={sticker.name}
              >
                {sticker.gifUrl || sticker.webpUrl ? (
                  <img
                    src={sticker.gifUrl || sticker.webpUrl}
                    alt={sticker.name}
                    className="w-full h-full object-contain filter drop-shadow-sm group-hover:scale-110 transition-transform duration-200 pointer-events-none"
                    loading="lazy"
                  />
                ) : sticker.drawingSvg ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: sticker.drawingSvg }}
                    className="w-full h-full flex items-center justify-center group-hover:scale-110 transition-transform"
                  />
                ) : (
                  <span className="text-4xl group-hover:scale-125 transition-transform">
                    {sticker.emoji || '✨'}
                  </span>
                )}
              </div>
            ))}

            {filteredStickers.length === 0 && (
              <div className="col-span-4 py-12 text-center text-zinc-400">
                <StickerIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-semibold">No stickers found for &quot;{searchQuery}&quot;</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveReactionTag('');
                    setSelectedCategory('all');
                  }}
                  className="mt-2 text-xs font-bold text-[#00a884] hover:underline cursor-pointer"
                >
                  View All Stickers
                </button>
              </div>
            )}
          </div>
        )}

        {/* MODE 2: GIFS (Giphy Grid) */}
        {activeMode === 'gif' && (
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 p-3">
            {filteredGifs.map((gif) => (
              <div
                key={gif.id}
                onClick={(e) => handleSelectSticker(gif.url, gif.name, e)}
                className={`aspect-4/3 rounded-xl overflow-hidden border transition cursor-pointer relative group ${
                  isDark
                    ? 'bg-[#202c33] border-white/5 hover:border-[#00a884]'
                    : 'bg-white border-slate-200 hover:border-[#00a884]'
                }`}
                title={gif.name}
              >
                <img
                  src={gif.url}
                  alt={gif.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent text-[10px] font-semibold text-white truncate">
                  {gif.name}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODE 3: EMOJIS (Categorized WhatsApp Palette) */}
        {activeMode === 'emoji' && (
          <div className="p-3 space-y-3">
            {EMOJI_CATEGORIES.map((cat) => (
              <div key={cat.name}>
                <h4
                  className={`text-[11px] font-bold mb-1.5 uppercase tracking-wider ${
                    isDark ? 'text-zinc-400' : 'text-slate-500'
                  }`}
                >
                  {cat.name}
                </h4>
                <div className="grid grid-cols-8 gap-1.5">
                  {cat.emojis.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => handleSelectSticker(emoji, undefined, e)}
                      className={`w-8 h-8 flex items-center justify-center text-xl rounded-lg transition active:scale-90 cursor-pointer ${
                        isDark ? 'hover:bg-white/10' : 'hover:bg-slate-200'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WhatsApp Bottom Pack Selector Bar */}
      <div
        className={`px-3 py-2 border-t flex items-center justify-between shrink-0 ${
          isDark ? 'bg-[#111b21] border-[#202c33]' : 'bg-white border-slate-100'
        }`}
      >
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setActiveMode('stickers');
              setActiveReactionTag('');
              setSearchQuery('');
            }}
            className={`p-1.5 rounded-xl transition cursor-pointer ${
              selectedCategory === 'all' && activeMode === 'stickers'
                ? isDark ? 'bg-[#202c33] text-[#00a884]' : 'bg-slate-100 text-[#00a884]'
                : isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="All Stickers"
          >
            <Clock className="w-4 h-4" />
          </button>

          {STICKER_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.id);
                setActiveMode('stickers');
                setActiveReactionTag('');
                setSearchQuery('');
              }}
              className={`px-2 py-1 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                selectedCategory === cat.id && activeMode === 'stickers'
                  ? isDark ? 'bg-[#202c33] text-[#00a884]' : 'bg-slate-100 text-[#00a884]'
                  : isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
              title={cat.label}
            >
              <span>{cat.icon}</span>
            </button>
          ))}
        </div>

        {/* Add / Create Button */}
        <button
          type="button"
          onClick={() => {
            if (onOpenDrawModal) onOpenDrawModal();
            else fileInputRef.current?.click();
          }}
          className={`p-1.5 rounded-xl text-[#00a884] transition cursor-pointer shrink-0 ml-1 ${
            isDark
              ? 'bg-[#202c33] hover:bg-[#2a3942] hover:text-emerald-300'
              : 'bg-slate-100 hover:bg-slate-200 hover:text-[#008f6f]'
          }`}
          title="Create or draw sticker"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * WhatsApp-style transparent free-floating sticker view for legacy cinema & game rooms
 */
export const StickerMessageView: React.FC<{ content: string }> = ({ content }) => {
  const { parseStickerMessage } = require('./StickersData');
  const sticker = parseStickerMessage(content);

  if (!sticker) {
    return (
      <div className="p-2 rounded-2xl bg-white/10 border border-white/10 text-rose-100 text-xs break-words">
        {content}
      </div>
    );
  }

  return (
    <div className="relative select-none group/sticker py-1">
      <div className="flex items-center justify-center">
        {sticker.gifUrl || sticker.webpUrl ? (
          <img
            src={sticker.gifUrl || sticker.webpUrl}
            alt={sticker.name || 'Sticker'}
            className="w-32 h-32 sm:w-40 sm:h-40 object-contain filter drop-shadow-md hover:scale-105 transition-transform duration-200"
            loading="lazy"
          />
        ) : sticker.drawingSvg ? (
          <div
            dangerouslySetInnerHTML={{ __html: sticker.drawingSvg }}
            className="w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center drop-shadow-md"
          />
        ) : (
          <span className="text-6xl drop-shadow-sm select-none">{sticker.emoji || '✨'}</span>
        )}
      </div>
    </div>
  );
};

