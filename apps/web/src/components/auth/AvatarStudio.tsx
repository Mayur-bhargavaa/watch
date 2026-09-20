'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Check, RefreshCw } from 'lucide-react';

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

// ─── Data ────────────────────────────────────────────────────────────────────

const SKIN_TONES = [
  { id: 'ffd1b1', name: 'Fair',        hex: '#ffd1b1' },
  { id: 'f8d25c', name: 'Golden',      hex: '#f8d25c' },
  { id: 'edb98a', name: 'Warm Beige',  hex: '#edb98a' },
  { id: 'd08b5b', name: 'Caramel',     hex: '#d08b5b' },
  { id: 'ae5d29', name: 'Bronze',      hex: '#ae5d29' },
  { id: '614335', name: 'Espresso',    hex: '#614335' },
];

const HAIR_STYLES = [
  { id: 'shortFlat',    name: 'Classic Short',  emoji: '💇' },
  { id: 'shortCurly',   name: 'Curly Fade',     emoji: '🌀' },
  { id: 'shortRound',   name: 'Crew Cut',        emoji: '✂️' },
  { id: 'shortWaved',   name: 'Wavy Crop',       emoji: '🌊' },
  { id: 'bob',          name: 'Sleek Bob',       emoji: '💁' },
  { id: 'bun',          name: 'Top Bun',         emoji: '🍡' },
  { id: 'straight01',   name: 'Long Straight',   emoji: '💆' },
  { id: 'curvy',        name: 'Wavy Flow',       emoji: '〰️' },
  { id: 'dreads01',     name: 'Dreadlocks',      emoji: '🎵' },
  { id: 'fro',          name: 'Afro Puff',       emoji: '⭕' },
  { id: 'winterHat02',  name: 'Beanie',          emoji: '🧢' },
  { id: 'hat',          name: 'Cap',             emoji: '🎩' },
];

const HAIR_COLORS = [
  { id: '2c1b18', name: 'Jet Black',     hex: '#2c1b18' },
  { id: '4a312c', name: 'Dark Brown',    hex: '#4a312c' },
  { id: '724133', name: 'Chestnut',      hex: '#724133' },
  { id: 'b58143', name: 'Honey Blonde',  hex: '#b58143' },
  { id: 'd6b370', name: 'Golden Blonde', hex: '#d6b370' },
  { id: 'c93305', name: 'Auburn Red',    hex: '#c93305' },
  { id: 'e8e1e1', name: 'Platinum',      hex: '#cbd5e1' },
  { id: 'a55728', name: 'Copper',        hex: '#a55728' },
];

const ACCESSORIES = [
  { id: 'none',           name: 'None',          emoji: '🚫' },
  { id: 'round',          name: 'Round Glasses', emoji: '🔵' },
  { id: 'prescription02', name: 'Modern Frames', emoji: '👓' },
  { id: 'sunglasses',     name: 'Sunglasses',    emoji: '🕶️' },
  { id: 'wayfarers',      name: 'Wayfarers',     emoji: '😎' },
  { id: 'kurt',           name: 'Square Frames', emoji: '🟦' },
];

const CLOTHING_OPTIONS = [
  { id: 'hoodie',           name: 'Hoodie',       emoji: '🧥' },
  { id: 'graphicShirt',     name: 'Graphic Tee',  emoji: '👕' },
  { id: 'shirtCrewNeck',    name: 'Crewneck',     emoji: '👔' },
  { id: 'blazerAndShirt',   name: 'Blazer',       emoji: '🕴️' },
  { id: 'collarAndSweater', name: 'Sweater',      emoji: '🧶' },
  { id: 'overall',          name: 'Overalls',     emoji: '🥼' },
];

const CLOTHES_COLORS = [
  { id: 'd2281e', name: 'Watch Red',   hex: '#d2281e' },
  { id: '25557c', name: 'Ocean Blue',  hex: '#25557c' },
  { id: '09090b', name: 'Midnight',    hex: '#09090b' },
  { id: '4338ca', name: 'Indigo',      hex: '#4338ca' },
  { id: '047857', name: 'Emerald',     hex: '#047857' },
  { id: 'db2777', name: 'Rose',        hex: '#db2777' },
  { id: 'd97706', name: 'Amber',       hex: '#d97706' },
  { id: 'e6e6e6', name: 'Light Grey',  hex: '#e6e6e6' },
  { id: '929598', name: 'Slate Grey',  hex: '#929598' },
  { id: 'ff5c5c', name: 'Coral',       hex: '#ff5c5c' },
];

const BG_COLORS = [
  { id: 'd2281e', name: 'Watch Red',    hex: '#d2281e' },
  { id: '09090b', name: 'Midnight',     hex: '#09090b' },
  { id: '4338ca', name: 'Indigo Night', hex: '#4338ca' },
  { id: '047857', name: 'Emerald',      hex: '#047857' },
  { id: 'db2777', name: 'Sunset Rose',  hex: '#db2777' },
  { id: 'd97706', name: 'Amber',        hex: '#d97706' },
  { id: '1e3a5f', name: 'Navy',         hex: '#1e3a5f' },
  { id: '2d2d2d', name: 'Charcoal',     hex: '#2d2d2d' },
];

const EYE_STYLES = [
  { id: 'happy',     name: 'Happy',     emoji: '😊' },
  { id: 'wink',      name: 'Wink',      emoji: '😉' },
  { id: 'default',   name: 'Default',   emoji: '🙂' },
  { id: 'surprised', name: 'Surprised', emoji: '😮' },
  { id: 'closed',    name: 'Closed',    emoji: '😌' },
  { id: 'hearts',    name: 'Hearts',    emoji: '😍' },
];

const MOUTH_STYLES = [
  { id: 'smile',   name: 'Smile',   emoji: '😁' },
  { id: 'twinkle', name: 'Twinkle', emoji: '✨' },
  { id: 'default', name: 'Calm',    emoji: '😐' },
  { id: 'serious', name: 'Serious', emoji: '😑' },
  { id: 'tongue',  name: 'Tongue',  emoji: '😛' },
];

const CHARACTER_PRESETS: AvatarConfig[] = [
  { seed: 'rohan',   skinColor: 'f8d25c', top: 'shortWaved',  hairColor: '2c1b18', accessories: 'round',          clothing: 'hoodie',           clothesColor: 'd2281e', eyes: 'wink',      mouth: 'smile',   bgColor: '09090b' },
  { seed: 'maya',    skinColor: 'edb98a', top: 'bob',          hairColor: '724133', accessories: 'sunglasses',     clothing: 'hoodie',           clothesColor: 'db2777', eyes: 'happy',     mouth: 'smile',   bgColor: '25557c' },
  { seed: 'arjun',   skinColor: 'd08b5b', top: 'shortFlat',   hairColor: '2c1b18', accessories: 'wayfarers',      clothing: 'blazerAndShirt',   clothesColor: '09090b', eyes: 'default',   mouth: 'serious', bgColor: '047857' },
  { seed: 'priya',   skinColor: 'ae5d29', top: 'fro',          hairColor: '4a312c', accessories: 'prescription02', clothing: 'collarAndSweater', clothesColor: '4338ca', eyes: 'hearts',    mouth: 'tongue',  bgColor: 'd97706' },
  { seed: 'riya',    skinColor: 'ffd1b1', top: 'curvy',        hairColor: 'b58143', accessories: 'none',           clothing: 'graphicShirt',     clothesColor: 'ff5c5c', eyes: 'happy',     mouth: 'twinkle', bgColor: '4338ca' },
  { seed: 'karan',   skinColor: '614335', top: 'dreads01',     hairColor: '2c1b18', accessories: 'none',           clothing: 'overall',          clothesColor: '25557c', eyes: 'wink',      mouth: 'smile',   bgColor: 'db2777' },
  { seed: 'anika',   skinColor: 'f8d25c', top: 'bun',          hairColor: 'c93305', accessories: 'round',          clothing: 'shirtCrewNeck',    clothesColor: '047857', eyes: 'closed',    mouth: 'smile',   bgColor: '1e3a5f' },
  { seed: 'dev',     skinColor: 'edb98a', top: 'shortCurly',  hairColor: '4a312c', accessories: 'sunglasses',     clothing: 'hoodie',           clothesColor: '929598', eyes: 'surprised', mouth: 'smile',   bgColor: 'd2281e' },
  { seed: 'zara',    skinColor: 'd08b5b', top: 'straight01',  hairColor: 'd6b370', accessories: 'wayfarers',      clothing: 'collarAndSweater', clothesColor: 'db2777', eyes: 'hearts',    mouth: 'twinkle', bgColor: '2d2d2d' },
  { seed: 'vikram',  skinColor: 'ae5d29', top: 'winterHat02', hairColor: '2c1b18', accessories: 'none',           clothing: 'hoodie',           clothesColor: '4338ca', eyes: 'wink',      mouth: 'tongue',  bgColor: '047857' },
  { seed: 'isha',    skinColor: 'ffd1b1', top: 'shortRound',  hairColor: 'e8e1e1', accessories: 'kurt',           clothing: 'blazerAndShirt',   clothesColor: '09090b', eyes: 'default',   mouth: 'serious', bgColor: 'd97706' },
  { seed: 'nikhil',  skinColor: '614335', top: 'shortWaved',  hairColor: 'b58143', accessories: 'prescription02', clothing: 'graphicShirt',     clothesColor: 'ff5c5c', eyes: 'happy',     mouth: 'smile',   bgColor: '25557c' },
];

// ─── URL builder ─────────────────────────────────────────────────────────────

function buildAvatarUrl(cfg: AvatarConfig): string {
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
  params.set('radius', '20');
  return `https://api.dicebear.com/7.x/avataaars/svg?${params.toString()}`;
}

/** Parse an existing DiceBear URL back into AvatarConfig so selections persist */
function parseAvatarUrl(url: string): AvatarConfig | null {
  if (!url || !url.includes('api.dicebear.com')) return null;
  try {
    const u = new URL(url);
    const p = u.searchParams;
    const acc = p.get('accessories') || 'none';
    const accProb = p.get('accessoriesProbability');
    return {
      seed:         p.get('seed')         || DEFAULT_CONFIG.seed,
      skinColor:    p.get('skinColor')    || DEFAULT_CONFIG.skinColor,
      top:          p.get('top')          || DEFAULT_CONFIG.top,
      hairColor:    p.get('hairColor')    || DEFAULT_CONFIG.hairColor,
      accessories:  accProb === '0' ? 'none' : (acc || 'none'),
      clothing:     p.get('clothing')     || DEFAULT_CONFIG.clothing,
      clothesColor: p.get('clothesColor') || DEFAULT_CONFIG.clothesColor,
      eyes:         p.get('eyes')         || DEFAULT_CONFIG.eyes,
      mouth:        p.get('mouth')        || DEFAULT_CONFIG.mouth,
      bgColor:      p.get('backgroundColor') || DEFAULT_CONFIG.bgColor,
    };
  } catch {
    return null;
  }
}

const DEFAULT_CONFIG: AvatarConfig = {
  seed: 'watchfan',
  skinColor: 'f8d25c',
  top: 'shortWaved',
  hairColor: '2c1b18',
  accessories: 'round',
  clothing: 'hoodie',
  clothesColor: 'd2281e',
  eyes: 'wink',
  mouth: 'smile',
  bgColor: 'd2281e',
};

// ─── Small reusable section heading ──────────────────────────────────────────
function SectionHeading({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className="text-sm">{emoji}</span>
      <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</h4>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AvatarStudio({ displayName, value, onChange }: AvatarStudioProps) {
  const [config, setConfig] = useState<AvatarConfig>(() => {
    // Try to restore from the existing saved URL
    const parsed = parseAvatarUrl(value);
    if (parsed) return parsed;
    return {
      ...DEFAULT_CONFIG,
      seed: displayName ? displayName.toLowerCase().replace(/\s+/g, '') : 'watchfan',
    };
  });

  const avatarUrl = useMemo(() => buildAvatarUrl(config), [config]);

  // Sync to parent on every change
  React.useEffect(() => {
    onChange(avatarUrl);
  }, [avatarUrl, onChange]);

  const update = useCallback(<K extends keyof AvatarConfig>(key: K, val: AvatarConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleRandomize = () => {
    const rand = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    setConfig({
      seed: `watch_${Math.random().toString(36).substring(2, 7)}`,
      skinColor: rand(SKIN_TONES).id,
      top: rand(HAIR_STYLES).id,
      hairColor: rand(HAIR_COLORS).id,
      accessories: rand(ACCESSORIES).id,
      clothing: rand(CLOTHING_OPTIONS).id,
      clothesColor: rand(CLOTHES_COLORS).id,
      eyes: rand(EYE_STYLES).id,
      mouth: rand(MOUTH_STYLES).id,
      bgColor: rand(BG_COLORS).id,
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5">

      {/* ── LEFT: Live Preview Panel ─────────────────────────────────────── */}
      <div className="lg:w-52 shrink-0 flex flex-col items-center gap-3">
        {/* Big avatar preview */}
        <div className="relative">
          <div className="w-40 h-40 rounded-3xl overflow-hidden shadow-2xl border-4 border-[#d2281e]/40 ring-4 ring-[#d2281e]/10">
            <img
              key={avatarUrl}
              src={avatarUrl}
              alt="Your Avatar"
              className="w-full h-full object-cover transition-all duration-300"
            />
          </div>
          {/* Randomize */}
          <button
            type="button"
            onClick={handleRandomize}
            title="Randomize everything"
            className="absolute -bottom-2 -right-2 p-2.5 rounded-full bg-[#d2281e] text-white shadow-lg hover:bg-[#b82017] active:scale-95 transition-all ring-2 ring-white"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Name + badge */}
        <div className="text-center">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#d2281e]/10 text-[#d2281e] text-[9px] font-black uppercase tracking-wider mb-1">
            ✨ Your Bitmoji
          </div>
          <p className="text-sm font-black text-zinc-900 dark:text-white leading-tight">
            {displayName ? `${displayName}'s Avatar` : 'Your Avatar'}
          </p>
          <p className="text-[10px] text-zinc-400 mt-0.5">Updates live as you pick</p>
        </div>

        {/* Character presets */}
        <div className="w-full">
          <SectionHeading emoji="🧑" label="Start From" />
          <div className="grid grid-cols-4 gap-1.5">
            {CHARACTER_PRESETS.map(preset => {
              const presetUrl = buildAvatarUrl(preset);
              const isSelected = config.seed === preset.seed;
              return (
                <button
                  key={preset.seed}
                  type="button"
                  onClick={() => setConfig({ ...preset })}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all active:scale-95 ${
                    isSelected
                      ? 'border-[#d2281e] ring-2 ring-[#d2281e]/30 scale-105 shadow-md'
                      : 'border-zinc-200 hover:border-zinc-400 hover:scale-105'
                  }`}
                  style={{ aspectRatio: '1' }}
                  title={preset.seed}
                >
                  <img src={presetUrl} alt={preset.seed} className="w-full h-full object-cover" loading="lazy" />
                  {isSelected && (
                    <div className="absolute inset-0 bg-[#d2281e]/15 flex items-end justify-center pb-0.5">
                      <div className="bg-[#d2281e] text-white text-[7px] font-black px-1 py-0.5 rounded-full flex items-center gap-0.5">
                        <Check className="w-1.5 h-1.5" /> Me
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── RIGHT: All Customization Panels ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-1" style={{ maxHeight: '68vh' }}>

        {/* Skin Tone */}
        <div>
          <SectionHeading emoji="🎨" label="Skin Tone" />
          <div className="grid grid-cols-6 gap-2">
            {SKIN_TONES.map(tone => (
              <button
                key={tone.id}
                type="button"
                onClick={() => update('skinColor', tone.id)}
                title={tone.name}
                className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                  config.skinColor === tone.id
                    ? 'border-[#d2281e] bg-red-50 shadow-md scale-105'
                    : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50 hover:scale-105'
                }`}
              >
                <div className="w-7 h-7 rounded-full shadow-sm border border-white/50" style={{ backgroundColor: tone.hex }} />
                <span className="text-[8px] font-bold text-zinc-500 text-center leading-tight">{tone.name}</span>
                {config.skinColor === tone.id && (
                  <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-[#d2281e] flex items-center justify-center">
                    <Check className="w-1.5 h-1.5 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Hair Style */}
        <div>
          <SectionHeading emoji="💇" label="Hair Style" />
          <div className="grid grid-cols-2 gap-1.5">
            {HAIR_STYLES.map(h => (
              <button
                key={h.id}
                type="button"
                onClick={() => update('top', h.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all ${
                  config.top === h.id
                    ? 'border-[#d2281e] bg-red-50 text-[#d2281e] shadow-md'
                    : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50 text-zinc-700'
                }`}
              >
                <span className="text-sm">{h.emoji}</span>
                <span className="text-[10px] font-bold flex-1">{h.name}</span>
                {config.top === h.id && <Check className="w-3 h-3 shrink-0 text-[#d2281e]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Hair Color */}
        <div>
          <SectionHeading emoji="🎀" label="Hair Color" />
          <div className="grid grid-cols-8 gap-2">
            {HAIR_COLORS.map(color => (
              <button
                key={color.id}
                type="button"
                onClick={() => update('hairColor', color.id)}
                title={color.name}
                className={`relative flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all ${
                  config.hairColor === color.id
                    ? 'border-[#d2281e] bg-red-50 shadow-md scale-110'
                    : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50 hover:scale-105'
                }`}
              >
                <div className="w-6 h-6 rounded-full border border-white/40 shadow-sm" style={{ backgroundColor: color.hex }} />
                <span className="text-[7px] font-bold text-zinc-500 text-center leading-tight">{color.name}</span>
                {config.hairColor === color.id && (
                  <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-[#d2281e] flex items-center justify-center">
                    <Check className="w-1.5 h-1.5 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Eyes */}
        <div>
          <SectionHeading emoji="👁️" label="Eye Expression" />
          <div className="grid grid-cols-3 gap-2">
            {EYE_STYLES.map(e => (
              <button
                key={e.id}
                type="button"
                onClick={() => update('eyes', e.id)}
                className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border-2 transition-all ${
                  config.eyes === e.id
                    ? 'border-[#d2281e] bg-red-50 shadow-md'
                    : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50'
                }`}
              >
                <span className="text-xl">{e.emoji}</span>
                <span className="text-[9px] font-bold text-zinc-600">{e.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mouth */}
        <div>
          <SectionHeading emoji="😊" label="Expression" />
          <div className="grid grid-cols-5 gap-2">
            {MOUTH_STYLES.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => update('mouth', m.id)}
                className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border-2 transition-all ${
                  config.mouth === m.id
                    ? 'border-[#d2281e] bg-red-50 shadow-md'
                    : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50'
                }`}
              >
                <span className="text-xl">{m.emoji}</span>
                <span className="text-[9px] font-bold text-zinc-600">{m.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Glasses */}
        <div>
          <SectionHeading emoji="👓" label="Eyewear" />
          <div className="grid grid-cols-2 gap-1.5">
            {ACCESSORIES.map(acc => (
              <button
                key={acc.id}
                type="button"
                onClick={() => update('accessories', acc.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all ${
                  config.accessories === acc.id
                    ? 'border-[#d2281e] bg-red-50 text-[#d2281e] shadow-md'
                    : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50 text-zinc-700'
                }`}
              >
                <span className="text-sm">{acc.emoji}</span>
                <span className="text-[10px] font-bold flex-1">{acc.name}</span>
                {config.accessories === acc.id && <Check className="w-3 h-3 shrink-0 text-[#d2281e]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Outfit */}
        <div>
          <SectionHeading emoji="👕" label="Outfit" />
          <div className="grid grid-cols-2 gap-1.5">
            {CLOTHING_OPTIONS.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => update('clothing', c.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all ${
                  config.clothing === c.id
                    ? 'border-[#d2281e] bg-red-50 text-[#d2281e] shadow-md'
                    : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50 text-zinc-700'
                }`}
              >
                <span className="text-sm">{c.emoji}</span>
                <span className="text-[10px] font-bold flex-1">{c.name}</span>
                {config.clothing === c.id && <Check className="w-3 h-3 shrink-0 text-[#d2281e]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Outfit Color */}
        <div>
          <SectionHeading emoji="🎨" label="Outfit Color" />
          <div className="grid grid-cols-5 gap-2">
            {CLOTHES_COLORS.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => update('clothesColor', c.id)}
                title={c.name}
                className={`relative flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all ${
                  config.clothesColor === c.id
                    ? 'border-[#d2281e] bg-red-50 shadow-md scale-110'
                    : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50 hover:scale-105'
                }`}
              >
                <div className="w-7 h-7 rounded-full border border-white/30 shadow-sm" style={{ backgroundColor: c.hex }} />
                <span className="text-[7px] font-bold text-zinc-500 text-center leading-tight">{c.name}</span>
                {config.clothesColor === c.id && (
                  <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-[#d2281e] flex items-center justify-center">
                    <Check className="w-1.5 h-1.5 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Background */}
        <div>
          <SectionHeading emoji="🌈" label="Background" />
          <div className="grid grid-cols-8 gap-2">
            {BG_COLORS.map(bg => (
              <button
                key={bg.id}
                type="button"
                onClick={() => update('bgColor', bg.id)}
                title={bg.name}
                className={`relative flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all ${
                  config.bgColor === bg.id
                    ? 'border-[#d2281e] bg-red-50 shadow-md scale-110'
                    : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50 hover:scale-105'
                }`}
              >
                <div className="w-6 h-6 rounded-full shadow-sm border border-white/20" style={{ backgroundColor: bg.hex }} />
                <span className="text-[7px] font-bold text-zinc-500 text-center leading-tight">{bg.name}</span>
                {config.bgColor === bg.id && (
                  <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-[#d2281e] flex items-center justify-center">
                    <Check className="w-1.5 h-1.5 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy note */}
        <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 flex items-start gap-2">
          <Check className="w-3.5 h-3.5 text-[#d2281e] shrink-0 mt-0.5" />
          <p className="text-[10px] text-zinc-500 leading-tight">
            <strong>Privacy:</strong> No photos stored — avatar is generated from your selections only.
          </p>
        </div>

      </div>
    </div>
  );
}

// Keep exported for backward compatibility
export const STANDING_COMPANIONS: never[] = [];
