'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  MoreHorizontal
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

// Fixed pawn slots inside the 4 yards
const YARD_PAWN_SLOTS: Record<LudoColor, Array<[number, number]>> = {
  red:    [[1.8, 1.8], [1.8, 4.2], [4.2, 1.8], [4.2, 4.2]], // Top-Left
  blue:   [[1.8, 10.8], [1.8, 13.2], [4.2, 10.8], [4.2, 13.2]], // Top-Right
  green:  [[10.8, 1.8], [10.8, 4.2], [13.2, 1.8], [13.2, 4.2]], // Bottom-Left
  yellow: [[10.8, 10.8], [10.8, 13.2], [13.2, 10.8], [13.2, 13.2]] // Bottom-Right
};

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

  const turnPlayer = playerByColor[gameState.currentTurnColor];

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

  useEffect(() => {
    if (gameState.diceValue !== null && gameState.diceValue !== prevDiceValueRef.current) {
      prevDiceValueRef.current = gameState.diceValue;
      const finalVal = gameState.diceValue;
      const turnColor = gameState.currentTurnColor;

      playSound('roll');
      setCenterDiceAnimation({
        phase: 'rolling',
        displayValue: Math.floor(Math.random() * 6) + 1,
        finalValue: finalVal,
        color: turnColor
      });

      const cycleInterval = setInterval(() => {
        setCenterDiceAnimation(prev =>
          prev && prev.phase === 'rolling'
            ? { ...prev, displayValue: Math.floor(Math.random() * 6) + 1 }
            : prev
        );
      }, 70);

      const settleTimeout = setTimeout(() => {
        clearInterval(cycleInterval);
        playSound('step');
        setCenterDiceAnimation({
          phase: 'settled',
          displayValue: finalVal,
          finalValue: finalVal,
          color: turnColor
        });
      }, 600);

      const vanishTimeout = setTimeout(() => {
        setCenterDiceAnimation(prev => (prev ? { ...prev, phase: 'vanishing' } : null));
      }, 1450);

      const finishTimeout = setTimeout(() => {
        setCenterDiceAnimation(null);
      }, 1800);

      return () => {
        clearInterval(cycleInterval);
        clearTimeout(settleTimeout);
        clearTimeout(vanishTimeout);
        clearTimeout(finishTimeout);
      };
    } else if (gameState.diceValue === null) {
      prevDiceValueRef.current = null;
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

  const prevTokensRef = useRef<Record<LudoColor, LudoToken[]> | null>(null);

  const getCellPixelCenter = (row: number, col: number): [number, number] => {
    const tileSize = 600 / 15; // 40px
    return [col * tileSize + tileSize / 2, row * tileSize + tileSize / 2];
  };

  const getStepCoordinates = (color: LudoColor, step: number, tokenId: number): [number, number] => {
    if (step === -1) {
      const slot = YARD_PAWN_SLOTS[color][tokenId] || [2, 2];
      return [slot[1] * 40, slot[0] * 40];
    }
    if (step >= 0 && step <= 50) {
      const ringPos = (COLOR_START_TILES[color] + step) % 52;
      const coord = RING_COORDS[ringPos];
      if (coord) {
        return getCellPixelCenter(coord[0], coord[1]);
      }
    }
    if (step >= 51 && step <= 55) {
      const homeIndex = step - 51;
      const coord = HOME_PATHS[color][homeIndex];
      if (coord) {
        return getCellPixelCenter(coord[0], coord[1]);
      }
    }
    if (step === 56) {
      const centerOffsets: Record<LudoColor, [number, number]> = {
        red: [265, 300],
        blue: [300, 265],
        yellow: [335, 300],
        green: [300, 335]
      };
      const offset = centerOffsets[color];
      return [offset[0] + (tokenId % 2 === 0 ? -6 : 6), offset[1] + (tokenId < 2 ? -6 : 6)];
    }
    return [300, 300];
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

    const { color, tokenId, fromStep, toStep } = movedPawnInfo;

    // Case 1: Spawning from yard to start
    if (fromStep === -1 && toStep === 0) {
      playSound('step');
      setAnimatingPawn({ color, tokenId, currentStep: 0, isHopArc: true });
      setTimeout(() => {
        playSound('move');
        setAnimatingPawn({ color, tokenId, currentStep: 0, isHopArc: false });
        setTimeout(() => setAnimatingPawn(null), 250);
      }, 200);
      return;
    }

    // Case 2: Advance on track step by step with clear pause on each box
    if (toStep > fromStep) {
      const hopSequence: number[] = [];
      for (let s = fromStep + 1; s <= toStep; s++) {
        hopSequence.push(s);
      }

      let hopIndex = 0;

      const runHop = () => {
        if (hopIndex >= hopSequence.length) {
          playSound('move');
          setTimeout(() => setAnimatingPawn(null), 250);
          return;
        }

        const nextStep = hopSequence[hopIndex];
        const isFinalStep = hopIndex === hopSequence.length - 1;

        // Step A: Arc hop into the next box (150ms airborne arc)
        setAnimatingPawn({
          color,
          tokenId,
          currentStep: nextStep,
          isHopArc: true
        });

        setTimeout(() => {
          // Step B: Land firmly on the box, snap contact shadow, play tap sound
          playSound('step');
          setAnimatingPawn({
            color,
            tokenId,
            currentStep: nextStep,
            isHopArc: false
          });

          // Step C: STOP & PAUSE on this box for 220ms (or 320ms if final destination)
          hopIndex++;
          const pauseTime = isFinalStep ? 320 : 220;
          setTimeout(runHop, pauseTime);
        }, 150);
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
          isHopping: isThisTokenAnimating && Boolean(animatingPawn?.isHopArc)
        });
      });
    }

    // Group track pawns by tile location
    const tileGroups = new Map<string, typeof rawList>();

    rawList.forEach((item) => {
      let key = '';
      if (item.step === -1) {
        key = `yard_${item.color}_${item.token.id}`;
      } else if (item.step >= 0 && item.step <= 50) {
        key = `track_${(COLOR_START_TILES[item.color] + item.step) % 52}`;
      } else if (item.step >= 51 && item.step <= 55) {
        key = `home_${item.color}_${item.step}`;
      } else {
        key = `finish_${item.color}`;
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
      color: LudoColor;
      isHopping: boolean;
      scale: number;
    }> = [];

    tileGroups.forEach((group) => {
      const count = group.length;
      group.forEach((item, indexInGroup) => {
        const [baseX, baseY] = getStepCoordinates(item.color, item.step, item.token.id);

        let offsetX = 0;
        let offsetY = 0;
        let scale = 1;

        if (count > 1 && item.step >= 0) {
          scale = count > 2 ? 0.78 : 0.85;
          if (count === 2) {
            offsetX = indexInGroup === 0 ? -6 : 6;
            offsetY = 0;
          } else if (count === 3) {
            if (indexInGroup === 0) { offsetX = -6; offsetY = -3; }
            else if (indexInGroup === 1) { offsetX = 6; offsetY = -3; }
            else { offsetX = 0; offsetY = 3; }
          } else {
            offsetX = indexInGroup % 2 === 0 ? -5.5 : 5.5;
            offsetY = indexInGroup < 2 ? -3.5 : 3.5;
          }
        }

        const finalX = baseX + offsetX;
        const groundY = baseY + offsetY;
        const finalY = (item.isHopping ? baseY - 16 : baseY) + offsetY;

        pawns.push({
          token: item.token,
          x: finalX,
          y: finalY,
          groundY,
          isLegal: item.isLegal,
          color: item.color,
          isHopping: item.isHopping,
          scale
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

  // Render sculpted 3D luxury pawn figurine matching the reference image
  const renderLuxuryPawn = (color: LudoColor, isLegal: boolean) => {
    const headGradient = `url(#${color}PawnHead)`;
    const bodyGradient = `url(#${color}PawnBody)`;
    const collarGradient = `url(#${color}PawnCollar)`;

    return (
      <g>
        {/* Tiered circular base pedestal with ambient occlusion shadow */}
        <ellipse cx="0" cy="3.5" rx="11" ry="4.2" fill="#000000" opacity="0.35" />
        {/* Base bottom ring */}
        <ellipse cx="0" cy="2.8" rx="10.8" ry="4" fill={bodyGradient} />
        {/* Base upper step */}
        <ellipse cx="0" cy="1.6" rx="9.2" ry="3.2" fill={headGradient} />
        <ellipse cx="-1.5" cy="1.2" rx="7" ry="1.8" fill="#ffffff" opacity="0.3" />

        {/* Flared bell-shaped body with smooth sculpted waist */}
        <path
          d="M -7.8 1.8 C -6.8 -5, -4 -9, -3.2 -12.5 C -3.2 -13.5, 3.2 -13.5, 3.2 -12.5 C 4 -9, 6.8 -5, 7.8 1.8 Z"
          fill={bodyGradient}
        />
        {/* Specular vertical reflection highlight along left curve of body */}
        <path
          d="M -5.5 1 C -4.8 -4, -3 -8, -2.2 -12 C -1.5 -12, -2.5 -4, -3.8 1 Z"
          fill="#ffffff"
          opacity="0.35"
        />

        {/* Collar metallic/beveled ring between waist and neck */}
        <ellipse cx="0" cy="-13.2" rx="4.5" ry="1.6" fill={collarGradient} stroke="#ffffff" strokeWidth="0.4" strokeOpacity="0.6" />

        {/* Slender neck column */}
        <path d="M -2.6 -13.2 C -2.6 -15, 2.6 -15, 2.6 -13.2 Z" fill={bodyGradient} />

        {/* Neck collar bead */}
        <ellipse cx="0" cy="-15.5" rx="3.8" ry="1.4" fill={headGradient} stroke="#ffffff" strokeWidth="0.3" strokeOpacity="0.5" />

        {/* Spherical head knob */}
        <circle
          cx="0"
          cy="-21.5"
          r="6.8"
          fill={headGradient}
          stroke={isLegal ? '#ffffff' : 'rgba(255,255,255,0.4)'}
          strokeWidth={isLegal ? '1.8' : '0.6'}
        />

        {/* Head specular glint (bright glass reflection dot + curved glint) */}
        <ellipse cx="-2.2" cy="-23.8" rx="2.4" ry="1.3" transform="rotate(-25 -2.2 -23.8)" fill="#ffffff" opacity="0.85" />
        <circle cx="2.6" cy="-19.2" r="0.8" fill="#ffffff" opacity="0.4" />
      </g>
    );
  };

  // Render Floating Dark Glass Player Pod matching the reference UI
  const renderCornerBadge = (color: LudoColor, side: 'left' | 'right') => {
    const p = playerByColor[color];
    const isCurrentTurn = gameState.currentTurnColor === color;
    const cfg = COLOR_CONFIG[color];
    const isMe = p?.userId === myPlayer?.userId;
    const isHost = p?.seat === 0;

    if (!p) return null;

    const pStream = participantStreamsByUserId[p.userId];
    
    // For local player (isMe), prioritize localUserStream and isCameraOn directly
    const activeStream = isMe ? (localUserStream || pStream?.stream) : pStream?.stream;
    const activeCameraOn = isMe ? isCameraOn : Boolean(pStream?.isCameraOn);
    const hasLiveVideo = Boolean(
      activeCameraOn &&
      activeStream &&
      activeStream.getVideoTracks().length > 0 &&
      activeStream.getVideoTracks().some(t => t.enabled && t.readyState !== 'ended')
    );

    const isPlayerMuted = isMe ? isMicMuted : (pStream?.isMuted ?? true);

    return (
      <div className={`relative flex items-center ${side === 'right' ? 'flex-row-reverse' : 'flex-row'} z-30 select-none group`}>
        {/* Remote audio receiver so we hear opponent speaking */}
        {!isMe && pStream?.stream && (
          <RemoteAudioPlayer stream={pStream.stream} />
        )}

        {/* Floating Dark Glass Capsule matching reference UI */}
        <div
          className={`relative z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0a0c16]/85 backdrop-blur-xl border transition-all duration-300 shadow-[0_8px_25px_rgba(0,0,0,0.65)] ${
            isCurrentTurn
              ? 'ring-2 border-white/40 scale-105'
              : 'border-white/15 hover:border-white/25'
          }`}
          style={{
            boxShadow: isCurrentTurn ? `0 0 20px ${cfg.glow}, 0 8px 25px rgba(0,0,0,0.7)` : undefined,
            borderColor: isCurrentTurn ? cfg.neon : undefined
          }}
        >
          {/* Avatar container with Neon Ring */}
          <div className="relative shrink-0">
            {/* Crown for Host ("You") */}
            {isHost && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                <Crown className="w-4 h-4 text-amber-300 fill-amber-400 animate-pulse" />
              </div>
            )}

            {/* Glowing Neon Avatar Ring */}
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full p-0.5 border flex items-center justify-center transition-all ${
                (isMe ? !isMicMuted : pStream?.isSpeaking)
                  ? 'ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.9)]'
                  : ''
              }`}
              style={{
                borderColor: cfg.neon,
                boxShadow: `0 0 12px ${cfg.glow}`,
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
          <div className="flex flex-col min-w-0 pr-0.5">
            <span className="font-bold text-white text-xs sm:text-sm tracking-wide truncate max-w-[80px] sm:max-w-[95px] drop-shadow-sm">
              {isMe ? 'You' : p.displayName}
            </span>
            {isCurrentTurn && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300/90 leading-none">
                Turn
              </span>
            )}
          </div>

          {/* Heart Icon with Neon Glow */}
          <Heart
            className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110"
            style={{
              color: cfg.neon,
              fill: isCurrentTurn ? cfg.neon : `${cfg.neon}40`,
              filter: `drop-shadow(0 0 4px ${cfg.glow})`
            }}
          />

          {/* Three Dots Menu Icon */}
          <button
            type="button"
            className="text-white/40 hover:text-white/80 transition p-0.5 cursor-pointer shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              if (!isMe) {
                onNudgePlayer?.(p.userId, p.displayName);
                playSound('nudge');
              }
            }}
            title={!isMe ? `Nudge ${p.displayName}` : undefined}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-between w-full max-w-4xl mx-auto select-none relative">
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

      {/* Board & Player Ribbons Container */}
      <div className="relative w-full max-w-[380px] sm:max-w-[450px] flex flex-col items-center select-none my-8 sm:my-10">

        {/* Center: Cozy Birchwood Board Block */}
        <div className="relative w-full aspect-square rounded-[38px] p-2.5 sm:p-3.5 bg-gradient-to-br from-[#f2e5d5] via-[#e6d6c1] to-[#cca985] border-[4px] border-[#faf3ea] shadow-[0_20px_45px_rgba(70,45,25,0.2),0_8px_18px_rgba(0,0,0,0.12),inset_0_2px_4px_rgba(255,255,255,0.9)] flex items-center justify-center transition-all duration-300">
          {/* 3D Rolling Center Dice */}
          {centerDiceAnimation && (
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
            viewBox="0 0 600 600"
            className="w-full h-full rounded-[28px] overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.6),inset_0_2px_4px_rgba(255,255,255,0.2)] border border-[#4a2e1b]"
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
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.4" />
                </filter>
                <filter id="tile3DShadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="1" stdDeviation="0.6" floodColor="#8c7a65" floodOpacity="0.15" />
                </filter>
                <filter id="trayInnerShadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.45" />
                </filter>
                <filter id="cottageShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.5" />
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

                {/* Metallic Gold & Bevel Gradients */}
                <linearGradient id="goldMetallicGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="35%" stopColor="#f59e0b" />
                  <stop offset="70%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#92400e" />
                </linearGradient>

                {/* Yard Glass Background Gradients */}
                <linearGradient id="rubyYardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b0714" />
                  <stop offset="50%" stopColor="#750d28" />
                  <stop offset="100%" stopColor="#9f1239" />
                </linearGradient>
                <linearGradient id="sapphireYardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#081838" />
                  <stop offset="50%" stopColor="#17357c" />
                  <stop offset="100%" stopColor="#1e40af" />
                </linearGradient>
                <linearGradient id="emeraldYardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#02241a" />
                  <stop offset="50%" stopColor="#054b38" />
                  <stop offset="100%" stopColor="#065f46" />
                </linearGradient>
                <linearGradient id="amberYardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#381403" />
                  <stop offset="50%" stopColor="#692d07" />
                  <stop offset="100%" stopColor="#92400e" />
                </linearGradient>

                {/* Metallic Yard Bevel Gradients */}
                <linearGradient id="rubyBevelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fecdd3" />
                  <stop offset="45%" stopColor="#e11d48" />
                  <stop offset="75%" stopColor="#881337" />
                  <stop offset="100%" stopColor="#fda4af" />
                </linearGradient>
                <linearGradient id="sapphireBevelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#dbeafe" />
                  <stop offset="45%" stopColor="#3b82f6" />
                  <stop offset="75%" stopColor="#1e3a8a" />
                  <stop offset="100%" stopColor="#93c5fd" />
                </linearGradient>
                <linearGradient id="emeraldBevelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d1fae5" />
                  <stop offset="45%" stopColor="#10b981" />
                  <stop offset="75%" stopColor="#064e3b" />
                  <stop offset="100%" stopColor="#6ee7b7" />
                </linearGradient>
                <linearGradient id="amberBevelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fef3c7" />
                  <stop offset="45%" stopColor="#f59e0b" />
                  <stop offset="75%" stopColor="#78350f" />
                  <stop offset="100%" stopColor="#fde047" />
                </linearGradient>

                {/* 3D Radial Gradients for Luxury Pawn Heads */}
                <radialGradient id="redPawnHead" cx="35%" cy="25%" r="70%">
                  <stop offset="0%" stopColor="#ffe4e6" />
                  <stop offset="25%" stopColor="#fb7185" />
                  <stop offset="65%" stopColor="#e11d48" />
                  <stop offset="100%" stopColor="#881337" />
                </radialGradient>
                <radialGradient id="bluePawnHead" cx="35%" cy="25%" r="70%">
                  <stop offset="0%" stopColor="#dbeafe" />
                  <stop offset="25%" stopColor="#60a5fa" />
                  <stop offset="65%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#1e3a8a" />
                </radialGradient>
                <radialGradient id="yellowPawnHead" cx="35%" cy="25%" r="70%">
                  <stop offset="0%" stopColor="#fef3c7" />
                  <stop offset="25%" stopColor="#fde047" />
                  <stop offset="65%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#78350f" />
                </radialGradient>
                <radialGradient id="greenPawnHead" cx="35%" cy="25%" r="70%">
                  <stop offset="0%" stopColor="#d1fae5" />
                  <stop offset="25%" stopColor="#4ade80" />
                  <stop offset="65%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#064e3b" />
                </radialGradient>

                {/* 3D Linear Gradients for Luxury Pawn Bodies */}
                <linearGradient id="redPawnBody" x1="15%" y1="0%" x2="85%" y2="100%">
                  <stop offset="0%" stopColor="#fda4af" />
                  <stop offset="30%" stopColor="#f43f5e" />
                  <stop offset="75%" stopColor="#be123c" />
                  <stop offset="100%" stopColor="#4c0519" />
                </linearGradient>
                <linearGradient id="bluePawnBody" x1="15%" y1="0%" x2="85%" y2="100%">
                  <stop offset="0%" stopColor="#93c5fd" />
                  <stop offset="30%" stopColor="#3b82f6" />
                  <stop offset="75%" stopColor="#1d4ed8" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
                <linearGradient id="yellowPawnBody" x1="15%" y1="0%" x2="85%" y2="100%">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="30%" stopColor="#f59e0b" />
                  <stop offset="75%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#78350f" />
                </linearGradient>
                <linearGradient id="greenPawnBody" x1="15%" y1="0%" x2="85%" y2="100%">
                  <stop offset="0%" stopColor="#86efac" />
                  <stop offset="30%" stopColor="#22c55e" />
                  <stop offset="75%" stopColor="#15803d" />
                  <stop offset="100%" stopColor="#052e16" />
                </linearGradient>

                {/* Metallic Pawn Collars */}
                <linearGradient id="redPawnCollar" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#fecdd3" />
                  <stop offset="100%" stopColor="#be123c" />
                </linearGradient>
                <linearGradient id="bluePawnCollar" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#bfdbfe" />
                  <stop offset="100%" stopColor="#1e40af" />
                </linearGradient>
                <linearGradient id="yellowPawnCollar" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#fde68a" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
                <linearGradient id="greenPawnCollar" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#bbf7d0" />
                  <stop offset="100%" stopColor="#15803d" />
                </linearGradient>
              </defs>

              {/* Board Base Surface (Porcelain Ivory with Metallic Grout) */}
              <rect width="600" height="600" fill="#140d09" />
              <rect x="5" y="5" width="590" height="590" rx="22" fill="#faf6ee" stroke="#d5c3ab" strokeWidth="1.5" />

              {/* 1. YARDS (4 Luxury Glass Quadrants with Glowing Neon Hearts) */}
              {/* Red Yard (Top-Left) */}
              <g>
                <rect x="15" y="15" width="210" height="210" rx="30" fill="url(#rubyYardGrad)" stroke="url(#rubyBevelGrad)" strokeWidth="3" filter="url(#trayInnerShadow)" />
                {/* Glowing Neon Red/Pink Heart */}
                <g transform="translate(120, 120) scale(1.35)">
                  <path
                    d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                    fill="rgba(255, 46, 121, 0.12)"
                    stroke="#ff2e79"
                    strokeWidth="3.2"
                    filter="url(#neonGlowPink)"
                  />
                  <path
                    d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1"
                    opacity="0.85"
                  />
                </g>
                {/* 4 Circular Socket Pads */}
                {YARD_PAWN_SLOTS.red.map((slot, i) => (
                  <g key={`ry-${i}`}>
                    <circle
                      cx={slot[1] * 40}
                      cy={slot[0] * 40}
                      r="22"
                      fill="#4a0818"
                      stroke="url(#rubyBevelGrad)"
                      strokeWidth="1.6"
                      filter="url(#recessedSaucerShadow)"
                    />
                    <circle
                      cx={slot[1] * 40}
                      cy={slot[0] * 40}
                      r="14"
                      fill="#6b0e24"
                      opacity="0.9"
                    />
                  </g>
                ))}
              </g>

              {/* Blue Yard (Top-Right) */}
              <g>
                <rect x="375" y="15" width="210" height="210" rx="30" fill="url(#sapphireYardGrad)" stroke="url(#sapphireBevelGrad)" strokeWidth="3" filter="url(#trayInnerShadow)" />
                {/* Glowing Neon Blue Heart */}
                <g transform="translate(480, 120) scale(1.35)">
                  <path
                    d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                    fill="rgba(56, 189, 248, 0.12)"
                    stroke="#38bdf8"
                    strokeWidth="3.2"
                    filter="url(#neonGlowBlue)"
                  />
                  <path
                    d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1"
                    opacity="0.85"
                  />
                </g>
                {/* 4 Circular Socket Pads */}
                {YARD_PAWN_SLOTS.blue.map((slot, i) => (
                  <g key={`by-${i}`}>
                    <circle
                      cx={slot[1] * 40}
                      cy={slot[0] * 40}
                      r="22"
                      fill="#0f2354"
                      stroke="url(#sapphireBevelGrad)"
                      strokeWidth="1.6"
                      filter="url(#recessedSaucerShadow)"
                    />
                    <circle
                      cx={slot[1] * 40}
                      cy={slot[0] * 40}
                      r="14"
                      fill="#1b3984"
                      opacity="0.9"
                    />
                  </g>
                ))}
              </g>

              {/* Green Yard (Bottom-Left) */}
              <g>
                <rect x="15" y="375" width="210" height="210" rx="30" fill="url(#emeraldYardGrad)" stroke="url(#emeraldBevelGrad)" strokeWidth="3" filter="url(#trayInnerShadow)" />
                {/* Glowing Neon Green Heart */}
                <g transform="translate(120, 480) scale(1.35)">
                  <path
                    d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                    fill="rgba(52, 211, 153, 0.12)"
                    stroke="#34d399"
                    strokeWidth="3.2"
                    filter="url(#neonGlowGreen)"
                  />
                  <path
                    d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1"
                    opacity="0.85"
                  />
                </g>
                {/* 4 Circular Socket Pads */}
                {YARD_PAWN_SLOTS.green.map((slot, i) => (
                  <g key={`gy-${i}`}>
                    <circle
                      cx={slot[1] * 40}
                      cy={slot[0] * 40}
                      r="22"
                      fill="#032e1f"
                      stroke="url(#emeraldBevelGrad)"
                      strokeWidth="1.6"
                      filter="url(#recessedSaucerShadow)"
                    />
                    <circle
                      cx={slot[1] * 40}
                      cy={slot[0] * 40}
                      r="14"
                      fill="#064e3b"
                      opacity="0.9"
                    />
                  </g>
                ))}
              </g>

              {/* Yellow Yard (Bottom-Right) */}
              <g>
                <rect x="375" y="375" width="210" height="210" rx="30" fill="url(#amberYardGrad)" stroke="url(#amberBevelGrad)" strokeWidth="3" filter="url(#trayInnerShadow)" />
                {/* Glowing Neon Gold Heart */}
                <g transform="translate(480, 480) scale(1.35)">
                  <path
                    d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                    fill="rgba(251, 191, 36, 0.12)"
                    stroke="#fbbf24"
                    strokeWidth="3.2"
                    filter="url(#neonGlowGold)"
                  />
                  <path
                    d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1"
                    opacity="0.85"
                  />
                </g>
                {/* 4 Circular Socket Pads */}
                {YARD_PAWN_SLOTS.yellow.map((slot, i) => (
                  <g key={`yy-${i}`}>
                    <circle
                      cx={slot[1] * 40}
                      cy={slot[0] * 40}
                      r="22"
                      fill="#4d2204"
                      stroke="url(#amberBevelGrad)"
                      strokeWidth="1.6"
                      filter="url(#recessedSaucerShadow)"
                    />
                    <circle
                      cx={slot[1] * 40}
                      cy={slot[0] * 40}
                      r="14"
                      fill="#713206"
                      opacity="0.9"
                    />
                  </g>
                ))}
              </g>

              {/* 2. TRACK CELLS (52 Ivory Porcelain Tiles with Elegant Metallic Star Coins) */}
              {RING_COORDS.map(([r, c], idx) => {
                const isSafe = SAFE_STAR_TILES.has(idx);
                const isRedStart = idx === 0;
                const isBlueStart = idx === 13;
                const isYellowStart = idx === 26;
                const isGreenStart = idx === 39;

                let fill = '#fbf8f2';
                let stroke = '#e8dfce';

                if (isRedStart) { fill = '#ffe4e6'; stroke = '#f43f5e'; }
                else if (isBlueStart) { fill = '#dbeafe'; stroke = '#3b82f6'; }
                else if (isYellowStart) { fill = '#fef3c7'; stroke = '#f59e0b'; }
                else if (isGreenStart) { fill = '#d1fae5'; stroke = '#10b981'; }

                return (
                  <g key={`track-${idx}`} filter="url(#tile3DShadow)">
                    <rect
                      x={c * 40 + 1}
                      y={r * 40 + 1}
                      width="38"
                      height="38"
                      fill={fill}
                      stroke={stroke}
                      strokeWidth="1.2"
                      rx="6"
                    />

                    {/* Elegant Safe Star Emblem */}
                    {isSafe && (
                      <g>
                        <circle
                          cx={c * 40 + 20}
                          cy={r * 40 + 20}
                          r="13"
                          fill="#f3ebe0"
                          stroke="#ded1be"
                          strokeWidth="1.2"
                        />
                        <text
                          x={c * 40 + 20}
                          y={r * 40 + 25}
                          textAnchor="middle"
                          fill="#c29d5b"
                          fontSize="15"
                          fontWeight="bold"
                        >
                          ★
                        </text>
                      </g>
                    )}

                    {/* Directional Entry Coins into Home Runways */}
                    {idx === 50 && (
                      <g>
                        <circle cx={c * 40 + 20} cy={r * 40 + 20} r="13" fill="#fda4af" stroke="#e11d48" strokeWidth="1.5" />
                        <text x={c * 40 + 20} y={r * 40 + 25} textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="900">
                          →
                        </text>
                      </g>
                    )}
                    {idx === 11 && (
                      <g>
                        <circle cx={c * 40 + 20} cy={r * 40 + 20} r="13" fill="#93c5fd" stroke="#2563eb" strokeWidth="1.5" />
                        <text x={c * 40 + 20} y={r * 40 + 25} textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="900">
                          ↓
                        </text>
                      </g>
                    )}
                    {idx === 24 && (
                      <g>
                        <circle cx={c * 40 + 20} cy={r * 40 + 20} r="13" fill="#fde047" stroke="#d97706" strokeWidth="1.5" />
                        <text x={c * 40 + 20} y={r * 40 + 25} textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="900">
                          ←
                        </text>
                      </g>
                    )}
                    {idx === 37 && (
                      <g>
                        <circle cx={c * 40 + 20} cy={r * 40 + 20} r="13" fill="#86efac" stroke="#16a34a" strokeWidth="1.5" />
                        <text x={c * 40 + 20} y={r * 40 + 25} textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="900">
                          ↑
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* 3. HOME RUNWAYS (Glossy Saturated Beveled Tiles) */}
              {HOME_PATHS.red.map(([r, c], idx) => (
                <rect
                  key={`rhp-${idx}`}
                  x={c * 40 + 1}
                  y={r * 40 + 1}
                  width="38"
                  height="38"
                  fill="#e11d48"
                  stroke="#be123c"
                  strokeWidth="1.2"
                  rx="6"
                  filter="url(#tile3DShadow)"
                />
              ))}

              {HOME_PATHS.blue.map(([r, c], idx) => (
                <rect
                  key={`bhp-${idx}`}
                  x={c * 40 + 1}
                  y={r * 40 + 1}
                  width="38"
                  height="38"
                  fill="#2563eb"
                  stroke="#1d4ed8"
                  strokeWidth="1.2"
                  rx="6"
                  filter="url(#tile3DShadow)"
                />
              ))}

              {HOME_PATHS.yellow.map(([r, c], idx) => (
                <rect
                  key={`yhp-${idx}`}
                  x={c * 40 + 1}
                  y={r * 40 + 1}
                  width="38"
                  height="38"
                  fill="#f59e0b"
                  stroke="#d97706"
                  strokeWidth="1.2"
                  rx="6"
                  filter="url(#tile3DShadow)"
                />
              ))}

              {HOME_PATHS.green.map(([r, c], idx) => (
                <rect
                  key={`ghp-${idx}`}
                  x={c * 40 + 1}
                  y={r * 40 + 1}
                  width="38"
                  height="38"
                  fill="#10b981"
                  stroke="#059669"
                  strokeWidth="1.2"
                  rx="6"
                  filter="url(#tile3DShadow)"
                />
              ))}

              {/* 4. CENTER HOME TRIANGLES */}
              <polygon points="240,240 300,300 240,360" fill="#e11d48" stroke="#be123c" strokeWidth="1" />
              <polygon points="240,240 300,300 360,240" fill="#2563eb" stroke="#1d4ed8" strokeWidth="1" />
              <polygon points="360,240 300,300 360,360" fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
              <polygon points="240,360 300,300 360,360" fill="#10b981" stroke="#059669" strokeWidth="1" />

              {/* Center Obsidian Glass Medallion with Radiant Neon Red Heart */}
              <circle cx="300" cy="300" r="44" fill="#090a12" stroke="url(#goldMetallicGradient)" strokeWidth="3" filter="url(#cottageShadow)" />
              <circle cx="300" cy="300" r="38" fill="#14070d" />
              <circle cx="300" cy="300" r="30" fill="#ff1744" opacity="0.25" filter="url(#castShadowBlur)" />

              {/* Intense Glowing Neon Red Heart in Center */}
              <g transform="translate(300, 298) scale(1.4)">
                <path
                  d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                  fill="#ff2e79"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  filter="url(#neonGlowRedCenter)"
                />
              </g>

              {/* 5. 3D EMBOSSED LUXURY PAWNS WITH REALISTIC SHADOWS */}
              {renderedPawns.map(({ token, x, y, groundY, isLegal, color, isHopping, scale }) => {
                const cfg = COLOR_CONFIG[color];

                return (
                  <g
                    key={`pawn-${color}-${token.id}`}
                    className={isLegal ? 'cursor-pointer' : ''}
                    onClick={() => {
                      if (isLegal) {
                        onMoveToken(token.id);
                      }
                    }}
                  >
                    {/* A. Ground Contact Shadow */}
                    <g
                      transform={`translate(${x}, ${groundY})`}
                      style={{
                        transition: isHopping ? 'transform 0.15s ease-out' : 'transform 0.1s ease-in'
                      }}
                    >
                      <ellipse
                        cx={1.5}
                        cy={4.5}
                        rx={(isHopping ? 13 : 11.5) * scale}
                        ry={(isHopping ? 4.5 : 3.8) * scale}
                        fill="#000000"
                        opacity={isHopping ? 0.12 : 0.3}
                        filter="url(#castShadowBlur)"
                        style={{ transition: 'all 0.14s ease' }}
                      />
                      <ellipse
                        cx={0}
                        cy={3.5}
                        rx={10 * scale}
                        ry={3.2 * scale}
                        fill="#000000"
                        opacity={isHopping ? 0.18 : 0.55}
                        filter="url(#contactShadowBlur)"
                        style={{ transition: 'all 0.14s ease' }}
                      />
                    </g>

                    {/* B. Legal Move Ground Selection Halo */}
                    {isLegal && !isHopping && (
                      <g transform={`translate(${x}, ${groundY})`}>
                        <ellipse
                          cx={0}
                          cy={3.5}
                          rx={16 * scale}
                          ry={7.5 * scale}
                          fill={cfg.fill}
                          opacity="0.4"
                        >
                          <animate attributeName="rx" values={`${14 * scale};${18 * scale};${14 * scale}`} dur="1.3s" repeatCount="indefinite" />
                          <animate attributeName="ry" values={`${6.5 * scale};${8.5 * scale};${6.5 * scale}`} dur="1.3s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.45;0.18;0.45" dur="1.3s" repeatCount="indefinite" />
                        </ellipse>

                        <ellipse
                          cx={0}
                          cy={3.5}
                          rx={12 * scale}
                          ry={5.5 * scale}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="2"
                          opacity="0.85"
                        >
                          <animate attributeName="opacity" values="0.95;0.4;0.95" dur="1.3s" repeatCount="indefinite" />
                          <animate attributeName="rx" values={`${11.5 * scale};${13 * scale};${11.5 * scale}`} dur="1.3s" repeatCount="indefinite" />
                          <animate attributeName="ry" values={`${5.2 * scale};${6.2 * scale};${5.2 * scale}`} dur="1.3s" repeatCount="indefinite" />
                        </ellipse>
                      </g>
                    )}

                    {/* C. 3D Luxury Figurine Pawn Body */}
                    <g
                      transform={`translate(${x}, ${y}) scale(${scale})`}
                      style={{
                        transition: isHopping
                          ? 'transform 0.15s cubic-bezier(0.2, 0.9, 0.3, 1.2)'
                          : 'transform 0.12s cubic-bezier(0.3, 1.4, 0.4, 1)'
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
                          {renderLuxuryPawn(color, isLegal)}
                        </g>
                      ) : (
                        renderLuxuryPawn(color, isLegal)
                      )}
                    </g>
                  </g>
                );
              })}
            </svg>

            {/* 4 Corner Player Pods matching reference UI layout */}
            {/* Top-Left Corner (Red Yard: "You", Crown 👑, Red neon ring) */}
            {playerByColor['red'] && (
              <div className="absolute -top-4 sm:-top-5 -left-2 sm:-left-3 z-30 pointer-events-auto">
                {renderCornerBadge('red', 'left')}
              </div>
            )}

            {/* Top-Right Corner (Blue Yard: "Babe" / Partner, Blue neon ring) */}
            {playerByColor['blue'] && (
              <div className="absolute -top-4 sm:-top-5 -right-2 sm:-right-3 z-30 pointer-events-auto">
                {renderCornerBadge('blue', 'right')}
              </div>
            )}

            {/* Bottom-Left Corner (Green Yard: Player 3, Green neon ring) */}
            {playerByColor['green'] && (
              <div className="absolute -bottom-4 sm:-bottom-5 -left-2 sm:-left-3 z-30 pointer-events-auto">
                {renderCornerBadge('green', 'left')}
              </div>
            )}

            {/* Bottom-Right Corner (Yellow Yard: Player 4, Gold neon ring) */}
            {playerByColor['yellow'] && (
              <div className="absolute -bottom-4 sm:-bottom-5 -right-2 sm:-right-3 z-30 pointer-events-auto">
                {renderCornerBadge('yellow', 'right')}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM CONTROLS MATCHING REFERENCE IMAGE (Undo button, Large Glowing Red Dice, Emoji button) */}
        <div className="w-full flex flex-col items-center mt-3 max-w-sm px-2 z-20">
          {/* Turn text status banner */}
          <div className="text-rose-200/90 font-sans font-bold text-xs sm:text-sm tracking-wider uppercase mb-3 text-center select-none drop-shadow-[0_0_8px_rgba(255,46,121,0.5)]">
            {gameState.winnerColor
              ? `🏆 ${gameState.winnerColor.toUpperCase()} Won the Match!`
              : turnPlayer && !turnPlayer.isConnected
              ? `${turnPlayer.displayName} has left • tap to nudge`
              : isMyTurn
              ? "it's your turn"
              : `it's ${turnPlayer?.displayName?.toLowerCase() || 'partner'}'s turn`}
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
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#121422]/90 backdrop-blur-md border border-white/20 shadow-[0_4px_15px_rgba(0,0,0,0.5)] flex items-center justify-center text-white/80 hover:text-white hover:border-white/40 active:scale-95 transition cursor-pointer"
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
                    // Friendly nudge
                    onNudgePlayer?.(turnPlayer?.userId, turnPlayer?.displayName);
                    onSendReaction?.('🔔');
                    playSound('nudge');
                  }
                }}
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center transition-all duration-200 select-none cursor-pointer active:scale-95 ${
                  canRoll
                    ? 'bg-gradient-to-br from-[#ff2e79] via-[#e11d48] to-[#9f1239] shadow-[0_0_35px_rgba(255,46,121,0.85),0_10px_25px_rgba(0,0,0,0.6)] border-2 border-rose-300/60 animate-pulse'
                    : canMove
                    ? 'bg-gradient-to-br from-[#ff2e79] via-[#e11d48] to-[#9f1239] shadow-[0_0_25px_rgba(255,46,121,0.6),0_10px_25px_rgba(0,0,0,0.6)] border-2 border-rose-300/40'
                    : gameState.winnerColor
                    ? 'bg-gradient-to-br from-[#f59e0b] via-[#d97706] to-[#b45309] shadow-[0_0_25px_rgba(245,158,11,0.7)] border-2 border-amber-300/60 animate-bounce'
                    : 'bg-gradient-to-br from-[#e11d48]/70 via-[#9f1239]/70 to-[#50071c]/80 shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-white/20 hover:brightness-110'
                }`}
              >
                {/* 3D Glossy Red Cube with White Pips */}
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#ff4777] to-[#be123c] border border-white/40 shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_4px_10px_rgba(0,0,0,0.4)] flex items-center justify-center transform-gpu">
                  {renderDiceFace(gameState.diceValue || 6, 'sm')}
                </div>
              </button>

              {/* Bold Glowing Label */}
              <span className={`text-[11px] sm:text-xs font-black tracking-widest uppercase drop-shadow-[0_0_8px_rgba(255,46,121,0.7)] ${
                canRoll ? 'text-rose-300 animate-pulse' : canMove ? 'text-amber-300' : 'text-white/80'
              }`}>
                {gameState.winnerColor
                  ? 'REMATCH'
                  : canRoll
                  ? 'ROLL THE DICE'
                  : canMove
                  ? 'CHOOSE GOTI'
                  : isMyTurn
                  ? 'YOUR TURN'
                  : 'NUDGE'}
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
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#121422]/90 backdrop-blur-md border border-white/20 shadow-[0_4px_15px_rgba(0,0,0,0.5)] flex items-center justify-center text-white/80 hover:text-white hover:border-white/40 active:scale-95 transition cursor-pointer"
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
