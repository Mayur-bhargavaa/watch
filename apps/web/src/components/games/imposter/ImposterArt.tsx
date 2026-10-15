import React from 'react';

/** Hero illustration for the Imposter lobby: a line-up of suspects where one of them is wearing a mask. Flat, solid, muted palette. */
export const ImposterArt: React.FC<{ className?: string }> = ({ className = '' }) => {
  const crew = [
    { x: 70, body: '#b45353', skin: '#f1cfae', bubble: true },
    { x: 135, body: '#4a6fa5', skin: '#c68863', bubble: false },
    { x: 265, body: '#4f8a6b', skin: '#8d5a3b', bubble: true },
    { x: 330, body: '#c4913a', skin: '#f4dcc0', bubble: false }
  ];
  return (
    <svg viewBox="0 0 400 400" role="img" aria-label="A line-up of suspects, one wearing a mask" className={className}>
      {/* flat backdrop disc */}
      <circle cx="200" cy="210" r="180" className="fill-zinc-100 dark:fill-[#1b1c24]" />
      <ellipse cx="200" cy="332" rx="160" ry="10" className="fill-zinc-200 dark:fill-black/40" />

      {/* crew */}
      {crew.map((c) => (
        <g key={c.x}>
          {c.bubble && (
            <g>
              <rect x={c.x - 24} y="118" width="48" height="30" rx="14" className="fill-white stroke-zinc-300 dark:fill-[#262730] dark:stroke-white/15" />
              <path d={`M${c.x - 4} 148 l6 10 l4 -10 z`} className="fill-white stroke-zinc-300 dark:fill-[#262730] dark:stroke-white/15" />
              <circle cx={c.x - 10} cy="133" r="3" className="fill-zinc-400" />
              <circle cx={c.x} cy="133" r="3" className="fill-zinc-400" />
              <circle cx={c.x + 10} cy="133" r="3" className="fill-zinc-400" />
            </g>
          )}
          <rect x={c.x - 26} y="236" width="52" height="92" rx="26" fill={c.body} />
          <circle cx={c.x} cy="212" r="24" fill={c.skin} />
          <circle cx={c.x - 8} cy="210" r="3" fill="#27272a" />
          <circle cx={c.x + 8} cy="210" r="3" fill="#27272a" />
          <path d={`M${c.x - 7} 221 q7 6 14 0`} fill="none" stroke="#27272a" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      ))}

      {/* the imposter: hooded, masked, a head taller */}
      <g>
        <text x="200" y="104" textAnchor="middle" fontSize="60" fontWeight="800" fill="#ee1d49" fontFamily="ui-sans-serif, system-ui, sans-serif">?</text>
        <rect x="168" y="222" width="64" height="112" rx="32" fill="#3f3f46" />
        <circle cx="200" cy="192" r="34" fill="#3f3f46" />
        <ellipse cx="200" cy="196" rx="23" ry="26" fill="#f4f4f5" />
        <ellipse cx="190" cy="192" rx="5" ry="3.5" fill="#27272a" />
        <ellipse cx="210" cy="192" rx="5" ry="3.5" fill="#27272a" />
        <path d="M188 206 q12 10 24 0" fill="none" stroke="#ee1d49" strokeWidth="3" strokeLinecap="round" />
        <path d="M180 178 q20 -10 40 0" fill="none" stroke="#ee1d49" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* magnifying glass */}
      <g>
        <circle cx="318" cy="338" r="28" className="fill-transparent stroke-zinc-500 dark:stroke-zinc-400" strokeWidth="7" />
        <line x1="338" y1="358" x2="366" y2="386" className="stroke-zinc-500 dark:stroke-zinc-400" strokeWidth="9" strokeLinecap="round" />
      </g>
    </svg>
  );
};
