import React from 'react';

/** Hero illustration for the Murder Mystery Night lobby: a mansion window, a magnifying glass and a candlestick. Flat, solid, muted palette. */
export const MurderArt: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 400 400" role="img" aria-label="A lit mansion window, a magnifying glass and a candlestick" className={className}>
    <circle cx="200" cy="205" r="180" className="fill-zinc-100 dark:fill-[#1b1c24]" />
    {/* mansion wall */}
    <rect x="70" y="80" width="260" height="250" rx="6" className="fill-zinc-300 dark:fill-[#2a2b35]" />
    <rect x="70" y="80" width="260" height="22" rx="6" className="fill-zinc-400 dark:fill-[#34353f]" />
    {/* window with a lit pane and a figure silhouette */}
    <rect x="132" y="128" width="100" height="140" rx="50" className="fill-zinc-500 dark:fill-[#14151b]" />
    <rect x="140" y="136" width="84" height="132" rx="42" className="fill-amber-200 dark:fill-amber-300" />
    <rect x="178" y="136" width="6" height="132" className="fill-zinc-500 dark:fill-[#14151b]" />
    <rect x="140" y="186" width="84" height="6" className="fill-zinc-500 dark:fill-[#14151b]" />
    <circle cx="204" cy="224" r="9" fill="#3f3f46" />
    <rect x="193" y="232" width="22" height="36" rx="10" fill="#3f3f46" />
    <rect x="124" y="268" width="116" height="10" rx="3" className="fill-zinc-400 dark:fill-[#34353f]" />
    {/* curtain */}
    <path d="M140 136 L140 200 Q150 170 160 136 Z" className="fill-[#ee1d49]" opacity="0.85" />
    {/* candlestick silhouette */}
    <g fill="#3f3f46">
      <rect x="276" y="168" width="8" height="24" rx="2" />
      <rect x="272" y="192" width="16" height="6" rx="2" />
      <rect x="277" y="198" width="6" height="52" rx="2" />
      <ellipse cx="280" cy="256" rx="14" ry="5" />
      <rect x="262" y="262" width="36" height="8" rx="3" />
    </g>
    <ellipse cx="280" cy="160" rx="4.5" ry="8" className="fill-amber-400" />
    {/* magnifying glass */}
    <g>
      <circle cx="120" cy="300" r="40" className="fill-white/0" fill="none" stroke="#ee1d49" strokeWidth="8" />
      <circle cx="120" cy="300" r="34" className="fill-zinc-100 dark:fill-[#1b1c24]" opacity="0.55" />
      <line x1="150" y1="330" x2="190" y2="372" stroke="#ee1d49" strokeWidth="12" strokeLinecap="round" />
    </g>
    <ellipse cx="200" cy="344" rx="150" ry="10" className="fill-zinc-200 dark:fill-black/40" />
  </svg>
);
