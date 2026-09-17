'use client';

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Check,
  Glasses,
  Palette,
  Shirt,
  Scissors,
  User,
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export interface AvatarConfig {
  seed: string;
  skinColor: string;
  top: string;
  hairColor: string;
  accessories: string;
  clothing: string;
  clothesColor: string;
  eyes: string;
  mouth: string;
  bgColor: string;
}

interface AvatarStudioProps {
  displayName?: string;
  value: string;
  onChange: (avatarUrl: string) => void;
}

// 3D Standing Clay/Plush Companions — all available looks
export const STANDING_COMPANIONS = [
  {
    id: 'standing_heart',
    name: 'Standing Heart Plush',
    tag: '3D Soft Plush with Glowing Heart & Folded Arms',
    emoji: '💗',
    url: '/avatars/standing_heart.png',
    preview: '/avatars/standing_heart.png'
  },
  {
    id: 'standing_cinema',
    name: 'On-Air Cinema Host',
    tag: '3D Plush with Studio Headphones & Folded Arms',
    emoji: '🎙️',
    url: '/avatars/standing_cinema.jpg',
    preview: '/avatars/standing_cinema.jpg'
  },
  {
    id: 'standing_star',
    name: 'Golden Star Persona',
    tag: '3D Plush with Shining Star & Warm Rim Light',
    emoji: '⭐',
    url: '/avatars/standing_star.jpg',
    preview: '/avatars/standing_star.jpg'
  },
  {
    id: 'standing_blush',
    name: 'Blushing Companion',
    tag: '3D Plush with Rosy Cheeks & Glowing Heart',
    emoji: '🌸',
    url: '/avatars/standing_blush.jpg',
    preview: '/avatars/standing_blush.jpg'
  },
  {
    id: 'standing_heart_cutout',
    name: 'Heart Cutout Edition',
    tag: 'Transparent Cutout with Heart Glow Effect',
    emoji: '❤️',
    url: '/avatars/standing_heart_cutout.png',
    preview: '/avatars/standing_heart_cutout.png'
  },
  {
    id: 'standing_heart_transparent',
    name: 'Crystal Heart Plush',
    tag: 'High-Res Crystal Clear Heart Companion',
    emoji: '💎',
    url: '/avatars/standing_heart_transparent.png',
    preview: '/avatars/standing_heart_transparent.png'
  }
];

// Aesthetic Palettes
const SKIN_TONES = [
  { id: 'ffd1b1', name: 'Fair', hex: '#ffd1b1' },
  { id: 'f8d25c', name: 'Golden', hex: '#f8d25c' },
  { id: 'edb98a', name: 'Warm', hex: '#edb98a' },
  { id: 'd08b5b', name: 'Caramel', hex: '#d08b5b' },
  { id: 'ae5d29', name: 'Deep Bronze', hex: '#ae5d29' },
  { id: '614335', name: 'Rich Espresso', hex: '#614335' }
];

const HAIR_STYLES = [
  { id: 'shortFlat', name: 'Classic Short' },
  { id: 'shortCurly', name: 'Curly Fade' },
  { id: 'shortRound', name: 'Crew Cut' },
  { id: 'shortWaved', name: 'Wavy Crop' },
  { id: 'bob', name: 'Sleek Bob' },
  { id: 'bun', name: 'Top Bun' },
  { id: 'straight01', name: 'Long Straight' },
  { id: 'curvy', name: 'Wavy Flow' },
  { id: 'dreads01', name: 'Dreadlocks' },
  { id: 'fro', name: 'Afro Puff' },
  { id: 'winterHat02', name: 'Beanie' }
];

const HAIR_COLORS = [
  { id: '2c1b18', name: 'Jet Black', hex: '#2c1b18' },
  { id: '4a312c', name: 'Dark Brunette', hex: '#4a312c' },
  { id: '724133', name: 'Warm Chestnut', hex: '#724133' },
  { id: 'b58143', name: 'Honey Blonde', hex: '#b58143' },
  { id: 'd6b370', name: 'Golden Blonde', hex: '#d6b370' },
  { id: 'c93305', name: 'Auburn Red', hex: '#c93305' },
  { id: 'e8e1e1', name: 'Platinum Silver', hex: '#cbd5e1' }
];

const ACCESSORIES = [
  { id: 'none', name: 'None' },
  { id: 'round', name: 'Round Glasses' },
  { id: 'prescription02', name: 'Modern Frames' },
  { id: 'sunglasses', name: 'Cool Sunglasses' },
  { id: 'wayfarers', name: 'Wayfarer Shades' }
];

const CLOTHING_OPTIONS = [
  { id: 'hoodie', name: 'Comfy Hoodie' },
  { id: 'graphicShirt', name: 'Cinema Tee' },
  { id: 'shirtCrewNeck', name: 'Crewneck' },
  { id: 'blazerAndShirt', name: 'Chic Blazer' },
  { id: 'collarAndSweater', name: 'Smart Sweater' }
];

const BG_PALETTES = [
  { id: 'd2281e', name: 'Watch Red', hex: '#d2281e' },
  { id: '09090b', name: 'Midnight', hex: '#09090b' },
  { id: '4338ca', name: 'Indigo Night', hex: '#4338ca' },
  { id: '047857', name: 'Emerald', hex: '#047857' },
  { id: 'b91c1c', name: 'Crimson', hex: '#b91c1c' },
  { id: 'db2777', name: 'Sunset Rose', hex: '#db2777' },
  { id: 'd97706', name: 'Warm Amber', hex: '#d97706' }
];

const PRESETS: Array<{ name: string; tag: string; config: Partial<AvatarConfig> }> = [
  {
    name: 'The Cinephile',
    tag: 'Popcorn Ready',
    config: {
      skinColor: 'ffd1b1',
      top: 'shortWaved',
      hairColor: '2c1b18',
      accessories: 'round',
      clothing: 'hoodie',
      clothesColor: 'd2281e',
      eyes: 'happy',
      mouth: 'smile',
      bgColor: '09090b'
    }
  },
  {
    name: 'The Gamer',
    tag: 'Ready Player 1',
    config: {
      skinColor: 'f8d25c',
      top: 'shortCurly',
      hairColor: '4a312c',
      accessories: 'wayfarers',
      clothing: 'graphicShirt',
      clothesColor: '25557c',
      eyes: 'wink',
      mouth: 'smile',
      bgColor: 'd2281e'
    }
  },
  {
    name: 'Cozy Partner',
    tag: 'Movie Night',
    config: {
      skinColor: 'edb98a',
      top: 'bun',
      hairColor: '724133',
      accessories: 'none',
      clothing: 'collarAndSweater',
      clothesColor: 'e6e6e6',
      eyes: 'happy',
      mouth: 'smile',
      bgColor: '4338ca'
    }
  },
  {
    name: 'Cool Shades',
    tag: 'VIP Lounge',
    config: {
      skinColor: 'ae5d29',
      top: 'shortFlat',
      hairColor: '2c1b18',
      accessories: 'sunglasses',
      clothing: 'blazerAndShirt',
      clothesColor: '262e33',
      eyes: 'default',
      mouth: 'serious',
      bgColor: '047857'
    }
  },
  {
    name: 'Casual Chill',
    tag: 'Weekend Vibe',
    config: {
      skinColor: 'd08b5b',
      top: 'straight01',
      hairColor: 'c93305',
      accessories: 'prescription02',
      clothing: 'shirtCrewNeck',
      clothesColor: 'ff5c5c',
      eyes: 'happy',
      mouth: 'smile',
      bgColor: 'db2777'
    }
  },
  {
    name: 'Night Owl',
    tag: 'Midnight Streamer',
    config: {
      skinColor: '614335',
      top: 'winterHat02',
      hairColor: '2c1b18',
      accessories: 'none',
      clothing: 'hoodie',
      clothesColor: '929598',
      eyes: 'wink',
      mouth: 'twinkle',
      bgColor: 'd97706'
    }
  }
];

function buildDiceBearUrl(cfg: AvatarConfig): string {
  const params = new URLSearchParams();
  params.set('seed', cfg.seed);
  params.set('skinColor', cfg.skinColor);
  params.set('top', cfg.top);
  params.set('hairColor', cfg.hairColor);
  if (cfg.accessories && cfg.accessories !== 'none') {
    params.set('accessories', cfg.accessories);
    params.set('accessoriesProbability', '100');
  } else {
    params.set('accessoriesProbability', '0');
  }
  params.set('clothing', cfg.clothing);
  params.set('clothesColor', cfg.clothesColor);
  params.set('eyes', cfg.eyes || 'happy');
  params.set('mouth', cfg.mouth || 'smile');
  params.set('backgroundColor', cfg.bgColor);
  params.set('radius', '0');

  return `https://api.dicebear.com/7.x/avataaars/svg?${params.toString()}`;
}

export function AvatarStudio({ displayName, value, onChange }: AvatarStudioProps) {
  // Start on 3D standing companions by default
  const isDirectStanding = Boolean(value && value.startsWith('/avatars/'));
  const [activeTab, setActiveTab] = useState<'standing' | 'appearance' | 'style' | 'presets'>(
    'standing'
  );

  const [standingUrl, setStandingUrl] = useState<string>(
    isDirectStanding ? value : '/avatars/standing_heart.png'
  );

  const [useStanding, setUseStanding] = useState<boolean>(isDirectStanding || !value);

  // Carousel index for step-by-step browsing of 3D looks
  const initialIdx = isDirectStanding
    ? Math.max(0, STANDING_COMPANIONS.findIndex((c) => c.url === value))
    : 0;
  const [carouselIndex, setCarouselIndex] = useState<number>(initialIdx);

  const [config, setConfig] = useState<AvatarConfig>(() => {
    return {
      seed: displayName ? displayName.toLowerCase().replace(/\s+/g, '') : 'watchfan',
      skinColor: 'edb98a',
      top: 'shortWaved',
      hairColor: '2c1b18',
      accessories: 'none',
      clothing: 'hoodie',
      clothesColor: 'd2281e',
      eyes: 'happy',
      mouth: 'smile',
      bgColor: 'd2281e'
    };
  });

  const generatedUrl = useMemo(() => {
    return buildDiceBearUrl(config);
  }, [config]);

  const activeAvatarUrl = useStanding ? standingUrl : generatedUrl;

  // Sync to parent
  React.useEffect(() => {
    onChange(activeAvatarUrl);
  }, [activeAvatarUrl, onChange]);

  const handleSelectStanding = (url: string) => {
    setStandingUrl(url);
    setUseStanding(true);
  };

  // Carousel navigation
  const handleCarouselPrev = () => {
    setCarouselIndex((prev) => (prev - 1 + STANDING_COMPANIONS.length) % STANDING_COMPANIONS.length);
  };
  const handleCarouselNext = () => {
    setCarouselIndex((prev) => (prev + 1) % STANDING_COMPANIONS.length);
  };

  const handleApplyPreset = (presetConfig: Partial<AvatarConfig>) => {
    setUseStanding(false);
    setConfig(prev => ({
      ...prev,
      ...presetConfig
    }));
  };

  return (
    <div className="space-y-5">
      {/* Studio Header & Hero Standing Preview */}
      <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-3xl bg-zinc-50 border border-zinc-200">
        
        {/* 3D Standing Stage Preview with Bottom Counter Bar */}
        <div className="relative group shrink-0">
          <div className="w-24 h-28 sm:w-28 sm:h-32 rounded-t-3xl rounded-b-2xl border-2 border-[#d2281e]/60 shadow-xl overflow-hidden bg-zinc-950 flex items-end justify-center relative">
            <img
              src={activeAvatarUrl}
              alt="Avatar Persona Preview"
              className="w-full h-full object-cover object-bottom transition-transform duration-300 group-hover:scale-105"
            />
            {/* Ledge / Bar bottom counter matching reference image */}
            <div className="absolute bottom-0 inset-x-0 h-1.5 bg-[#d2281e] shadow-[0_0_10px_rgba(210,40,30,0.9)]" />
          </div>

          {/* Selected indicator */}
          {useStanding && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#d2281e] text-white rounded-full shadow-lg flex items-center justify-center">
              <Check className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        {/* Persona Identity Badge & Controls */}
        <div className="flex-1 text-center sm:text-left space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#d2281e]/10 text-[#d2281e] text-[10.5px] font-black uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            <span>3D Standing Persona Stage</span>
          </div>

          <h3 className="text-sm sm:text-base font-black text-zinc-950 tracking-tight">
            {displayName ? `${displayName}'s Standing Avatar` : 'Your Standing Cinema Avatar'}
          </h3>

          {/* Show currently selected look name always */}
          {useStanding ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#d2281e]">✓ Selected:</span>
              <span className="text-[11px] text-zinc-700 font-semibold">
                {STANDING_COMPANIONS.find((c) => c.url === standingUrl)?.name ?? 'Custom Look'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#d2281e]">✓ Selected:</span>
              <span className="text-[11px] text-zinc-700 font-semibold">Custom Avatar</span>
            </div>
          )}

          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Browse all looks using ← → below and click <strong>Select This Look</strong>.
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex rounded-2xl bg-zinc-100 p-1 border border-zinc-200 text-xs font-bold overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('standing')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition shrink-0 ${
            activeTab === 'standing'
              ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/80'
              : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-[#d2281e]" />
          <span>3D Standing Characters</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('appearance'); setUseStanding(false); }}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition shrink-0 ${
            activeTab === 'appearance'
              ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/80'
              : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <Scissors className="w-3.5 h-3.5 text-[#d2281e]" />
          <span>Hair & Skin</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('style'); setUseStanding(false); }}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition shrink-0 ${
            activeTab === 'style'
              ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/80'
              : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <Shirt className="w-3.5 h-3.5 text-[#d2281e]" />
          <span>Style & Mood</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('presets'); setUseStanding(false); }}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition shrink-0 ${
            activeTab === 'presets'
              ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/80'
              : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <Palette className="w-3.5 h-3.5 text-[#d2281e]" />
          <span>Presets</span>
        </button>
      </div>

      {/* Tab 1: 3D STANDING COMPANIONS — Full Carousel */}
      {activeTab === 'standing' && (() => {
        const comp = STANDING_COMPANIONS[carouselIndex];
        const isSelected = useStanding && standingUrl === comp.url;
        return (
          <div className="space-y-4">
            {/* Step counter */}
            <div className="flex items-center justify-center gap-2">
              {STANDING_COMPANIONS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCarouselIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === carouselIndex
                      ? 'bg-[#d2281e] scale-125'
                      : 'bg-zinc-300 hover:bg-zinc-400'
                  }`}
                />
              ))}
              <span className="text-[10px] text-zinc-400 font-mono ml-1">
                {carouselIndex + 1}/{STANDING_COMPANIONS.length}
              </span>
            </div>

            {/* Large carousel card */}
            <div className={`relative rounded-3xl border-2 overflow-hidden transition-all ${
              isSelected
                ? 'border-[#d2281e] shadow-xl ring-4 ring-[#d2281e]/20'
                : 'border-zinc-200 shadow-md'
            }`}>
              {/* Avatar image — large */}
              <div className="bg-zinc-950 flex items-end justify-center" style={{ height: 220 }}>
                <img
                  src={comp.preview}
                  alt={comp.name}
                  className="h-full w-full object-cover object-bottom transition-all duration-300"
                />
                <div className="absolute bottom-0 inset-x-0 h-2 bg-[#d2281e] shadow-[0_0_12px_rgba(210,40,30,0.9)]" />
              </div>

              {/* Selected badge overlay */}
              {isSelected && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#d2281e] text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg">
                  <Check className="w-3 h-3" />
                  <span>Selected</span>
                </div>
              )}

              {/* Info strip */}
              <div className="bg-white px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-black text-zinc-900">
                    {comp.emoji} {comp.name}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{comp.tag}</div>
                </div>
              </div>
            </div>

            {/* Navigation row */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCarouselPrev}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-bold text-zinc-700 transition active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleSelectStanding(comp.url);
                }}
                className={`flex-[2] py-2.5 rounded-2xl text-xs font-black transition active:scale-95 flex items-center justify-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                    : 'bg-[#d2281e] hover:bg-[#b82017] text-white shadow-md shadow-[#d2281e]/30'
                }`}
              >
                {isSelected ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>This Look is Active!</span>
                  </>
                ) : (
                  <span>✨ Select This Look</span>
                )}
              </button>

              <button
                type="button"
                onClick={handleCarouselNext}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-bold text-zinc-700 transition active:scale-95"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* All looks strip */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider text-center">All Looks</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {STANDING_COMPANIONS.map((c, i) => {
                  const isSel = useStanding && standingUrl === c.url;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCarouselIndex(i);
                        handleSelectStanding(c.url);
                      }}
                      className={`shrink-0 relative w-16 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                        isSel
                          ? 'border-[#d2281e] shadow-md ring-2 ring-[#d2281e]/30'
                          : i === carouselIndex
                          ? 'border-zinc-400'
                          : 'border-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      <img src={c.preview} alt={c.name} className="w-full h-full object-cover object-bottom" />
                      <div className="absolute bottom-0 inset-x-0 h-1 bg-[#d2281e]" />
                      {isSel && (
                        <div className="absolute inset-0 bg-[#d2281e]/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white drop-shadow" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 font-medium text-center">
              Standing characters display with the counter bar across your dashboard and room seats.
            </p>
          </div>
        );
      })()}

      {/* Tab 2: Hair & Skin */}
      {activeTab === 'appearance' && (
        <div className="space-y-3.5">
          
          {/* Skin Tone Selector */}
          <div>
            <label className="text-[11px] font-black text-zinc-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <User className="w-3 h-3 text-[#d2281e]" />
              <span>Skin Tone</span>
            </label>
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {SKIN_TONES.map(tone => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => {
                    setUseStanding(false);
                    setConfig(prev => ({ ...prev, skinColor: tone.id }));
                  }}
                  className={`relative w-8 h-8 rounded-full border-2 transition-all shrink-0 ${
                    config.skinColor === tone.id && !useStanding
                      ? 'border-[#d2281e] scale-110 shadow-md ring-2 ring-[#d2281e]/30'
                      : 'border-white hover:scale-105'
                  }`}
                  style={{ backgroundColor: tone.hex }}
                  title={tone.name}
                >
                  {config.skinColor === tone.id && !useStanding && (
                    <Check className="w-4 h-4 text-white drop-shadow mx-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Hair Style Selector */}
          <div>
            <label className="text-[11px] font-black text-zinc-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Scissors className="w-3 h-3 text-[#d2281e]" />
              <span>Hairstyle</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {HAIR_STYLES.map(h => {
                const isSelected = config.top === h.id && !useStanding;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      setUseStanding(false);
                      setConfig(prev => ({ ...prev, top: h.id }));
                    }}
                    className={`py-1.5 px-2.5 text-xs font-bold rounded-xl text-left border transition truncate ${
                      isSelected
                        ? 'bg-[#d2281e]/10 border-[#d2281e] text-[#d2281e] shadow-sm'
                        : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    {h.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hair Color Selector */}
          <div>
            <label className="text-[11px] font-black text-zinc-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Palette className="w-3 h-3 text-[#d2281e]" />
              <span>Hair Color</span>
            </label>
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {HAIR_COLORS.map(color => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => {
                    setUseStanding(false);
                    setConfig(prev => ({ ...prev, hairColor: color.id }));
                  }}
                  className={`relative w-8 h-8 rounded-full border-2 transition-all shrink-0 ${
                    config.hairColor === color.id && !useStanding
                      ? 'border-[#d2281e] scale-110 shadow-md ring-2 ring-[#d2281e]/30'
                      : 'border-white hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                >
                  {config.hairColor === color.id && !useStanding && (
                    <Check className="w-4 h-4 text-white drop-shadow mx-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Tab 3: Style & Mood */}
      {activeTab === 'style' && (
        <div className="space-y-3.5">
          
          {/* Eyewear / Accessories */}
          <div>
            <label className="text-[11px] font-black text-zinc-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Glasses className="w-3 h-3 text-[#d2281e]" />
              <span>Glasses & Eyewear</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {ACCESSORIES.map(acc => {
                const isSelected = config.accessories === acc.id && !useStanding;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setUseStanding(false);
                      setConfig(prev => ({ ...prev, accessories: acc.id }));
                    }}
                    className={`py-1.5 px-2.5 text-xs font-bold rounded-xl text-left border transition truncate ${
                      isSelected
                        ? 'bg-[#d2281e]/10 border-[#d2281e] text-[#d2281e] shadow-sm'
                        : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    {acc.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Outfit */}
          <div>
            <label className="text-[11px] font-black text-zinc-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Shirt className="w-3 h-3 text-[#d2281e]" />
              <span>Clothing</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {CLOTHING_OPTIONS.map(c => {
                const isSelected = config.clothing === c.id && !useStanding;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setUseStanding(false);
                      setConfig(prev => ({ ...prev, clothing: c.id }));
                    }}
                    className={`py-1.5 px-2.5 text-xs font-bold rounded-xl text-left border transition truncate ${
                      isSelected
                        ? 'bg-[#d2281e]/10 border-[#d2281e] text-[#d2281e] shadow-sm'
                        : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Background Palette */}
          <div>
            <label className="text-[11px] font-black text-zinc-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Palette className="w-3 h-3 text-[#d2281e]" />
              <span>Backdrop Color</span>
            </label>
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {BG_PALETTES.map(bg => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => {
                    setUseStanding(false);
                    setConfig(prev => ({ ...prev, bgColor: bg.id }));
                  }}
                  className={`relative w-8 h-8 rounded-full border-2 transition-all shrink-0 ${
                    config.bgColor === bg.id && !useStanding
                      ? 'border-[#d2281e] scale-110 shadow-md ring-2 ring-[#d2281e]/30'
                      : 'border-white hover:scale-105'
                  }`}
                  style={{ backgroundColor: bg.hex }}
                  title={bg.name}
                >
                  {config.bgColor === bg.id && !useStanding && (
                    <Check className="w-4 h-4 text-white drop-shadow mx-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Tab 4: Presets */}
      {activeTab === 'presets' && (
        <div className="grid grid-cols-2 gap-2.5">
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPreset(p.config)}
              className="p-2.5 text-left rounded-2xl bg-zinc-50 hover:bg-red-50/40 border border-zinc-200 hover:border-[#d2281e]/40 transition group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-zinc-900 group-hover:text-[#d2281e] transition">
                  {p.name}
                </span>
                <Sparkles className="w-3 h-3 text-zinc-400 group-hover:text-[#d2281e] transition" />
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">{p.tag}</p>
            </button>
          ))}
        </div>
      )}

      {/* Strict Anti-Upload & Safety Notice */}
      <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-start gap-2">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#d2281e] shrink-0 mt-0.5" />
        <p className="text-[10.5px] text-zinc-500 leading-tight">
          <strong>Privacy note:</strong> Photo uploads are disabled to keep watch parties safe and private. You can choose any 3D standing character or custom persona anytime!
        </p>
      </div>
    </div>
  );
}
