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
  MoreHorizontal,
  Maximize2,
  Minimize2
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

// Fixed pawn slots inside the 4 yards (symmetrically centered around yard hearts at dx, dy = +/- 48px)
const YARD_PAWN_SLOTS: Record<LudoColor, Array<[number, number]>> = {
  red:    [[2.0, 2.0], [2.0, 4.4], [4.4, 2.0], [4.4, 4.4]], // Top-Left (center: 128, 128)
  blue:   [[2.0, 10.6], [2.0, 13.0], [4.4, 10.6], [4.4, 13.0]], // Top-Right (center: 472, 128)
  green:  [[10.6, 2.0], [10.6, 4.4], [13.0, 2.0], [13.0, 4.4]], // Bottom-Left (center: 128, 472)
  yellow: [[10.6, 10.6], [10.6, 13.0], [13.0, 10.6], [13.0, 13.0]] // Bottom-Right (center: 472, 472)
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

  // Corner pods mapped to their physical screen corner under board rotation
  const CORNER_CLASSES: Record<number, { className: string; side: 'left' | 'right' }> = {
    0: { className: 'absolute -top-4 sm:-top-5 -left-2 sm:-left-3 z-30 pointer-events-auto', side: 'left' },
    1: { className: 'absolute -top-4 sm:-top-5 -right-2 sm:-right-3 z-30 pointer-events-auto', side: 'right' },
    2: { className: 'absolute -bottom-4 sm:-bottom-5 -right-2 sm:-right-3 z-30 pointer-events-auto', side: 'right' },
    3: { className: 'absolute -bottom-4 sm:-bottom-5 -left-2 sm:-left-3 z-30 pointer-events-auto', side: 'left' }
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

  // Board Size Mode: Large by default, with optional Cinema / Expanded mode
  const [isCinemaMode, setIsCinemaMode] = useState<boolean>(false);

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
        const t2 = setTimeout(() => setAnimatingPawn(null), 250);
        animTimeoutsRef.current.push(t2);
      }, 200);
      animTimeoutsRef.current.push(t1);
      return;
    }

    // Case 2: Advance on track step by step with clear pause on each box
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
          const finishTimeout = setTimeout(() => setAnimatingPawn(null), 250);
          animTimeoutsRef.current.push(finishTimeout);
          return;
        }

        const nextStep = hopSequence[hopIndex];
        const isFinalStep = hopIndex === hopSequence.length - 1;

        // Step A: Arc hop into the next box (140ms airborne arc)
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

          // Step C: STOP & PAUSE on this box
          hopIndex++;
          const pauseTime = isFinalStep ? 260 : 180;
          const nextHopTimeout = setTimeout(runHop, pauseTime);
          animTimeoutsRef.current.push(nextHopTimeout);
        }, 140);
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
      isMyColor: boolean;
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
        let scale = 1.0;

        if (count > 1 && item.step >= 0) {
          scale = count > 2 ? 0.76 : 0.86;
          if (count === 2) {
            offsetX = indexInGroup === 0 ? -7 : 7;
            offsetY = 0;
          } else if (count === 3) {
            if (indexInGroup === 0) { offsetX = -7; offsetY = -4; }
            else if (indexInGroup === 1) { offsetX = 7; offsetY = -4; }
            else { offsetX = 0; offsetY = 4; }
          } else {
            offsetX = indexInGroup % 2 === 0 ? -6.5 : 6.5;
            offsetY = indexInGroup < 2 ? -4 : 4;
          }
        }

        const finalX = baseX + offsetX;
        const groundY = baseY + offsetY;
        const finalY = (item.isHopping ? baseY - 20 : baseY) + offsetY;

        pawns.push({
          token: item.token,
          x: finalX,
          y: finalY,
          groundY,
          isLegal: item.isLegal,
          isMyColor: item.isMyColor,
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

  // Render sculpted 3D luxury pawn figurine with unique color silhouette, emblems, and crowns
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
            rx="14.5"
            ry="6.2"
            fill="none"
            stroke={neonColor}
            strokeWidth="1.4"
            strokeDasharray="3, 2"
            opacity="0.9"
          />
        )}

        {/* Tier 1: Ambient Base Ground Shadow */}
        <ellipse cx="0" cy="3.5" rx="14" ry="5.5" fill="#000000" opacity="0.38" />
        
        {/* Tier 2: Heavy 24K Gold Beveled Pedestal Ring */}
        <ellipse cx="0" cy="2" rx="13.5" ry="5.2" fill="url(#goldMetallicGradient)" stroke="#78350f" strokeWidth="0.8" />
        
        {/* Tier 3: Upper Beveled Gemstone Base Step */}
        <ellipse cx="0" cy="0.8" rx="11" ry="4.2" fill={headGradient} stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.6" />
        
        {/* Tier 4: Gold Torus Collar Base Rim */}
        <ellipse cx="0" cy="-0.2" rx="8.5" ry="3.0" fill="url(#goldMetallicGradient)" stroke="#92400e" strokeWidth="0.5" />
        {/* Base Specular Gloss Arc */}
        <path d="M -7 -1 A 8 3 0 0 1 7 -1" fill="none" stroke="#ffffff" strokeWidth="0.9" opacity="0.6" />

        {/* Sculpted Flared Pawn Body (Hourglass bell curve seamlessly covering and wrapping the base) */}
        <path
          d="M -8.2 0 C -7.5 -4, -5 -7, -3.6 -9 L 3.6 -9 C 5 -7, 7.5 -4, 8.2 0 C 4.5 2.2, -4.5 2.2, -8.2 0 Z"
          fill={bodyGradient}
        />
        {/* Specular curved vertical gloss streak down the left torso */}
        <path
          d="M -6.2 -0.2 C -5.5 -3.8, -3.2 -6.5, -2.2 -8.5 C -1.5 -8.5, -2.0 -3.8, -4.0 -0.2 Z"
          fill="#ffffff"
          opacity="0.4"
        />
        {/* Ambient shadow gradient down the right contour */}
        <path
          d="M 6.2 -0.2 C 5.5 -3.8, 3.2 -6.5, 2.2 -8.5 C 1.5 -8.5, 2.0 -3.8, 4.0 -0.2 Z"
          fill="#000000"
          opacity="0.25"
        />

        {/* Unique Color Chest Emblem (Instantly reveals goti identity) */}
        {color === 'red' && (
          /* Glowing Royal Ruby Heart Emblem */
          <path
            d="M 0,-2 C 0,-2 -2.8,-4.5 -2.8,-6.2 C -2.8,-7.5 -1.8,-8.2 -0.6,-8.2 C 0,-8.2 0,-7.8 0,-7.8 C 0,-7.8 0,-8.2 0.6,-8.2 C 1.8,-8.2 2.8,-7.5 2.8,-6.2 C 2.8,-4.5 0,-2 0,-2 Z"
            transform="translate(0, 2.5) scale(0.9)"
            fill="#ff2e79"
            stroke="#ffffff"
            strokeWidth="0.5"
          />
        )}
        {color === 'blue' && (
          /* Sapphire Imperial Diamond Emblem */
          <polygon
            points="0,-7 2.8,-4.2 0,-1.4 -2.8,-4.2"
            fill="#38bdf8"
            stroke="#ffffff"
            strokeWidth="0.5"
          />
        )}
        {color === 'green' && (
          /* Emerald 4-Leaf Clover Emblem */
          <g transform="translate(0, -4.2) scale(0.72)">
            <circle cx="-1.8" cy="0" r="1.4" fill="#34d399" />
            <circle cx="1.8" cy="0" r="1.4" fill="#34d399" />
            <circle cx="0" cy="-1.8" r="1.4" fill="#34d399" />
            <circle cx="0" cy="1.8" r="1.4" fill="#34d399" />
            <circle cx="0" cy="0" r="0.8" fill="#ffffff" />
          </g>
        )}
        {color === 'yellow' && (
          /* Golden Star Emblem */
          <polygon
            points="0,-7 1.0,-4.3 3.6,-4.3 1.5,-2.7 2.3,0 0,-1.6 -2.3,0 -1.5,-2.7 -3.6,-4.3 -1.0,-4.3"
            transform="translate(0, 0.4) scale(0.85)"
            fill="#fbbf24"
            stroke="#ffffff"
            strokeWidth="0.4"
          />
        )}

        {/* Lower Polished Gold Torus Waist Ring */}
        <ellipse cx="0" cy="-9" rx="4.8" ry="1.8" fill="url(#goldMetallicGradient)" stroke="#92400e" strokeWidth="0.5" />
        
        {/* Tapered Slender Neck Column */}
        <path d="M -2.6 -9 C -2.6 -12.5, 2.6 -12.5, 2.6 -9 Z" fill={bodyGradient} />

        {/* Upper Gold Neck Collar Bead */}
        <ellipse cx="0" cy="-12.5" rx="4.0" ry="1.5" fill="url(#goldMetallicGradient)" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.8" />

        {/* Spherical Luxury Gemstone Head Knob (Centered at cy=-19.5, r=8.2) */}
        <circle
          cx="0"
          cy="-19.5"
          r="8.2"
          fill={headGradient}
          stroke={isLegal ? '#ffffff' : 'rgba(255,255,255,0.7)'}
          strokeWidth={isLegal ? '2.2' : '1.0'}
        />

        {/* 3D Spherical Specular Highlights (glass reflection & curved gleam) */}
        <circle cx="-2.6" cy="-22.2" r="2.2" fill="#ffffff" opacity="0.95" />
        <circle cx="-0.8" cy="-24.2" r="1.1" fill="#ffffff" opacity="0.85" />
        <ellipse cx="2.5" cy="-16.8" rx="2.0" ry="1.0" transform="rotate(30 2.5 -16.8)" fill="#ffffff" opacity="0.28" />

        {/* Unique Color Head Crown Finials (Distinct silhouettes for every color!) */}
        {color === 'red' && (
          /* Red: Imperial Triple-Peak Royal Crown with glowing Ruby Heart */
          <g transform="translate(0, -27.7)">
            <path d="M -6.5 0 L -8.5 -5.5 L -3.5 -3 L 0 -7 L 3.5 -3 L 8.5 -5.5 L 6.5 0 Z" fill="url(#goldMetallicGradient)" stroke="#ffffff" strokeWidth="0.4" />
            <circle cx="0" cy="-7.8" r="1.5" fill="#ff2e79" stroke="#ffffff" strokeWidth="0.3" />
            <circle cx="-8.5" cy="-5.8" r="0.8" fill="#ffffff" />
            <circle cx="8.5" cy="-5.8" r="0.8" fill="#ffffff" />
          </g>
        )}
        {color === 'blue' && (
          /* Blue: Regal 4-Point Starlight Sapphire Diamond Crest */
          <g transform="translate(0, -27.7)">
            <polygon points="0,-9 3.8,-4.5 8,-3.5 4,-0.5 5,4.5 0,1.2 -5,4.5 -4,-0.5 -8,-3.5 -3.8,-4.5" fill="url(#goldMetallicGradient)" stroke="#ffffff" strokeWidth="0.4" />
            <circle cx="0" cy="-3.5" r="1.6" fill="#38bdf8" stroke="#ffffff" strokeWidth="0.3" />
            <circle cx="0" cy="-9.5" r="0.8" fill="#ffffff" />
          </g>
        )}
        {color === 'green' && (
          /* Green: Celtic Emerald Tri-Spire Laurel Crown */
          <g transform="translate(0, -27.7)">
            <path d="M -6.5 1 C -8 -4.5, -4 -6, -2.5 -3 C -1.2 -8, 1.2 -8, 2.5 -3 C 4 -6, 8 -4.5, 6.5 1 Z" fill="url(#goldMetallicGradient)" stroke="#ffffff" strokeWidth="0.4" />
            <circle cx="-6" cy="-5.5" r="1.0" fill="#ffffff" />
            <circle cx="0" cy="-8.5" r="1.5" fill="#34d399" stroke="#ffffff" strokeWidth="0.3" />
            <circle cx="6" cy="-5.5" r="1.0" fill="#ffffff" />
          </g>
        )}
        {color === 'yellow' && (
          /* Yellow: Radiant Solar Sunburst Crown with golden rays & amber jewel */
          <g transform="translate(0, -27.7)">
            <polygon points="0,-9.5 2.2,-4.5 7,-6 4,-1.5 7,2 2.2,1 0,5 -2.2,1 -7,2 -4,-1.5 -7,-6 -2.2,-4.5" fill="url(#goldMetallicGradient)" stroke="#ffffff" strokeWidth="0.4" />
            <circle cx="0" cy="-2" r="1.8" fill="#fbbf24" stroke="#ffffff" strokeWidth="0.4" />
            <circle cx="0" cy="-10" r="0.8" fill="#ffffff" />
          </g>
        )}
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
    <div className="flex flex-col items-center justify-between w-full max-w-5xl xl:max-w-6xl mx-auto select-none relative">
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
      <div
        className={`relative w-full ${
          isCinemaMode
            ? 'max-w-[min(98vw,520px)] sm:max-w-[640px] md:max-w-[720px] lg:max-w-[800px] xl:max-w-[880px]'
            : 'max-w-[min(94vw,460px)] sm:max-w-[560px] md:max-w-[620px] lg:max-w-[680px] xl:max-w-[740px]'
        } flex flex-col items-center select-none my-6 sm:my-8 transition-all duration-300`}
      >

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
            viewBox="0 0 600 600"
            className="w-full h-full rounded-[26px] overflow-visible shadow-[inset_0_0_25px_rgba(0,0,0,0.9)] border border-[#2b2535]"
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
              </defs>

              {/* Board Base Surface: Dark Obsidian Slate with Dual Golden Inlay and Corner Filigree */}
              <rect width="600" height="600" fill="#0b0d14" />
              <rect x="4" y="4" width="592" height="592" rx="26" fill="#131622" stroke="#2c2838" strokeWidth="2" />
              <rect x="10" y="10" width="580" height="580" rx="22" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="1.8" opacity="0.85" />
              <rect x="14" y="14" width="572" height="572" rx="18" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="0.8" strokeDasharray="5, 4" opacity="0.6" />

              {/* 4 Ornate Golden Corner Filigree Brackets */}
              <path d="M 12 36 L 12 24 A 12 12 0 0 1 24 12 L 36 12 M 16 32 L 16 26 A 10 10 0 0 1 26 16 L 32 16" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="1.5" />
              <path d="M 588 36 L 588 24 A 12 12 0 0 0 576 12 L 564 12 M 584 32 L 584 26 A 10 10 0 0 0 574 16 L 568 16" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="1.5" />
              <path d="M 12 564 L 12 576 A 12 12 0 0 0 24 588 L 36 588 M 16 568 L 16 574 A 10 10 0 0 0 26 584 L 32 584" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="1.5" />
              <path d="M 588 564 L 588 576 A 12 12 0 0 1 576 588 L 564 588 M 584 568 L 584 574 A 10 10 0 0 1 574 584 L 568 584" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="1.5" />

              {/* Rotated Board Play Surface (active player yard always faces bottom-left) */}
              <g transform={boardRotation ? `rotate(${boardRotation}, 300, 300)` : undefined}>
                {/* 1. YARDS (4 Luxury Royal Palace Chambers with 3D Pedestals & Illuminated Crests) */}
                {/* Red Yard (Top-Left in base coordinates) */}
                <g>
                  <rect x="16" y="16" width="224" height="224" rx="24" fill="url(#rubyYardGrad)" stroke="#ff2e79" strokeWidth="2.5" filter="url(#trayInnerShadow)" />
                  <rect x="20" y="20" width="216" height="216" rx="20" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="1.2" opacity="0.65" />
                  <rect x="23" y="23" width="210" height="210" rx="17" fill="none" stroke="#ff2e79" strokeWidth="0.8" opacity="0.4" strokeDasharray="4, 3" />
                  {/* Concentric ornamental quadrant arcs */}
                  <circle cx="128" cy="128" r="82" fill="none" stroke="#ff2e79" strokeWidth="0.5" opacity="0.25" />
                  <circle cx="128" cy="128" r="56" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="0.6" opacity="0.3" strokeDasharray="2, 2" />

                  {/* Glowing Royal Red/Pink Heart Crest with Crown */}
                  <g transform={`translate(128, 128) rotate(${-boardRotation})`}>
                    <circle cx="0" cy="0" r="42" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="0.8" strokeDasharray="3, 3" opacity="0.65" />
                    <circle cx="0" cy="0" r="33" fill="none" stroke="#ff2e79" strokeWidth="1.2" opacity="0.5" />
                    <g transform="scale(1.45)">
                      <path
                        d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                        fill="rgba(255, 46, 121, 0.15)"
                        stroke="#ff2e79"
                        strokeWidth="3.2"
                        filter="url(#neonGlowPink)"
                      />
                      <path
                        d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.2"
                        opacity="0.9"
                      />
                      {/* Imperial Crown atop Heart */}
                      <path
                        d="M -7 -17 L -10 -24 L -3.5 -20.5 L 0 -26 L 3.5 -20.5 L 10 -24 L 7 -17 Z"
                        fill="url(#goldMetallicGradient)"
                        stroke="#ffffff"
                        strokeWidth="0.4"
                      />
                      <circle cx="0" cy="-26" r="0.8" fill="#ffffff" />
                    </g>
                  </g>

                  {/* 4 3D Recessed Gold Socket Pedestals */}
                  {YARD_PAWN_SLOTS.red.map((slot, i) => (
                    <g key={`ry-${i}`} filter="url(#pedestalRingShadow)">
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="19.5" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="1.8" />
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="17.8" fill="#1c0308" filter="url(#recessedSaucerShadow)" />
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="15.8" fill="url(#rubyYardGrad)" stroke="#ff2e79" strokeWidth="0.8" opacity="0.85" />
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="12" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" strokeDasharray="2, 2" />
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="2.5" fill="url(#goldMetallicGradient)" opacity="0.7" />
                    </g>
                  ))}
                </g>

                {/* Blue Yard (Top-Right in base coordinates) */}
                <g>
                  <rect x="360" y="16" width="224" height="224" rx="24" fill="url(#sapphireYardGrad)" stroke="#38bdf8" strokeWidth="2.5" filter="url(#trayInnerShadow)" />
                  <rect x="364" y="20" width="216" height="216" rx="20" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="1.2" opacity="0.65" />
                  <rect x="367" y="23" width="210" height="210" rx="17" fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.4" strokeDasharray="4, 3" />
                  {/* Concentric ornamental quadrant arcs */}
                  <circle cx="472" cy="128" r="82" fill="none" stroke="#38bdf8" strokeWidth="0.5" opacity="0.25" />
                  <circle cx="472" cy="128" r="56" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="0.6" opacity="0.3" strokeDasharray="2, 2" />

                  {/* Glowing Royal Blue Heart Crest with Crown */}
                  <g transform={`translate(472, 128) rotate(${-boardRotation})`}>
                    <circle cx="0" cy="0" r="42" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="0.8" strokeDasharray="3, 3" opacity="0.65" />
                    <circle cx="0" cy="0" r="33" fill="none" stroke="#38bdf8" strokeWidth="1.2" opacity="0.5" />
                    <g transform="scale(1.45)">
                      <path
                        d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                        fill="rgba(56, 189, 248, 0.15)"
                        stroke="#38bdf8"
                        strokeWidth="3.2"
                        filter="url(#neonGlowBlue)"
                      />
                      <path
                        d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.2"
                        opacity="0.9"
                      />
                      {/* Imperial Crown atop Heart */}
                      <path
                        d="M -7 -17 L -10 -24 L -3.5 -20.5 L 0 -26 L 3.5 -20.5 L 10 -24 L 7 -17 Z"
                        fill="url(#goldMetallicGradient)"
                        stroke="#ffffff"
                        strokeWidth="0.4"
                      />
                      <circle cx="0" cy="-26" r="0.8" fill="#ffffff" />
                    </g>
                  </g>

                  {/* 4 3D Recessed Gold Socket Pedestals */}
                  {YARD_PAWN_SLOTS.blue.map((slot, i) => (
                    <g key={`by-${i}`} filter="url(#pedestalRingShadow)">
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="19.5" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="1.8" />
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="17.8" fill="#030d21" filter="url(#recessedSaucerShadow)" />
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="15.8" fill="url(#sapphireYardGrad)" stroke="#38bdf8" strokeWidth="0.8" opacity="0.85" />
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="12" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" strokeDasharray="2, 2" />
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="2.5" fill="url(#goldMetallicGradient)" opacity="0.7" />
                    </g>
                  ))}
                </g>

                {/* Green Yard (Bottom-Left in base coordinates) */}
                <g>
                  <rect x="16" y="360" width="224" height="224" rx="24" fill="url(#emeraldYardGrad)" stroke="#10b981" strokeWidth="2.5" filter="url(#trayInnerShadow)" />
                  <rect x="20" y="364" width="216" height="216" rx="20" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="1.2" opacity="0.65" />
                  <rect x="23" y="367" width="210" height="210" rx="17" fill="none" stroke="#10b981" strokeWidth="0.8" opacity="0.4" strokeDasharray="4, 3" />
                  {/* Concentric ornamental quadrant arcs */}
                  <circle cx="128" cy="472" r="82" fill="none" stroke="#10b981" strokeWidth="0.5" opacity="0.25" />
                  <circle cx="128" cy="472" r="56" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="0.6" opacity="0.3" strokeDasharray="2, 2" />

                  {/* Glowing Royal Green Heart Crest with Crown */}
                  <g transform={`translate(128, 472) rotate(${-boardRotation})`}>
                    <circle cx="0" cy="0" r="42" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="0.8" strokeDasharray="3, 3" opacity="0.65" />
                    <circle cx="0" cy="0" r="33" fill="none" stroke="#10b981" strokeWidth="1.2" opacity="0.5" />
                    <g transform="scale(1.45)">
                      <path
                        d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                        fill="rgba(52, 211, 153, 0.15)"
                        stroke="#34d399"
                        strokeWidth="3.2"
                        filter="url(#neonGlowGreen)"
                      />
                      <path
                        d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.2"
                        opacity="0.9"
                      />
                      {/* Imperial Crown atop Heart */}
                      <path
                        d="M -7 -17 L -10 -24 L -3.5 -20.5 L 0 -26 L 3.5 -20.5 L 10 -24 L 7 -17 Z"
                        fill="url(#goldMetallicGradient)"
                        stroke="#ffffff"
                        strokeWidth="0.4"
                      />
                      <circle cx="0" cy="-26" r="0.8" fill="#ffffff" />
                    </g>
                  </g>

                  {/* 4 3D Recessed Gold Socket Pedestals */}
                  {YARD_PAWN_SLOTS.green.map((slot, i) => (
                    <g key={`gy-${i}`} filter="url(#pedestalRingShadow)">
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="19.5" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="1.8" />
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="17.8" fill="#02140a" filter="url(#recessedSaucerShadow)" />
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="15.8" fill="url(#emeraldYardGrad)" stroke="#10b981" strokeWidth="0.8" opacity="0.85" />
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="12" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" strokeDasharray="2, 2" />
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="2.5" fill="url(#goldMetallicGradient)" opacity="0.7" />
                    </g>
                  ))}
                </g>

                {/* Yellow Yard (Bottom-Right in base coordinates) */}
                <g>
                  <rect x="360" y="360" width="224" height="224" rx="24" fill="url(#amberYardGrad)" stroke="#f59e0b" strokeWidth="2.5" filter="url(#trayInnerShadow)" />
                  <rect x="364" y="364" width="216" height="216" rx="20" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="1.2" opacity="0.65" />
                  <rect x="367" y="367" width="210" height="210" rx="17" fill="none" stroke="#f59e0b" strokeWidth="0.8" opacity="0.4" strokeDasharray="4, 3" />
                  {/* Concentric ornamental quadrant arcs */}
                  <circle cx="472" cy="472" r="82" fill="none" stroke="#f59e0b" strokeWidth="0.5" opacity="0.25" />
                  <circle cx="472" cy="472" r="56" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="0.6" opacity="0.3" strokeDasharray="2, 2" />

                  {/* Glowing Royal Gold Heart Crest with Crown */}
                  <g transform={`translate(472, 472) rotate(${-boardRotation})`}>
                    <circle cx="0" cy="0" r="42" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="0.8" strokeDasharray="3, 3" opacity="0.65" />
                    <circle cx="0" cy="0" r="33" fill="none" stroke="#fbbf24" strokeWidth="1.2" opacity="0.5" />
                    <g transform="scale(1.45)">
                      <path
                        d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                        fill="rgba(251, 191, 36, 0.15)"
                        stroke="#fbbf24"
                        strokeWidth="3.2"
                        filter="url(#neonGlowGold)"
                      />
                      <path
                        d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.2"
                        opacity="0.9"
                      />
                      {/* Imperial Crown atop Heart */}
                      <path
                        d="M -7 -17 L -10 -24 L -3.5 -20.5 L 0 -26 L 3.5 -20.5 L 10 -24 L 7 -17 Z"
                        fill="url(#goldMetallicGradient)"
                        stroke="#ffffff"
                        strokeWidth="0.4"
                      />
                      <circle cx="0" cy="-26" r="0.8" fill="#ffffff" />
                    </g>
                  </g>

                  {/* 4 3D Recessed Gold Socket Pedestals */}
                  {YARD_PAWN_SLOTS.yellow.map((slot, i) => (
                    <g key={`yy-${i}`} filter="url(#pedestalRingShadow)">
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="19.5" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="1.8" />
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="17.8" fill="#1c1001" filter="url(#recessedSaucerShadow)" />
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="15.8" fill="url(#amberYardGrad)" stroke="#f59e0b" strokeWidth="0.8" opacity="0.85" />
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="12" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" strokeDasharray="2, 2" />
                      <circle cx={slot[1] * 40} cy={slot[0] * 40} r="2.5" fill="url(#goldMetallicGradient)" opacity="0.7" />
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

                    {/* Start tile golden royal emblem badge */}
                    {(isRedStart || isBlueStart || isYellowStart || isGreenStart) && (
                      <circle
                        cx={tileX + 18}
                        cy={tileY + 18}
                        r="14"
                        fill="none"
                        stroke="url(#goldMetallicGradient)"
                        strokeWidth="1"
                        opacity="0.6"
                      />
                    )}

                    {/* Gleaming 3D Embossed Golden Star on Safe Haven Tiles */}
                    {isSafe && (
                      <g transform={`translate(${tileX}, ${tileY})`}>
                        {/* Golden celestial radiance glow */}
                        <circle cx="18" cy="18" r="14" fill="url(#starGoldGlow)" opacity="0.35" />
                        {/* Drop shadow star */}
                        <polygon
                          points="18,5 21.5,13.5 30.5,14.5 24,20.5 26,29.5 18,25 10,29.5 12,20.5 5.5,14.5 14.5,13.5"
                          transform="translate(0, 1.2)"
                          fill="#451a03"
                          opacity="0.5"
                        />
                        {/* 3D 24K Gold Embossed Star Body */}
                        <polygon
                          points="18,5 21.5,13.5 30.5,14.5 24,20.5 26,29.5 18,25 10,29.5 12,20.5 5.5,14.5 14.5,13.5"
                          fill="url(#goldMetallicGradient)"
                          stroke="#fffbeb"
                          strokeWidth="1"
                          strokeLinejoin="round"
                        />
                        {/* Internal golden star facets */}
                        <polygon
                          points="18,18 18,5 21.5,13.5"
                          fill="#ffffff"
                          opacity="0.4"
                        />
                        <polygon
                          points="18,18 30.5,14.5 24,20.5"
                          fill="#78350f"
                          opacity="0.3"
                        />
                        <polygon
                          points="18,18 26,29.5 18,25"
                          fill="#78350f"
                          opacity="0.3"
                        />
                        <polygon
                          points="18,18 10,29.5 12,20.5"
                          fill="#ffffff"
                          opacity="0.35"
                        />
                        <polygon
                          points="18,18 5.5,14.5 14.5,13.5"
                          fill="#ffffff"
                          opacity="0.45"
                        />
                        {/* Central sparkling gem pip */}
                        <circle cx="18" cy="18" r="2.2" fill="#ffffff" filter="url(#goldGlowFilter)" />
                      </g>
                    )}
                  </g>
                );
              })}

              {/* 3. HOME RUNWAYS (Directional Jeweled Runway Tiles with Golden Chevrons) */}
              {/* Red Home Runway (Points Right: -> towards center) */}
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

              {/* Blue Home Runway (Points Down: v towards center) */}
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

              {/* Yellow Home Runway (Points Left: <- towards center) */}
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

              {/* Green Home Runway (Points Up: ^ towards center) */}
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

              {/* 4. CENTER HOME TRIANGLES & IMPERIAL VICTORY SANCTUARY */}
              <g filter="url(#trayInnerShadow)">
                <polygon points="240,240 300,300 240,360" fill="url(#rubyTileGrad)" stroke="#4c0519" strokeWidth="1.2" />
                <polygon points="240,240 300,300 360,240" fill="url(#sapphireTileGrad)" stroke="#082f49" strokeWidth="1.2" />
                <polygon points="360,240 300,300 360,360" fill="url(#amberTileGrad)" stroke="#451a03" strokeWidth="1.2" />
                <polygon points="240,360 300,300 360,360" fill="url(#emeraldTileGrad)" stroke="#022c22" strokeWidth="1.2" />
              </g>

              {/* 24K Gold Separator Struts between 4 Home Triangles */}
              <line x1="240" y1="240" x2="360" y2="360" stroke="url(#goldMetallicGradient)" strokeWidth="2.4" strokeLinecap="round" />
              <line x1="240" y1="360" x2="360" y2="240" stroke="url(#goldMetallicGradient)" strokeWidth="2.4" strokeLinecap="round" />

              {/* Imperial Victory Medallion with Radiant Golden Rosette and Ruby Heart */}
              <g transform={`translate(300, 300) rotate(${-boardRotation})`}>
                {/* Outer Golden Rosette Ring */}
                <circle cx="0" cy="0" r="38" fill="none" stroke="url(#goldMetallicGradient)" strokeWidth="2" opacity="0.8" />
                <circle cx="0" cy="0" r="34" fill="none" stroke="#fbbf24" strokeWidth="0.8" strokeDasharray="3, 3" opacity="0.6" />
                {/* 8-Point Golden Star Behind Heart */}
                <polygon
                  points="0,-32 8,-12 30,-12 14,3 20,24 0,12 -20,24 -14,3 -30,-12 -8,-12"
                  fill="url(#goldMetallicGradient)"
                  stroke="#ffffff"
                  strokeWidth="0.6"
                  opacity="0.85"
                />
                <circle cx="0" cy="0" r="22" fill="#180408" opacity="0.85" stroke="url(#goldMetallicGradient)" strokeWidth="1.2" />

                {/* Radiant Glowing Neon Ruby Heart */}
                <g transform="translate(0, -2) scale(1.35)">
                  <path
                    d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                    fill="rgba(255, 23, 68, 0.3)"
                    stroke="#ff1744"
                    strokeWidth="3.6"
                    filter="url(#neonGlowRedCenter)"
                  />
                  <path
                    d="M 0,16 C 0,16 -16,4 -16,-6 C -16,-13 -10,-17 -3,-17 C 0,-17 0,-14 0,-14 C 0,-14 0,-17 3,-17 C 10,-17 16,-13 16,-6 C 16,4 0,16 0,16 Z"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.4"
                    opacity="0.95"
                  />
                </g>
              </g>

              {/* 5. 3D EMBOSSED LUXURY PAWNS WITH REALISTIC SHADOWS */}
              {renderedPawns.map(({ token, x, y, groundY, isLegal, isMyColor, color, isHopping, scale }) => {
                const cfg = COLOR_CONFIG[color];

                return (
                  <g
                    key={`pawn-${color}-${token.id}`}
                    className={isLegal ? 'cursor-pointer' : ''}
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
                        transition: isHopping ? 'transform 0.15s ease-out' : 'transform 0.1s ease-in'
                      }}
                    >
                      <ellipse
                        cx={0}
                        cy={2}
                        rx={(isHopping ? 16 : 14) * scale}
                        ry={(isHopping ? 7.5 : 5.8) * scale}
                        fill="#000000"
                        opacity={isHopping ? 0.12 : 0.38}
                        filter="url(#castShadowBlur)"
                        style={{ transition: 'all 0.14s ease' }}
                      />
                      <ellipse
                        cx={0}
                        cy={2}
                        rx={11 * scale}
                        ry={4.5 * scale}
                        fill="#000000"
                        opacity={isHopping ? 0.18 : 0.55}
                        filter="url(#contactShadowBlur)"
                        style={{ transition: 'all 0.14s ease' }}
                      />
                    </g>

                    {/* B. Legal Move Ground Selection Halo */}
                    {isLegal && !isHopping && (
                      <g transform={`translate(${x}, ${groundY}) rotate(${-boardRotation})`}>
                        <ellipse
                          cx={0}
                          cy={2}
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
                          cy={2}
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

                    {/* C. 3D Luxury Figurine Pawn Body (counter-rotated to stay perfectly upright) */}
                    <g
                      transform={`translate(${x}, ${y}) rotate(${-boardRotation}) scale(${scale})`}
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
                          {renderLuxuryPawn(color, isLegal, isMyColor)}
                        </g>
                      ) : (
                        renderLuxuryPawn(color, isLegal, isMyColor)
                      )}
                    </g>
                  </g>
                );
              })}
              </g>
            </svg>

            {/* 4 Corner Player Pods dynamically placed according to board perspective rotation */}
            {(['red', 'blue', 'yellow', 'green'] as LudoColor[]).map((col) => {
              if (!playerByColor[col]) return null;
              const corner = getPhysicalCorner(col);
              return (
                <div key={`corner-${col}`} className={corner.className}>
                  {renderCornerBadge(col, corner.side)}
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM CONTROLS MATCHING REFERENCE IMAGE (Undo button, Large Glowing Red Dice, Emoji button, Board Size toggle) */}
        <div className="w-full flex flex-col items-center mt-4 sm:mt-6 max-w-md sm:max-w-lg px-2 z-20">
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

          {/* 4-Control Bottom Panel */}
          <div className="w-full flex items-center justify-center gap-4 sm:gap-7">
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
                    // Friendly nudge (notifies only recipient)
                    onNudgePlayer?.(turnPlayer?.userId, turnPlayer?.displayName);
                    setJustNudged(true);
                    setTimeout(() => setJustNudged(false), 2500);
                  }
                }}
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center transition-all duration-200 select-none cursor-pointer active:scale-95 ${
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
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#ff4777] to-[#be123c] border border-white/40 shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_4px_10px_rgba(0,0,0,0.4)] flex items-center justify-center transform-gpu">
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
                  : justNudged
                  ? 'NUDGED! 🔔'
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

            {/* 4. Far Right: Board Size Toggle Button */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => setIsCinemaMode(prev => !prev)}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#121422]/90 backdrop-blur-md border ${
                  isCinemaMode ? 'border-amber-400/80 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.4)]' : 'border-white/20 text-white/80'
                } shadow-[0_4px_15px_rgba(0,0,0,0.5)] flex items-center justify-center hover:text-white hover:border-white/40 active:scale-95 transition cursor-pointer`}
                title={isCinemaMode ? 'Switch to Standard Size' : 'Switch to Cinema / Extra Large Size'}
              >
                {isCinemaMode ? (
                  <Minimize2 className="w-5 h-5 text-amber-300" />
                ) : (
                  <Maximize2 className="w-5 h-5 text-white/90" />
                )}
              </button>
              <span className={`text-[10px] font-bold tracking-widest uppercase ${
                isCinemaMode ? 'text-amber-300' : 'text-white/60'
              }`}>
                {isCinemaMode ? 'EXPAND' : 'BIG'}
              </span>
            </div>
          </div>
        </div>
      </div>
  );
};
