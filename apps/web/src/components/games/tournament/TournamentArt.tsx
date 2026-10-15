import React from 'react';

/** Hero illustration for Tournament Arena: a small bracket that leads to a trophy. Flat, solid, muted palette. */
export const TournamentArt: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 400 400" role="img" aria-label="A tournament bracket with four players leading to a trophy" className={className}>
    <circle cx="200" cy="210" r="180" className="fill-zinc-100 dark:fill-[#1b1c24]" />
    <ellipse cx="200" cy="338" rx="150" ry="11" className="fill-zinc-200 dark:fill-black/40" />
    {/* bracket lines */}
    <g fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M108 117h22v40h-22" className="stroke-zinc-300 dark:stroke-[#3a3b46]" />
      <path d="M108 217h22v40h-22" className="stroke-zinc-300 dark:stroke-[#3a3b46]" />
      <path d="M130 137h20" stroke="#ee1d49" />
      <path d="M130 237h20" className="stroke-zinc-300 dark:stroke-[#3a3b46]" />
      <path d="M208 137h22v100h-22" className="stroke-zinc-300 dark:stroke-[#3a3b46]" />
      <path d="M230 187h20" className="stroke-zinc-300 dark:stroke-[#3a3b46]" />
      <path d="M108 117h22v20" stroke="#ee1d49" />
      <path d="M208 137h22v50h20" stroke="#ee1d49" />
    </g>
    {/* round 1 */}
    <g>
      <rect x="48" y="109" width="60" height="16" rx="5" fill="#ee1d49" />
      <rect x="48" y="149" width="60" height="16" rx="5" className="fill-zinc-300 dark:fill-[#2a2b35]" />
      <rect x="48" y="209" width="60" height="16" rx="5" className="fill-zinc-300 dark:fill-[#2a2b35]" />
      <rect x="48" y="249" width="60" height="16" rx="5" className="fill-zinc-300 dark:fill-[#2a2b35]" />
    </g>
    {/* round 2 */}
    <g>
      <rect x="150" y="129" width="58" height="16" rx="5" fill="#ee1d49" />
      <rect x="150" y="229" width="58" height="16" rx="5" className="fill-zinc-300 dark:fill-[#2a2b35]" />
    </g>
    {/* final */}
    <rect x="250" y="179" width="60" height="16" rx="5" fill="#ee1d49" />
    {/* trophy */}
    <g fill="#d97706">
      <path d="M262 214h36v22a18 18 0 0 1-36 0z" />
      <path d="M262 220h-9a9 9 0 0 0 9 15" fill="none" stroke="#d97706" strokeWidth="4" strokeLinecap="round" />
      <path d="M298 220h9a9 9 0 0 1-9 15" fill="none" stroke="#d97706" strokeWidth="4" strokeLinecap="round" />
      <rect x="276" y="254" width="8" height="12" />
      <rect x="266" y="266" width="28" height="7" rx="3" />
    </g>
    <rect x="262" y="276" width="36" height="46" rx="4" className="fill-zinc-400 dark:fill-[#2f303b]" />
    <text x="280" y="307" textAnchor="middle" fontSize="22" fontWeight="800" fill="#ffffff" fontFamily="ui-sans-serif, system-ui, sans-serif">1</text>
  </svg>
);
