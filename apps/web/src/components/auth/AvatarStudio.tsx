'use client';

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Dice5,
  Check,
  Glasses,
  Smile,
  Palette,
  Shirt,
  Scissors,
  User,
  CheckCircle2
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
  params.set('radius', '50');

  return `https://api.dicebear.com/7.x/avataaars/svg?${params.toString()}`;
}

export function AvatarStudio({ displayName, value, onChange }: AvatarStudioProps) {
  const [activeTab, setActiveTab] = useState<'style' | 'appearance' | 'presets'>('appearance');

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

  const previewUrl = useMemo(() => {
    const url = buildDiceBearUrl(config);
    return url;
  }, [config]);

  // Sync to parent when config changes
  React.useEffect(() => {
    onChange(previewUrl);
  }, [previewUrl, onChange]);

  const handleShuffle = () => {
    const randomSkin = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)].id;
    const randomTop = HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)].id;
    const randomHairCol = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].id;
    const randomAcc = ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)].id;
    const randomCloth = CLOTHING_OPTIONS[Math.floor(Math.random() * CLOTHING_OPTIONS.length)].id;
    const randomBg = BG_PALETTES[Math.floor(Math.random() * BG_PALETTES.length)].id;
    const randomEyes = ['happy', 'wink', 'default', 'surprised'][Math.floor(Math.random() * 4)];
    const randomMouth = ['smile', 'twinkle', 'default'][Math.floor(Math.random() * 3)];

    setConfig(prev => ({
      ...prev,
      seed: `watch_${Math.random().toString(36).substring(2, 7)}`,
      skinColor: randomSkin,
      top: randomTop,
      hairColor: randomHairCol,
      accessories: randomAcc,
      clothing: randomCloth,
      bgColor: randomBg,
      eyes: randomEyes,
      mouth: randomMouth
    }));
  };

  const handleApplyPreset = (presetConfig: Partial<AvatarConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...presetConfig
    }));
  };

  return (
    <div className="space-y-5">
      {/* Studio Header & Hero Preview */}
      <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-3xl bg-zinc-50 border border-zinc-200">
        
        {/* Avatar Live Display */}
        <div className="relative group shrink-0">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full ring-4 ring-[#d2281e]/30 shadow-xl overflow-hidden bg-zinc-900 flex items-center justify-center relative">
            <img
              src={previewUrl}
              alt="Avatar Persona Preview"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          
          <button
            type="button"
            onClick={handleShuffle}
            title="Randomize Avatar Persona"
            className="absolute -bottom-1 -right-1 p-2 bg-[#d2281e] text-white rounded-full shadow-lg hover:bg-[#b82017] active:scale-95 transition-all flex items-center justify-center"
          >
            <Dice5 className="w-4 h-4" />
          </button>
        </div>

        {/* Persona Identity Badge & Shuffle CTA */}
        <div className="flex-1 text-center sm:text-left space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#d2281e]/10 text-[#d2281e] text-[10.5px] font-black uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            <span>Bitmoji Avatar Creator</span>
          </div>

          <h3 className="text-sm sm:text-base font-black text-zinc-950 tracking-tight">
            {displayName ? `${displayName}'s 3D Persona` : 'Your Cinema Persona'}
          </h3>

          <p className="text-[11px] text-zinc-500 max-w-sm leading-relaxed">
            Personalize your character for watch parties, live video calls, and 2-player games.
          </p>

          <div className="pt-0.5 flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <button
              type="button"
              onClick={handleShuffle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition shadow-sm"
            >
              <Dice5 className="w-3.5 h-3.5 text-[#d2281e]" />
              <span>🎲 Shuffle Look</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex rounded-2xl bg-zinc-100 p-1 border border-zinc-200 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('appearance')}
          className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
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
          onClick={() => setActiveTab('style')}
          className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
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
          onClick={() => setActiveTab('presets')}
          className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
            activeTab === 'presets'
              ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/80'
              : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-[#d2281e]" />
          <span>Presets</span>
        </button>
      </div>

      {/* Tab 1: Hair & Skin */}
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
                  onClick={() => setConfig(prev => ({ ...prev, skinColor: tone.id }))}
                  className={`relative w-8 h-8 rounded-full border-2 transition-all shrink-0 ${
                    config.skinColor === tone.id
                      ? 'border-[#d2281e] scale-110 shadow-md ring-2 ring-[#d2281e]/30'
                      : 'border-white hover:scale-105'
                  }`}
                  style={{ backgroundColor: tone.hex }}
                  title={tone.name}
                >
                  {config.skinColor === tone.id && (
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
                const isSelected = config.top === h.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, top: h.id }))}
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
                  onClick={() => setConfig(prev => ({ ...prev, hairColor: color.id }))}
                  className={`relative w-8 h-8 rounded-full border-2 transition-all shrink-0 ${
                    config.hairColor === color.id
                      ? 'border-[#d2281e] scale-110 shadow-md ring-2 ring-[#d2281e]/30'
                      : 'border-white hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                >
                  {config.hairColor === color.id && (
                    <Check className="w-4 h-4 text-white drop-shadow mx-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Tab 2: Style & Mood */}
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
                const isSelected = config.accessories === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, accessories: acc.id }))}
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
                const isSelected = config.clothing === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, clothing: c.id }))}
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
              <span>Badge Background Color</span>
            </label>
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {BG_PALETTES.map(bg => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, bgColor: bg.id }))}
                  className={`relative w-8 h-8 rounded-full border-2 transition-all shrink-0 ${
                    config.bgColor === bg.id
                      ? 'border-[#d2281e] scale-110 shadow-md ring-2 ring-[#d2281e]/30'
                      : 'border-white hover:scale-105'
                  }`}
                  style={{ backgroundColor: bg.hex }}
                  title={bg.name}
                >
                  {config.bgColor === bg.id && (
                    <Check className="w-4 h-4 text-white drop-shadow mx-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Tab 3: Quick Presets */}
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
          <strong>Privacy note:</strong> Photo file uploads are disabled to keep parties safe and private. Your customized Bitmoji character will be used across rooms and games.
        </p>
      </div>
    </div>
  );
}
