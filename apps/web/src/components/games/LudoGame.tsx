'use client';

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy,
  Sparkles,
  RefreshCw,
  Crown,
  Volume2,
  VolumeX,
  ShieldCheck,
  Send,
  Smile,
  Check,
  RotateCcw,
  Heart,
  MoreHorizontal,
  Users,
  Lock,
  Crosshair,
  Bell
} from 'lucide-react';
import {
  GameRoom,
  GameRoomPlayer,
  LudoGameState,
  LudoColor,
  LudoToken
} from '@synccinema/common';
import { FloatingReaction } from '../../hooks/useGameRoom';
import { VideoGridParticipant } from '../../hooks/useWebRTC';

// Live Circular Video Feed for In-Call Avatars
export function VideoAvatar({
  stream,
  isSelf,
  displayName
}: {
  stream: MediaStream | null;
  isSelf?: boolean;
  displayName: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    video.defaultMuted = Boolean(isSelf);
    video.muted = Boolean(isSelf);

    const playVideo = () => {
      video.play().catch(() => {});
    };

    playVideo();
    video.addEventListener('loadedmetadata', playVideo);
    return () => {
      video.removeEventListener('loadedmetadata', playVideo);
    };
  }, [stream, isSelf]);

  if (!stream) return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={Boolean(isSelf)}
      className={`w-full h-full object-cover transform-gpu ${isSelf ? '-scale-x-100' : ''}`}
    />
  );
}

// Remote Audio Receiver to Hear Connected Players
function RemoteAudioPlayer({ stream }: { stream: MediaStream | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !stream) return;
    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }
    audio.volume = 1.0;
    audio.play().catch(() => {});
  }, [stream]);

  if (!stream) return null;

  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
}

export interface LudoGameProps {
  room: GameRoom;
  gameState: LudoGameState;
  myPlayer: GameRoomPlayer | null;
  isMyTurn: boolean;
  canRoll: boolean;
  canMove: boolean;
  legalMoves: number[];
  onRollDice: () => void;
  onMoveToken: (tokenId: number) => void;
  onRematch?: () => void;
  onSendReaction?: (emoji: string) => void;
  onSendQuickChat?: (text: string) => void;
  floatingReactions?: FloatingReaction[];
  participantStreamsByUserId?: Record<string, VideoGridParticipant>;
  localUserStream?: MediaStream | null;
  isCameraOn?: boolean;
  isMicMuted?: boolean;
  isCompact?: boolean;
  onNudgePlayer?: (userId?: string, displayName?: string) => void;
}

// Color starting tile indices on the common 52-tile ring
const COLOR_START_TILES: Record<LudoColor, number> = {
  red: 0,
  blue: 13,
  yellow: 26,
  green: 39
};

// Visual themes matching the romantic candlelit neon date-night design
const COLOR_CONFIG: Record<LudoColor, {
  name: string;
  fill: string;
  border: string;
  light: string;
  glow: string;
  neon: string;
  yardBg: string;
  yardBorder: string;
  homeRow: string;
  dotColor: string;
  gradientStart: string;
  gradientEnd: string;
}> = {
  red: {
    name: 'Red',
    fill: '#e11d48',
    border: '#be123c',
    light: '#ffe4e6',
    glow: 'rgba(255, 46, 121, 0.75)',
    neon: '#ff2e79',
    yardBg: '#881337',
    yardBorder: '#fda4af',
    homeRow: '#e11d48',
    dotColor: 'bg-rose-500',
    gradientStart: '#fb7185',
    gradientEnd: '#9f1239'
  },
  blue: {
    name: 'Blue',
    fill: '#2563eb',
    border: '#1d4ed8',
    light: '#e0f2fe',
    glow: 'rgba(56, 189, 248, 0.75)',
    neon: '#38bdf8',
    yardBg: '#1e3a8a',
    yardBorder: '#93c5fd',
    homeRow: '#2563eb',
    dotColor: 'bg-blue-500',
    gradientStart: '#60a5fa',
    gradientEnd: '#1e40af'
  },
  yellow: {
    name: 'Yellow',
    fill: '#f59e0b',
    border: '#d97706',
    light: '#fef3c7',
    glow: 'rgba(251, 191, 36, 0.75)',
    neon: '#fbbf24',
    yardBg: '#78350f',
    yardBorder: '#fde68a',
    homeRow: '#f59e0b',
    dotColor: 'bg-amber-400',
    gradientStart: '#fde047',
    gradientEnd: '#b45309'
  },
  green: {
    name: 'Green',
    fill: '#10b981',
    border: '#059669',
    light: '#d1fae5',
    glow: 'rgba(52, 211, 153, 0.75)',
    neon: '#34d399',
    yardBg: '#064e3b',
    yardBorder: '#a7f3d0',
    homeRow: '#10b981',
    dotColor: 'bg-emerald-500',
    gradientStart: '#4ade80',
    gradientEnd: '#047857'
  }
};

// 52 Track Tile Coordinates [row, col] on a 15x15 grid (0 to 14)
const RING_COORDS: Array<[number, number]> = [
  [6, 1],  // 0  Red Start (Star) - Top-Left entry moving right
  [6, 2],  // 1
  [6, 3],  // 2
  [6, 4],  // 3
  [6, 5],  // 4
  [5, 6],  // 5
  [4, 6],  // 6
  [3, 6],  // 7
  [2, 6],  // 8  (Safe Star)
  [1, 6],  // 9
  [0, 6],  // 10
  [0, 7],  // 11
  [0, 8],  // 12
  [1, 8],  // 13 Blue Start (Star) - Top-Right entry moving down
  [2, 8],  // 14
  [3, 8],  // 15
  [4, 8],  // 16
  [5, 8],  // 17
  [6, 9],  // 18
  [6, 10], // 19
  [6, 11], // 20
  [6, 12], // 21 (Safe Star)
  [6, 13], // 22
  [6, 14], // 23
  [7, 14], // 24
  [8, 14], // 25
  [8, 13], // 26 Yellow Start (Star) - Bottom-Right entry moving left
  [8, 12], // 27
  [8, 11], // 28
  [8, 10], // 29
  [8, 9],  // 30
  [9, 8],  // 31
  [10, 8], // 32
  [11, 8], // 33
  [12, 8], // 34 (Safe Star)
  [13, 8], // 35
  [14, 8], // 36
  [14, 7], // 37
  [14, 6], // 38
  [13, 6], // 39 Green Start (Star) - Bottom-Left entry moving up
  [12, 6], // 40
  [11, 6], // 41
  [10, 6], // 42
  [9, 6],  // 43
  [8, 5],  // 44
  [8, 4],  // 45
  [8, 3],  // 46
  [8, 2],  // 47 (Safe Star)
  [8, 1],  // 48
  [8, 0],  // 49
  [7, 0],  // 50
  [6, 0]   // 51
];

// 5 Home Column Coordinates for each color
const HOME_PATHS: Record<LudoColor, Array<[number, number]>> = {
  red: [
    [7, 1], [7, 2], [7, 3], [7, 4], [7, 5]
  ],
  blue: [
    [1, 7], [2, 7], [3, 7], [4, 7], [5, 7]
  ],
  yellow: [
    [7, 13], [7, 12], [7, 11], [7, 10], [7, 9]
  ],
  green: [
    [13, 7], [12, 7], [11, 7], [10, 7], [9, 7]
  ]
};

// Safe Tile Indices
const SAFE_STAR_TILES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Grid & Dimension constants (Single Source of Truth)
export const BOARD_GRID_SIZE = 15;
export const BOARD_PIXEL_SIZE = 600;
export const CELL_SIZE = BOARD_PIXEL_SIZE / BOARD_GRID_SIZE; // 40px

export interface LogicalPosition {
  type: 'yard' | 'track' | 'runway' | 'finish';
  row?: number;
  col?: number;
  yardIndex?: number;
  finishIndex?: number;
}

export function gridToPixel(row: number, col: number): { x: number; y: number } {
  return {
    x: col * CELL_SIZE + CELL_SIZE / 2,
    y: row * CELL_SIZE + CELL_SIZE / 2
  };
}

// 4 Yard Socket Centers (Top-Left 120,120; Top-Right 480,120; Bottom-Left 120,480; Bottom-Right 480,480)
// dx, dy = +/- 46px from yard center
export const YARD_SOCKET_CENTERS: Record<LudoColor, Array<{ x: number; y: number }>> = {
  red: [
    { x: 74, y: 74 },
    { x: 166, y: 74 },
    { x: 74, y: 166 },
    { x: 166, y: 166 }
  ],
  blue: [
    { x: 434, y: 74 },
    { x: 526, y: 74 },
    { x: 434, y: 166 },
    { x: 526, y: 166 }
  ],
  green: [
    { x: 74, y: 434 },
    { x: 166, y: 434 },
    { x: 74, y: 526 },
    { x: 166, y: 526 }
  ],
  yellow: [
    { x: 434, y: 434 },
    { x: 526, y: 434 },
    { x: 434, y: 526 },
    { x: 526, y: 526 }
  ]
};

// 4 Dedicated Landing Slots inside each Victory Triangle Quadrant
export const FINISH_SLOTS: Record<LudoColor, Array<{ x: number; y: number }>> = {
  red: [
    { x: 256, y: 288 },
    { x: 256, y: 312 },
    { x: 274, y: 293 },
    { x: 274, y: 307 }
  ],
  blue: [
    { x: 288, y: 256 },
    { x: 312, y: 256 },
    { x: 293, y: 274 },
    { x: 307, y: 274 }
  ],
  yellow: [
    { x: 344, y: 288 },
    { x: 344, y: 312 },
    { x: 326, y: 293 },
    { x: 326, y: 307 }
  ],
  green: [
    { x: 288, y: 344 },
    { x: 312, y: 344 },
    { x: 293, y: 326 },
    { x: 307, y: 326 }
  ]
};

export function getTrackCell(color: LudoColor, step: number): { row: number; col: number } {
  const ringIndex = (COLOR_START_TILES[color] + step) % 52;
  const [row, col] = RING_COORDS[ringIndex];
  return { row, col };
}

export function getRunwayCell(color: LudoColor, step: number): { row: number; col: number } {
  const runwayIndex = Math.max(0, Math.min(4, step - 51));
  const [row, col] = HOME_PATHS[color][runwayIndex];
  return { row, col };
}

export function getPawnLogicalPosition(color: LudoColor, step: number, tokenId: number): LogicalPosition {
  if (step === -1) {
    return { type: 'yard', yardIndex: tokenId % 4 };
  }
  if (step >= 56) {
    return { type: 'finish', finishIndex: tokenId % 4 };
  }
  if (step >= 51 && step <= 55) {
    const { row, col } = getRunwayCell(color, step);
    return { type: 'runway', row, col };
  }
  const { row, col } = getTrackCell(color, step);
  return { type: 'track', row, col };
}

export function getPawnPixelPosition(color: LudoColor, step: number, tokenId: number): { x: number; y: number } {
  const logical = getPawnLogicalPosition(color, step, tokenId);
  if (logical.type === 'yard') {
    return YARD_SOCKET_CENTERS[color][logical.yardIndex ?? (tokenId % 4)];
  }
  if (logical.type === 'finish') {
    return FINISH_SLOTS[color][logical.finishIndex ?? (tokenId % 4)];
  }
  return gridToPixel(logical.row!, logical.col!);
}


export const LudoGame: React.FC<LudoGameProps> = ({
  room,
  gameState,
  myPlayer,
  isMyTurn,
  canRoll,
  canMove,
  legalMoves,
  onRollDice,
  onMoveToken,
  onRematch,
  onSendReaction,
  onSendQuickChat,
  floatingReactions = [],
  participantStreamsByUserId = {},
  localUserStream = null,
  isCameraOn = false,
  isMicMuted = true,
  isCompact = false,
  onNudgePlayer
}) => {
  // Web Audio sound synthesizer for realistic board feel
  const playSound = (type: 'roll' | 'step' | 'move' | 'capture' | 'win' | 'nudge') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'roll') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(750, now + 0.18);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'step') {
        // Crisp wooden tap sound
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.06);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
        osc.start(now);
        osc.stop(now + 0.07);
      } else if (type === 'move') {
        // Landing thud
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'capture') {
        // Capture impact sound
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.25);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        osc.frequency.setValueAtTime(1046.50, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (type === 'nudge') {
        // Cheerful dual-tone bell chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1320, now + 0.12);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch (e) {}
  };

  // Visual feedback when sender taps nudge
  const [justNudged, setJustNudged] = useState(false);

  // Map players by color
  const playerByColor = useMemo(() => {
    const map: Partial<Record<LudoColor, GameRoomPlayer>> = {};
    for (const p of room.players) {
      if (p.color) map[p.color] = p;
    }
    if (gameState.seats) {
      Object.values(gameState.seats).forEach((seatInfo) => {
        if (!map[seatInfo.color]) {
          const matchedPlayer = room.players.find(p => p.userId === seatInfo.userId);
          if (matchedPlayer) map[seatInfo.color] = matchedPlayer;
        }
      });
    }
    return map;
  }, [room.players, gameState.seats]);

  // Helper to check if a color is active in the current match
  const isColorInGame = useCallback((color: LudoColor) => {
    return Boolean(playerByColor[color]);
  }, [playerByColor]);

  const turnPlayer = playerByColor[gameState.currentTurnColor];

  // Perspective orientation: Active player's yard sits at Bottom-Left (down) for clarity
  // Green is originally at Bottom-Left (0°).
  // Yellow is at Bottom-Right (rotates 90° clockwise to Bottom-Left).
  // Blue is at Top-Right (rotates 180° clockwise to Bottom-Left).
  // Red is at Top-Left (rotates 270° clockwise to Bottom-Left).
  const myColor: LudoColor = useMemo(() => {
    if (myPlayer?.color) return myPlayer.color;
    if (gameState.seats && myPlayer?.userId) {
      const seat = Object.values(gameState.seats).find(s => s.userId === myPlayer.userId);
      if (seat?.color) return seat.color;
    }
    return 'red';
  }, [myPlayer, gameState.seats]);

  const boardRotation = useMemo(() => {
    switch (myColor) {
      case 'green': return 0;
      case 'yellow': return 90;
      case 'blue': return 180;
      case 'red': return 270;
      default: return 0;
    }
  }, [myColor]);

  // Corner cards dynamically positioned floating prominently out from the board corners matching Image 2 benchmark
  const CORNER_CLASSES: Record<number, { className: string; side: 'left' | 'right' }> = {
    0: { className: 'absolute -top-5 sm:-top-7 -left-4 sm:-left-8 z-30 pointer-events-auto', side: 'left' },
    1: { className: 'absolute -top-5 sm:-top-7 -right-4 sm:-right-8 z-30 pointer-events-auto', side: 'right' },
    2: { className: 'absolute -bottom-5 sm:-bottom-7 -right-4 sm:-right-8 z-30 pointer-events-auto', side: 'right' },
    3: { className: 'absolute -bottom-5 sm:-bottom-7 -left-4 sm:-left-8 z-30 pointer-events-auto', side: 'left' }
  };

  const ORIG_CORNER_INDEX: Record<LudoColor, number> = {
    red: 0,
    blue: 1,
    yellow: 2,
    green: 3
  };

  const getPhysicalCorner = (color: LudoColor) => {
    const orig = ORIG_CORNER_INDEX[color];
    const shift = Math.round(boardRotation / 90) % 4;
    const phys = (orig + shift) % 4;
    return CORNER_CLASSES[phys];
  };

  // =========================================================================
  // 1. CENTER 3D ROLLING DICE ANIMATION
  // =========================================================================
  const [centerDiceAnimation, setCenterDiceAnimation] = useState<{
    phase: 'rolling' | 'settled' | 'vanishing';
    displayValue: number;
    finalValue: number;
    color: LudoColor;
  } | null>(null);

  const prevDiceValueRef = useRef<number | null>(null);
  const diceTimeoutsRef = useRef<{
    cycle?: NodeJS.Timeout;
    settle?: NodeJS.Timeout;
    vanish?: NodeJS.Timeout;
    finish?: NodeJS.Timeout;
  }>({});

  const clearDiceTimeouts = () => {
    if (diceTimeoutsRef.current.cycle) clearInterval(diceTimeoutsRef.current.cycle);
    if (diceTimeoutsRef.current.settle) clearTimeout(diceTimeoutsRef.current.settle);
    if (diceTimeoutsRef.current.vanish) clearTimeout(diceTimeoutsRef.current.vanish);
    if (diceTimeoutsRef.current.finish) clearTimeout(diceTimeoutsRef.current.finish);
    diceTimeoutsRef.current = {};
  };

  const hideCenterDice = () => {
    clearDiceTimeouts();
    setCenterDiceAnimation(null);
  };

  useEffect(() => {
    return () => {
      clearDiceTimeouts();
    };
  }, []);

  // Single-pawn auto-move: If only 1 goti is legal, move automatically after dice settle
  // If 2 or more, player will be prompted to choose
  const autoMoveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHandledRollKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isMyTurn || canRoll || gameState.diceValue === null || gameState.winnerColor) {
      if (autoMoveTimerRef.current) {
        clearTimeout(autoMoveTimerRef.current);
        autoMoveTimerRef.current = null;
      }
      return;
    }

    const rollKey = `${gameState.currentTurnColor}_${gameState.diceValue}_${legalMoves.join(',')}`;

    if (legalMoves.length === 1) {
      if (lastHandledRollKeyRef.current !== rollKey) {
        lastHandledRollKeyRef.current = rollKey;
        const targetTokenId = legalMoves[0];

        if (autoMoveTimerRef.current) clearTimeout(autoMoveTimerRef.current);
        // Wait 850ms so dice roll settles smoothly, then automatically move the single legal goti
        autoMoveTimerRef.current = setTimeout(() => {
          hideCenterDice();
          onMoveToken(targetTokenId);
        }, 850);
      }
    } else {
      if (autoMoveTimerRef.current) {
        clearTimeout(autoMoveTimerRef.current);
        autoMoveTimerRef.current = null;
      }
    }

    return () => {
      if (autoMoveTimerRef.current) {
        clearTimeout(autoMoveTimerRef.current);
        autoMoveTimerRef.current = null;
      }
    };
  }, [isMyTurn, canRoll, legalMoves, gameState.diceValue, gameState.currentTurnColor, gameState.winnerColor, onMoveToken]);

  // Clean animation timeout manager to avoid stutter or overlapping frames
  const animTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const clearAnimTimeouts = () => {
    animTimeoutsRef.current.forEach(t => clearTimeout(t));
    animTimeoutsRef.current = [];
  };

  useEffect(() => {
    return () => {
      clearAnimTimeouts();
    };
  }, []);

  useEffect(() => {
    if (gameState.diceValue !== null && gameState.diceValue !== prevDiceValueRef.current) {
      prevDiceValueRef.current = gameState.diceValue;
      const finalVal = gameState.diceValue;
      const turnColor = gameState.currentTurnColor;

      clearDiceTimeouts();
      playSound('roll');
      setCenterDiceAnimation({
        phase: 'rolling',
        displayValue: Math.floor(Math.random() * 6) + 1,
        finalValue: finalVal,
        color: turnColor
      });

      diceTimeoutsRef.current.cycle = setInterval(() => {
        setCenterDiceAnimation(prev =>
          prev && prev.phase === 'rolling'
            ? { ...prev, displayValue: Math.floor(Math.random() * 6) + 1 }
            : prev
        );
      }, 70);

      diceTimeoutsRef.current.settle = setTimeout(() => {
        if (diceTimeoutsRef.current.cycle) clearInterval(diceTimeoutsRef.current.cycle);
        playSound('step');
        setCenterDiceAnimation({
          phase: 'settled',
          displayValue: finalVal,
          finalValue: finalVal,
          color: turnColor
        });
      }, 600);

      diceTimeoutsRef.current.vanish = setTimeout(() => {
        setCenterDiceAnimation(prev => (prev ? { ...prev, phase: 'vanishing' } : null));
      }, 1450);

      diceTimeoutsRef.current.finish = setTimeout(() => {
        hideCenterDice();
      }, 1800);

      return () => {
        clearDiceTimeouts();
      };
    } else if (gameState.diceValue === null) {
      prevDiceValueRef.current = null;
      hideCenterDice();
    }
  }, [gameState.diceValue, gameState.currentTurnColor]);

  // =========================================================================
  // 2. STEP-BY-STEP PAWN ("GOTI") HOPPING ANIMATION
  // =========================================================================
  const [animatingPawn, setAnimatingPawn] = useState<{
    color: LudoColor;
    tokenId: number;
    currentStep: number;
    isHopArc: boolean;
  } | null>(null);

  const [showGridDebug, setShowGridDebug] = useState(false);

  const prevTokensRef = useRef<Record<LudoColor, LudoToken[]> | null>(null);

  const getCellPixelCenter = (row: number, col: number): [number, number] => {
    const pt = gridToPixel(row, col);
    return [pt.x, pt.y];
  };

  const getStepCoordinates = (color: LudoColor, step: number, tokenId: number): [number, number] => {
    const pt = getPawnPixelPosition(color, step, tokenId);
    return [pt.x, pt.y];
  };

  useEffect(() => {
    if (!prevTokensRef.current) {
      prevTokensRef.current = gameState.tokens;
      return;
    }

    const prevTokens = prevTokensRef.current;
    prevTokensRef.current = gameState.tokens;

    const colors: LudoColor[] = ['red', 'green', 'yellow', 'blue'];
    let movedPawnInfo: { color: LudoColor; tokenId: number; fromStep: number; toStep: number } | null = null;

    for (const col of colors) {
      const prevList = prevTokens[col] || [];
      const currentList = gameState.tokens[col] || [];

      for (const cur of currentList) {
        const prev = prevList.find(p => p.id === cur.id);
        if (prev && prev.step !== cur.step) {
          movedPawnInfo = {
            color: col,
            tokenId: cur.id,
            fromStep: prev.step,
            toStep: cur.step
          };
          break;
        }
      }
      if (movedPawnInfo) break;
    }

    if (!movedPawnInfo) return;

    hideCenterDice();
    const { color, tokenId, fromStep, toStep } = movedPawnInfo;

    // Case 1: Spawning from yard to start
    if (fromStep === -1 && toStep === 0) {
      clearAnimTimeouts();
      playSound('step');
      setAnimatingPawn({ color, tokenId, currentStep: 0, isHopArc: true });
      const t1 = setTimeout(() => {
        playSound('move');
        setAnimatingPawn({ color, tokenId, currentStep: 0, isHopArc: false });
        const t2 = setTimeout(() => setAnimatingPawn(null), 300);
        animTimeoutsRef.current.push(t2);
      }, 260);
      animTimeoutsRef.current.push(t1);
      return;
    }

    // Case 2: Advance on track step by step with clear pause on each box (slow, one-by-one cadence)
    if (toStep > fromStep) {
      clearAnimTimeouts();
      const hopSequence: number[] = [];
      for (let s = fromStep + 1; s <= toStep; s++) {
        hopSequence.push(s);
      }

      let hopIndex = 0;

      const runHop = () => {
        if (hopIndex >= hopSequence.length) {
          playSound('move');
          const finishTimeout = setTimeout(() => setAnimatingPawn(null), 320);
          animTimeoutsRef.current.push(finishTimeout);
          return;
        }

        const nextStep = hopSequence[hopIndex];
        const isFinalStep = hopIndex === hopSequence.length - 1;

        // Step A: Arc hop into the next box (250ms smooth airborne arc)
        setAnimatingPawn({
          color,
          tokenId,
          currentStep: nextStep,
          isHopArc: true
        });

        const landTimeout = setTimeout(() => {
          // Step B: Land firmly on the box, snap contact shadow, play tap sound
          playSound('step');
          setAnimatingPawn({
            color,
            tokenId,
            currentStep: nextStep,
            isHopArc: false
          });

          // Step C: STOP & PAUSE visibly on this box so player clearly sees it move one-by-one
          hopIndex++;
          const pauseTime = isFinalStep ? 360 : 250;
          const nextHopTimeout = setTimeout(runHop, pauseTime);
          animTimeoutsRef.current.push(nextHopTimeout);
        }, 250);
        animTimeoutsRef.current.push(landTimeout);
      };

      runHop();
    }
  }, [gameState.tokens]);

  // Compute all rendered pawns with co-location offset (so pawns on same tile never hide each other)
  const renderedPawns = useMemo(() => {
    const rawList: Array<{
      token: LudoToken;
      color: LudoColor;
      step: number;
      isLegal: boolean;
      isMyColor: boolean;
      isHopping: boolean;
    }> = [];

    const colors: LudoColor[] = ['red', 'green', 'yellow', 'blue'];

    for (const color of colors) {
      const tokens = gameState.tokens[color] || [];
      const isMyColor = myPlayer && (myPlayer.color === color || (gameState.seats && Object.values(gameState.seats).find(s => s.userId === myPlayer.userId)?.color === color));

      tokens.forEach((token) => {
        const isLegal = Boolean(isMyTurn && isMyColor && legalMoves.includes(token.id));
        const isThisTokenAnimating = Boolean(
          animatingPawn && animatingPawn.color === color && animatingPawn.tokenId === token.id
        );
        const activeStep = isThisTokenAnimating && animatingPawn ? animatingPawn.currentStep : token.step;

        rawList.push({
          token,
          color,
          step: activeStep,
          isLegal,
          isMyColor: Boolean(isMyColor),
          isHopping: isThisTokenAnimating && Boolean(animatingPawn?.isHopArc)
        });
      });
    }

    // Group track and runway pawns by cell location (so co-located pawns don't occlude)
    const tileGroups = new Map<string, typeof rawList>();

    rawList.forEach((item) => {
      let key = '';
      if (item.step === -1) {
        key = `yard_${item.color}_${item.token.id}`;
      } else if (item.step >= 0 && item.step <= 50) {
        key = `track_${(COLOR_START_TILES[item.color] + item.step) % 52}`;
      } else if (item.step >= 51 && item.step <= 55) {
        key = `runway_${item.color}_${item.step}`;
      } else {
        key = `finish_${item.color}_${item.token.id}`;
      }

      if (!tileGroups.has(key)) tileGroups.set(key, []);
      tileGroups.get(key)!.push(item);
    });

    const pawns: Array<{
      token: LudoToken;
      x: number;
      y: number;
      groundY: number;
      isLegal: boolean;
      isMyColor: boolean;
      color: LudoColor;
      isHopping: boolean;
      scale: number;
      isInGame: boolean;
    }> = [];

    tileGroups.forEach((group) => {
      const count = group.length;
      group.forEach((item, indexInGroup) => {
        const basePos = getPawnPixelPosition(item.color, item.step, item.token.id);

        // Scale factor: Grand, prominent 3D figurine fitting the socket saucer & tiles
        const PAWN_BASE_SCALE = 0.92;
        let scale = PAWN_BASE_SCALE;
        let offsetX = 0;
        let offsetY = 0;

        // Apply co-location offset cluster strictly within cell boundaries (only for shared track/runway cells)
        if (count > 1 && item.step >= 0 && item.step <= 55) {
          if (count === 2) {
            scale = 0.78;
            offsetX = indexInGroup === 0 ? -6.5 : 6.5;
            offsetY = 0;
          } else if (count === 3) {
            scale = 0.68;
            if (indexInGroup === 0) {
              offsetX = -6.5;
              offsetY = -4.5;
            } else if (indexInGroup === 1) {
              offsetX = 6.5;
              offsetY = -4.5;
            } else {
              offsetX = 0;
              offsetY = 5.0;
            }
          } else {
            scale = 0.62;
            offsetX = indexInGroup % 2 === 0 ? -6.0 : 6.0;
            offsetY = indexInGroup < 2 ? -5.0 : 5.0;
          }
        }

        const finalX = basePos.x + offsetX;
        const groundY = basePos.y + offsetY;

        pawns.push({
          token: item.token,
          x: finalX,
          y: groundY,
          groundY,
          isLegal: item.isLegal,
          isMyColor: item.isMyColor,
          color: item.color,
          isHopping: item.isHopping,
          scale,
          isInGame: isColorInGame(item.color)
        });
      });
    });

    return pawns;
  }, [gameState.tokens, gameState.seats, myPlayer, isMyTurn, legalMoves, animatingPawn]);

  // Render Crisp 3D Dice Face with Perfectly Spaced Pips (Zero Overlap)
  const renderDiceFace = (value: number | null, size: 'sm' | 'lg' = 'sm') => {
    const val = value || 1;
    // Casino standard pip coordinates on a 100x100 square:
    // Left: 27, Center: 50, Right: 73
    // Top: 27, Middle: 50, Bottom: 73
    // For 6: [27, 25], [73, 25], [27, 50], [73, 50], [27, 75], [73, 75]
    // Radius 7.6 -> diameter 15.2 -> gap between rows is (25 - 15.2) = 9.8 units! ZERO OVERLAP
    const pipMap: Record<number, Array<[number, number]>> = {
      1: [[50, 50]],
      2: [[27, 27], [73, 73]],
      3: [[27, 27], [50, 50], [73, 73]],
      4: [[27, 27], [73, 27], [27, 73], [73, 73]],
      5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
      6: [[27, 25], [73, 25], [27, 50], [73, 50], [27, 75], [73, 75]]
    };
    const pips = pipMap[val] || pipMap[1];
    const isLarge = size === 'lg';

    return (
      <svg
        viewBox="0 0 100 100"
        className={isLarge ? 'w-16 h-16 sm:w-20 sm:h-20' : 'w-7 h-7 sm:w-8 sm:h-8'}
        style={{ shapeRendering: 'geometricPrecision' }}
      >
        <defs>
          <radialGradient id={`pipGleam-${size}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="60%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#090d16" />
          </radialGradient>
        </defs>
        {pips.map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={val === 6 ? 7.6 : 8.6}
            fill={`url(#pipGleam-${size})`}
          />
        ))}
      </svg>
    );
  };

  // Render sculpted 3D luxury pawn figurine matching Image 2 benchmark
  const renderLuxuryPawn = (color: LudoColor, isLegal: boolean, isMyColor: boolean = false) => {
    const headGradient = `url(#${color}PawnHead)`;
    const bodyGradient = `url(#${color}PawnBody)`;
    const neonColor = color === 'red' ? '#ff2e79' : color === 'blue' ? '#38bdf8' : color === 'green' ? '#34d399' : '#fbbf24';

    return (
      <g filter="url(#tile3DShadow)">
        {/* Tier 0: Player Distinction Halo (hugs the goti base pedestal cleanly without spilling) */}
        {isMyColor && (
          <ellipse
            cx="0"
            cy="2"
            rx="15"
            ry="6.5"
            fill="none"
            stroke={neonColor}
            strokeWidth="1.4"
            strokeDasharray="3, 2"
            opacity="0.9"
          />
        )}

        {/* Tier 1: Pedestal Underside Bevel Occlusion */}
        <ellipse cx="0" cy="2.2" rx="13.2" ry="5.0" fill="#000000" opacity="0.22" />
        
        {/* Tier 2: Heavy 24K Gold Beveled Pedestal Ring */}
        <ellipse cx="0" cy="2" rx="13.8" ry="5.4" fill="url(#baroqueGoldGrad)" stroke="#543b0d" strokeWidth="0.8" />
        <ellipse cx="0" cy="1.6" rx="12.6" ry="4.8" fill="none" stroke="#fff8db" strokeWidth="0.6" opacity="0.8" />
        
        {/* Tier 3: Upper Beveled Gemstone Base Step */}
        <ellipse cx="0" cy="0.8" rx="11.2" ry="4.4" fill={headGradient} stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.6" />
        
        {/* Tier 4: Gold Torus Collar Base Rim */}
        <ellipse cx="0" cy="-0.2" rx="8.8" ry="3.2" fill="url(#baroqueGoldGrad)" stroke="#543b0d" strokeWidth="0.5" />
        {/* Base Specular Gloss Arc */}
        <path d="M -7.2 -1 A 8 3 0 0 1 7.2 -1" fill="none" stroke="#ffffff" strokeWidth="1.0" opacity="0.65" />

        {/* Sculpted Flared Pawn Body (Hourglass bell curve seamlessly covering and wrapping the base) */}
        <path
          d="M -8.4 0 C -7.6 -4.2, -5.2 -7.5, -3.8 -9.5 L 3.8 -9.5 C 5.2 -7.5, 7.6 -4.2, 8.4 0 C 4.6 2.4, -4.6 2.4, -8.4 0 Z"
          fill={bodyGradient}
        />
        {/* Specular curved vertical gloss streak down the left torso */}
        <path
          d="M -6.4 -0.2 C -5.6 -3.8, -3.4 -6.8, -2.4 -9 C -1.6 -9, -2.2 -4, -4.2 -0.2 Z"
          fill="#ffffff"
          opacity="0.45"
        />
        {/* Ambient shadow gradient down the right contour */}
        <path
          d="M 6.4 -0.2 C 5.6 -3.8, 3.4 -6.8, 2.4 -9 C 1.6 -9, 2.2 -4, 4.2 -0.2 Z"
          fill="#000000"
          opacity="0.25"
        />

        {/* Unique Color Chest Emblem (Crisp Vector Heraldic Icons) */}
        {color === 'red' && (
          /* Ruby Royal Shield Icon */
          <path
            d="M 0,-7.2 L 3.2,-5.4 L 3.2,-2.2 C 3.2,0.6 0,2.6 0,2.6 C 0,2.6 -3.2,0.6 -3.2,-2.2 L -3.2,-5.4 Z"
            transform="translate(0, -0.5) scale(0.9)"
            fill="#ff2e79"
            stroke="#ffffff"
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
        )}
        {color === 'blue' && (
          /* Sapphire Imperial Diamond Icon */
          <polygon
            points="0,-7.2 3.2,-3.8 0,-0.4 -3.2,-3.8"
            transform="translate(0, -0.5) scale(0.9)"
            fill="#38bdf8"
            stroke="#ffffff"
            strokeWidth="0.5"
          />
        )}
        {color === 'green' && (
          /* Emerald Heraldic Crest Icon */
          <path
            d="M 0,-7.2 C 1.2,-5.2 3.2,-3.8 3.2,-2.0 C 3.2,-0.2 1.4,1.0 0,1.4 C -1.4,1.0 -3.2,-0.2 -3.2,-2.0 C -3.2,-3.8 -1.2,-5.2 0,-7.2 Z"
            transform="translate(0, -0.5) scale(0.9)"
            fill="#34d399"
            stroke="#ffffff"
            strokeWidth="0.5"
          />
        )}
        {color === 'yellow' && (
          /* Golden Star Icon */
          <polygon
            points="0,-7.2 1.0,-4.4 3.5,-4.4 1.5,-2.8 2.2,-0.2 0,-1.7 -2.2,-0.2 -1.5,-2.8 -3.5,-4.4 -1.0,-4.4"
            transform="translate(0, -0.5) scale(0.9)"
            fill="#fbbf24"
            stroke="#ffffff"
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
        )}

        {/* Lower Polished Gold Torus Waist Ring */}
        <ellipse cx="0" cy="-9.5" rx="5.0" ry="1.9" fill="url(#baroqueGoldGrad)" stroke="#543b0d" strokeWidth="0.5" />
        
        {/* Tapered Slender Neck Column */}
        <path d="M -2.8 -9.5 C -2.8 -13, 2.8 -13, 2.8 -9.5 Z" fill={bodyGradient} />

        {/* Upper Gold Neck Collar Bead matching Image 2 */}
        <ellipse cx="0" cy="-13" rx="4.5" ry="1.7" fill="url(#baroqueGoldGrad)" stroke="#543b0d" strokeWidth="0.5" />
        <ellipse cx="0" cy="-13.3" rx="3.8" ry="1.3" fill="none" stroke="#fff8db" strokeWidth="0.5" opacity="0.8" />

        {/* Spherical Luxury Gemstone Head Knob (Centered at cy=-20.5, r=8.6) matching Image 2 */}
        <circle
          cx="0"
          cy="-20.5"
          r="8.6"
          fill={headGradient}
          stroke={isLegal ? '#ffffff' : 'rgba(255,255,255,0.7)'}
          strokeWidth={isLegal ? '2.4' : '1.0'}
        />

        {/* 3D Spherical Specular Highlights (glass reflection & curved gleam) */}
        <circle cx="-2.8" cy="-23.5" r="2.3" fill="#ffffff" opacity="0.95" />
        <circle cx="-0.8" cy="-25.5" r="1.1" fill="#ffffff" opacity="0.85" />
        <ellipse cx="2.6" cy="-17.5" rx="2.2" ry="1.1" transform="rotate(30 2.6 -17.5)" fill="#ffffff" opacity="0.32" />

        {/* Unique Color Head Crown Finials matching Image 2 */}
        {color === 'red' && (
          /* Red: Imperial Triple-Peak Royal Crown with glowing Ruby Heart */
          <g transform="translate(0, -29)">
            <path d="M -6.5 0 L -8.5 -5.5 L -3.5 -3 L 0 -7 L 3.5 -3 L 8.5 -5.5 L 6.5 0 Z" fill="url(#baroqueGoldGrad)" stroke="#fff8db" strokeWidth="0.4" />
            <circle cx="0" cy="-7.8" r="1.5" fill="#ff2e79" stroke="#ffffff" strokeWidth="0.3" />
            <circle cx="-8.5" cy="-5.8" r="0.8" fill="#ffffff" />
            <circle cx="8.5" cy="-5.8" r="0.8" fill="#ffffff" />
          </g>
        )}
        {color === 'blue' && (
          /* Blue: Regal 4-Point Starlight Sapphire Diamond Crest */
          <g transform="translate(0, -29)">
            <polygon points="0,-9 3.8,-4.5 8,-3.5 4,-0.5 5,4.5 0,1.2 -5,4.5 -4,-0.5 -8,-3.5 -3.8,-4.5" fill="url(#baroqueGoldGrad)" stroke="#fff8db" strokeWidth="0.4" />
            <circle cx="0" cy="-3.5" r="1.6" fill="#38bdf8" stroke="#ffffff" strokeWidth="0.3" />
            <circle cx="0" cy="-9.5" r="0.8" fill="#ffffff" />
          </g>
        )}
        {color === 'green' && (
          /* Green: Celtic Emerald Tri-Spire Laurel Crown */
          <g transform="translate(0, -29)">
            <path d="M -6.5 1 C -8 -4.5, -4 -6, -2.5 -3 C -1.2 -8, 1.2 -8, 2.5 -3 C 4 -6, 8 -4.5, 6.5 1 Z" fill="url(#baroqueGoldGrad)" stroke="#fff8db" strokeWidth="0.4" />
            <circle cx="-6" cy="-5.5" r="1.0" fill="#ffffff" />
            <circle cx="0" cy="-8.5" r="1.5" fill="#34d399" stroke="#ffffff" strokeWidth="0.3" />
            <circle cx="6" cy="-5.5" r="1.0" fill="#ffffff" />
          </g>
        )}
        {color === 'yellow' && (
          /* Yellow: Radiant Solar Sunburst Crown with golden rays & amber jewel */
          <g transform="translate(0, -29)">
            <polygon points="0,-9.5 2.2,-4.5 7,-6 4,-1.5 7,2 2.2,1 0,5 -2.2,1 -7,2 -4,-1.5 -7,-6 -2.2,-4.5" fill="url(#baroqueGoldGrad)" stroke="#fff8db" strokeWidth="0.4" />
            <circle cx="0" cy="-2" r="1.8" fill="#fbbf24" stroke="#ffffff" strokeWidth="0.4" />
            <circle cx="0" cy="-10" r="0.8" fill="#ffffff" />
          </g>
        )}
      </g>
    );
  };

  // Render Floating Dark Glass Player Card matching the Image 2 benchmark
  const renderCornerBadge = (color: LudoColor, side: 'left' | 'right') => {
    const p = playerByColor[color];
    const isCurrentTurn = gameState.currentTurnColor === color;
    const cfg = COLOR_CONFIG[color];
    const isMe = p?.userId === myPlayer?.userId;
    const isHost = p?.seat === 0;
    const tokens = gameState.tokens?.[color] || [];

    // Faded empty card for colors/seats not in the current game
    if (!p) {
      return (
        <div className="relative flex flex-col items-center z-30 select-none opacity-25 hover:opacity-40 transition-opacity">
          <div className="relative z-20 flex flex-col items-center justify-between w-20 sm:w-24 py-2.5 px-2 rounded-2xl bg-[#0a0c16]/50 backdrop-blur-md border border-white/10 shadow-md">
            <div
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-dashed flex items-center justify-center text-white/30 text-xs font-bold mb-1"
              style={{ borderColor: `${cfg.neon}40`, backgroundColor: `${cfg.fill}15` }}
            >
              <span className="text-white/30 text-xs">—</span>
            </div>
            <span className="font-semibold text-white/40 text-[10px] sm:text-[11px] tracking-wide text-center">
              Empty
            </span>
            <span className="text-[8px] font-bold text-white/20 uppercase tracking-wider mt-0.5">
              {color}
            </span>
            {/* 4 Empty Dots */}
            <div className="flex items-center justify-center gap-1.5 mt-2 pt-1 border-t border-white/5 w-full">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full border border-white/15 bg-white/5" />
              ))}
            </div>
          </div>
        </div>
      );
    }

    const pStream = participantStreamsByUserId[p.userId];
    const isDisconnected = !p.isConnected;
    
    // For local player (isMe), prioritize localUserStream and isCameraOn directly
    const activeStream = isMe ? (localUserStream || pStream?.stream) : pStream?.stream;
    const activeCameraOn = isMe ? isCameraOn : Boolean(pStream?.isCameraOn);
    const hasLiveVideo = Boolean(
      activeCameraOn &&
      activeStream &&
      activeStream.getVideoTracks().length > 0 &&
      activeStream.getVideoTracks().some(t => t.enabled && t.readyState !== 'ended')
    );

    return (
      <div className="relative flex flex-col items-center z-30 select-none group">
        {/* Remote audio receiver so we hear opponent speaking */}
        {!isMe && pStream?.stream && (
          <RemoteAudioPlayer stream={pStream.stream} />
        )}

        {/* Floating Dark Crystal Card matching Image 2 reference UI */}
        <div
          className={`relative z-20 flex flex-col items-center justify-between w-20 sm:w-24 py-2.5 px-2 rounded-2xl sm:rounded-[22px] bg-[#0a0c16]/90 backdrop-blur-xl border transition-all duration-300 shadow-[0_8px_25px_rgba(0,0,0,0.65)] ${
            isDisconnected
              ? 'opacity-40 grayscale-[60%] border-rose-500/25'
              : isCurrentTurn
              ? 'ring-2 border-white/40 scale-105'
              : 'border-white/15 hover:border-white/25'
          }`}
          style={{
            boxShadow: isCurrentTurn ? `0 0 20px ${cfg.glow}, 0 8px 25px rgba(0,0,0,0.7)` : undefined,
            borderColor: isCurrentTurn ? cfg.neon : undefined
          }}
        >
          {/* Nudge / menu button at top-right corner of card */}
          {!isMe && (
            <button
              type="button"
              className="absolute top-1.5 right-1.5 text-white/30 hover:text-white transition p-0.5 cursor-pointer z-30 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onNudgePlayer?.(p.userId, p.displayName);
              }}
              title={`Nudge ${p.displayName}`}
            >
              <MoreHorizontal className="w-3 h-3" />
            </button>
          )}

          {/* Avatar container with Neon Ring */}
          <div className="relative shrink-0 mt-0.5">
            {/* Crown for Host */}
            {isHost && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                <Crown className="w-4 h-4 text-amber-300 fill-amber-400 animate-pulse" />
              </div>
            )}

            {/* Glowing Neon Avatar Ring */}
            <div
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full p-0.5 border flex items-center justify-center transition-all ${
                (isMe ? !isMicMuted : pStream?.isSpeaking)
                  ? 'ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.9)]'
                  : ''
              }`}
              style={{
                borderColor: cfg.neon,
                boxShadow: `0 0 10px ${cfg.glow}`,
                backgroundColor: '#0f111a'
              }}
            >
              <div
                className="w-full h-full rounded-full flex items-center justify-center font-bold text-xs text-white shadow-inner uppercase overflow-hidden relative"
                style={{ backgroundColor: cfg.fill }}
              >
                {hasLiveVideo && activeStream ? (
                  <VideoAvatar stream={activeStream} isSelf={isMe} displayName={p.displayName} />
                ) : p.avatarUrl ? (
                  <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" />
                ) : (
                  <span>{p.displayName[0]}</span>
                )}
              </div>
            </div>

            {/* Connection status indicator dot */}
            <span
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-1.5 ring-[#0a0c16] ${
                p.isConnected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
              }`}
              title={p.isConnected ? 'Online' : 'Disconnected'}
            />
          </div>

          {/* Player Name / Tag */}
          <div className="flex flex-col items-center min-w-0 mt-1.5 text-center w-full">
            <span className="font-bold text-white text-xs sm:text-[13px] tracking-wide truncate max-w-[70px] sm:max-w-[80px] drop-shadow-sm">
              {p.displayName}
            </span>
            {isDisconnected ? (
              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-rose-400/90 leading-none mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
                Offline
              </span>
            ) : isCurrentTurn ? (
              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-amber-300 leading-none mt-0.5 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]">
                {isMe ? 'Your Turn' : 'Thinking...'}
              </span>
            ) : isMe ? (
              <span className="text-[8px] sm:text-[9px] font-bold text-white/50 leading-none mt-0.5">
                You
              </span>
            ) : (
              <span className="text-[8px] sm:text-[9px] font-bold text-white/40 leading-none mt-0.5">
                Ready!
              </span>
            )}
          </div>

          {/* 4-Dot Token Status Tracker matching Image 2 */}
          <div className="flex items-center justify-center gap-1.5 mt-2 pt-1.5 border-t border-white/10 w-full">
            {[0, 1, 2, 3].map((tokenIdx) => {
              const tok = tokens[tokenIdx];
              const isHome = tok && tok.step >= 56;
              const isOnBoard = tok && tok.step >= 0 && tok.step < 56;
              return (
                <div
                  key={tokenIdx}
                  className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-300 ${
                    isHome
                      ? 'ring-1 ring-white shadow-[0_0_8px_#ffffff] bg-white'
                      : isOnBoard
                      ? 'shadow-[0_0_6px_currentColor]'
                      : 'opacity-40 border border-white/30'
                  }`}
                  style={{
                    backgroundColor: isHome ? '#ffffff' : isOnBoard ? cfg.neon : `${cfg.fill}35`,
                    borderColor: cfg.neon,
                    color: cfg.neon
                  }}
                  title={isHome ? 'Token Home!' : isOnBoard ? 'Token on Track' : 'Token in Yard'}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-between w-full max-w-2xl mx-auto select-none relative">
      {/* Floating Reactions Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
        {floatingReactions.map(r => (
          <div
            key={r.id}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 animate-float-up flex flex-col items-center"
          >
            <span className="text-4xl filter drop-shadow-lg">{r.emoji}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/70 text-white font-bold backdrop-blur-sm mt-0.5">
              {r.userName}
            </span>
          </div>
        ))}
      </div>

      {/* Board & Player Ribbons Container - Perfectly sized to fit screen without scrolling */}
      <div
        className="relative w-full max-w-[min(92vw,calc(100dvh-230px),440px)] sm:max-w-[min(85vw,calc(100dvh-220px),480px)] md:max-w-[min(75vw,calc(100dvh-210px),510px)] lg:max-w-[min(48vw,calc(100dvh-200px),530px)] flex flex-col items-center select-none my-4 sm:my-6 px-5 sm:px-8"
      >
        {/* Top Room Status Pill & Alignment Debug Toggle */}
        <div className="mb-3 sm:mb-4 flex items-center justify-center gap-2 z-20">
          <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0a0c16]/85 backdrop-blur-md border border-amber-400/30 shadow-[0_4px_15px_rgba(0,0,0,0.5)] text-amber-200/90 text-xs font-semibold tracking-wide">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>{room.maxPlayers || 4} Players</span>
            <span className="text-white/30">•</span>
            <Lock className="w-3 h-3 text-amber-400/80" />
            <span>{room.isPrivate ? 'Private Room' : 'Public Room'}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowGridDebug(prev => !prev)}
            className={`p-1.5 rounded-full border text-xs transition cursor-pointer ${
              showGridDebug
                ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                : 'bg-[#0a0c16]/85 text-white/50 border-white/15 hover:text-white hover:border-white/30'
            }`}
            title="Toggle Grid & Alignment Crosshairs"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Luxury Dark Mahogany & Obsidian Ludo Board Block matching reference image */}
        <div className="relative w-full aspect-square rounded-[36px] p-2.5 sm:p-3.5 bg-gradient-to-br from-[#2a222f] via-[#1a1b24] to-[#101118] border-[3px] border-[#3e3447] shadow-[0_25px_60px_rgba(0,0,0,0.85),0_10px_25px_rgba(0,0,0,0.65),inset_0_1px_2px_rgba(255,255,255,0.2)] flex items-center justify-center transition-all duration-300">
          {/* 3D Rolling Center Dice */}
          {centerDiceAnimation && !animatingPawn && gameState.diceValue !== null && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
              <div
                className={`flex flex-col items-center justify-center ${
                  centerDiceAnimation.phase === 'rolling'
                    ? 'animate-dice-tumble'
                    : centerDiceAnimation.phase === 'settled'
                    ? 'scale-125 animate-bounce'
                    : 'animate-dice-vanish'
                }`}
              >
                <div
                  className="absolute w-36 h-36 rounded-full blur-2xl animate-pulse"
                  style={{
                    backgroundColor: COLOR_CONFIG[centerDiceAnimation.color]?.glow || 'rgba(251, 191, 36, 0.7)'
                  }}
                />

                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white shadow-[0_15px_40px_rgba(0,0,0,0.25),0_0_25px_rgba(251,191,36,0.8)] border-4 border-amber-300 flex items-center justify-center transform-gpu">
                  {renderDiceFace(centerDiceAnimation.displayValue, 'lg')}
                </div>

                {centerDiceAnimation.phase === 'settled' && (
                  <div className="mt-3 px-3.5 py-1 rounded-full bg-[#3d2714]/90 text-amber-300 text-xs font-black border border-amber-400/60 shadow-xl flex items-center gap-1.5 animate-in fade-in zoom-in-50 duration-150">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-current" />
                    <span>Rolled {centerDiceAnimation.finalValue}!</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SVG Board Container with Luxury Frame matching reference image */}
          <svg
            viewBox="-16 -16 632 632"
            className="w-full h-full rounded-[26px] overflow-hidden shadow-[inset_0_0_25px_rgba(0,0,0,0.9)] border border-[#2b2535]"
            style={{ shapeRendering: 'geometricPrecision' }}
          >
              <defs>
                {/* Contact Shadow & Ambient Occlusion Blurs */}
                <filter id="contactShadowBlur" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="1" />
                </filter>
                <filter id="castShadowBlur" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.2" />
                </filter>
                <filter id="recessedSaucerShadow" x="-25%" y="-25%" width="150%" height="150%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.5" />
                </filter>
                <filter id="tile3DShadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="1" stdDeviation="0.6" floodColor="#000000" floodOpacity="0.4" />
                </filter>
                <filter id="trayInnerShadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.6" />
                </filter>

                {/* Neon Glow Filters matching reference image */}
                <filter id="neonGlowPink" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#ff2e79" floodOpacity="0.9" />
                  <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#ff2e79" floodOpacity="0.6" />
                </filter>
                <filter id="neonGlowBlue" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#38bdf8" floodOpacity="0.9" />
                  <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#38bdf8" floodOpacity="0.6" />
                </filter>
                <filter id="neonGlowGreen" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#34d399" floodOpacity="0.9" />
                  <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#34d399" floodOpacity="0.6" />
                </filter>
                <filter id="neonGlowGold" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#fbbf24" floodOpacity="0.9" />
                  <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#fbbf24" floodOpacity="0.6" />
                </filter>
                <filter id="neonGlowRedCenter" x="-60%" y="-60%" width="220%" height="220%">
                  <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ff1744" floodOpacity="0.95" />
                  <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#ff2e79" floodOpacity="0.75" />
                </filter>

                {/* 3D Star Glow and Pedestal Shadow Filters */}
                <filter id="starGoldGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#fbbf24" floodOpacity="0.9" />
                  <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.6" />
                </filter>
                <filter id="pedestalRingShadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.65" />
                </filter>
                <filter id="pawnSpecularGleam" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="0.6" />
                  <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* 24K Royal Metallic Gold Gradients */}
                <linearGradient id="goldMetallicGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fffbeb" />
                  <stop offset="25%" stopColor="#fef08a" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="80%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#78350f" />
                </linearGradient>
                <radialGradient id="goldRingRadial" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#fef9c3" />
                  <stop offset="45%" stopColor="#f59e0b" />
                  <stop offset="85%" stopColor="#b45309" />
                  <stop offset="100%" stopColor="#78350f" />
                </radialGradient>

                {/* Travertine Ivory Marble Tile Gradient with 3D Depth */}
                <linearGradient id="marbleTileGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fbf9f4" />
                  <stop offset="45%" stopColor="#ede6da" />
                  <stop offset="100%" stopColor="#ded3c1" />
                </linearGradient>

                {/* Colored Stone Tile Gradients */}
                <linearGradient id="rubyTileGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fb7185" />
                  <stop offset="40%" stopColor="#e11d48" />
                  <stop offset="100%" stopColor="#881337" />
                </linearGradient>
                <linearGradient id="sapphireTileGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="40%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#1e3a8a" />
                </linearGradient>
                <linearGradient id="emeraldTileGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4ade80" />
                  <stop offset="40%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#064e3b" />
                </linearGradient>
                <linearGradient id="amberTileGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fde047" />
                  <stop offset="40%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#78350f" />
                </linearGradient>

                {/* Yard Royal Velvet Background Gradients */}
                <linearGradient id="rubyYardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#5c091a" />
                  <stop offset="50%" stopColor="#33050e" />
                  <stop offset="100%" stopColor="#1a0207" />
                </linearGradient>
                <linearGradient id="sapphireYardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0d2b5c" />
                  <stop offset="50%" stopColor="#071733" />
                  <stop offset="100%" stopColor="#030b1a" />
                </linearGradient>
                <linearGradient id="emeraldYardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0a4221" />
                  <stop offset="50%" stopColor="#042613" />
                  <stop offset="100%" stopColor="#02140a" />
                </linearGradient>
                <linearGradient id="amberYardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#543304" />
                  <stop offset="50%" stopColor="#362002" />
                  <stop offset="100%" stopColor="#1c1001" />
                </linearGradient>

                {/* 3D Radial Sphere Gradients for Luxury Pawn Heads */}
                <radialGradient id="redPawnHead" cx="30%" cy="25%" r="75%">
                  <stop offset="0%" stopColor="#fff1f2" />
                  <stop offset="20%" stopColor="#fda4af" />
                  <stop offset="55%" stopColor="#e11d48" />
                  <stop offset="85%" stopColor="#9f1239" />
                  <stop offset="100%" stopColor="#4c0519" />
                </radialGradient>
                <radialGradient id="bluePawnHead" cx="30%" cy="25%" r="75%">
                  <stop offset="0%" stopColor="#f0f9ff" />
                  <stop offset="20%" stopColor="#93c5fd" />
                  <stop offset="55%" stopColor="#2563eb" />
                  <stop offset="85%" stopColor="#1e40af" />
                  <stop offset="100%" stopColor="#081e59" />
                </radialGradient>
                <radialGradient id="yellowPawnHead" cx="30%" cy="25%" r="75%">
                  <stop offset="0%" stopColor="#fffbeb" />
                  <stop offset="20%" stopColor="#fde047" />
                  <stop offset="55%" stopColor="#f59e0b" />
                  <stop offset="85%" stopColor="#b45309" />
                  <stop offset="100%" stopColor="#451a03" />
                </radialGradient>
                <radialGradient id="greenPawnHead" cx="30%" cy="25%" r="75%">
                  <stop offset="0%" stopColor="#f0fdf4" />
                  <stop offset="20%" stopColor="#86efac" />
                  <stop offset="55%" stopColor="#10b981" />
                  <stop offset="85%" stopColor="#047857" />
                  <stop offset="100%" stopColor="#022c22" />
                </radialGradient>

                {/* 3D Cylindrical Gradients for Luxury Pawn Bodies */}
                <linearGradient id="redPawnBody" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#9f1239" />
                  <stop offset="25%" stopColor="#fb7185" />
                  <stop offset="50%" stopColor="#e11d48" />
                  <stop offset="85%" stopColor="#881337" />
                  <stop offset="100%" stopColor="#4c0519" />
                </linearGradient>
                <linearGradient id="bluePawnBody" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1e40af" />
                  <stop offset="25%" stopColor="#60a5fa" />
                  <stop offset="50%" stopColor="#2563eb" />
                  <stop offset="85%" stopColor="#1e3a8a" />
                  <stop offset="100%" stopColor="#081e59" />
                </linearGradient>
                <linearGradient id="yellowPawnBody" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#b45309" />
                  <stop offset="25%" stopColor="#fde047" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="85%" stopColor="#92400e" />
                  <stop offset="100%" stopColor="#451a03" />
                </linearGradient>
                <linearGradient id="greenPawnBody" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#047857" />
                  <stop offset="25%" stopColor="#4ade80" />
                  <stop offset="50%" stopColor="#10b981" />
                  <stop offset="85%" stopColor="#064e3b" />
                  <stop offset="100%" stopColor="#022c22" />
                </linearGradient>

                {/* Antique Baroque 24K Sculpted Gold Gradients matching Image 2 */}
                <linearGradient id="baroqueGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fff8db" />
                  <stop offset="15%" stopColor="#f7d479" />
                  <stop offset="35%" stopColor="#d4a343" />
                  <stop offset="55%" stopColor="#aa7c11" />
                  <stop offset="80%" stopColor="#e5b95c" />
                  <stop offset="100%" stopColor="#543b0d" />
                </linearGradient>
                <linearGradient id="mahoganyFrameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2e1b10" />
                  <stop offset="40%" stopColor="#1a0f08" />
                  <stop offset="100%" stopColor="#0c0704" />
                </linearGradient>
              </defs>

              {/* Board Base Surface: Heavy Carved Mahogany & 24K Sculpted Baroque Outer Gold Frame matching Image 2 */}
              <rect x="-16" y="-16" width="632" height="632" rx="26" fill="url(#mahoganyFrameGrad)" stroke="#3e2311" strokeWidth="1.5" />
              {/* Heavy 24K Antique Gold Baroque Stepped Relief Molding */}
              <rect x="-13" y="-13" width="626" height="626" rx="23" fill="none" stroke="url(#baroqueGoldGrad)" strokeWidth="4.5" />
              <rect x="-9.5" y="-9.5" width="619" height="619" rx="20" fill="none" stroke="#fff8db" strokeWidth="1.2" opacity="0.85" />
              <rect x="-6" y="-6" width="612" height="612" rx="16" fill="none" stroke="#3b2606" strokeWidth="2.5" />
              <rect x="-2" y="-2" width="604" height="604" rx="13" fill="none" stroke="url(#baroqueGoldGrad)" strokeWidth="1.8" strokeDasharray="6, 3" opacity="0.9" />
              <rect x="0" y="0" width="600" height="600" rx="10" fill="#0d0f17" filter="url(#trayInnerShadow)" />

              {/* 4 Ornate Baroque / Rococo Filigree Corner Carvings matching Image 2 */}
              {/* Top-Left Corner Filigree */}
              <g stroke="url(#baroqueGoldGrad)" strokeWidth="1.8" fill="none" strokeLinecap="round">
                <path d="M -11 28 C -11 6, 6 -11, 28 -11" />
                <path d="M -8 20 C -8 2, 2 -8, 20 -8" stroke="#fff8db" strokeWidth="1" opacity="0.9" />
                <path d="M -4 34 C -4 14, 14 -4, 34 -4" />
                <path d="M -12 -12 C -6 -6, -6 -6, 2 2" strokeWidth="2.4" />
                <circle cx="5" cy="5" r="2.8" fill="url(#baroqueGoldGrad)" stroke="#543b0d" strokeWidth="0.8" />
                <circle cx="-3" cy="22" r="1.6" fill="#fff8db" />
                <circle cx="22" cy="-3" r="1.6" fill="#fff8db" />
              </g>
              {/* Top-Right Corner Filigree */}
              <g stroke="url(#baroqueGoldGrad)" strokeWidth="1.8" fill="none" strokeLinecap="round">
                <path d="M 611 28 C 611 6, 594 -11, 572 -11" />
                <path d="M 608 20 C 608 2, 598 -8, 580 -8" stroke="#fff8db" strokeWidth="1" opacity="0.9" />
                <path d="M 604 34 C 604 14, 586 -4, 566 -4" />
                <path d="M 612 -12 C 606 -6, 606 -6, 598 2" strokeWidth="2.4" />
                <circle cx="595" cy="5" r="2.8" fill="url(#baroqueGoldGrad)" stroke="#543b0d" strokeWidth="0.8" />
                <circle cx="603" cy="22" r="1.6" fill="#fff8db" />
                <circle cx="578" cy="-3" r="1.6" fill="#fff8db" />
              </g>
              {/* Bottom-Left Corner Filigree */}
              <g stroke="url(#baroqueGoldGrad)" strokeWidth="1.8" fill="none" strokeLinecap="round">
                <path d="M -11 572 C -11 594, 6 611, 28 611" />
                <path d="M -8 580 C -8 598, 2 608, 20 608" stroke="#fff8db" strokeWidth="1" opacity="0.9" />
                <path d="M -4 566 C -4 586, 14 604, 34 604" />
                <path d="M -12 612 C -6 606, -6 606, 2 598" strokeWidth="2.4" />
                <circle cx="5" cy="595" r="2.8" fill="url(#baroqueGoldGrad)" stroke="#543b0d" strokeWidth="0.8" />
                <circle cx="-3" cy="578" r="1.6" fill="#fff8db" />
                <circle cx="22" cy="603" r="1.6" fill="#fff8db" />
              </g>
              {/* Bottom-Right Corner Filigree */}
              <g stroke="url(#baroqueGoldGrad)" strokeWidth="1.8" fill="none" strokeLinecap="round">
                <path d="M 611 572 C 611 594, 594 611, 572 611" />
                <path d="M 608 580 C 608 598, 598 608, 580 608" stroke="#fff8db" strokeWidth="1" opacity="0.9" />
                <path d="M 604 566 C 604 586, 586 604, 566 604" />
                <path d="M 612 612 C 606 606, 606 606, 598 598" strokeWidth="2.4" />
                <circle cx="595" cy="595" r="2.8" fill="url(#baroqueGoldGrad)" stroke="#543b0d" strokeWidth="0.8" />
                <circle cx="603" cy="578" r="1.6" fill="#fff8db" />
                <circle cx="578" cy="603" r="1.6" fill="#fff8db" />
              </g>

              {/* Rotated Board Play Surface (active player yard always faces bottom-left) */}
              <g transform={boardRotation ? `rotate(${boardRotation}, 300, 300)` : undefined}>
                {/* 1. YARDS (4 Luxury Royal Palace Chambers with 3D Pedestals & Embossed Crown Crests) */}
                {/* Red Yard (Top-Left in base coordinates) */}
                <g style={{ opacity: isColorInGame('red') ? 1 : 0.28, filter: isColorInGame('red') ? undefined : 'grayscale(55%)', transition: 'opacity 0.4s ease, filter 0.4s ease' }}>
                  <rect x="10" y="10" width="220" height="220" rx="22" fill="url(#rubyYardGrad)" stroke="url(#baroqueGoldGrad)" strokeWidth="3.2" filter="url(#trayInnerShadow)" />
                  <rect x="14" y="14" width="212" height="212" rx="18" fill="none" stroke="#fff8db" strokeWidth="1.0" opacity="0.75" />
                  <rect x="17" y="17" width="206" height="206" rx="15" fill="none" stroke="#ff2e79" strokeWidth="0.8" opacity="0.45" strokeDasharray="4, 3" />
                  {/* Concentric ornamental quadrant arcs */}
                  <circle cx="120" cy="120" r="82" fill="none" stroke="#ff2e79" strokeWidth="0.5" opacity="0.25" />
                  <circle cx="120" cy="120" r="54" fill="none" stroke="url(#baroqueGoldGrad)" strokeWidth="0.6" opacity="0.3" strokeDasharray="3, 3" />

                  {/* 4 Ornate Gold Corner Filigree Brackets inside yard */}
                  <g stroke="url(#baroqueGoldGrad)" strokeWidth="1.2" fill="none" opacity="0.85">
                    <path d="M 28 46 C 28 34, 34 28, 46 28 M 28 38 C 30 30, 30 30, 38 28" />
                    <circle cx="32" cy="32" r="1.5" fill="url(#baroqueGoldGrad)" />
                    <path d="M 212 46 C 212 34, 206 28, 194 28 M 212 38 C 210 30, 210 30, 202 28" />
                    <circle cx="208" cy="32" r="1.5" fill="url(#baroqueGoldGrad)" />
                    <path d="M 28 194 C 28 206, 34 212, 46 212 M 28 202 C 30 210, 30 210, 38 212" />
                    <circle cx="32" cy="208" r="1.5" fill="url(#baroqueGoldGrad)" />
                    <path d="M 212 194 C 212 206, 206 212, 194 212 M 212 202 C 210 210, 210 210, 202 212" />
                    <circle cx="208" cy="208" r="1.5" fill="url(#baroqueGoldGrad)" />
                  </g>

                  {/* Embossed Royal Crown Crest in Yard Center matching Image 2 */}
                  <g transform={`translate(120, 120) rotate(${-boardRotation})`}>
                    <circle cx="0" cy="0" r="46" fill="none" stroke="url(#baroqueGoldGrad)" strokeWidth="1.2" strokeDasharray="4, 3" opacity="0.7" />
                    <circle cx="0" cy="0" r="38" fill="none" stroke="#ff2e79" strokeWidth="1.4" opacity="0.45" />
                    <g transform="scale(1.4)">
                      <ellipse cx="0" cy="-3" rx="26" ry="15" fill="rgba(255, 46, 121, 0.22)" opacity="0.9" />
                      <path
                        d="M -22,5 L -19,-11 L -9,-3 L 0,-17 L 9,-3 L 19,-11 L 22,5 Z"
                        fill="#000000"
                        opacity="0.45"
                        transform="translate(0, 1.8)"
                      />
                      <path
                        d="M -21,5 C -11,8 11,8 21,5 L 19,10 C 11,13 -11,13 -19,10 Z"
                        fill="url(#baroqueGoldGrad)"
                        stroke="#543b0d"
                        strokeWidth="0.8"
                      />
                      <circle cx="-10" cy="7.5" r="1.5" fill="#ff2e79" stroke="#fffdf0" strokeWidth="0.4" />
                      <circle cx="0" cy="8.5" r="1.8" fill="#fffdf0" stroke="#543b0d" strokeWidth="0.4" />
                      <circle cx="10" cy="7.5" r="1.5" fill="#ff2e79" stroke="#fffdf0" strokeWidth="0.4" />
                      <path
                        d="M -21,5 L -19,-11 L -9,-3 L 0,-17 L 9,-3 L 19,-11 L 21,5 C 11,7.5 -11,7.5 -21,5 Z"
                        fill="url(#baroqueGoldGrad)"
                        stroke="#fff8db"
                        strokeWidth="0.9"
                        strokeLinejoin="round"
                      />
                      <path d="M 0,-17 L 0,5 M -9,-3 L -7,5 M 9,-3 L 7,5" stroke="#543b0d" strokeWidth="0.7" opacity="0.6" />
                      <path d="M 0,-17 L 1.5,5 M -9,-3 L -8,5 M 9,-3 L 8,5" stroke="#fff8db" strokeWidth="0.6" opacity="0.8" />
                      <circle cx="-19" cy="-11" r="2.0" fill="#fffdf0" stroke="#78350f" strokeWidth="0.5" />
                      <circle cx="-9" cy="-3" r="1.7" fill="#fffdf0" stroke="#78350f" strokeWidth="0.5" />
                      <circle cx="0" cy="-17" r="2.6" fill="#fffdf0" stroke="#78350f" strokeWidth="0.6" />
                      <circle cx="9" cy="-3" r="1.7" fill="#fffdf0" stroke="#78350f" strokeWidth="0.5" />
                      <circle cx="19" cy="-11" r="2.0" fill="#fffdf0" stroke="#78350f" strokeWidth="0.5" />
                      <path d="M 0,-9 L -3,-3 L 0,3 L 3,-3 Z" fill="#ff2e79" stroke="#fffdf0" strokeWidth="0.4" />
                    </g>
                  </g>

                  {/* 4 3D Recessed Gold Socket Pedestals matching Image 2 */}
                  {YARD_SOCKET_CENTERS.red.map((socket, i) => (
                    <g key={`ry-${i}`} filter="url(#pedestalRingShadow)">
                      <circle cx={socket.x} cy={socket.y} r="20" fill="url(#baroqueGoldGrad)" stroke="#543b0d" strokeWidth="0.8" />
                      <circle cx={socket.x} cy={socket.y} r="18.5" fill="none" stroke="#fff8db" strokeWidth="0.8" opacity="0.8" />
                      <circle cx={socket.x} cy={socket.y} r="16.5" fill="#080a10" filter="url(#recessedSaucerShadow)" />
                      <circle cx={socket.x} cy={socket.y} r="14.5" fill="url(#rubyYardGrad)" stroke="#ff2e79" strokeWidth="0.8" opacity="0.85" />
                      <circle cx={socket.x} cy={socket.y} r="11" fill="none" stroke="url(#baroqueGoldGrad)" strokeWidth="0.8" strokeDasharray="2.5, 2" opacity="0.6" />
                      <circle cx={socket.x} cy={socket.y} r="2.8" fill="url(#baroqueGoldGrad)" stroke="#fff8db" strokeWidth="0.4" />
                    </g>
                  ))}
                </g>

                {/* Blue Yard (Top-Right in base coordinates) */}
                <g style={{ opacity: isColorInGame('blue') ? 1 : 0.28, filter: isColorInGame('blue') ? undefined : 'grayscale(55%)', transition: 'opacity 0.4s ease, filter 0.4s ease' }}>
                  <rect x="370" y="10" width="220" height="220" rx="22" fill="url(#sapphireYardGrad)" stroke="url(#baroqueGoldGrad)" strokeWidth="3.2" filter="url(#trayInnerShadow)" />
                  <rect x="374" y="14" width="212" height="212" rx="18" fill="none" stroke="#fff8db" strokeWidth="1.0" opacity="0.75" />
                  <rect x="377" y="17" width="206" height="206" rx="15" fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.45" strokeDasharray="4, 3" />
                  {/* Concentric ornamental quadrant arcs */}
                  <circle cx="480" cy="120" r="82" fill="none" stroke="#38bdf8" strokeWidth="0.5" opacity="0.25" />
                  <circle cx="480" cy="120" r="54" fill="none" stroke="url(#baroqueGoldGrad)" strokeWidth="0.6" opacity="0.3" strokeDasharray="3, 3" />

                  {/* 4 Ornate Gold Corner Filigree Brackets inside yard */}
                  <g stroke="url(#baroqueGoldGrad)" strokeWidth="1.2" fill="none" opacity="0.85">
                    <path d="M 388 46 C 388 34, 394 28, 406 28 M 388 38 C 390 30, 390 30, 398 28" />
                    <circle cx="392" cy="32" r="1.5" fill="url(#baroqueGoldGrad)" />
                    <path d="M 572 46 C 572 34, 566 28, 554 28 M 572 38 C 570 30, 570 30, 562 28" />
                    <circle cx="568" cy="32" r="1.5" fill="url(#baroqueGoldGrad)" />
                    <path d="M 388 194 C 388 206, 394 212, 406 212 M 388 202 C 390 210, 390 210, 398 212" />
                    <circle cx="392" cy="208" r="1.5" fill="url(#baroqueGoldGrad)" />
                    <path d="M 572 194 C 572 206, 566 212, 554 212 M 572 202 C 570 210, 570 210, 562 212" />
                    <circle cx="568" cy="208" r="1.5" fill="url(#baroqueGoldGrad)" />
                  </g>

                  {/* Embossed Royal Crown Crest in Yard Center matching Image 2 */}
                  <g transform={`translate(480, 120) rotate(${-boardRotation})`}>
                    <circle cx="0" cy="0" r="46" fill="none" stroke="url(#baroqueGoldGrad)" strokeWidth="1.2" strokeDasharray="4, 3" opacity="0.7" />
                    <circle cx="0" cy="0" r="38" fill="none" stroke="#38bdf8" strokeWidth="1.4" opacity="0.45" />
                    <g transform="scale(1.4)">
                      <ellipse cx="0" cy="-3" rx="26" ry="15" fill="rgba(56, 189, 248, 0.22)" opacity="0.9" />
                      <path
                        d="M -22,5 L -19,-11 L -9,-3 L 0,-17 L 9,-3 L 19,-11 L 22,5 Z"
                        fill="#000000"
                        opacity="0.45"
                        transform="translate(0, 1.8)"
                      />
                      <path
                        d="M -21,5 C -11,8 11,8 21,5 L 19,10 C 11,13 -11,13 -19,10 Z"
                        fill="url(#baroqueGoldGrad)"
                        stroke="#543b0d"
                        strokeWidth="0.8"
                      />
                      <circle cx="-10" cy="7.5" r="1.5" fill="#38bdf8" stroke="#fffdf0" strokeWidth="0.4" />
                      <circle cx="0" cy="8.5" r="1.8" fill="#fffdf0" stroke="#543b0d" strokeWidth="0.4" />
                      <circle cx="10" cy="7.5" r="1.5" fill="#38bdf8" stroke="#fffdf0" strokeWidth="0.4" />
                      <path
                        d="M -21,5 L -19,-11 L -9,-3 L 0,-17 L 9,-3 L 19,-11 L 21,5 C 11,7.5 -11,7.5 -21,5 Z"
                        fill="url(#baroqueGoldGrad)"
                        stroke="#fff8db"
                        strokeWidth="0.9"
                        strokeLinejoin="round"
                      />
                      <path d="M 0,-17 L 0,5 M -9,-3 L -7,5 M 9,-3 L 7,5" stroke="#543b0d" strokeWidth="0.7" opacity="0.6" />
                      <path d="M 0,-17 L 1.5,5 M -9,-3 L -8,5 M 9,-3 L 8,5" stroke="#fff8db" strokeWidth="0.6" opacity="0.8" />
                      <circle cx="-19" cy="-11" r="2.0" fill="#fffdf0" stroke="#78350f" strokeWidth="0.5" />
                      <circle cx="-9" cy="-3" r="1.7" fill="#fffdf0" stroke="#78350f" strokeWidth="0.5" />
                      <circle cx="0" cy="-17" r="2.6" fill="#fffdf0" stroke="#78350f" strokeWidth="0.6" />
                      <circle cx="9" cy="-3" r="1.7" fill="#fffdf0" stroke="#78350f" strokeWidth="0.5" />
                      <circle cx="19" cy="-11" r="2.0" fill="#fffdf0" stroke="#78350f" strokeWidth="0.5" />
                      <path d="M 0,-9 L -3,-3 L 0,3 L 3,-3 Z" fill="#38bdf8" stroke="#fffdf0" strokeWidth="0.4" />
                    </g>
                  </g>

                  {/* 4 3D Recessed Gold Socket Pedestals matching Image 2 */}
                  {YARD_SOCKET_CENTERS.blue.map((socket, i) => (
                    <g key={`by-${i}`} filter="url(#pedestalRingShadow)">
                      <circle cx={socket.x} cy={socket.y} r="20" fill="url(#baroqueGoldGrad)" stroke="#543b0d" strokeWidth="0.8" />
                      <circle cx={socket.x} cy={socket.y} r="18.5" fill="none" stroke="#fff8db" strokeWidth="0.8" opacity="0.8" />
                      <circle cx={socket.x} cy={socket.y} r="16.5" fill="#080a10" filter="url(#recessedSaucerShadow)" />
                      <circle cx={socket.x} cy={socket.y} r="14.5" fill="url(#sapphireYardGrad)" stroke="#38bdf8" strokeWidth="0.8" opacity="0.85" />
                      <circle cx={socket.x} cy={socket.y} r="11" fill="none" stroke="url(#baroqueGoldGrad)" strokeWidth="0.8" strokeDasharray="2.5, 2" opacity="0.6" />
                      <circle cx={socket.x} cy={socket.y} r="2.8" fill="url(#baroqueGoldGrad)" stroke="#fff8db" strokeWidth="0.4" />
                    </g>
                  ))}
                </g>

                {/* Green Yard (Bottom-Left in base coordinates) */}
                <g style={{ opacity: isColorInGame('green') ? 1 : 0.28, filter: isColorInGame('green') ? undefined : 'grayscale(55%)', transition: 'opacity 0.4s ease, filter 0.4s ease' }}>
                  <rect x="10" y="370" width="220" height="220" rx="22" fill="url(#emeraldYardGrad)" stroke="url(#baroqueGoldGrad)" strokeWidth="3.2" filter="url(#trayInnerShadow)" />
                  <rect x="14" y="374" width="212" height="212" rx="18" fill="none" stroke="#fff8db" strokeWidth="1.0" opacity="0.75" />
                  <rect x="17" y="377" width="206" height="206" rx="15" fill="none" stroke="#10b981" strokeWidth="0.8" opacity="0.45" strokeDasharray="4, 3" />
                  {/* Concentric ornamental quadrant arcs */}
                  <circle cx="120" cy="480" r="82" fill="none" stroke="#10b981" strokeWidth="0.5" opacity="0.25" />
                  <circle cx="120" cy="480" r="54" fill="none" stroke="url(#baroqueGoldGrad)" strokeWidth="0.6" opacity="0.3" strokeDasharray="3, 3" />

                  {/* 4 Ornate Gold Corner Filigree Brackets inside yard */}
                  <g stroke="url(#baroqueGoldGrad)" strokeWidth="1.2" fill="none" opacity="0.85">
                    <path d="M 28 406 C 28 394, 34 388, 46 388 M 28 398 C 30 390, 30 390, 38 388" />
                    <circle cx="32" cy="392" r="1.5" fill="url(#baroqueGoldGrad)" />
                    <path d="M 212 406 C 212 394, 206 388, 194 388 M 212 398 C 210 390, 210 390, 202 388" />
                    <circle cx="208" cy="392" r="1.5" fill="url(#baroqueGoldGrad)" />
                    <path d="M 28 554 C 28 566, 34 572, 46 572 M 28 562 C 30 570, 30 570, 38 572" />
                    <circle cx="32" cy="568" r="1.5" fill="url(#baroqueGoldGrad)" />
                    <path d="M 212 554 C 212 566, 206 572, 194 572 M 212 562 C 210 570, 210 570, 202 572" />
                    <circle cx="208" cy="568" r="1.5" fill="url(#baroqueGoldGrad)" />
                  </g>

                  {/* Embossed Royal Crown Crest in Yard Center matching Image 2 */}
                  <g transform={`translate(120, 480) rotate(${-boardRotation})`}>
                    <circle cx="0" cy="0" r="46" fill="none" stroke="url(#baroqueGoldGrad)" strokeWidth="1.2" strokeDasharray="4, 3" opacity="0.7" />
                    <circle cx="0" cy="0" r="38" fill="none" stroke="#10b981" strokeWidth="1.4" opacity="0.45" />
                    <g transform="scale(1.4)">
                      <ellipse cx="0" cy="-3" rx="26" ry="15" fill="rgba(52, 211, 153, 0.22)" opacity="0.9" />
                      <path
                        d="M -22,5 L -19,-11 L -9,-3 L 0,-17 L 9,-3 L 19,-11 L 22,5 Z"
                        fill="#000000"
                        opacity="0.45"
                        transform="translate(0, 1.8)"
                      />
                      <path
                        d="M -21,5 C -11,8 11,8 21,5 L 19,10 C 11,13 -11,13 -19,10 Z"
                        fill="url(#baroqueGoldGrad)"
                        stroke="#543b0d"
                        strokeWidth="0.8"
                      />
                      <circle cx="-10" cy="7.5" r="1.5" fill="#10b981" stroke="#fffdf0" strokeWidth="0.4" />
                      <circle cx="0" cy="8.5" r="1.8" fill="#fffdf0" stroke="#543b0d" strokeWidth="0.4" />
                      <circle cx="10" cy="7.5" r="1.5" fill="#10b981" stroke="#fffdf0" strokeWidth="0.4" />
                      <path
                        d="M -21,5 L -19,-11 L -9,-3 L 0,-17 L 9,-3 L 19,-11 L 21,5 C 11,7.5 -11,7.5 -21,5 Z"
                        fill="url(#baroqueGoldGrad)"
                        stroke="#fff8db"
                        strokeWidth="0.9"
                        strokeLinejoin="round"
                      />
                      <path d="M 0,-17 L 0,5 M -9,-3 L -7,5 M 9,-3 L 7,5" stroke="#543b0d" strokeWidth="0.7" opacity="0.6" />
                      <path d="M 0,-17 L 1.5,5 M -9,-3 L -8,5 M 9,-3 L 8,5" stroke="#fff8db" strokeWidth="0.6" opacity="0.8" />
                      <circle cx="-19" cy="-11" r="2.0" fill="#fffdf0" stroke="#78350f" strokeWidth="0.5" />
                      <circle cx="-9" cy="-3" r="1.7" fill="#fffdf0" stroke="#78350f" strokeWidth="0.5" />
                      <circle cx="0" cy="-17" r="2.6" fill="#fffdf0" stroke="#78350f" strokeWidth="0.6" />
                      <circle cx="9" cy="-3" r="1.7" fill="#fffdf0" stroke="#78350f" strokeWidth="0.5" />
                      <circle cx="19" cy="-11" r="2.0" fill="#fffdf0" stroke="#78350f" strokeWidth="0.5" />
                      <path d="M 0,-9 L -3,-3 L 0,3 L 3,-3 Z" fill="#10b981" stroke="#fffdf0" strokeWidth="0.4" />
                    </g>
                  </g>

                  {/* 4 3D Recessed Gold Socket Pedestals matching Image 2 */}
                  {YARD_SOCKET_CENTERS.green.map((socket, i) => (
                    <g key={`gy-${i}`} filter="url(#pedestalRingShadow)">
                      <circle cx={socket.x} cy={socket.y} r="20" fill="url(#baroqueGoldGrad)" stroke="#543b0d" strokeWidth="0.8" />
                      <circle cx={socket.x} cy={socket.y} r="18.5" fill="none" stroke="#fff8db" strokeWidth="0.8" opacity="0.8" />
                      <circle cx={socket.x} cy={socket.y} r="16.5" fill="#080a10" filter="url(#recessedSaucerShadow)" />
                      <circle cx={socket.x} cy={socket.y} r="14.5" fill="url(#emeraldYardGrad)" stroke="#10b981" strokeWidth="0.8" opacity="0.85" />
                      <circle cx={socket.x} cy={socket.y} r="11" fill="none" stroke="url(#baroqueGoldGrad)" strokeWidth="0.8" strokeDasharray="2.5, 2" opacity="0.6" />
                      <circle cx={socket.x} cy={socket.y} r="2.8" fill="url(#baroqueGoldGrad)" stroke="#fff8db" strokeWidth="0.4" />
                    </g>
                  ))}
                </g>

                {/* Yellow Yard (Bottom-Right in base coordinates) */}
                <g style={{ opacity: isColorInGame('yellow') ? 1 : 0.28, filter: isColorInGame('yellow') ? undefined : 'grayscale(55%)', transition: 'opacity 0.4s ease, filter 0.4s ease' }}>
                  <rect x="370" y="370" width="220" height="220" rx="22" fill="url(#amberYardGrad)" stroke="url(#baroqueGoldGrad)" strokeWidth="3.2" filter="url(#trayInnerShadow)" />
                  <rect x="374" y="374" width="212" height="212" rx="18" fill="none" stroke="#fff8db" strokeWidth="1.0" opacity="0.75" />
                  <rect x="377" y="377" width="206" height="206" rx="15" fill="none" stroke="#f59e0b" strokeWidth="0.8" opacity="0.45" strokeDasharray="4, 3" />
                  {/* Concentric ornamental quadrant arcs */}
                  <circle cx="480" cy="480" r="82" fill="none" stroke="#f59e0b" strokeWidth="0.5" opacity="0.25" />
                  <circle cx="480" cy="480" r="54" fill="none" stroke="url(#baroqueGoldGrad)" strokeWidth="0.6" opacity="0.3" strokeDasharray="3, 3" />

                  {/* 4 Ornate Gold Corner Filigree Brackets inside yard */}
                  <g stroke="url(#baroqueGoldGrad)" strokeWidth="1.2" fill="none" opacity="0.85">
                    <path d="M 388 406 C 388 394, 394 388, 406 388 M 388 398 C 390 390, 390 390, 398 388" />
                    <circle cx="392" cy="392" r="1.5" fill="url(#baroqueGoldGrad)" />
                    <path d="M 572 406 C 572 394, 566 388, 554 388 M 572 398 C 570 390, 570 390, 562 388" />
                    <circle cx="568" cy="392" r="1.5" fill="url(#baroqueGoldGrad)" />
                    <path d="M 388 554 C 388 566, 394 572, 406 572 M 388 562 C 390 570, 390 570, 398 572" />
                    <circle cx="392" cy="568" r="1.5" fill="url(#baroqueGoldGrad)" />
                    <path d="M 572 554 C 572 566, 566 572, 554 572 M 572 562 C 570 570, 570 570, 562 572" />
                    <circle cx="568" cy="568" r="1.5" fill="url(#baroqueGoldGrad)" />
                  </g>

                  {/* Embossed Royal Crown Crest in Yard Center matching Image 2 */}
                  <g transform={`translate(480, 480) rotate(${-boardRotation})`}>
                    <circle cx="0" cy="0" r="46" fill="none" stroke="url(#baroqueGoldGrad)" strokeWidth="1.2" strokeDasharray="4, 3" opacity="0.7" />
                    <circle cx="0" cy="0" r="38" fill="none" stroke="#fbbf24" strokeWidth="1.4" opacity="0.45" />
                    <g transform="scale(1.4)">
                      <ellipse cx="0" cy="-3" rx="26" ry="15" fill="rgba(251, 191, 36, 0.22)" opacity="0.9" />
                      <path
                        d="M -22,5 L -19,-11 L -9,-3 L 0,-17 L 9,-3 L 19,-11 L 22,5 Z"
                        fill="#000000"
                        opacity="0.45"
                        transform="translate(0, 1.8)"
                      />
                      <path
                        d="M -21,5 C -11,8 11,8 21,5 L 19,10 C 11,13 -11,13 -19,10 Z"
                        fill="url(#baroqueGoldGrad)"
                        stroke="#543b0d"
                        strokeWidth="0.8"
                      />
                      <circle cx="-10" cy="7.5" r="1.5" fill="#fbbf24" stroke="#fffdf0" strokeWidth="0.4" />
                      <circle cx="0" cy="8.5" r="1.8" fill="#fffdf0" stroke="#543b0d" strokeWidth="0.4" />
                      <circle cx="10" cy="7.5" r="1.5" fill="#fbbf24" stroke="#fffdf0" strokeWidth="0.4" />
                      <path
                        d="M -21,5 L -19,-11 L -9,-3 L 0,-17 L 9,-3 L 19,-11 L 21,5 C 11,7.5 -11,7.5 -21,5 Z"
                        fill="url(#baroqueGoldGrad)"
                        stroke="#fff8db"
                        strokeWidth="0.9"
                        strokeLinejoin="round"
                      />
                      <path d="M 0,-17 L 0,5 M -9,-3 L -7,5 M 9,-3 L 7,5" stroke="#543b0d" strokeWidth="0.7" opacity="0.6" />
                      <path d="M 0,-17 L 1.5,5 M -9,-3 L -8,5 M 9,-3 L 8,5" stroke="#fff8db" strokeWidth="0.6" opacity="0.8" />
                      <circle cx="-19" cy="-11" r="2.0" fill="#fffdf0" stroke="#78350f" strokeWidth="0.5" />
                      <circle cx="-9" cy="-3" r="1.7" fill="#fffdf0" stroke="#78350f" strokeWidth="0.5" />
                      <circle cx="0" cy="-17" r="2.6" fill="#fffdf0" stroke="#78350f" strokeWidth="0.6" />
                      <circle cx="9" cy="-3" r="1.7" fill="#fffdf0" stroke="#78350f" strokeWidth="0.5" />
                      <circle cx="19" cy="-11" r="2.0" fill="#fffdf0" stroke="#78350f" strokeWidth="0.5" />
                      <path d="M 0,-9 L -3,-3 L 0,3 L 3,-3 Z" fill="#fbbf24" stroke="#fffdf0" strokeWidth="0.4" />
                    </g>
                  </g>

                  {/* 4 3D Recessed Gold Socket Pedestals matching Image 2 */}
                  {YARD_SOCKET_CENTERS.yellow.map((socket, i) => (
                    <g key={`yy-${i}`} filter="url(#pedestalRingShadow)">
                      <circle cx={socket.x} cy={socket.y} r="20" fill="url(#baroqueGoldGrad)" stroke="#543b0d" strokeWidth="0.8" />
                      <circle cx={socket.x} cy={socket.y} r="18.5" fill="none" stroke="#fff8db" strokeWidth="0.8" opacity="0.8" />
                      <circle cx={socket.x} cy={socket.y} r="16.5" fill="#080a10" filter="url(#recessedSaucerShadow)" />
                      <circle cx={socket.x} cy={socket.y} r="14.5" fill="url(#amberYardGrad)" stroke="#f59e0b" strokeWidth="0.8" opacity="0.85" />
                      <circle cx={socket.x} cy={socket.y} r="11" fill="none" stroke="url(#baroqueGoldGrad)" strokeWidth="0.8" strokeDasharray="2.5, 2" opacity="0.6" />
                      <circle cx={socket.x} cy={socket.y} r="2.8" fill="url(#baroqueGoldGrad)" stroke="#fff8db" strokeWidth="0.4" />
                    </g>
                  ))}
                </g>

              {/* 2. TRACK CELLS (52 Ivory Travertine Marble Tiles with Embossed 3D Golden Safe Stars) */}
              {RING_COORDS.map(([r, c], idx) => {
                const isSafe = SAFE_STAR_TILES.has(idx);
                const isRedStart = idx === 0;
                const isBlueStart = idx === 13;
                const isYellowStart = idx === 26;
                const isGreenStart = idx === 39;

                let fill = 'url(#marbleTileGrad)';
                let stroke = '#c8bcab';

                if (isRedStart) { fill = 'url(#rubyTileGrad)'; stroke = '#f43f5e'; }
                else if (isBlueStart) { fill = 'url(#sapphireTileGrad)'; stroke = '#3b82f6'; }
                else if (isYellowStart) { fill = 'url(#amberTileGrad)'; stroke = '#eab308'; }
                else if (isGreenStart) { fill = 'url(#emeraldTileGrad)'; stroke = '#10b981'; }

                const tileX = c * 40 + 2;
                const tileY = r * 40 + 2;

                return (
                  <g key={`track-${idx}`} filter="url(#tile3DShadow)">
                    <rect
                      x={tileX}
                      y={tileY}
                      width="36"
                      height="36"
                      fill={fill}
                      stroke={stroke}
                      strokeWidth="1"
                      rx="5"
                    />

                    {/* Subtle top inner bevel highlight on marble tiles */}
                    {!isRedStart && !isBlueStart && !isYellowStart && !isGreenStart && (
                      <>
                        <line
                          x1={tileX + 3}
                          y1={tileY + 2.5}
                          x2={tileX + 33}
                          y2={tileY + 2.5}
                          stroke="#ffffff"
                          strokeWidth="0.8"
                          opacity="0.8"
                        />
                        <rect
                          x={tileX + 3}
                          y={tileY + 3}
                          width="30"
                          height="30"
                          fill="none"
                          stroke="rgba(0,0,0,0.06)"
                          strokeWidth="0.5"
                          rx="3"
                        />
                      </>
                    )}

                    {/* Start Tile Directional Launch Arrow Icons */}
                    {isRedStart && (
                      <g transform={`translate(${tileX + 18}, ${tileY + 18})`}>
                        <path d="M -7 0 L 5 0 M 1 -5 L 6 0 L 1 5" stroke="#000000" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" transform="translate(0, 1)" />
                        <path d="M -7 0 L 5 0 M 1 -5 L 6 0 L 1 5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M -6.5 0 L 4.5 0 M 1 -4 L 5 0 L 1 4" stroke="#fff8db" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                      </g>
                    )}
                    {isBlueStart && (
                      <g transform={`translate(${tileX + 18}, ${tileY + 18})`}>
                        <path d="M 0 -7 L 0 5 M -5 1 L 0 6 L 5 1" stroke="#000000" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" transform="translate(0, 1)" />
                        <path d="M 0 -7 L 0 5 M -5 1 L 0 6 L 5 1" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M 0 -6.5 L 0 4.5 M -4 1 L 0 5 L 4 1" stroke="#fff8db" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                      </g>
                    )}
                    {isYellowStart && (
                      <g transform={`translate(${tileX + 18}, ${tileY + 18})`}>
                        <path d="M 7 0 L -5 0 M -1 -5 L -6 0 L -1 5" stroke="#000000" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" transform="translate(0, 1)" />
                        <path d="M 7 0 L -5 0 M -1 -5 L -6 0 L -1 5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M 6.5 0 L -4.5 0 M -1 -4 L -5 0 L -1 4" stroke="#fff8db" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                      </g>
                    )}
                    {isGreenStart && (
                      <g transform={`translate(${tileX + 18}, ${tileY + 18})`}>
                        <path d="M 0 7 L 0 -5 M -5 -1 L 0 -6 L 5 -1" stroke="#000000" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" transform="translate(0, 1)" />
                        <path d="M 0 7 L 0 -5 M -5 -1 L 0 -6 L 5 -1" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M 0 6.5 L 0 -4.5 M -4 -1 L 0 -5 L 4 -1" stroke="#fff8db" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                      </g>
                    )}

                    {/* Clean 24K Gold Vector Star Icon on Safe Haven Tiles */}
                    {isSafe && !isRedStart && !isBlueStart && !isYellowStart && !isGreenStart && (
                      <g transform={`translate(${tileX}, ${tileY})`}>
                        {/* Drop shadow star icon */}
                        <path
                          d="M 18 7.5 L 20.8 13.2 L 27 14.1 L 22.5 18.5 L 23.6 24.6 L 18 21.7 L 12.4 24.6 L 13.5 18.5 L 9 14.1 L 15.2 13.2 Z"
                          fill="rgba(0,0,0,0.45)"
                          transform="translate(0, 1.2)"
                        />
                        {/* 24K Antique Gold Metallic Star Icon */}
                        <path
                          d="M 18 7.5 L 20.8 13.2 L 27 14.1 L 22.5 18.5 L 23.6 24.6 L 18 21.7 L 12.4 24.6 L 13.5 18.5 L 9 14.1 L 15.2 13.2 Z"
                          fill="url(#baroqueGoldGrad)"
                          stroke="#543b0d"
                          strokeWidth="1.0"
                          strokeLinejoin="round"
                        />
                        {/* Inner specular bevel line */}
                        <path
                          d="M 18 10.2 L 20 14.2 L 24.5 14.8 L 21.2 18 L 22 22.4 L 18 20.3 L 14 22.4 L 14.8 18 L 11.5 14.8 L 16 14.2 Z"
                          fill="none"
                          stroke="#fff8db"
                          strokeWidth="0.7"
                          opacity="0.9"
                        />
                        {/* Central star gleam */}
                        <circle cx="18" cy="17.2" r="1.3" fill="#ffffff" opacity="0.9" />
                      </g>
                    )}
                  </g>
                );
              })}

              {/* 3. HOME RUNWAYS (Directional Jeweled Runway Tiles with Golden Chevrons) */}
              {/* Red Home Runway (Points Right: -> towards center) */}
              <g style={{ opacity: isColorInGame('red') ? 1 : 0.25, transition: 'opacity 0.4s ease' }}>
                {HOME_PATHS.red.map(([r, c], idx) => {
                  const tileX = c * 40 + 2;
                  const tileY = r * 40 + 2;
                  return (
                    <g key={`rhp-${idx}`} filter="url(#tile3DShadow)">
                      <rect
                        x={tileX}
                        y={tileY}
                        width="36"
                        height="36"
                        fill="url(#rubyTileGrad)"
                        stroke="#fb7185"
                        strokeWidth="1"
                        rx="5"
                      />
                      <line x1={tileX + 3} y1={tileY + 2.5} x2={tileX + 33} y2={tileY + 2.5} stroke="#ffffff" strokeWidth="0.8" opacity="0.6" />
                      {/* Golden Directional Chevron pointing toward Center (Right) */}
                      <path
                        d={`M ${tileX + 14} ${tileY + 11} L ${tileX + 22} ${tileY + 18} L ${tileX + 14} ${tileY + 25}`}
                        fill="none"
                        stroke="url(#goldMetallicGradient)"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.45 + idx * 0.12}
                      />
                    </g>
                  );
                })}
              </g>

              {/* Blue Home Runway (Points Down: v towards center) */}
              <g style={{ opacity: isColorInGame('blue') ? 1 : 0.25, transition: 'opacity 0.4s ease' }}>
                {HOME_PATHS.blue.map(([r, c], idx) => {
                  const tileX = c * 40 + 2;
                  const tileY = r * 40 + 2;
                  return (
                    <g key={`bhp-${idx}`} filter="url(#tile3DShadow)">
                      <rect
                        x={tileX}
                        y={tileY}
                        width="36"
                        height="36"
                        fill="url(#sapphireTileGrad)"
                        stroke="#60a5fa"
                        strokeWidth="1"
                        rx="5"
                      />
                      <line x1={tileX + 3} y1={tileY + 2.5} x2={tileX + 33} y2={tileY + 2.5} stroke="#ffffff" strokeWidth="0.8" opacity="0.6" />
                      {/* Golden Directional Chevron pointing toward Center (Down) */}
                      <path
                        d={`M ${tileX + 11} ${tileY + 14} L ${tileX + 18} ${tileY + 22} L ${tileX + 25} ${tileY + 14}`}
                        fill="none"
                        stroke="url(#goldMetallicGradient)"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.45 + idx * 0.12}
                      />
                    </g>
                  );
                })}
              </g>

              {/* Yellow Home Runway (Points Left: <- towards center) */}
              <g style={{ opacity: isColorInGame('yellow') ? 1 : 0.25, transition: 'opacity 0.4s ease' }}>
                {HOME_PATHS.yellow.map(([r, c], idx) => {
                  const tileX = c * 40 + 2;
                  const tileY = r * 40 + 2;
                  return (
                    <g key={`yhp-${idx}`} filter="url(#tile3DShadow)">
                      <rect
                        x={tileX}
                        y={tileY}
                        width="36"
                        height="36"
                        fill="url(#amberTileGrad)"
                        stroke="#facc15"
                        strokeWidth="1"
                        rx="5"
                      />
                      <line x1={tileX + 3} y1={tileY + 2.5} x2={tileX + 33} y2={tileY + 2.5} stroke="#ffffff" strokeWidth="0.8" opacity="0.6" />
                      {/* Golden Directional Chevron pointing toward Center (Left) */}
                      <path
                        d={`M ${tileX + 22} ${tileY + 11} L ${tileX + 14} ${tileY + 18} L ${tileX + 22} ${tileY + 25}`}
                        fill="none"
                        stroke="url(#goldMetallicGradient)"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.45 + idx * 0.12}
                      />
                    </g>
                  );
                })}
              </g>

              {/* Green Home Runway (Points Up: ^ towards center) */}
              <g style={{ opacity: isColorInGame('green') ? 1 : 0.25, transition: 'opacity 0.4s ease' }}>
                {HOME_PATHS.green.map(([r, c], idx) => {
                  const tileX = c * 40 + 2;
                  const tileY = r * 40 + 2;
                  return (
                    <g key={`ghp-${idx}`} filter="url(#tile3DShadow)">
                      <rect
                        x={tileX}
                        y={tileY}
                        width="36"
                        height="36"
                        fill="url(#emeraldTileGrad)"
                        stroke="#4ade80"
                        strokeWidth="1"
                        rx="5"
                      />
                      <line x1={tileX + 3} y1={tileY + 2.5} x2={tileX + 33} y2={tileY + 2.5} stroke="#ffffff" strokeWidth="0.8" opacity="0.6" />
                      {/* Golden Directional Chevron pointing toward Center (Up) */}
                      <path
                        d={`M ${tileX + 11} ${tileY + 22} L ${tileX + 18} ${tileY + 14} L ${tileX + 25} ${tileY + 22}`}
                        fill="none"
                        stroke="url(#goldMetallicGradient)"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.45 + idx * 0.12}
                      />
                    </g>
                  );
                })}
              </g>

              {/* 4. CENTER HOME TRIANGLES & IMPERIAL VICTORY SANCTUARY */}
              <g filter="url(#trayInnerShadow)">
                <polygon points="240,240 300,300 240,360" fill="url(#rubyTileGrad)" stroke="#4c0519" strokeWidth="1.2" />
                <polygon points="240,240 300,300 360,240" fill="url(#sapphireTileGrad)" stroke="#082f49" strokeWidth="1.2" />
                <polygon points="360,240 300,300 360,360" fill="url(#amberTileGrad)" stroke="#451a03" strokeWidth="1.2" />
                <polygon points="240,360 300,300 360,360" fill="url(#emeraldTileGrad)" stroke="#022c22" strokeWidth="1.2" />
              </g>

              {/* 24K Gold Separator Struts between 4 Home Triangles */}
              <line x1="240" y1="240" x2="360" y2="360" stroke="url(#baroqueGoldGrad)" strokeWidth="2.8" strokeLinecap="round" />
              <line x1="240" y1="360" x2="360" y2="240" stroke="url(#baroqueGoldGrad)" strokeWidth="2.8" strokeLinecap="round" />

              {/* Imperial Victory Medallion with Radiant Golden Rosette and Ruby Heart matching Image 2 */}
              <g transform={`translate(300, 300) rotate(${-boardRotation})`}>
                {/* Outer Golden Rosette Ring */}
                <circle cx="0" cy="0" r="40" fill="none" stroke="url(#baroqueGoldGrad)" strokeWidth="2.4" opacity="0.9" />
                <circle cx="0" cy="0" r="35" fill="none" stroke="#fff8db" strokeWidth="0.8" strokeDasharray="3, 3" opacity="0.75" />
                {/* 8-Point Golden Star Behind Heart */}
                <polygon
                  points="0,-32 8,-12 30,-12 14,3 20,24 0,12 -20,24 -14,3 -30,-12 -8,-12"
                  fill="url(#baroqueGoldGrad)"
                  stroke="#fff8db"
                  strokeWidth="0.6"
                  opacity="0.9"
                />
                <circle cx="0" cy="0" r="23" fill="#180408" opacity="0.9" stroke="url(#baroqueGoldGrad)" strokeWidth="1.2" />

                {/* Imperial Victory Crown Vector Icon */}
                <g transform="translate(0, -1) scale(1.1)">
                  {/* Drop Shadow */}
                  <path
                    d="M -11 -6 L -14 7 L 14 7 L 11 -6 L 5 -1 L 0 -9 L -5 -1 Z"
                    fill="#000000"
                    opacity="0.45"
                    transform="translate(0, 1.5)"
                  />
                  {/* 24K Sculpted Crown Icon Body */}
                  <path
                    d="M -11 -6 L -14 7 L 14 7 L 11 -6 L 5 -1 L 0 -9 L -5 -1 Z"
                    fill="url(#baroqueGoldGrad)"
                    stroke="#543b0d"
                    strokeWidth="0.9"
                    strokeLinejoin="round"
                  />
                  {/* Specular Edge Highlight */}
                  <path
                    d="M -10.5 -5 L -13 6 L 13 6 L 10.5 -5 L 5 0 L 0 -7.5 L -5 0 Z"
                    fill="none"
                    stroke="#fff8db"
                    strokeWidth="0.7"
                    opacity="0.9"
                  />
                  {/* Crown Base Band with Gem Insets */}
                  <rect x="-14" y="8" width="28" height="4.5" rx="1.5" fill="url(#baroqueGoldGrad)" stroke="#543b0d" strokeWidth="0.8" />
                  <circle cx="-8" cy="10.2" r="1.2" fill="#ff2e79" stroke="#fff8db" strokeWidth="0.3" />
                  <circle cx="0" cy="10.2" r="1.4" fill="#38bdf8" stroke="#fff8db" strokeWidth="0.3" />
                  <circle cx="8" cy="10.2" r="1.2" fill="#34d399" stroke="#fff8db" strokeWidth="0.3" />
                  {/* 5 Crown Peak Pearls */}
                  <circle cx="-11" cy="-6" r="1.4" fill="#ffffff" stroke="#543b0d" strokeWidth="0.4" />
                  <circle cx="-5" cy="-1" r="1.1" fill="#fff8db" stroke="#543b0d" strokeWidth="0.3" />
                  <circle cx="0" cy="-9" r="1.8" fill="#ffffff" stroke="#543b0d" strokeWidth="0.4" />
                  <circle cx="5" cy="-1" r="1.1" fill="#fff8db" stroke="#543b0d" strokeWidth="0.3" />
                  <circle cx="11" cy="-6" r="1.4" fill="#ffffff" stroke="#543b0d" strokeWidth="0.4" />
                </g>
              </g>

              {/* 5. 3D EMBOSSED LUXURY PAWNS WITH REALISTIC SHADOWS */}
              {renderedPawns.map(({ token, x, y, groundY, isLegal, isMyColor, color, isHopping, scale, isInGame }) => {
                const cfg = COLOR_CONFIG[color];

                return (
                  <g
                    key={`pawn-${color}-${token.id}`}
                    className={isLegal ? 'cursor-pointer' : ''}
                    style={{
                      opacity: isInGame ? 1 : 0.26,
                      filter: isInGame ? undefined : 'grayscale(60%)',
                      transition: 'opacity 0.4s ease, filter 0.4s ease'
                    }}
                    onClick={() => {
                      if (isLegal) {
                        if (autoMoveTimerRef.current) {
                          clearTimeout(autoMoveTimerRef.current);
                          autoMoveTimerRef.current = null;
                        }
                        hideCenterDice();
                        onMoveToken(token.id);
                      }
                    }}
                  >
                    {/* A. Ground Contact Shadow */}
                    <g
                      transform={`translate(${x}, ${groundY}) rotate(${-boardRotation})`}
                      style={{
                        transition: isHopping ? 'transform 0.25s ease-out' : 'transform 0.22s ease-in'
                      }}
                    >
                      <ellipse
                        cx={0}
                        cy={2 * scale}
                        rx={(isHopping ? 16 : 14) * scale}
                        ry={(isHopping ? 7.5 : 5.8) * scale}
                        fill="#000000"
                        opacity={isHopping ? 0.12 : (isInGame ? 0.40 : 0.08)}
                        filter="url(#castShadowBlur)"
                        style={{ transition: 'all 0.22s ease' }}
                      />
                      <ellipse
                        cx={0}
                        cy={2 * scale}
                        rx={11 * scale}
                        ry={4.5 * scale}
                        fill="#000000"
                        opacity={isHopping ? 0.18 : (isInGame ? 0.58 : 0.12)}
                        filter="url(#contactShadowBlur)"
                        style={{ transition: 'all 0.22s ease' }}
                      />
                    </g>

                    {/* B. Legal Move Ground Selection Halo */}
                    {isLegal && !isHopping && (
                      <g transform={`translate(${x}, ${groundY}) rotate(${-boardRotation})`}>
                        <ellipse
                          cx={0}
                          cy={2 * scale}
                          rx={16 * scale}
                          ry={7.2 * scale}
                          fill={cfg.fill}
                          opacity="0.35"
                        >
                          <animate attributeName="rx" values={`${14.5 * scale};${17.5 * scale};${14.5 * scale}`} dur="1.3s" repeatCount="indefinite" />
                          <animate attributeName="ry" values={`${6.5 * scale};${8.0 * scale};${6.5 * scale}`} dur="1.3s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.45;0.15;0.45" dur="1.3s" repeatCount="indefinite" />
                        </ellipse>

                        <ellipse
                          cx={0}
                          cy={2 * scale}
                          rx={15 * scale}
                          ry={6.8 * scale}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="2.0"
                          opacity="0.9"
                        >
                          <animate attributeName="opacity" values="1.0;0.4;1.0" dur="1.3s" repeatCount="indefinite" />
                          <animate attributeName="rx" values={`${13.5 * scale};${16 * scale};${13.5 * scale}`} dur="1.3s" repeatCount="indefinite" />
                          <animate attributeName="ry" values={`${6.0 * scale};${7.2 * scale};${6.0 * scale}`} dur="1.3s" repeatCount="indefinite" />
                        </ellipse>
                      </g>
                    )}

                    {/* C. 3D Luxury Figurine Pawn Body (3D standing posture, counter-rotated & hopped straight up into the air) */}
                    <g
                      transform={`translate(${x}, ${groundY}) rotate(${-boardRotation}) translate(0, ${isHopping ? -14 : 0}) scale(${scale})`}
                      style={{
                        transition: isHopping
                          ? 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)'
                          : 'transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1)'
                      }}
                    >
                      {isLegal && !isHopping ? (
                        <g>
                          <animateTransform
                            attributeName="transform"
                            type="translate"
                            values="0,0; 0,-3.5; 0,0"
                            dur="1.1s"
                            repeatCount="indefinite"
                          />
                          {renderLuxuryPawn(color, isLegal, isMyColor)}
                        </g>
                      ) : (
                        renderLuxuryPawn(color, isLegal, isMyColor)
                      )}
                    </g>
                  </g>
                );
              })}
              {/* 6. DEBUG GRID & PAWN ALIGNMENT CROSSHAIRS OVERLAY */}
              {showGridDebug && (
                <g id="ludoGridDebugOverlay" pointerEvents="none">
                  {/* 15x15 Board Grid Cell Boundaries */}
                  {Array.from({ length: 15 }).map((_, r) =>
                    Array.from({ length: 15 }).map((_, c) => (
                      <rect
                        key={`debug-cell-${r}-${c}`}
                        x={c * 40}
                        y={r * 40}
                        width={40}
                        height={40}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.15)"
                        strokeWidth="0.6"
                      />
                    ))
                  )}

                  {/* Track Tile Centers (Red Crosshairs + Index) */}
                  {RING_COORDS.map(([r, c], idx) => {
                    const cx = c * 40 + 20;
                    const cy = r * 40 + 20;
                    return (
                      <g key={`debug-track-${idx}`}>
                        <line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} stroke="#ef4444" strokeWidth="1.2" />
                        <line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} stroke="#ef4444" strokeWidth="1.2" />
                        <circle cx={cx} cy={cy} r="1.5" fill="#ffffff" />
                        <text x={cx} y={cy - 8} fontSize="6.5" fill="#fca5a5" textAnchor="middle" fontWeight="bold">
                          {idx}
                        </text>
                      </g>
                    );
                  })}

                  {/* Runway Tile Centers (Magenta Crosshairs) */}
                  {(['red', 'blue', 'yellow', 'green'] as LudoColor[]).flatMap((col) =>
                    HOME_PATHS[col].map(([r, c], idx) => {
                      const cx = c * 40 + 20;
                      const cy = r * 40 + 20;
                      return (
                        <g key={`debug-runway-${col}-${idx}`}>
                          <line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} stroke="#ec4899" strokeWidth="1.2" />
                          <line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} stroke="#ec4899" strokeWidth="1.2" />
                          <circle cx={cx} cy={cy} r="1.5" fill="#ffffff" />
                        </g>
                      );
                    })
                  )}

                  {/* Yard Socket Centers (Cyan Crosshairs) */}
                  {(['red', 'blue', 'green', 'yellow'] as LudoColor[]).flatMap((col) =>
                    YARD_SOCKET_CENTERS[col].map((s, idx) => (
                      <g key={`debug-yard-${col}-${idx}`}>
                        <line x1={s.x - 8} y1={s.y} x2={s.x + 8} y2={s.y} stroke="#06b6d4" strokeWidth="1.2" />
                        <line x1={s.x} y1={s.y - 8} x2={s.x + 8} y2={s.y + 8} stroke="#06b6d4" strokeWidth="1.2" />
                        <circle cx={s.x} cy={s.y} r="2" fill="#ffffff" />
                      </g>
                    ))
                  )}

                  {/* Finish Sanctuary Slots (Emerald Crosshairs) */}
                  {(['red', 'blue', 'green', 'yellow'] as LudoColor[]).flatMap((col) =>
                    FINISH_SLOTS[col].map((s, idx) => (
                      <g key={`debug-finish-${col}-${idx}`}>
                        <line x1={s.x - 5} y1={s.y} x2={s.x + 5} y2={s.y} stroke="#10b981" strokeWidth="1.2" />
                        <line x1={s.x} y1={s.y - 5} x2={s.x + 5} y2={s.y + 5} stroke="#10b981" strokeWidth="1.2" />
                        <circle cx={s.x} cy={s.y} r="1.5" fill="#ffffff" />
                      </g>
                    ))
                  )}

                  {/* Active Pawn Footprint Contact Points (Bright Golden Crosshairs) */}
                  {renderedPawns.map((p, idx) => (
                    <g key={`debug-pawn-pos-${idx}`}>
                      <circle cx={p.x} cy={p.groundY} r="3" fill="none" stroke="#facc15" strokeWidth="1.2" />
                      <line x1={p.x - 6} y1={p.groundY} x2={p.x + 6} y2={p.groundY} stroke="#facc15" strokeWidth="1.2" />
                      <line x1={p.x} y1={p.groundY - 6} x2={p.x} y2={p.groundY + 6} stroke="#facc15" strokeWidth="1.2" />
                    </g>
                  ))}
                </g>
              )}
              </g>
            </svg>

            {/* 4 Corner Player Pods dynamically placed according to board perspective rotation */}
            {(['red', 'blue', 'yellow', 'green'] as LudoColor[]).map((col) => {
              const corner = getPhysicalCorner(col);
              return (
                <div key={`corner-${col}`} className={corner.className}>
                  {renderCornerBadge(col, corner.side)}
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM CONTROLS MATCHING REFERENCE IMAGE (Undo button, Large Glowing Red Dice, Emoji button) */}
        <div className="w-full flex flex-col items-center mt-4 sm:mt-5 max-w-xs sm:max-w-sm px-2 z-20">
          <div className="text-rose-200/90 font-sans font-bold text-xs sm:text-sm tracking-wider uppercase mb-2 text-center select-none drop-shadow-[0_0_8px_rgba(255,46,121,0.5)]">
            {gameState.winnerColor ? (
              <span className="inline-flex items-center justify-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                <span>{gameState.winnerColor.toUpperCase()} Won the Match!</span>
              </span>
            ) : turnPlayer && !turnPlayer.isConnected ? (
              `${turnPlayer.displayName} has left • tap to nudge`
            ) : isMyTurn ? (
              "it's your turn"
            ) : (
              `it's ${turnPlayer?.displayName?.toLowerCase() || 'partner'}'s turn`
            )}
          </div>

          {/* 3-Control Bottom Panel from reference UI */}
          <div className="w-full flex items-center justify-center gap-6 sm:gap-8">
            {/* 1. Left: Circular UNDO / Replay Button */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (gameState.winnerColor && onRematch) {
                    onRematch();
                  } else {
                    playSound('step');
                  }
                }}
                className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-[#121422]/90 backdrop-blur-md border border-white/20 shadow-[0_4px_15px_rgba(0,0,0,0.5)] flex items-center justify-center text-white/80 hover:text-white hover:border-white/40 active:scale-95 transition cursor-pointer"
                title={gameState.winnerColor ? 'Rematch' : 'Undo'}
              >
                {gameState.winnerColor ? (
                  <RefreshCw className="w-5 h-5 text-amber-400" />
                ) : (
                  <RotateCcw className="w-5 h-5 text-white/90" />
                )}
              </button>
              <span className="text-[10px] font-bold text-white/60 tracking-widest uppercase">
                {gameState.winnerColor ? 'REMATCH' : 'UNDO'}
              </span>
            </div>

            {/* 2. Center: Large Circular Glowing Button with 3D Red Cube Dice */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (gameState.winnerColor && onRematch) {
                    onRematch();
                  } else if (canRoll) {
                    onRollDice();
                  } else if (canMove) {
                    // choosing goti
                  } else {
                    // Friendly nudge (notifies only recipient)
                    onNudgePlayer?.(turnPlayer?.userId, turnPlayer?.displayName);
                    setJustNudged(true);
                    setTimeout(() => setJustNudged(false), 2500);
                  }
                }}
                className={`w-18 h-18 sm:w-22 sm:h-22 rounded-full flex flex-col items-center justify-center transition-all duration-200 select-none cursor-pointer active:scale-95 ${
                  canRoll
                    ? 'bg-gradient-to-br from-[#ff2e79] via-[#e11d48] to-[#9f1239] shadow-[0_0_35px_rgba(255,46,121,0.85),0_10px_25px_rgba(0,0,0,0.6)] border-2 border-rose-300/60 animate-pulse'
                    : canMove
                    ? 'bg-gradient-to-br from-[#ff2e79] via-[#e11d48] to-[#9f1239] shadow-[0_0_25px_rgba(255,46,121,0.6),0_10px_25px_rgba(0,0,0,0.6)] border-2 border-rose-300/40'
                    : gameState.winnerColor
                    ? 'bg-gradient-to-br from-[#f59e0b] via-[#d97706] to-[#b45309] shadow-[0_0_25px_rgba(245,158,11,0.7)] border-2 border-amber-300/60 animate-bounce'
                    : justNudged
                    ? 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 shadow-[0_0_25px_rgba(16,185,129,0.7)] border-2 border-emerald-300/60'
                    : 'bg-gradient-to-br from-[#e11d48]/70 via-[#9f1239]/70 to-[#50071c]/80 shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-white/20 hover:brightness-110'
                }`}
              >
                {/* 3D Glossy Red Cube with White Pips */}
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#ff4777] to-[#be123c] border border-white/40 shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_4px_10px_rgba(0,0,0,0.4)] flex items-center justify-center transform-gpu">
                  {renderDiceFace(gameState.diceValue || 6, 'sm')}
                </div>
              </button>

              {/* Bold Glowing Label */}
              <span className={`text-[11px] sm:text-xs font-black tracking-widest uppercase drop-shadow-[0_0_8px_rgba(255,46,121,0.7)] ${
                canRoll
                  ? 'text-rose-300 animate-pulse'
                  : canMove
                  ? 'text-amber-300'
                  : justNudged
                  ? 'text-emerald-300 animate-pulse'
                  : 'text-white/80'
              }`}>
                {gameState.winnerColor
                  ? 'REMATCH'
                  : canRoll
                  ? 'ROLL THE DICE'
                  : canMove
                  ? 'CHOOSE GOTI'
                  : isMyTurn
                  ? 'YOUR TURN'
                  : justNudged ? (
                    <span className="inline-flex items-center gap-1">
                      <span>NUDGED!</span>
                      <Bell className="w-3 h-3 text-emerald-300" />
                    </span>
                  ) : 'NUDGE'}
              </span>
            </div>

            {/* 3. Right: Circular EMOJI Button */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onSendReaction?.('❤️');
                  playSound('step');
                }}
                className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-[#121422]/90 backdrop-blur-md border border-white/20 shadow-[0_4px_15px_rgba(0,0,0,0.5)] flex items-center justify-center text-white/80 hover:text-white hover:border-white/40 active:scale-95 transition cursor-pointer"
                title="Send Emoji / Reaction"
              >
                <Smile className="w-5 h-5 text-white/90" />
              </button>
              <span className="text-[10px] font-bold text-white/60 tracking-widest uppercase">
                EMOJI
              </span>
            </div>
          </div>
        </div>
      </div>
  );
};
