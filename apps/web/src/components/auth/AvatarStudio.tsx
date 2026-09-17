'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Check, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

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
  { id: 'ffd1b1', name: 'Fair',         hex: '#ffd1b1' },
  { id: 'f8d25c', name: 'Golden',       hex: '#f8d25c' },
  { id: 'edb98a', name: 'Warm Beige',   hex: '#edb98a' },
  { id: 'd08b5b', name: 'Caramel',      hex: '#d08b5b' },
  { id: 'ae5d29', name: 'Bronze',       hex: '#ae5d29' },
  { id: '614335', name: 'Espresso',     hex: '#614335' },
];

const HAIR_STYLES = [
  { id: 'shortFlat',    name: 'Classic Short',   emoji: '💇' },
  { id: 'shortCurly',   name: 'Curly Fade',      emoji: '🌀' },
  { id: 'shortRound',   name: 'Crew Cut',         emoji: '✂️' },
  { id: 'shortWaved',   name: 'Wavy Crop',        emoji: '🌊' },
  { id: 'bob',          name: 'Sleek Bob',        emoji: '💁' },
  { id: 'bun',          name: 'Top Bun',          emoji: '🍡' },
  { id: 'straight01',   name: 'Long Straight',    emoji: '💆' },
  { id: 'curvy',        name: 'Wavy Flow',        emoji: '〰️' },
  { id: 'dreads01',     name: 'Dreadlocks',       emoji: '🎵' },
  { id: 'fro',          name: 'Afro Puff',        emoji: '⭕' },
  { id: 'winterHat02',  name: 'Beanie',           emoji: '🧢' },
  { id: 'hat',          name: 'Cap',              emoji: '🎩' },
];

const HAIR_COLORS = [
  { id: '2c1b18', name: 'Jet Black',       hex: '#2c1b18' },
  { id: '4a312c', name: 'Dark Brown',      hex: '#4a312c' },
  { id: '724133', name: 'Chestnut',        hex: '#724133' },
  { id: 'b58143', name: 'Honey Blonde',   hex: '#b58143' },
  { id: 'd6b370', name: 'Golden Blonde',  hex: '#d6b370' },
  { id: 'c93305', name: 'Auburn Red',     hex: '#c93305' },
  { id: 'e8e1e1', name: 'Platinum',       hex: '#cbd5e1' },
  { id: 'a55728', name: 'Copper',         hex: '#a55728' },
];

const ACCESSORIES = [
  { id: 'none',           name: 'None',           emoji: '🚫' },
  { id: 'round',          name: 'Round Glasses',  emoji: '🔵' },
  { id: 'prescription02', name: 'Modern Frames',  emoji: '👓' },
  { id: 'sunglasses',     name: 'Sunglasses',     emoji: '🕶️' },
  { id: 'wayfarers',      name: 'Wayfarers',      emoji: '😎' },
  { id: 'kurt',           name: 'Square Frames',  emoji: '🟦' },
];

const CLOTHING_OPTIONS = [
  { id: 'hoodie',           name: 'Hoodie',        emoji: '🧥' },
  { id: 'graphicShirt',     name: 'Graphic Tee',   emoji: '👕' },
  { id: 'shirtCrewNeck',    name: 'Crewneck',      emoji: '👔' },
  { id: 'blazerAndShirt',   name: 'Blazer',        emoji: '🕴️' },
  { id: 'collarAndSweater', name: 'Sweater',       emoji: '🧶' },
  { id: 'overall',          name: 'Overalls',      emoji: '🥼' },
];

const CLOTHES_COLORS = [
  { id: 'd2281e', name: 'Watch Red',    hex: '#d2281e' },
  { id: '25557c', name: 'Ocean Blue',   hex: '#25557c' },
  { id: '09090b', name: 'Midnight',     hex: '#09090b' },
  { id: '4338ca', name: 'Indigo',       hex: '#4338ca' },
  { id: '047857', name: 'Emerald',      hex: '#047857' },
  { id: 'db2777', name: 'Rose',         hex: '#db2777' },
  { id: 'd97706', name: 'Amber',        hex: '#d97706' },
  { id: 'e6e6e6', name: 'Light Grey',   hex: '#e6e6e6' },
  { id: '929598', name: 'Slate Grey',   hex: '#929598' },
  { id: 'ff5c5c', name: 'Coral',        hex: '#ff5c5c' },
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

// Pre-made diverse character starters — user picks one, then customises
const CHARACTER_PRESETS: AvatarConfig[] = [
  { seed: 'rohan',    skinColor: 'f8d25c', top: 'shortWaved',  hairColor: '2c1b18', accessories: 'round',          clothing: 'hoodie',           clothesColor: 'd2281e', eyes: 'wink',      mouth: 'smile',   bgColor: '09090b' },
  { seed: 'maya',     skinColor: 'edb98a', top: 'bob',          hairColor: '724133', accessories: 'sunglasses',     clothing: 'hoodie',           clothesColor: 'db2777', eyes: 'happy',     mouth: 'smile',   bgColor: '25557c' },
  { seed: 'arjun',    skinColor: 'd08b5b', top: 'shortFlat',   hairColor: '2c1b18', accessories: 'wayfarers',      clothing: 'blazerAndShirt',   clothesColor: '09090b', eyes: 'default',   mouth: 'serious', bgColor: '047857' },
  { seed: 'priya',    skinColor: 'ae5d29', top: 'fro',          hairColor: '4a312c', accessories: 'prescription02', clothing: 'collarAndSweater', clothesColor: '4338ca', eyes: 'hearts',    mouth: 'tongue',  bgColor: 'd97706' },
  { seed: 'riya',     skinColor: 'ffd1b1', top: 'curvy',        hairColor: 'b58143', accessories: 'none',           clothing: 'graphicShirt',     clothesColor: 'ff5c5c', eyes: 'happy',     mouth: 'twinkle', bgColor: '4338ca' },
  { seed: 'karan',    skinColor: '614335', top: 'dreads01',     hairColor: '2c1b18', accessories: 'none',           clothing: 'overall',          clothesColor: '25557c', eyes: 'wink',      mouth: 'smile',   bgColor: 'db2777' },
  { seed: 'anika',    skinColor: 'f8d25c', top: 'bun',          hairColor: 'c93305', accessories: 'round',          clothing: 'shirtCrewNeck',    clothesColor: '047857', eyes: 'closed',    mouth: 'smile',   bgColor: '1e3a5f' },
  { seed: 'dev',      skinColor: 'edb98a', top: 'shortCurly',  hairColor: '4a312c', accessories: 'sunglasses',     clothing: 'hoodie',           clothesColor: '929598', eyes: 'surprised', mouth: 'smile',   bgColor: 'd2281e' },
  { seed: 'zara',     skinColor: 'd08b5b', top: 'straight01',  hairColor: 'd6b370', accessories: 'wayfarers',      clothing: 'collarAndSweater', clothesColor: 'db2777', eyes: 'hearts',    mouth: 'twinkle', bgColor: '2d2d2d' },
  { seed: 'vikram',   skinColor: 'ae5d29', top: 'winterHat02', hairColor: '2c1b18', accessories: 'none',           clothing: 'hoodie',           clothesColor: '4338ca', eyes: 'wink',      mouth: 'tongue',  bgColor: '047857' },
  { seed: 'isha',     skinColor: 'ffd1b1', top: 'shortRound',  hairColor: 'e8e1e1', accessories: 'kurt',           clothing: 'blazerAndShirt',   clothesColor: '09090b', eyes: 'default',   mouth: 'serious', bgColor: 'd97706' },
  { seed: 'nikhil',   skinColor: '614335', top: 'shortWaved',  hairColor: 'b58143', accessories: 'prescription02', clothing: 'graphicShirt',     clothesColor: 'ff5c5c', eyes: 'happy',     mouth: 'smile',   bgColor: '25557c' },
];

// Steps for the step-by-step wizard
const STEPS = [
  { id: 'pick',       label: 'Pick Character', emoji: '🧑' },
  { id: 'skin',       label: 'Skin',           emoji: '🎨' },
  { id: 'hair',       label: 'Hair',           emoji: '💇' },
  { id: 'haircolor',  label: 'Hair Color',     emoji: '🎀' },
  { id: 'eyes',       label: 'Eyes',           emoji: '👁️' },
  { id: 'mouth',      label: 'Mouth',          emoji: '😊' },
  { id: 'glasses',    label: 'Glasses',        emoji: '👓' },
  { id: 'outfit',     label: 'Outfit',         emoji: '👕' },
  { id: 'color',      label: 'Outfit Color',   emoji: '🎨' },
  { id: 'bg',         label: 'Background',     emoji: '🌈' },
] as const;

type StepId = typeof STEPS[number]['id'];

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

// ─── Main Component ───────────────────────────────────────────────────────────

export function AvatarStudio({ displayName, value, onChange }: AvatarStudioProps) {
  const [step, setStep] = useState<number>(0);

  const [config, setConfig] = useState<AvatarConfig>(() => {
    // If existing value is a DiceBear URL, keep it. Otherwise use defaults.
    if (value && value.startsWith('/avatars/')) {
      // Was a standing sticker — reset to bitmoji default
      return {
        ...DEFAULT_CONFIG,
        seed: displayName ? displayName.toLowerCase().replace(/\s+/g, '') : 'watchfan',
      };
    }
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

  const currentStep = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="space-y-5">

      {/* ── Live Avatar Preview ── */}
      <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-3xl bg-zinc-50 border border-zinc-200">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-28 h-28 rounded-3xl overflow-hidden shadow-xl border-2 border-[#d2281e]/50">
            <img
              key={avatarUrl}
              src={avatarUrl}
              alt="Your Bitmoji Avatar"
              className="w-full h-full object-cover transition-all duration-300"
            />
          </div>
          {/* Randomize button */}
          <button
            type="button"
            onClick={handleRandomize}
            title="Randomize everything"
            className="absolute -bottom-1.5 -right-1.5 p-2 rounded-full bg-[#d2281e] text-white shadow-lg hover:bg-[#b82017] active:scale-95 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#d2281e]/10 text-[#d2281e] text-[10px] font-black uppercase tracking-wider">
            ✨ Your Bitmoji
          </div>
          <h3 className="text-base font-black text-zinc-900 tracking-tight">
            {displayName ? `${displayName}'s Avatar` : 'Your Custom Avatar'}
          </h3>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Customize skin, hair, eyes, outfit and more below. Your avatar updates live!
          </p>
          <p className="text-[10px] text-zinc-500 font-semibold">
            Step {step + 1} of {STEPS.length} — <span className="text-[#d2281e]">{currentStep.emoji} {currentStep.label}</span>
          </p>
        </div>
      </div>

      {/* ── Step Progress Dots ── */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(i)}
            title={s.label}
            className={`transition-all rounded-full font-bold text-[9px] flex items-center justify-center
              ${i === step
                ? 'w-8 h-5 bg-[#d2281e] text-white px-1'
                : i < step
                ? 'w-2 h-2 bg-[#d2281e]/60'
                : 'w-2 h-2 bg-zinc-200 hover:bg-zinc-300'
              }`}
          >
            {i === step ? s.emoji : ''}
          </button>
        ))}
      </div>

      {/* ── Step Content ── */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 min-h-[180px]">
        <h4 className="text-xs font-black text-zinc-700 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="text-base">{currentStep.emoji}</span>
          {currentStep.label}
        </h4>

        {/* PICK CHARACTER */}
        {currentStep.id === 'pick' && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-400">
              Choose a character as your starting look. You can fully customise it in the next steps!
            </p>
            <div className="grid grid-cols-4 gap-2.5 max-h-72 overflow-y-auto pr-0.5">
              {CHARACTER_PRESETS.map((preset, i) => {
                const presetUrl = buildAvatarUrl(preset);
                const isSelected = config.seed === preset.seed;
                return (
                  <button
                    key={preset.seed}
                    type="button"
                    onClick={() => setConfig({ ...preset })}
                    className={`relative rounded-2xl overflow-hidden border-2 transition-all active:scale-95 ${
                      isSelected
                        ? 'border-[#d2281e] shadow-lg ring-2 ring-[#d2281e]/30 scale-105'
                        : 'border-zinc-200 hover:border-zinc-400 hover:scale-105'
                    }`}
                    style={{ aspectRatio: '1' }}
                  >
                    <img
                      src={presetUrl}
                      alt={`Character ${i + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-[#d2281e]/10 flex items-end justify-center pb-1">
                        <div className="bg-[#d2281e] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Check className="w-2 h-2" />
                          You
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-zinc-400 text-center">Tap any character → click <strong>Next</strong> to customise it your way</p>
          </div>
        )}

        {/* SKIN */}
        {currentStep.id === 'skin' && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-400">Pick your skin tone</p>
            <div className="grid grid-cols-3 gap-2.5">
              {SKIN_TONES.map(tone => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => update('skinColor', tone.id)}
                  className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                    config.skinColor === tone.id
                      ? 'border-[#d2281e] bg-red-50 shadow-md'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-full shadow-sm border border-white/50"
                    style={{ backgroundColor: tone.hex }}
                  />
                  <span className="text-[10px] font-bold text-zinc-600">{tone.name}</span>
                  {config.skinColor === tone.id && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#d2281e] flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* HAIR STYLE */}
        {currentStep.id === 'hair' && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-400">Choose your hairstyle</p>
            <div className="grid grid-cols-2 gap-2">
              {HAIR_STYLES.map(h => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => update('top', h.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border-2 text-left transition-all ${
                    config.top === h.id
                      ? 'border-[#d2281e] bg-red-50 text-[#d2281e] shadow-md'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <span className="text-base">{h.emoji}</span>
                  <span className="text-[11px] font-bold">{h.name}</span>
                  {config.top === h.id && <Check className="w-3.5 h-3.5 ml-auto shrink-0 text-[#d2281e]" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* HAIR COLOR */}
        {currentStep.id === 'haircolor' && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-400">Choose your hair color</p>
            <div className="grid grid-cols-4 gap-3">
              {HAIR_COLORS.map(color => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => update('hairColor', color.id)}
                  className={`relative flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all ${
                    config.hairColor === color.id
                      ? 'border-[#d2281e] bg-red-50 shadow-md'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full border border-white/40 shadow-sm"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="text-[9px] font-bold text-zinc-500 text-center leading-tight">{color.name}</span>
                  {config.hairColor === color.id && (
                    <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#d2281e] flex items-center justify-center">
                      <Check className="w-2 h-2 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* EYES */}
        {currentStep.id === 'eyes' && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-400">Choose your eye expression</p>
            <div className="grid grid-cols-3 gap-2.5">
              {EYE_STYLES.map(e => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => update('eyes', e.id)}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl border-2 transition-all ${
                    config.eyes === e.id
                      ? 'border-[#d2281e] bg-red-50 shadow-md'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50'
                  }`}
                >
                  <span className="text-2xl">{e.emoji}</span>
                  <span className="text-[10px] font-bold text-zinc-600">{e.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MOUTH */}
        {currentStep.id === 'mouth' && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-400">Choose your expression</p>
            <div className="grid grid-cols-3 gap-2.5">
              {MOUTH_STYLES.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => update('mouth', m.id)}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl border-2 transition-all ${
                    config.mouth === m.id
                      ? 'border-[#d2281e] bg-red-50 shadow-md'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50'
                  }`}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-[10px] font-bold text-zinc-600">{m.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* GLASSES */}
        {currentStep.id === 'glasses' && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-400">Add glasses or eyewear</p>
            <div className="grid grid-cols-2 gap-2">
              {ACCESSORIES.map(acc => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => update('accessories', acc.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border-2 text-left transition-all ${
                    config.accessories === acc.id
                      ? 'border-[#d2281e] bg-red-50 text-[#d2281e] shadow-md'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <span className="text-base">{acc.emoji}</span>
                  <span className="text-[11px] font-bold">{acc.name}</span>
                  {config.accessories === acc.id && <Check className="w-3.5 h-3.5 ml-auto shrink-0 text-[#d2281e]" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* OUTFIT STYLE */}
        {currentStep.id === 'outfit' && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-400">Choose your outfit</p>
            <div className="grid grid-cols-2 gap-2">
              {CLOTHING_OPTIONS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => update('clothing', c.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border-2 text-left transition-all ${
                    config.clothing === c.id
                      ? 'border-[#d2281e] bg-red-50 text-[#d2281e] shadow-md'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <span className="text-base">{c.emoji}</span>
                  <span className="text-[11px] font-bold">{c.name}</span>
                  {config.clothing === c.id && <Check className="w-3.5 h-3.5 ml-auto shrink-0 text-[#d2281e]" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* OUTFIT COLOR */}
        {currentStep.id === 'color' && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-400">Pick your outfit color</p>
            <div className="grid grid-cols-5 gap-3">
              {CLOTHES_COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => update('clothesColor', c.id)}
                  className={`relative flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all ${
                    config.clothesColor === c.id
                      ? 'border-[#d2281e] bg-red-50 shadow-md'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full border border-white/30 shadow-sm"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="text-[8px] font-bold text-zinc-500 text-center leading-tight">{c.name}</span>
                  {config.clothesColor === c.id && (
                    <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#d2281e] flex items-center justify-center">
                      <Check className="w-2 h-2 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* BACKGROUND */}
        {currentStep.id === 'bg' && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-400">Choose your avatar background</p>
            <div className="grid grid-cols-4 gap-3">
              {BG_COLORS.map(bg => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => update('bgColor', bg.id)}
                  className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                    config.bgColor === bg.id
                      ? 'border-[#d2281e] bg-red-50 shadow-md'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50'
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-full shadow-sm border border-white/20"
                    style={{ backgroundColor: bg.hex }}
                  />
                  <span className="text-[9px] font-bold text-zinc-500 text-center leading-tight">{bg.name}</span>
                  {config.bgColor === bg.id && (
                    <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-[#d2281e] flex items-center justify-center">
                      <Check className="w-2 h-2 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Prev / Next Navigation ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={isFirst}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-bold text-zinc-700 transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex-1 text-center">
          <span className="text-[10px] text-zinc-400 font-mono">{step + 1} / {STEPS.length}</span>
        </div>

        {isLast ? (
          <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-500/30">
            <Check className="w-4 h-4" />
            All Done!
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#d2281e] hover:bg-[#b82017] text-white text-xs font-bold transition active:scale-95 shadow-md shadow-[#d2281e]/20"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Privacy note */}
      <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-start gap-2">
        <Check className="w-3.5 h-3.5 text-[#d2281e] shrink-0 mt-0.5" />
        <p className="text-[10.5px] text-zinc-500 leading-tight">
          <strong>Privacy note:</strong> Photo uploads are disabled. Your avatar is generated from your customization choices — no photos stored!
        </p>
      </div>
    </div>
  );
}

// Keep exported for backward compatibility (no longer used in UI but may be imported)
export const STANDING_COMPANIONS: never[] = [];
