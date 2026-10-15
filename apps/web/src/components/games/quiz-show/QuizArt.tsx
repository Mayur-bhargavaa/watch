import React from 'react';

/** Hero illustration for the Quiz Show Studio lobby: a stage with a host lectern, a podium and three buzzers. Flat, solid, muted palette. */
export const QuizArt: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 400 400" role="img" aria-label="A quiz stage with a host lectern, a winners podium and three buzzers" className={className}>
    <circle cx="200" cy="210" r="180" className="fill-zinc-100 dark:fill-[#1b1c24]" />
    {/* stage backdrop */}
    <rect x="60" y="86" width="280" height="150" rx="10" className="fill-zinc-300 dark:fill-[#2a2b35]" />
    <rect x="72" y="98" width="256" height="126" rx="6" className="fill-white dark:fill-[#14151b]" />
    <text x="200" y="146" textAnchor="middle" fontSize="40" fontWeight="800" fill="#ee1d49" fontFamily="ui-sans-serif, system-ui, sans-serif">QUIZ</text>
    <rect x="130" y="164" width="140" height="8" rx="4" className="fill-zinc-200 dark:fill-[#2a2b35]" />
    <rect x="150" y="182" width="100" height="8" rx="4" className="fill-zinc-200 dark:fill-[#2a2b35]" />
    {/* stage floor */}
    <ellipse cx="200" cy="338" rx="165" ry="12" className="fill-zinc-200 dark:fill-black/40" />
    <rect x="60" y="300" width="280" height="30" rx="6" className="fill-zinc-300 dark:fill-[#2a2b35]" />
    {/* podium: 2nd, 1st, 3rd */}
    <g>
      <rect x="140" y="270" width="52" height="30" rx="3" fill="#52525b" />
      <rect x="192" y="248" width="56" height="52" rx="3" fill="#ee1d49" />
      <rect x="248" y="282" width="48" height="18" rx="3" fill="#71717a" />
      <text x="166" y="291" textAnchor="middle" fontSize="16" fontWeight="800" fill="#ffffff" fontFamily="ui-sans-serif, system-ui, sans-serif">2</text>
      <text x="220" y="282" textAnchor="middle" fontSize="22" fontWeight="800" fill="#ffffff" fontFamily="ui-sans-serif, system-ui, sans-serif">1</text>
      <text x="272" y="296" textAnchor="middle" fontSize="13" fontWeight="800" fill="#ffffff" fontFamily="ui-sans-serif, system-ui, sans-serif">3</text>
    </g>
    {/* trophy on the first place */}
    <g fill="#d97706">
      <path d="M208 214h24v14a12 12 0 0 1-24 0z" />
      <rect x="216" y="238" width="8" height="8" />
      <rect x="208" y="246" width="24" height="3" rx="1.5" />
    </g>
    {/* buzzers */}
    <g>
      {[{ x: 80, c: '#be123c' }, { x: 104, c: '#1d4ed8' }, { x: 128, c: '#b45309' }].map((b) => (
        <g key={b.x}>
          <rect x={b.x - 10} y="293" width="20" height="7" rx="2" fill="#3f3f46" />
          <ellipse cx={b.x} cy="291" rx="9" ry="5" fill={b.c} />
        </g>
      ))}
    </g>
    {/* lectern */}
    <g>
      <rect x="296" y="254" width="34" height="46" rx="4" fill="#3f3f46" />
      <rect x="290" y="248" width="46" height="10" rx="3" fill="#52525b" />
      <circle cx="313" cy="236" r="9" fill="#a1a1aa" />
      <rect x="311" y="216" width="4" height="12" rx="2" fill="#3f3f46" />
    </g>
  </svg>
);
