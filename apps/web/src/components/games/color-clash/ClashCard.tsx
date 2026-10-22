'use client';

import React from 'react';
import type { ClashCard, ClashColor } from '@synccinema/common';
import { cardLabel, cardMark, COLOR_HEX } from '../../../lib/clashView';

/** the icon in the middle of an action card (drawn, so it looks the same everywhere and is never just a colour) */
function Glyph({ card, ink }: { card: ClashCard; ink: string }) {
  const common = { fill: 'none', stroke: ink, strokeWidth: 3.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (card.kind) {
    case 'skip':
      return <svg viewBox="0 0 32 32" className="w-3/5 h-3/5" aria-hidden><circle cx="16" cy="16" r="10.5" {...common} /><path d="M8.5 23.5l15-15" {...common} /></svg>;
    case 'reverse':
      return <svg viewBox="0 0 32 32" className="w-3/5 h-3/5" aria-hidden><path d="M7 12h15l-4-4M25 20H10l4 4" {...common} /></svg>;
    case 'draw-two':
      return (
        <svg viewBox="0 0 32 32" className="w-3/5 h-3/5" aria-hidden>
          <rect x="6" y="9" width="12" height="16" rx="2.5" {...common} />
          <rect x="13" y="6" width="12" height="16" rx="2.5" fill={ink} fillOpacity="0.18" stroke={ink} strokeWidth="3.2" />
        </svg>
      );
    case 'wild':
      return <WildWheel className="w-3/5 h-3/5" />;
    case 'wild-draw-four':
      return <WildWheel className="w-3/5 h-3/5" plus4 />;
    default:
      return null;
  }
}

/** four quarters, one per colour: the Wild mark */
function WildWheel({ className, plus4 = false }: { className?: string; plus4?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M16 16V4a12 12 0 0 1 12 12z" fill={COLOR_HEX.blue.from} />
      <path d="M16 16h12a12 12 0 0 1-12 12z" fill={COLOR_HEX.green.from} />
      <path d="M16 16v12A12 12 0 0 1 4 16z" fill={COLOR_HEX.yellow.from} />
      <path d="M16 16H4A12 12 0 0 1 16 4z" fill={COLOR_HEX.red.from} />
      <circle cx="16" cy="16" r="12" fill="none" stroke="#fff" strokeWidth="1.6" />
      {plus4 && <text x="16" y="20.6" textAnchor="middle" fontSize="12" fontWeight="900" fill="#fff" stroke="#111827" strokeWidth="0.6" paintOrder="stroke">+4</text>}
    </svg>
  );
}

const SIZE = {
  hand: 'w-[62px] h-[90px] sm:w-[76px] sm:h-[110px] [@media(max-height:500px)]:w-[50px] [@media(max-height:500px)]:h-[72px]',
  pile: 'w-[66px] h-[96px] sm:w-[88px] sm:h-[128px] [@media(max-height:500px)]:w-[52px] [@media(max-height:500px)]:h-[76px]'
} as const;

interface FaceProps {
  card: ClashCard;
  size?: keyof typeof SIZE;
  /** the player may play this card now (highlighted) */
  playable?: boolean;
  selected?: boolean;
  /** it is the player's own hand and this card cannot be played: dim it */
  dim?: boolean;
  onClick?: () => void;
  /** the colour a Wild on top of the pile was given */
  chosen?: ClashColor | null;
}

/** An original card design: a colour field, a white inset with the value, small corner marks and a rounded edge. */
export function ClashCardFace({ card, size = 'hand', playable = false, selected = false, dim = false, onClick, chosen = null }: FaceProps) {
  const wild = card.color === null;
  const c = card.color ? COLOR_HEX[card.color] : null;
  const ink = c?.ink ?? '#fff';
  const label = cardLabel(card);
  const body = (
    <span
      className={`relative block w-full h-full rounded-xl overflow-hidden border-2 ${selected ? 'border-amber-300' : playable ? 'border-white/90' : 'border-white/30'} shadow-lg`}
      style={{ background: wild ? 'linear-gradient(135deg,#111827,#1f2937)' : `linear-gradient(145deg,${c!.from},${c!.to})` }}
    >
      <span aria-hidden className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(135deg,rgba(255,255,255,0.5) 0 2px,transparent 2px 9px)' }} />
      <span aria-hidden className="absolute left-1 top-0.5 text-[11px] sm:text-[13px] font-black leading-none" style={{ color: ink }}>{cardMark(card)}</span>
      <span aria-hidden className="absolute right-1 bottom-0.5 text-[11px] sm:text-[13px] font-black leading-none rotate-180" style={{ color: ink }}>{cardMark(card)}</span>
      <span className="absolute inset-[16%] rounded-[50%] bg-white/92 flex items-center justify-center rotate-[-14deg] shadow-inner" style={{ backgroundColor: 'rgba(255,255,255,0.93)' }}>
        <span className="rotate-[14deg] flex items-center justify-center w-full h-full">
          {card.kind === 'number' ? (
            <span className="text-[26px] sm:text-[34px] font-black leading-none" style={{ color: c!.to }}>{card.value}</span>
          ) : (
            <Glyph card={card} ink={wild ? '#111827' : c!.to} />
          )}
        </span>
      </span>
      {chosen && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-1 w-4 h-4 rounded-full border-2 border-white" style={{ background: COLOR_HEX[chosen].from }} aria-hidden />
      )}
    </span>
  );
  const cls = `relative shrink-0 ${SIZE[size]} select-none outline-none focus-visible:ring-4 focus-visible:ring-amber-300/80 rounded-xl motion-safe:transition-transform motion-safe:duration-150 ${
    selected ? '-translate-y-4 scale-105 z-10' : playable ? '-translate-y-2' : ''
  } ${dim ? 'opacity-45 saturate-50' : ''} ${onClick ? (playable || selected ? 'cursor-pointer active:scale-95' : 'cursor-not-allowed') : ''}`;
  if (!onClick) {
    // a span is inline by default and would ignore its width and height
    return <span className={`block ${cls}`} role="img" aria-label={label}>{body}</span>;
  }
  return (
    <button type="button" className={cls} aria-label={label} aria-pressed={selected} aria-disabled={!playable && !selected} onClick={onClick}>
      {body}
    </button>
  );
}

/** the back of a card: nothing about the face is in the page at all */
export function ClashCardBack({ size = 'pile', label = 'Card' }: { size?: keyof typeof SIZE | 'mini'; label?: string }) {
  const mini = size === 'mini';
  return (
    <span
      role="img"
      aria-label={label}
      className={`relative block shrink-0 ${mini ? 'w-5 h-7 sm:w-6 sm:h-9 rounded-md' : `${SIZE[size]} rounded-xl`} border-2 border-white/25 shadow-md overflow-hidden`}
      style={{ background: 'linear-gradient(145deg,#1f2937,#0b0f1a)' }}
    >
      <span aria-hidden className="absolute inset-0 opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(45deg,rgba(238,29,73,0.8) 0 2px,transparent 2px 8px)' }} />
      {!mini && <span aria-hidden className="absolute inset-[22%] rounded-full bg-[#ee1d49] flex items-center justify-center text-white font-black text-[10px] sm:text-sm rotate-[-12deg]">CC</span>}
    </span>
  );
}
