import React from 'react';

/** Hero illustration for the Mafia Night lobby: a moonlit town, a lit window and a hooded figure. Flat, solid, muted palette. */
export const MafiaArt: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 400 400" role="img" aria-label="A town at night under a full moon with a hooded figure in the street" className={className}>
    <circle cx="200" cy="210" r="180" className="fill-zinc-100 dark:fill-[#1b1c24]" />
    {/* moon */}
    <circle cx="288" cy="110" r="34" className="fill-amber-100 dark:fill-zinc-300" />
    <circle cx="300" cy="102" r="30" className="fill-zinc-100 dark:fill-[#1b1c24]" />
    {/* skyline */}
    <g className="fill-zinc-300 dark:fill-[#2a2b35]">
      <rect x="70" y="200" width="56" height="130" rx="4" />
      <rect x="132" y="160" width="64" height="170" rx="4" />
      <rect x="202" y="190" width="52" height="140" rx="4" />
      <rect x="260" y="150" width="70" height="180" rx="4" />
    </g>
    {/* windows */}
    <g className="fill-zinc-100 dark:fill-[#14151b]">
      {[88, 104].map((x) => [214, 244, 274].map((y) => <rect key={`a${x}${y}`} x={x} y={y} width="10" height="14" rx="2" />))}
      {[148, 172].map((x) => [180, 214, 248, 282].map((y) => <rect key={`b${x}${y}`} x={x} y={y} width="12" height="16" rx="2" />))}
      {[276, 300].map((x) => [170, 204, 238, 272].map((y) => <rect key={`c${x}${y}`} x={x} y={y} width="12" height="16" rx="2" />))}
    </g>
    <rect x="148" y="214" width="12" height="16" rx="2" className="fill-amber-400" />
    <rect x="300" y="238" width="12" height="16" rx="2" className="fill-amber-400" />
    {/* street */}
    <ellipse cx="200" cy="340" rx="165" ry="12" className="fill-zinc-200 dark:fill-black/40" />
    {/* hooded figure */}
    <g>
      <rect x="170" y="236" width="60" height="104" rx="30" fill="#3f3f46" />
      <circle cx="200" cy="214" r="30" fill="#3f3f46" />
      <ellipse cx="200" cy="218" rx="19" ry="21" fill="#18181b" />
      <ellipse cx="192" cy="216" rx="3.5" ry="2.5" fill="#ee1d49" />
      <ellipse cx="208" cy="216" rx="3.5" ry="2.5" fill="#ee1d49" />
    </g>
    <text x="200" y="120" textAnchor="middle" fontSize="54" fontWeight="800" fill="#ee1d49" fontFamily="ui-sans-serif, system-ui, sans-serif">?</text>
  </svg>
);
