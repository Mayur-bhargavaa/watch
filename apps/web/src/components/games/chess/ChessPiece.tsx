'use client';

import React from 'react';
import { ChessPieceType, ChessColor } from '@synccinema/common';

interface ChessPieceProps {
  type: ChessPieceType;
  color: ChessColor;
  className?: string;
}

export const ChessPiece: React.FC<ChessPieceProps> = ({ type, color, className = 'w-full h-full' }) => {
  const isWhite = color === 'w';

  // Gradient colors for high-end cinematic feel
  const fillGradientId = isWhite ? 'whitePieceGrad' : 'blackPieceGrad';
  const strokeColor = isWhite ? '#1e293b' : '#f8fafc';
  const shadowColor = isWhite ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.6)';

  return (
    <svg
      viewBox="0 0 45 45"
      className={`${className} drop-shadow-[0_4px_6px_${shadowColor}] transition-transform duration-150 select-none pointer-events-none`}
    >
      <defs>
        {/* Warm Ivory gradient for White */}
        <linearGradient id="whitePieceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>

        {/* Deep Obsidian Charcoal gradient for Black */}
        <linearGradient id="blackPieceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="60%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>

        {/* Subtle Specular Highlights */}
        <linearGradient id="specularGlow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {type === 'p' && (
        // PAWN
        <g fill={`url(#${fillGradientId})`} stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" />
          <path d="M12 40.5h21" strokeWidth="1.8" />
        </g>
      )}

      {type === 'n' && (
        // KNIGHT
        <g fill={`url(#${fillGradientId})`} stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" />
          <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 1.5 1 1.5z" />
          <circle cx="15.5" cy="15.5" r="1.25" fill={isWhite ? '#0f172a' : '#f8fafc'} />
          <path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" />
        </g>
      )}

      {type === 'b' && (
        // BISHOP
        <g fill={`url(#${fillGradientId})`} stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" />
          <path d="M17.5 26h10M22.5 10v4M20.5 12h4" />
        </g>
      )}

      {type === 'r' && (
        // ROOK
        <g fill={`url(#${fillGradientId})`} stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 39h27v-3H9v3zm3.5-7l1.5-17.5h17l1.5 17.5h-20zm-1-18.5l-1-4.5h4v3h4v-3h5v3h4v-3h5v3h4v-3h4l-1 4.5h-24z" />
          <path d="M11 39.5h23" strokeWidth="1.8" />
        </g>
      )}

      {type === 'q' && (
        // QUEEN
        <g fill={`url(#${fillGradientId})`} stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM24.5 7.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0z" />
          <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11-7-16-7 16-7-11 2 12zm0 5c9-1 18-1 27 0l1 4.5H8L9 31zm0 7h27v2.5H9V38z" />
          <circle cx="6" cy="12" r="1.5" />
          <circle cx="14" cy="9" r="1.5" />
          <circle cx="22.5" cy="8" r="1.5" />
          <circle cx="31" cy="9" r="1.5" />
          <circle cx="39" cy="12" r="1.5" />
        </g>
      )}

      {type === 'k' && (
        // KING
        <g fill={`url(#${fillGradientId})`} stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Royal Cross */}
          <path d="M22.5 11.5V6M20 8.5h5" strokeWidth="1.8" />
          <path d="M22.5 25c0-4 4.5-7.5 4.5-11 0-2-1.5-3.5-4.5-3.5s-4.5 1.5-4.5 3.5c0 3.5 4.5 7 4.5 11" />
          <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V23c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7.5z" />
          <path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0" />
        </g>
      )}
    </svg>
  );
};
