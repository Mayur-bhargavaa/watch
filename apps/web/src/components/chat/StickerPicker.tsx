'use client';

import React, { useState, useMemo } from 'react';
import {
  STICKER_PACK,
  STICKER_CATEGORIES,
  StickerItem,
  parseStickerMessage
} from './StickersData';
import { Sparkles, X, Search, Link as LinkIcon, Send } from 'lucide-react';

interface StickerPickerProps {
  onSelectSticker: (stickerIdOrUrl: string, caption?: string) => void;
  onClose: () => void;
}

export function StickerPicker({ onSelectSticker, onClose }: StickerPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCustomLinkInput, setShowCustomLinkInput] = useState(false);
  const [customGifUrl, setCustomGifUrl] = useState('');
  const [customCaption, setCustomCaption] = useState('');
  const lastClickTimeRef = React.useRef<number>(0);

  const handleSelectSticker = (stickerIdOrUrl: string, caption?: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const now = Date.now();
    if (now - lastClickTimeRef.current < 500) return;
    lastClickTimeRef.current = now;
    onSelectSticker(stickerIdOrUrl, caption);
  };

  // Filtered stickers based on active category and live search query
  const filteredStickers = useMemo(() => {
    let list = STICKER_PACK;
    if (selectedCategory !== 'all') {
      list = list.filter((s) => s.category === selectedCategory);
    }
    const q = searchQuery.trim().toLowerCase();
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
  }, [selectedCategory, searchQuery]);

  const handleSendCustomGif = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGifUrl.trim()) return;
    onSelectSticker(customGifUrl.trim(), customCaption.trim() || undefined);
    setCustomGifUrl('');
    setCustomCaption('');
    setShowCustomLinkInput(false);
  };

  return (
    <div className="bg-[#140b15]/95 border border-rose-500/40 rounded-3xl p-3 sm:p-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl w-80 sm:w-96 flex flex-col gap-2.5 max-h-[460px] select-none animate-in fade-in zoom-in-95 duration-150 z-50">
      {/* Header */}
      <div className="flex items-center justify-between pb-1 border-b border-rose-500/20">
        <div className="flex items-center gap-2 text-white">
          <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center shadow-md">
            <Sparkles className="w-3 h-3 text-white animate-pulse" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black tracking-wide bg-gradient-to-r from-rose-200 via-pink-300 to-amber-200 bg-clip-text text-transparent">
              GIPHY & Gen-Z Stickers
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 font-bold">
              Bubu Dudu ✨
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowCustomLinkInput((prev) => !prev)}
            className={`p-1.5 rounded-xl transition text-xs flex items-center gap-1 ${
              showCustomLinkInput
                ? 'bg-rose-500/30 text-pink-300 border border-rose-400/40'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
            title="Paste any GIPHY / GIF link"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Live Search Bar */}
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 absolute left-3 text-rose-300/50 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search Bubu, Dudu, Capybara, Slay, Cat..."
          className="w-full pl-9 pr-8 py-1.5 bg-black/40 border border-rose-500/30 rounded-xl text-xs text-white placeholder-rose-200/40 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400/30 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 p-0.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Expandable Custom Giphy / GIF Link Box */}
      {showCustomLinkInput && (
        <form
          onSubmit={handleSendCustomGif}
          className="p-2.5 rounded-2xl bg-black/50 border border-rose-500/30 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center justify-between text-[10px] text-rose-300/80 font-bold">
            <span>Paste any GIPHY or GIF link:</span>
          </div>
          <input
            type="url"
            value={customGifUrl}
            onChange={(e) => setCustomGifUrl(e.target.value)}
            placeholder="https://media.giphy.com/.../giphy.gif"
            className="w-full px-2.5 py-1.5 bg-zinc-900 border border-white/15 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-400"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customCaption}
              onChange={(e) => setCustomCaption(e.target.value)}
              placeholder="Tagline (optional)..."
              className="flex-1 px-2.5 py-1 bg-zinc-900 border border-white/15 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-400"
            />
            <button
              type="submit"
              disabled={!customGifUrl.trim()}
              className="px-3 py-1 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow"
            >
              <Send className="w-3 h-3" />
              <span>Send</span>
            </button>
          </div>
        </form>
      )}

      {/* Category Ribbon */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none scroll-smooth">
        {STICKER_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              setSelectedCategory(cat.id);
            }}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition whitespace-nowrap flex items-center gap-1 shrink-0 ${
              selectedCategory === cat.id
                ? 'bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 text-white shadow-md shadow-rose-950/60 scale-[1.02]'
                : 'bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Stickers Grid */}
      <div className="grid grid-cols-3 gap-2 overflow-y-auto pr-1 max-h-64 sm:max-h-72 scrollbar-thin scrollbar-thumb-rose-500/30">
        {filteredStickers.length === 0 ? (
          <div className="col-span-3 py-8 text-center text-rose-300/60 flex flex-col items-center justify-center gap-1">
            <span className="text-2xl">🐼❓</span>
            <p className="text-xs font-semibold">No stickers found for &quot;{searchQuery}&quot;</p>
            <p className="text-[10px] text-zinc-400">Try &quot;bubu&quot;, &quot;hug&quot;, &quot;cat&quot;, &quot;capybara&quot;, or &quot;slay&quot;</p>
          </div>
        ) : (
          filteredStickers.map((sticker) => (
            <button
              key={sticker.id}
              type="button"
              onClick={(e) => handleSelectSticker(sticker.id, undefined, e)}
              className={`group relative flex flex-col items-center justify-between p-2 rounded-2xl bg-gradient-to-br ${sticker.bgGradient} border ${sticker.borderColor} hover:scale-105 active:scale-95 transition-all duration-200 shadow-md hover:shadow-xl hover:border-white/40 cursor-pointer overflow-hidden min-h-[95px]`}
            >
              {/* Media: Animated Giphy GIF or Large Emoji */}
              <div className="flex-1 flex items-center justify-center w-full my-auto">
                {sticker.gifUrl ? (
                  <img
                    src={sticker.gifUrl}
                    alt={sticker.name}
                    className="w-16 h-16 sm:w-18 sm:h-18 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-200"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-3xl sm:text-4xl filter drop-shadow group-hover:scale-115 transition-transform duration-200">
                    {sticker.emoji}
                  </span>
                )}
              </div>

              {/* Sticker Tagline Banner */}
              <span
                className={`w-full mt-1 text-[8.5px] font-black uppercase tracking-tight text-center leading-tight truncate px-1 py-0.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 ${sticker.textColor} drop-shadow`}
              >
                {sticker.tagline}
              </span>

              {/* Sparkle Glow on Hover */}
              <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function StickerMessageView({ content }: { content: string }) {
  const sticker = parseStickerMessage(content);
  if (!sticker) return null;

  return (
    <div
      className="relative inline-flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-3xl border shadow-2xl hover:scale-105 transition-transform duration-200 select-none group/sticker my-1 backdrop-blur-md max-w-[200px]"
      style={{
        background: `linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(15, 8, 16, 0.65) 100%)`,
        borderColor: 'rgba(255, 255, 255, 0.18)'
      }}
    >
      {/* Animated Subtle Ambient Glow */}
      <div
        className={`absolute inset-0 rounded-3xl bg-gradient-to-tr ${sticker.bgGradient} opacity-60 blur-md group-hover/sticker:opacity-95 transition-opacity`}
      />

      {/* Visual Sticker: Animated GIF or Large Emoji */}
      <div className="relative z-10 flex items-center justify-center">
        {sticker.gifUrl ? (
          <img
            src={sticker.gifUrl}
            alt={sticker.name}
            className="w-28 h-28 sm:w-32 sm:h-32 object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.6)] group-hover/sticker:scale-105 transition-transform duration-200"
            loading="lazy"
          />
        ) : (
          <div className="text-5xl sm:text-6xl transform group-hover/sticker:scale-110 group-hover/sticker:rotate-3 transition-all duration-200 drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
            {sticker.emoji}
          </div>
        )}
      </div>

      {/* Illustrated Caption Tag */}
      <div className="relative z-10 mt-1.5 px-3 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/20 shadow-lg max-w-full">
        <span
          className={`text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider ${sticker.textColor} truncate block`}
        >
          {sticker.tagline}
        </span>
      </div>
    </div>
  );
}
