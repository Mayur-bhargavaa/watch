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
  Check
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
  yellow: 0,
  blue: 13,
  red: 26,
  green: 39
};

// Visual themes matching the cozy cottagecore claymation UI
const COLOR_CONFIG: Record<LudoColor, {
  name: string;
  animal: 'chick' | 'bear' | 'bunny' | 'frog';
  fill: string;
  border: string;
  light: string;
  glow: string;
  yardBg: string;
  yardBorder: string;
  homeRow: string;
  dotColor: string;
  gradientStart: string;
  gradientEnd: string;
}> = {
  yellow: {
    name: 'Yellow',
    animal: 'chick',
    fill: '#f5c842',
    border: '#e5b634',
    light: '#fef9e7',
    glow: 'rgba(245, 200, 66, 0.6)',
    yardBg: '#fae8a4',
    yardBorder: '#e8cb74',
    homeRow: '#fae288',
    dotColor: 'bg-amber-400',
    gradientStart: '#fef08a',
    gradientEnd: '#d97706'
  },
  blue: {
    name: 'Blue',
    animal: 'bear',
    fill: '#4a8ee8',
    border: '#3b78cb',
    light: '#e8f2fe',
    glow: 'rgba(74, 142, 232, 0.6)',
    yardBg: '#b4d7fe',
    yardBorder: '#8abdf6',
    homeRow: '#9bc5f5',
    dotColor: 'bg-blue-500',
    gradientStart: '#93c5fd',
    gradientEnd: '#2563eb'
  },
  red: {
    name: 'Red',
    animal: 'bunny',
    fill: '#f26464',
    border: '#dc4a4a',
    light: '#feeff0',
    glow: 'rgba(242, 100, 100, 0.6)',
    yardBg: '#fba5a5',
    yardBorder: '#f28d8d',
    homeRow: '#fca5a5',
    dotColor: 'bg-rose-500',
    gradientStart: '#fca5a5',
    gradientEnd: '#dc2626'
  },
  green: {
    name: 'Green',
    animal: 'frog',
    fill: '#6bbd73',
    border: '#53a85b',
    light: '#eef8ef',
    glow: 'rgba(107, 189, 115, 0.6)',
    yardBg: '#b2d8b5',
    yardBorder: '#8abf8e',
    homeRow: '#a8d4ab',
    dotColor: 'bg-emerald-500',
    gradientStart: '#86efac',
    gradientEnd: '#16a34a'
  }
};

// 52 Track Tile Coordinates [row, col] on a 15x15 grid (0 to 14)
const RING_COORDS: Array<[number, number]> = [
  [6, 1],  // 0  Yellow Start (Star)
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
  [1, 8],  // 13 Blue Start (Star)
  [2, 8],  // 14
  [3, 8],  // 15
  [4, 8],  // 16
  [5, 8],  // 17
  [6, 9],  // 18
  [6, 10], // 19
  [6, 11], // 20
  [6, 12], // 21  (Safe Star)
  [6, 13], // 22
  [6, 14], // 23
  [7, 14], // 24
  [8, 14], // 25
  [8, 13], // 26 Red Start (Star)
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
  [13, 6], // 39 Green Start (Star)
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
  yellow: [
    [7, 1], [7, 2], [7, 3], [7, 4], [7, 5]
  ],
  blue: [
    [1, 7], [2, 7], [3, 7], [4, 7], [5, 7]
  ],
  red: [
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
  yellow: [[1.8, 1.8], [1.8, 4.2], [4.2, 1.8], [4.2, 4.2]], // Top-Left
  blue:   [[1.8, 10.8], [1.8, 13.2], [4.2, 10.8], [4.2, 13.2]], // Top-Right
  green:  [[10.8, 1.8], [10.8, 4.2], [13.2, 1.8], [13.2, 4.2]], // Bottom-Left
  red:    [[10.8, 10.8], [10.8, 13.2], [13.2, 10.8], [13.2, 13.2]] // Bottom-Right
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
        green: [300, 265],
        yellow: [335, 300],
        blue: [300, 335]
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

  // Render sculpted 3D ceramic animal figurines matching reference image
  const renderAnimalFigurine = (color: LudoColor, isLegal: boolean, cfg: any) => {
    if (color === 'blue') {
      // 🐻 3D Ceramic Blue Teddy Bear
      return (
        <g>
          {/* Base Pedestal */}
          <ellipse cx={0} cy={3.8} rx="11" ry="4.2" fill="#1e3a8a" opacity="0.4" />
          <ellipse cx={0} cy={3.2} rx="10.8" ry="4" fill="url(#bluePawnBody)" />
          <ellipse cx={0} cy={2.2} rx="9.6" ry="3.2" fill="url(#bluePawnBody)" />
          <ellipse cx={-1.5} cy={1.8} rx="7.2" ry="1.8" fill="#bfdbfe" opacity="0.6" />

          {/* Sculpted Bear Torso */}
          <path
            d="M -7.5 2 C -8.5 -4, -6.5 -10, 0 -10 C 6.5 -10, 8.5 -4, 7.5 2 Z"
            fill="url(#bluePawnBody)"
          />
          {/* Soft Tummy Patch */}
          <ellipse cx={0} cy="-3.5" rx="4.5" ry="5" fill="#60a5fa" opacity="0.75" />

          {/* Folded Bear Paws on Tummy */}
          <ellipse cx="-4.2" cy="-3" rx="2.5" ry="1.8" transform="rotate(-18 -4.2 -3)" fill="#2563eb" stroke="#1d4ed8" strokeWidth="0.4" />
          <ellipse cx="4.2" cy="-3" rx="2.5" ry="1.8" transform="rotate(18 4.2 -3)" fill="#2563eb" stroke="#1d4ed8" strokeWidth="0.4" />

          {/* Round Bear Ears */}
          <circle cx="-5.8" cy="-20.5" r="3.2" fill="#2563eb" stroke="#1e40af" strokeWidth="0.5" />
          <circle cx="-5.8" cy="-20.5" r="1.8" fill="#bfdbfe" />
          <circle cx="5.8" cy="-20.5" r="3.2" fill="#2563eb" stroke="#1e40af" strokeWidth="0.5" />
          <circle cx="5.8" cy="-20.5" r="1.8" fill="#bfdbfe" />

          {/* Round Bear Head */}
          <circle
            cx={0}
            cy={-14.8}
            r="7.8"
            fill="url(#bluePawnHead)"
            stroke={isLegal ? '#ffffff' : '#1d4ed8'}
            strokeWidth={isLegal ? '1.8' : '0.7'}
          />

          {/* Snout / Muzzle */}
          <ellipse cx={0} cy={-13.2} rx="3.6" ry="2.7" fill="#dbeafe" />
          {/* Bear Nose */}
          <path d="M -1.5 -14.2 Q 0 -14.8 1.5 -14.2 Q 0 -13 -1.5 -14.2 Z" fill="#1e293b" />
          {/* Bear Smile */}
          <path d="M -1.8 -12.3 Q 0 -11.4 1.8 -12.3" fill="none" stroke="#1e293b" strokeWidth="0.7" strokeLinecap="round" />

          {/* Glossy Black Bead Eyes with Catchlights */}
          <circle cx="-2.8" cy="-16.2" r="1.1" fill="#0f172a" />
          <circle cx="-3.1" cy="-16.5" r="0.45" fill="#ffffff" />
          <circle cx="2.8" cy="-16.2" r="1.1" fill="#0f172a" />
          <circle cx="2.5" cy="-16.5" r="0.45" fill="#ffffff" />

          {/* Ceramic Specular Highlight Glint */}
          <ellipse cx="-2.4" cy="-18" rx="2.2" ry="1.2" fill="#ffffff" opacity="0.85" />
        </g>
      );
    }

    if (color === 'green') {
      // 🐸 3D Ceramic Green Frog
      return (
        <g>
          {/* Tiered Base Pedestal / Lilypad rim */}
          <ellipse cx={0} cy={3.8} rx="11" ry="4.2" fill="#064e3b" opacity="0.4" />
          <ellipse cx={0} cy={3.2} rx="10.8" ry="4" fill="url(#greenPawnBody)" />
          <ellipse cx={0} cy={2.2} rx="9.6" ry="3.2" fill="url(#greenPawnBody)" />
          <ellipse cx={-1.5} cy={1.8} rx="7.2" ry="1.8" fill="#bbf7d0" opacity="0.6" />

          {/* Wide Frog Body */}
          <path
            d="M -8 2 C -9 -3, -7 -9.5, 0 -9.5 C 7 -9.5, 9 -3, 8 2 Z"
            fill="url(#greenPawnBody)"
          />
          {/* Pale Green Soft Belly */}
          <ellipse cx={0} cy="-3" rx="5.2" ry="4.8" fill="#bbf7d0" opacity="0.85" />

          {/* Little Hands on Sides */}
          <ellipse cx="-4.8" cy="-2.5" rx="2.2" ry="1.6" fill="#15803d" />
          <ellipse cx="4.8" cy="-2.5" rx="2.2" ry="1.6" fill="#15803d" />

          {/* Wide Friendly Frog Head */}
          <ellipse
            cx={0}
            cy={-13.8}
            rx="7.8"
            ry="6.6"
            fill="url(#greenPawnHead)"
            stroke={isLegal ? '#ffffff' : '#15803d'}
            strokeWidth={isLegal ? '1.8' : '0.7'}
          />

          {/* Bulbous Frog Eyes on Top */}
          <circle cx="-4.8" cy="-19" r="3.4" fill="url(#greenPawnHead)" stroke="#166534" strokeWidth="0.5" />
          <circle cx="-4.8" cy="-19" r="2.3" fill="#ffffff" />
          <circle cx="-4.5" cy="-19" r="1.3" fill="#0f172a" />
          <circle cx="-4.8" cy="-19.4" r="0.5" fill="#ffffff" />

          <circle cx="4.8" cy="-19" r="3.4" fill="url(#greenPawnHead)" stroke="#166534" strokeWidth="0.5" />
          <circle cx="4.8" cy="-19" r="2.3" fill="#ffffff" />
          <circle cx="4.5" cy="-19" r="1.3" fill="#0f172a" />
          <circle cx="4.2" cy="-19.4" r="0.5" fill="#ffffff" />

          {/* Blush Pink Cheeks */}
          <circle cx="-5.2" cy="-12.5" r="1.6" fill="#f472b6" opacity="0.65" />
          <circle cx="5.2" cy="-12.5" r="1.6" fill="#f472b6" opacity="0.65" />

          {/* Wide Gentle Frog Smile */}
          <path d="M -3.6 -12 Q 0 -9.6 3.6 -12" fill="none" stroke="#14532d" strokeWidth="0.9" strokeLinecap="round" />

          {/* Glossy Glint */}
          <ellipse cx="-1.8" cy="-15.8" rx="2.5" ry="1.2" fill="#ffffff" opacity="0.8" />
        </g>
      );
    }

    if (color === 'yellow') {
      // 🐥 3D Ceramic Yellow Chick
      return (
        <g>
          <ellipse cx={0} cy={3.8} rx="11" ry="4.2" fill="#713f12" opacity="0.4" />
          <ellipse cx={0} cy={3.2} rx="10.8" ry="4" fill="url(#yellowPawnBody)" />
          <ellipse cx={0} cy={2.2} rx="9.6" ry="3.2" fill="url(#yellowPawnBody)" />
          <ellipse cx={-1.5} cy={1.8} rx="7.2" ry="1.8" fill="#fef08a" opacity="0.6" />

          {/* Plump Chick Body */}
          <path
            d="M -7.5 2 C -8.5 -4, -6.5 -10, 0 -10 C 6.5 -10, 8.5 -4, 7.5 2 Z"
            fill="url(#yellowPawnBody)"
          />
          <path d="M -6.8 -1.5 Q -8.5 -4.5 -6.2 -7" stroke="#ca8a04" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          <path d="M 6.8 -1.5 Q 8.5 -4.5 6.2 -7" stroke="#ca8a04" strokeWidth="1.2" strokeLinecap="round" fill="none" />

          {/* Feather Tuft */}
          <path d="M -1 -21.8 Q 0 -24.5 1 -21.8" fill="none" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round" />

          {/* Head */}
          <circle
            cx={0}
            cy={-14.5}
            r="7.5"
            fill="url(#yellowPawnHead)"
            stroke={isLegal ? '#ffffff' : '#ca8a04'}
            strokeWidth={isLegal ? '1.8' : '0.7'}
          />

          {/* Orange Beak */}
          <polygon points="0,-10.8 -2.4,-13.2 2.4,-13.2" fill="#ea580c" stroke="#c2410c" strokeWidth="0.3" />

          {/* Eyes */}
          <circle cx="-2.8" cy="-15.5" r="1.1" fill="#1c1917" />
          <circle cx="-3.1" cy="-15.8" r="0.4" fill="#ffffff" />
          <circle cx="2.8" cy="-15.5" r="1.1" fill="#1c1917" />
          <circle cx="2.5" cy="-15.8" r="0.4" fill="#ffffff" />

          <ellipse cx="-2.4" cy="-17.8" rx="2.2" ry="1.2" fill="#ffffff" opacity="0.85" />
        </g>
      );
    }

    // 🐰 3D Ceramic Coral/Red Bunny
    return (
      <g>
        <ellipse cx={0} cy={3.8} rx="11" ry="4.2" fill="#4c0519" opacity="0.4" />
        <ellipse cx={0} cy={3.2} rx="10.8" ry="4" fill="url(#redPawnBody)" />
        <ellipse cx={0} cy={2.2} rx="9.6" ry="3.2" fill="url(#redPawnBody)" />
        <ellipse cx={-1.5} cy={1.8} rx="7.2" ry="1.8" fill="#fecdd3" opacity="0.6" />

        {/* Upright Bunny Ears */}
        <ellipse cx="-3.5" cy="-24.5" rx="2.2" ry="5.5" transform="rotate(-8 -3.5 -24.5)" fill="url(#redPawnHead)" stroke="#be123c" strokeWidth="0.4" />
        <ellipse cx="-3.5" cy="-24.5" rx="1.2" ry="3.8" transform="rotate(-8 -3.5 -24.5)" fill="#fecdd3" />
        <ellipse cx="3.5" cy="-24.5" rx="2.2" ry="5.5" transform="rotate(8 3.5 -24.5)" fill="url(#redPawnHead)" stroke="#be123c" strokeWidth="0.4" />
        <ellipse cx="3.5" cy="-24.5" rx="1.2" ry="3.8" transform="rotate(8 3.5 -24.5)" fill="#fecdd3" />

        {/* Bunny Body */}
        <path
          d="M -7.5 2 C -8.5 -4, -6.5 -10, 0 -10 C 6.5 -10, 8.5 -4, 7.5 2 Z"
          fill="url(#redPawnBody)"
        />
        <ellipse cx={0} cy="-3" rx="4.5" ry="5" fill="#ffe4e6" opacity="0.85" />

        {/* Head */}
        <circle
          cx={0}
          cy={-14.2}
          r="7.5"
          fill="url(#redPawnHead)"
          stroke={isLegal ? '#ffffff' : '#be123c'}
          strokeWidth={isLegal ? '1.8' : '0.7'}
        />

        {/* Nose & Mouth */}
        <polygon points="0,-12 -1.2,-13.2 1.2,-13.2" fill="#f43f5e" />
        <path d="M -1.2 -11 Q 0 -10.3 1.2 -11" fill="none" stroke="#881337" strokeWidth="0.7" strokeLinecap="round" />

        {/* Eyes */}
        <circle cx="-2.8" cy="-15" r="1.1" fill="#1c1917" />
        <circle cx="-3.1" cy="-15.3" r="0.4" fill="#ffffff" />
        <circle cx="2.8" cy="-15.5" r="1.1" fill="#1c1917" />
        <circle cx="2.5" cy="-15.3" r="0.4" fill="#ffffff" />

        <ellipse cx="-2.2" cy="-17.2" rx="2.2" ry="1.2" fill="#ffffff" opacity="0.85" />
      </g>
    );
  };

  // Render Angled Ribbon Player Badge matching reference UI (e.g., 'kucchu' and 'you')
  const renderCornerBadge = (color: LudoColor, side: 'left' | 'right') => {
    const p = playerByColor[color];
    const isCurrentTurn = gameState.currentTurnColor === color;
    const cfg = COLOR_CONFIG[color];
    const isMe = p?.userId === myPlayer?.userId;
    const isHost = p?.seat === 0;

    if (!p) return null;

    const isRight = side === 'right';
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
      <div className={`relative flex items-center ${isRight ? 'flex-row-reverse' : 'flex-row'} z-30 select-none`}>
        {/* Remote audio receiver so we hear opponent speaking */}
        {!isMe && pStream?.stream && (
          <RemoteAudioPlayer stream={pStream.stream} />
        )}

        {/* Circular Avatar with Centered Floating Golden Chevron */}
        <div className="relative shrink-0 z-20">
          {/* Floating 3D Golden Pointer when this player's turn - perfectly centered above avatar */}
          {isCurrentTurn && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce z-40 pointer-events-none">
              <svg width="24" height="22" viewBox="0 0 24 22" fill="none" className="drop-shadow-[0_3px_5px_rgba(0,0,0,0.45)]">
                <defs>
                  <linearGradient id="goldTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fff7ed" />
                    <stop offset="35%" stopColor="#fde047" />
                    <stop offset="70%" stopColor="#eab308" />
                    <stop offset="100%" stopColor="#ca8a04" />
                  </linearGradient>
                  <linearGradient id="goldLeftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="100%" stopColor="#a16207" />
                  </linearGradient>
                </defs>
                {/* 3D faceted chevron arrow */}
                <path d="M 12 21 L 2 4 L 12 7 Z" fill="url(#goldLeftGrad)" />
                <path d="M 12 21 L 22 4 L 12 7 Z" fill="url(#goldTopGrad)" />
                <path d="M 2 4 L 12 7 L 22 4 L 12 21 Z" stroke="#ffffff" strokeWidth="0.8" opacity="0.85" />
              </svg>
            </div>
          )}

          {/* Avatar Ring with Speaking Glow & Camera Integration */}
          <div
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full p-0.5 border-2 shadow-lg flex items-center justify-center transition-all ${
              (isMe ? !isMicMuted : pStream?.isSpeaking)
                ? 'ring-4 ring-emerald-400 scale-105 shadow-[0_0_20px_rgba(52,211,153,0.85)]'
                : isCurrentTurn
                ? 'ring-3 ring-amber-300 scale-105 shadow-[0_0_18px_rgba(251,191,36,0.65)]'
                : ''
            }`}
            style={{
              borderColor: cfg.border,
              backgroundColor: '#ffffff'
            }}
          >
            <div
              className="w-full h-full rounded-full flex items-center justify-center font-black text-xs sm:text-sm text-white shadow-inner uppercase overflow-hidden relative"
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
            className={`absolute bottom-0.5 ${isRight ? 'left-0.5' : 'right-0.5'} w-3.5 h-3.5 rounded-full ring-2 ring-white flex items-center justify-center text-[7px] font-bold ${
              p.isConnected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
            }`}
            title={p.isConnected ? 'Online' : 'Player Left / Disconnected'}
          />

          {/* Audio / Mic indicator dot */}
          <span
            className={`absolute -top-1 ${isRight ? '-left-1' : '-right-1'} w-4 h-4 rounded-full border border-white shadow-sm flex items-center justify-center text-[8px] z-30 transition-colors ${
              isPlayerMuted
                ? 'bg-rose-600 text-white'
                : 'bg-emerald-500 text-white animate-pulse'
            }`}
            title={isPlayerMuted ? 'Microphone Muted' : 'Microphone Active'}
          >
            {isPlayerMuted ? '🔇' : '🎙️'}
          </span>

          {/* Dice icon for local player */}
          {isMe && (
            <span className={`absolute -bottom-1.5 ${isRight ? '-left-1.5' : '-right-1.5'} w-5 h-5 rounded-md bg-white border border-[#dfd5c4] shadow-sm flex items-center justify-center text-[11px] leading-none`}>
              🎲
            </span>
          )}
        </div>

        {/* Angled Ribbon Banner tucking behind avatar */}
        <div
          className={`relative z-10 py-1.5 font-extrabold text-white text-xs sm:text-sm tracking-wide shadow-md flex items-center gap-1.5 transition-all ${
            isRight
              ? '-mr-3.5 pr-5 pl-4 rounded-l-xl'
              : '-ml-3.5 pl-5 pr-4 rounded-r-xl'
          } ${!p.isConnected ? 'opacity-90' : ''}`}
          style={{
            backgroundColor: p.isConnected ? cfg.fill : '#475569',
            border: `2px solid ${p.isConnected ? cfg.border : '#64748b'}`,
            boxShadow: `0 4px 12px ${p.isConnected ? cfg.glow : 'rgba(0,0,0,0.35)'}`,
            transform: isRight ? 'skewX(-4deg)' : 'skewX(4deg)'
          }}
        >
          <span
            className="truncate max-w-[85px] sm:max-w-[110px]"
            style={{ transform: isRight ? 'skewX(4deg)' : 'skewX(-4deg)' }}
          >
            {isMe ? 'you' : !p.isConnected ? `${p.displayName.toLowerCase()} (left)` : p.displayName.toLowerCase()}
          </span>
          {isHost && (
            <span
              className="text-amber-200 text-xs shrink-0"
              style={{ transform: isRight ? 'skewX(4deg)' : 'skewX(-4deg)' }}
            >
              👑
            </span>
          )}

          {/* Quick Nudge pill button on ribbon if opponent left/disconnected */}
          {!isMe && !p.isConnected && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNudgePlayer?.(p.userId, p.displayName);
                playSound('nudge');
              }}
              style={{ transform: isRight ? 'skewX(4deg)' : 'skewX(-4deg)' }}
              className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[9px] uppercase tracking-wider flex items-center gap-0.5 shadow transition active:scale-95 cursor-pointer shrink-0"
              title={`Nudge ${p.displayName} to return`}
            >
              <span>🔔</span>
              <span>Nudge</span>
            </button>
          )}
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

          {/* SVG Board */}
          <svg
            viewBox="0 0 600 600"
            className="w-full h-full rounded-[26px] overflow-hidden shadow-inner border border-[#e8dcc8]"
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
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.18" />
                </filter>
                <filter id="tile3DShadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="1" stdDeviation="0.6" floodColor="#8c7a65" floodOpacity="0.12" />
                </filter>
                <filter id="trayInnerShadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#8c7a65" floodOpacity="0.18" />
                </filter>
                <filter id="cottageShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#7a5530" floodOpacity="0.25" />
                </filter>

                {/* Gold Metallic & Pointer Gradients */}
                <linearGradient id="goldMetallicGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="35%" stopColor="#f59e0b" />
                  <stop offset="70%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#92400e" />
                </linearGradient>
                <linearGradient id="goldPointerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="40%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>

                {/* 3D Radial Gradients for Ceramic Animal Heads */}
                <radialGradient id="bluePawnHead" cx="35%" cy="25%" r="70%">
                  <stop offset="0%" stopColor="#dbeafe" />
                  <stop offset="25%" stopColor="#60a5fa" />
                  <stop offset="60%" stopColor="#2563eb" />
                  <stop offset="85%" stopColor="#1d4ed8" />
                  <stop offset="100%" stopColor="#172554" />
                </radialGradient>
                <radialGradient id="greenPawnHead" cx="35%" cy="25%" r="70%">
                  <stop offset="0%" stopColor="#dcfce7" />
                  <stop offset="25%" stopColor="#4ade80" />
                  <stop offset="60%" stopColor="#16a34a" />
                  <stop offset="85%" stopColor="#15803d" />
                  <stop offset="100%" stopColor="#14532d" />
                </radialGradient>
                <radialGradient id="yellowPawnHead" cx="35%" cy="25%" r="70%">
                  <stop offset="0%" stopColor="#fffbeb" />
                  <stop offset="25%" stopColor="#fde047" />
                  <stop offset="60%" stopColor="#eab308" />
                  <stop offset="85%" stopColor="#ca8a04" />
                  <stop offset="100%" stopColor="#713f12" />
                </radialGradient>
                <radialGradient id="redPawnHead" cx="35%" cy="25%" r="70%">
                  <stop offset="0%" stopColor="#ffe4e6" />
                  <stop offset="25%" stopColor="#fb7185" />
                  <stop offset="60%" stopColor="#e11d48" />
                  <stop offset="85%" stopColor="#be123c" />
                  <stop offset="100%" stopColor="#4c0519" />
                </radialGradient>

                {/* 3D Linear Gradients for Ceramic Animal Bodies */}
                <linearGradient id="bluePawnBody" x1="15%" y1="0%" x2="85%" y2="100%">
                  <stop offset="0%" stopColor="#93c5fd" />
                  <stop offset="30%" stopColor="#3b82f6" />
                  <stop offset="75%" stopColor="#1d4ed8" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
                <linearGradient id="greenPawnBody" x1="15%" y1="0%" x2="85%" y2="100%">
                  <stop offset="0%" stopColor="#86efac" />
                  <stop offset="30%" stopColor="#22c55e" />
                  <stop offset="75%" stopColor="#15803d" />
                  <stop offset="100%" stopColor="#052e16" />
                </linearGradient>
                <linearGradient id="yellowPawnBody" x1="15%" y1="0%" x2="85%" y2="100%">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="30%" stopColor="#f59e0b" />
                  <stop offset="75%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#78350f" />
                </linearGradient>
                <linearGradient id="redPawnBody" x1="15%" y1="0%" x2="85%" y2="100%">
                  <stop offset="0%" stopColor="#fda4af" />
                  <stop offset="30%" stopColor="#f43f5e" />
                  <stop offset="75%" stopColor="#be123c" />
                  <stop offset="100%" stopColor="#4c0519" />
                </linearGradient>
              </defs>

              {/* Board Base Surface (Porcelain Cream) */}
              <rect width="600" height="600" fill="#faf7ee" />

              {/* 1. YARDS (4 Pastel Trays with Botanical Engravings) */}
              {/* Yellow Yard (Top-Left) with Daisy Engraving */}
              <g>
                <rect x="0" y="0" width="240" height="240" fill={COLOR_CONFIG.yellow.yardBg} />
                <rect x="20" y="20" width="200" height="200" rx="36" fill="#fdfaf0" stroke="#ebd28c" strokeWidth="2" filter="url(#trayInnerShadow)" />
                {/* Daisy Engraving in Center */}
                <g transform="translate(120, 120)" opacity="0.8">
                  {/* Stem & Leaves */}
                  <path d="M 0 10 L 0 34" stroke="#c5963f" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="M 0 18 Q -8 15 -10 20 Q -4 22 0 18" fill="none" stroke="#c5963f" strokeWidth="1.3" />
                  <path d="M 0 24 Q 8 21 10 26 Q 4 28 0 24" fill="none" stroke="#c5963f" strokeWidth="1.3" />
                  {/* Center Disc */}
                  <circle cx="0" cy="0" r="5" fill="none" stroke="#c5963f" strokeWidth="1.6" />
                  {/* 8 Flower Petals */}
                  {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                    <ellipse
                      key={`ypet-${deg}`}
                      cx="0"
                      cy="-11"
                      rx="3.5"
                      ry="5"
                      transform={`rotate(${deg} 0 0)`}
                      fill="none"
                      stroke="#c5963f"
                      strokeWidth="1.3"
                    />
                  ))}
                </g>
                {/* 4 Circular Socket Pads */}
                {YARD_PAWN_SLOTS.yellow.map((slot, i) => (
                  <g key={`yy-${i}`}>
                    <circle
                      cx={slot[1] * 40}
                      cy={slot[0] * 40}
                      r="22"
                      fill="#faf0cd"
                      stroke="#e0be69"
                      strokeWidth="1.5"
                      filter="url(#recessedSaucerShadow)"
                    />
                    <circle
                      cx={slot[1] * 40}
                      cy={slot[0] * 40}
                      r="14"
                      fill="#fae8a4"
                      opacity="0.9"
                    />
                  </g>
                ))}
              </g>

              {/* Blue Yard (Top-Right) with Fern Branch Engraving */}
              <g>
                <rect x="360" y="0" width="240" height="240" fill={COLOR_CONFIG.blue.yardBg} />
                <rect x="380" y="20" width="200" height="200" rx="36" fill="#f4f9ff" stroke="#9bc5f5" strokeWidth="2" filter="url(#trayInnerShadow)" />
                {/* Fern Branch Engraving in Center */}
                <g transform="translate(480, 120)" opacity="0.8">
                  <path d="M 0 -36 L 0 36" stroke="#5289cc" strokeWidth="1.6" strokeLinecap="round" />
                  {[-24, -12, 0, 12, 24].map((offsetY, idx) => (
                    <g key={`fern-${idx}`}>
                      <path d={`M 0 ${offsetY} Q -12 ${offsetY - 3} -14 ${offsetY + 3} Q -7 ${offsetY + 4} 0 ${offsetY + 1}`} fill="none" stroke="#5289cc" strokeWidth="1.3" />
                      <path d={`M 0 ${offsetY} Q 12 ${offsetY - 3} 14 ${offsetY + 3} Q 7 ${offsetY + 4} 0 ${offsetY + 1}`} fill="none" stroke="#5289cc" strokeWidth="1.3" />
                    </g>
                  ))}
                </g>
                {/* 4 Circular Socket Pads */}
                {YARD_PAWN_SLOTS.blue.map((slot, i) => (
                  <g key={`by-${i}`}>
                    <circle
                      cx={slot[1] * 40}
                      cy={slot[0] * 40}
                      r="22"
                      fill="#dbeafe"
                      stroke="#7eb1ee"
                      strokeWidth="1.5"
                      filter="url(#recessedSaucerShadow)"
                    />
                    <circle
                      cx={slot[1] * 40}
                      cy={slot[0] * 40}
                      r="14"
                      fill="#b4d7fe"
                      opacity="0.9"
                    />
                  </g>
                ))}
              </g>

              {/* Green Yard (Bottom-Left) with Lavender Stalk Engraving */}
              <g>
                <rect x="0" y="360" width="240" height="240" fill={COLOR_CONFIG.green.yardBg} />
                <rect x="20" y="380" width="200" height="200" rx="36" fill="#f4faf5" stroke="#9ecfa2" strokeWidth="2" filter="url(#trayInnerShadow)" />
                {/* Lavender Wildflower Stalk Engraving in Center */}
                <g transform="translate(120, 480)" opacity="0.8">
                  <path d="M 0 -34 L 0 34" stroke="#528757" strokeWidth="1.6" strokeLinecap="round" />
                  {[-24, -14, -4, 6].map((offsetY, idx) => (
                    <g key={`lav-${idx}`}>
                      <ellipse cx="-4.5" cy={offsetY} rx="3.5" ry="1.8" transform={`rotate(-25 -4.5 ${offsetY})`} fill="none" stroke="#528757" strokeWidth="1.3" />
                      <ellipse cx="4.5" cy={offsetY} rx="3.5" ry="1.8" transform={`rotate(25 4.5 ${offsetY})`} fill="none" stroke="#528757" strokeWidth="1.3" />
                    </g>
                  ))}
                  <path d="M 0 18 Q -10 20 -11 26 Q -5 27 0 21" fill="none" stroke="#528757" strokeWidth="1.3" />
                  <path d="M 0 18 Q 10 20 11 26 Q 5 27 0 21" fill="none" stroke="#528757" strokeWidth="1.3" />
                </g>
                {/* 4 Circular Socket Pads */}
                {YARD_PAWN_SLOTS.green.map((slot, i) => (
                  <g key={`gy-${i}`}>
                    <circle
                      cx={slot[1] * 40}
                      cy={slot[0] * 40}
                      r="22"
                      fill="#daf0dd"
                      stroke="#7ab680"
                      strokeWidth="1.5"
                      filter="url(#recessedSaucerShadow)"
                    />
                    <circle
                      cx={slot[1] * 40}
                      cy={slot[0] * 40}
                      r="14"
                      fill="#b2d8b5"
                      opacity="0.9"
                    />
                  </g>
                ))}
              </g>

              {/* Red Yard (Bottom-Right) with Maple Leaf Engraving */}
              <g>
                <rect x="360" y="360" width="240" height="240" fill={COLOR_CONFIG.red.yardBg} />
                <rect x="380" y="380" width="200" height="200" rx="36" fill="#fff5f5" stroke="#f49d9d" strokeWidth="2" filter="url(#trayInnerShadow)" />
                {/* Maple Leaf Engraving in Center */}
                <g transform="translate(480, 480)" opacity="0.8">
                  <path d="M 0 24 L 0 36" stroke="#c75454" strokeWidth="1.6" strokeLinecap="round" />
                  <path
                    d="M 0 -30 L 4 -18 L 15 -22 L 10 -11 L 24 -6 L 13 0 L 16 12 L 6 10 L 0 19 L -6 10 L -16 12 L -13 0 L -24 -6 L -10 -11 L -15 -22 L -4 -18 Z"
                    fill="none"
                    stroke="#c75454"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path d="M 0 19 L 0 -26 M 0 6 L 14 -7 M 0 6 L -14 -7 M 0 -4 L 9 -17 M 0 -4 L -9 -17" stroke="#c75454" strokeWidth="1.2" strokeLinecap="round" />
                </g>
                {/* 4 Circular Socket Pads */}
                {YARD_PAWN_SLOTS.red.map((slot, i) => (
                  <g key={`ry-${i}`}>
                    <circle
                      cx={slot[1] * 40}
                      cy={slot[0] * 40}
                      r="22"
                      fill="#fde2e2"
                      stroke="#e87676"
                      strokeWidth="1.5"
                      filter="url(#recessedSaucerShadow)"
                    />
                    <circle
                      cx={slot[1] * 40}
                      cy={slot[0] * 40}
                      r="14"
                      fill="#fba5a5"
                      opacity="0.9"
                    />
                  </g>
                ))}
              </g>

              {/* 2. TRACK CELLS (52 Tiles with Soft Wooden Star Tokens & Arrow Coins) */}
              {RING_COORDS.map(([r, c], idx) => {
                const isSafe = SAFE_STAR_TILES.has(idx);
                const isYellowStart = idx === 0;
                const isBlueStart = idx === 13;
                const isRedStart = idx === 26;
                const isGreenStart = idx === 39;

                let fill = '#fcfaf4';
                let stroke = '#e8dfce';

                if (isYellowStart) { fill = COLOR_CONFIG.yellow.yardBg; stroke = '#e0be69'; }
                else if (isBlueStart) { fill = COLOR_CONFIG.blue.yardBg; stroke = '#7eb1ee'; }
                else if (isRedStart) { fill = COLOR_CONFIG.red.yardBg; stroke = '#e87676'; }
                else if (isGreenStart) { fill = COLOR_CONFIG.green.yardBg; stroke = '#7ab680'; }

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

                    {/* Safe Stamped Wooden / Ceramic Star Coin */}
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
                          fill="#9f8569"
                          fontSize="14"
                          fontWeight="bold"
                        >
                          ★
                        </text>
                      </g>
                    )}

                    {/* Directional Entry Coins to Home Stretch Lanes */}
                    {idx === 11 && (
                      <g>
                        <circle cx={c * 40 + 20} cy={r * 40 + 20} r="13" fill="#b4d7fe" stroke="#7fb3f3" strokeWidth="1.5" />
                        <text x={c * 40 + 20} y={r * 40 + 25} textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="900">
                          ↓
                        </text>
                      </g>
                    )}
                    {idx === 50 && (
                      <g>
                        <circle cx={c * 40 + 20} cy={r * 40 + 20} r="13" fill="#fae8a4" stroke="#e5be52" strokeWidth="1.5" />
                        <text x={c * 40 + 20} y={r * 40 + 25} textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="900">
                          →
                        </text>
                      </g>
                    )}
                    {idx === 24 && (
                      <g>
                        <circle cx={c * 40 + 20} cy={r * 40 + 20} r="13" fill="#fba5a5" stroke="#ec7878" strokeWidth="1.5" />
                        <text x={c * 40 + 20} y={r * 40 + 25} textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="900">
                          ←
                        </text>
                      </g>
                    )}
                    {idx === 37 && (
                      <g>
                        <circle cx={c * 40 + 20} cy={r * 40 + 20} r="13" fill="#b2d8b5" stroke="#7eb883" strokeWidth="1.5" />
                        <text x={c * 40 + 20} y={r * 40 + 25} textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="900">
                          ↑
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* 3. HOME PATHS */}
              {HOME_PATHS.yellow.map(([r, c], idx) => (
                <rect
                  key={`yhp-${idx}`}
                  x={c * 40 + 1}
                  y={r * 40 + 1}
                  width="38"
                  height="38"
                  fill={COLOR_CONFIG.yellow.homeRow}
                  stroke="#edd47d"
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
                  fill={COLOR_CONFIG.blue.homeRow}
                  stroke="#8cbaf0"
                  strokeWidth="1.2"
                  rx="6"
                  filter="url(#tile3DShadow)"
                />
              ))}

              {HOME_PATHS.red.map(([r, c], idx) => (
                <rect
                  key={`rhp-${idx}`}
                  x={c * 40 + 1}
                  y={r * 40 + 1}
                  width="38"
                  height="38"
                  fill={COLOR_CONFIG.red.homeRow}
                  stroke="#f09595"
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
                  fill={COLOR_CONFIG.green.homeRow}
                  stroke="#9ac99d"
                  strokeWidth="1.2"
                  rx="6"
                  filter="url(#tile3DShadow)"
                />
              ))}

              {/* 4. CENTER HOME TRIANGLES */}
              <polygon points="240,240 300,300 240,360" fill={COLOR_CONFIG.yellow.homeRow} />
              <polygon points="240,240 300,300 360,240" fill={COLOR_CONFIG.blue.homeRow} />
              <polygon points="360,240 300,300 360,360" fill={COLOR_CONFIG.red.homeRow} />
              <polygon points="240,360 300,300 360,360" fill={COLOR_CONFIG.green.homeRow} />

              {/* Center Home Birchwood Medallion with Engraved Cottage House + Heart */}
              <circle cx="300" cy="300" r="44" fill="#eedcc6" stroke="#d5bc9f" strokeWidth="3" filter="url(#cottageShadow)" />
              <circle cx="300" cy="300" r="39" fill="#faedd9" />
              <g transform="translate(300, 300)">
                {/* Gable Roof */}
                <path d="M -22 -2 L 0 -22 L 22 -2" stroke="#ab7d53" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                {/* Chimney */}
                <path d="M 12 -12 L 12 -20 L 17 -20 L 17 -7" stroke="#ab7d53" strokeWidth="2.2" strokeLinejoin="round" fill="none" />
                {/* House walls */}
                <path d="M -16 -2 L -16 20 L 16 20 L 16 -2" stroke="#ab7d53" strokeWidth="2.8" strokeLinejoin="round" fill="none" />
                {/* Centered Engraved Heart in House */}
                <path
                  d="M 0,11 C 0,11 -7,6 -7,2 C -7,-1 -5,-3 -2,-3 C -0.5,-3 0,-2 0,-2 C 0,-2 0.5,-3 2,-3 C 5,-3 7,-1 7,2 C 7,6 0,11 0,11 Z"
                  fill="#ab7d53"
                />
              </g>

              {/* 5. 3D EMBOSSED PAWNS WITH PHYSICAL GROUND CONTACT (NEVER IN AIR) */}
              {renderedPawns.map(({ token, x, y, groundY, isLegal, color, isHopping, scale }) => {
                const cfg = COLOR_CONFIG[color];
                const headGradient = `url(#${color}PawnHead)`;
                const bodyGradient = `url(#${color}PawnBody)`;

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
                    {/* A. Physical Ground Contact Shadow (Glides smoothly along the floor) */}
                    <g
                      transform={`translate(${x}, ${groundY})`}
                      style={{
                        transition: isHopping ? 'transform 0.15s ease-out' : 'transform 0.1s ease-in'
                      }}
                    >
                      {/* Soft directional cast shadow */}
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
                      {/* Tight ambient occlusion contact shadow directly touching base rim */}
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

                    {/* B. Legal Move Ground Selection Halo (Flat on tile floor under goti) */}
                    {isLegal && !isHopping && (
                      <g transform={`translate(${x}, ${groundY})`}>
                        {/* Soft Outer Ground Aura */}
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

                        {/* Concentric Golden Selection Ring on Floor */}
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

                    {/* C. 3D Luxury Figurine Pawn Body (Glides smoothly, gentle bob when selectable) */}
                    <g
                      transform={`translate(${x}, ${y}) scale(${scale})`}
                      style={{
                        transition: isHopping
                          ? 'transform 0.15s cubic-bezier(0.2, 0.9, 0.3, 1.2)'
                          : 'transform 0.12s cubic-bezier(0.3, 1.4, 0.4, 1)'
                      }}
                    >
                      {/* When selectable, subtle gentle hover/bounce inviting tap */}
                      {isLegal && !isHopping ? (
                        <g>
                          <animateTransform
                            attributeName="transform"
                            type="translate"
                            values="0,0; 0,-3.5; 0,0"
                            dur="1.1s"
                            repeatCount="indefinite"
                          />
                          {renderAnimalFigurine(color, isLegal, cfg)}
                        </g>
                      ) : (
                        renderAnimalFigurine(color, isLegal, cfg)
                      )}
                    </g>
                  </g>
                );
              })}
            </svg>

            {/* 4 Corner Player Badges Anchored directly on the Board Corners */}
            {/* Top-Left Corner (Yellow Yard) */}
            {playerByColor['yellow'] && (
              <div className="absolute -top-4 sm:-top-5 -left-2 sm:-left-3 z-30 pointer-events-auto">
                {renderCornerBadge('yellow', 'left')}
              </div>
            )}

            {/* Top-Right Corner (Blue Yard) */}
            {playerByColor['blue'] && (
              <div className="absolute -top-4 sm:-top-5 -right-2 sm:-right-3 z-30 pointer-events-auto">
                {renderCornerBadge('blue', 'right')}
              </div>
            )}

            {/* Bottom-Left Corner (Green Yard) */}
            {playerByColor['green'] && (
              <div className="absolute -bottom-4 sm:-bottom-5 -left-2 sm:-left-3 z-30 pointer-events-auto">
                {renderCornerBadge('green', 'left')}
              </div>
            )}

            {/* Bottom-Right Corner (Red Yard) */}
            {playerByColor['red'] && (
              <div className="absolute -bottom-4 sm:-bottom-5 -right-2 sm:-right-3 z-30 pointer-events-auto">
                {renderCornerBadge('red', 'right')}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM CONTROLS (Turn Text, Plush Amber Button, Quick Reactions & Chat) */}
        <div className="w-full flex flex-col items-center mt-2 max-w-sm px-2 z-20">
          {/* Turn Text in cozy warm brown serif */}
          <div className="text-[#523c2d] font-serif font-bold text-sm sm:text-base mb-2 text-center select-none">
            {gameState.winnerColor
              ? `🏆 ${gameState.winnerColor.toUpperCase()} Won the Match!`
              : turnPlayer && !turnPlayer.isConnected
              ? `${turnPlayer.displayName} has left the match • tap below to nudge`
              : isMyTurn
              ? "it's your turn"
              : `it's ${turnPlayer?.displayName?.toLowerCase() || 'partner'}'s turn`}
          </div>

          {/* Large Plush Warm Amber Pill Button matching reference UI */}
          <button
            onClick={() => {
              if (gameState.winnerColor && onRematch) {
                onRematch();
              } else if (canRoll) {
                onRollDice();
              } else if (canMove) {
                // choosing goti
              } else {
                // Friendly partner nudge
                onNudgePlayer?.(turnPlayer?.userId, turnPlayer?.displayName);
                onSendReaction?.('🔔');
                playSound('nudge');
              }
            }}
            className={`w-full max-w-[270px] py-3.5 sm:py-4 rounded-full font-black text-sm sm:text-base tracking-wide transition-all duration-200 select-none shadow-[0_10px_22px_rgba(217,119,6,0.38),inset_0_2px_2px_rgba(255,255,255,0.7),inset_0_-4px_0_rgba(180,83,9,0.55)] active:scale-95 active:shadow-[0_4px_12px_rgba(217,119,6,0.3)] cursor-pointer ${
              canRoll
                ? 'bg-gradient-to-b from-[#fbb040] via-[#f59e0b] to-[#d97706] text-[#3d2708] hover:brightness-105 animate-pulse ring-2 ring-amber-300/70'
                : canMove
                ? 'bg-gradient-to-b from-[#fbb040] via-[#f59e0b] to-[#d97706] text-[#3d2708] hover:brightness-105'
                : gameState.winnerColor
                ? 'bg-gradient-to-b from-[#fbb040] via-[#f59e0b] to-[#d97706] text-[#3d2708] animate-bounce'
                : 'bg-gradient-to-b from-[#fab652] via-[#f5a31a] to-[#de8211] text-[#4a2e05] hover:brightness-105'
            }`}
          >
            {gameState.winnerColor
              ? 'Rematch 🔄'
              : canRoll
              ? 'roll dice'
              : canMove
              ? 'choose goti'
              : turnPlayer && !turnPlayer.isConnected
              ? `nudge ${turnPlayer.displayName.toLowerCase()} 🔔`
              : 'nudge partner 🔔'}
          </button>
        </div>
      </div>
  );
};
