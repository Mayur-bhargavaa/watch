'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PenFightFlickEvent } from '../../../hooks/useGameRoom';

/** the parts of the server's PenFightGameState the screen uses */
interface PenState {
  desk: { width: number; height: number };
  penRadius: number;
  pens: { x: number; y: number; out: boolean }[];
  currentTurnSeat: number;
  round: number;
  roundsToWin: number;
  scores: [number, number];
  flicksThisRound: number;
  maxFlicksPerRound: number;
  winner: 'X' | 'O' | null;
}

interface Props {
  state: PenState | null;
  /** the flick the server just played, with its frames; the board replays it and then calls onReplayDone */
  flick: PenFightFlickEvent | null;
  onReplayDone: () => void;
  /** 0 or 1 for a player, null for a spectator */
  mySeat: number | null;
  canFlick: boolean;
  onFlick: (angle: number, power: number) => void;
  names: [string, string];
}

const MARGIN = 70; // room around the desk so a pen that slides off is still seen
// a pen is drawn as a capsule about as long as 2.4 radii (the physics treats it as a disc of that radius)
const penLen = (radius: number): number => radius * 2.4;
const FULL_DRAG = 230; // dragging this far (desk units) is full power
const COLORS = [
  { body: '#f43f5e', dark: '#9f1239', glow: 'rgba(244,63,94,0.55)' },
  { body: '#38bdf8', dark: '#0c4a6e', glow: 'rgba(56,189,248,0.55)' }
] as const;

type Pt = { x: number; y: number };

/**
 * The Pen Fight desk. A canvas: a wooden school desk seen from above and two pens. On your turn you drag back anywhere on
 * the desk (like a catapult) to aim and set the power, then let go. The server plays the flick and sends the frames; every
 * screen replays them, so both players see exactly the same fight. Pens that slide past the desk edge fall off.
 */
export function PenFightBoard({ state, flick, onReplayDone, mySeat, canFlick, onFlick, names }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const live = useRef({ state, canFlick, mySeat });
  live.current = { state, canFlick, mySeat };
  const pensRef = useRef<Pt[]>([]); // what is drawn right now
  const anglesRef = useRef<number[]>([0, Math.PI]); // the way each pen points
  const fallRef = useRef<number[]>([0, 0]); // 0..1 how far a pen has fallen
  const dragRef = useRef<{ start: Pt; now: Pt } | null>(null);
  const playingRef = useRef(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [aimPower, setAimPower] = useState(0);
  const doneRef = useRef(onReplayDone);
  doneRef.current = onReplayDone;

  const worldW = (state?.desk.width ?? 1000) + MARGIN * 2;
  const worldH = (state?.desk.height ?? 600) + MARGIN * 2;

  // resting pens follow the state whenever nothing is being replayed
  useEffect(() => {
    if (!state || playingRef.current) return;
    pensRef.current = state.pens.map((p) => ({ x: p.x, y: p.y }));
    fallRef.current = state.pens.map((p) => (p.out ? 1 : 0));
  }, [state]);

  // ---- drawing ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const st = live.current.state;
    if (!canvas || !st) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = (cssW * worldH) / worldW;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.height = `${cssH}px`;
    }
    const k = (cssW * dpr) / worldW;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, worldW, worldH);

    const dw = st.desk.width;
    const dh = st.desk.height;
    // desk: warm wood with grain, a bevelled edge and a soft shadow on the floor
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 14;
    roundRect(ctx, MARGIN, MARGIN, dw, dh, 34);
    ctx.fillStyle = '#7a4a24';
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, MARGIN, MARGIN, dw, dh, 34);
    ctx.clip();
    const wood = ctx.createLinearGradient(0, MARGIN, 0, MARGIN + dh);
    wood.addColorStop(0, '#b9803f');
    wood.addColorStop(0.5, '#a56d32');
    wood.addColorStop(1, '#8c5a28');
    ctx.fillStyle = wood;
    ctx.fillRect(MARGIN, MARGIN, dw, dh);
    ctx.strokeStyle = 'rgba(70,38,14,0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const y = MARGIN + 14 + i * (dh / 26) + Math.sin(i * 1.7) * 6;
      ctx.beginPath();
      ctx.moveTo(MARGIN, y);
      ctx.bezierCurveTo(MARGIN + dw * 0.3, y + 10 * Math.sin(i), MARGIN + dw * 0.65, y - 10 * Math.cos(i), MARGIN + dw, y + 4);
      ctx.stroke();
    }
    // doodles and a ruler line, like a real school desk
    ctx.strokeStyle = 'rgba(40,20,8,0.28)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(MARGIN + dw / 2, MARGIN + 18);
    ctx.lineTo(MARGIN + dw / 2, MARGIN + dh - 18);
    ctx.setLineDash([14, 14]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(MARGIN + dw / 2, MARGIN + dh / 2, 54, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,230,190,0.55)';
    ctx.lineWidth = 5;
    roundRect(ctx, MARGIN + 2, MARGIN + 2, dw - 4, dh - 4, 32);
    ctx.stroke();

    // pens
    const pens = pensRef.current.length ? pensRef.current : st.pens;
    for (let i = 0; i < 2; i++) {
      const p = pens[i];
      if (!p) continue;
      const fall = fallRef.current[i] ?? 0;
      const turn = st.currentTurnSeat === i && !st.winner;
      drawPen(ctx, MARGIN + p.x, MARGIN + p.y, anglesRef.current[i], COLORS[i], st.penRadius, fall, turn);
    }

    // aiming: a dotted line and an arrow from your pen, longer the harder you pull
    const drag = dragRef.current;
    const seat = live.current.mySeat;
    if (drag && seat !== null && pens[seat]) {
      const dx = drag.start.x - drag.now.x;
      const dy = drag.start.y - drag.now.y;
      const len = Math.hypot(dx, dy);
      if (len > 6) {
        const power = Math.min(1, len / FULL_DRAG);
        const a = Math.atan2(dy, dx);
        const px = MARGIN + pens[seat].x;
        const py = MARGIN + pens[seat].y;
        const reach = 120 + power * 360;
        ctx.save();
        ctx.strokeStyle = power > 0.85 ? '#fde047' : '#ffffff';
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.setLineDash([2, 16]);
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(a) * (st.penRadius + 6), py + Math.sin(a) * (st.penRadius + 6));
        ctx.lineTo(px + Math.cos(a) * reach, py + Math.sin(a) * reach);
        ctx.stroke();
        ctx.setLineDash([]);
        const ex = px + Math.cos(a) * reach;
        const ey = py + Math.sin(a) * reach;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - Math.cos(a - 0.45) * 26, ey - Math.sin(a - 0.45) * 26);
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - Math.cos(a + 0.45) * 26, ey - Math.sin(a + 0.45) * 26);
        ctx.stroke();
        ctx.restore();
      }
    }
  }, [worldH, worldW]);

  // ---- replaying a flick ----
  const lastPlayed = useRef(0);
  useEffect(() => {
    if (!flick || flick.id === lastPlayed.current) return;
    lastPlayed.current = flick.id;
    const frames = flick.flick.frames;
    const fps = flick.flick.fps || 30;
    if (!frames.length) {
      doneRef.current();
      return;
    }
    playingRef.current = true;
    setBanner(null);
    const total = ((frames.length - 1) / fps) * 1000;
    const start = performance.now();
    let raf = 0;
    let finished = false;
    const prev: Pt[] = [{ x: frames[0][0], y: frames[0][1] }, { x: frames[0][2], y: frames[0][3] }];

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      clearTimeout(safety);
      const last = frames[frames.length - 1];
      pensRef.current = [{ x: last[0], y: last[1] }, { x: last[2], y: last[3] }];
      const deskW = live.current.state?.desk.width ?? 1000;
      const deskH = live.current.state?.desk.height ?? 600;
      const wentOut = pensRef.current.map((p) => p.x < 0 || p.x > deskW || p.y < 0 || p.y > deskH);
      // a pen that slid off falls away for a moment before the next round puts the pens back
      const fallStart = performance.now();
      const fallStep = () => {
        const t = Math.min(1, (performance.now() - fallStart) / 520);
        fallRef.current = wentOut.map((o, i) => (o ? t : fallRef.current[i] ?? 0));
        draw();
        if (t < 1 && wentOut.some(Boolean)) {
          raf = requestAnimationFrame(fallStep);
          return;
        }
        playingRef.current = false;
        fallRef.current = [0, 0];
        doneRef.current();
        if (flick.roundOver) {
          const w = flick.roundOver.winnerSeat;
          setBanner(w === null ? 'Dead even: nobody scores' : `${names[w]} wins the round!`);
          setTimeout(() => setBanner(null), 2200);
        }
      };
      fallStep();
    };
    const safety = setTimeout(finish, total + 1500); // a hidden tab pauses animation frames: never get stuck

    const step = (now: number) => {
      const t = Math.min(total, now - start);
      const f = (t / 1000) * fps;
      const i = Math.min(frames.length - 2, Math.floor(f));
      const frac = f - i;
      const a = frames[i];
      const b = frames[Math.min(frames.length - 1, i + 1)];
      const cur = [
        { x: a[0] + (b[0] - a[0]) * frac, y: a[1] + (b[1] - a[1]) * frac },
        { x: a[2] + (b[2] - a[2]) * frac, y: a[3] + (b[3] - a[3]) * frac }
      ];
      for (let s = 0; s < 2; s++) {
        const dx = cur[s].x - prev[s].x;
        const dy = cur[s].y - prev[s].y;
        if (Math.hypot(dx, dy) > 0.6) anglesRef.current[s] = lerpAngle(anglesRef.current[s], Math.atan2(dy, dx), 0.25);
        prev[s] = cur[s];
      }
      pensRef.current = cur;
      draw();
      if (t >= total) finish();
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(safety);
      if (!finished) {
        playingRef.current = false;
        doneRef.current();
      }
    };
  }, [flick, draw, names]);

  // the ring around the pen whose turn it is pulses: redraw a little while nothing else moves
  useEffect(() => {
    const id = setInterval(() => {
      if (!playingRef.current && !dragRef.current) draw();
    }, 90);
    return () => clearInterval(id);
  }, [draw]);

  // redraw whenever the state changes or the window resizes
  useEffect(() => {
    if (!playingRef.current) draw();
  }, [state, draw, canFlick]);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  // ---- aiming with a finger or the mouse ----
  const toWorld = (e: React.PointerEvent): Pt => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * worldW - MARGIN, y: ((e.clientY - rect.top) / rect.height) * worldH - MARGIN };
  };
  const onDown = (e: React.PointerEvent) => {
    if (!live.current.canFlick || playingRef.current) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = toWorld(e);
    dragRef.current = { start: p, now: p };
    setAimPower(0);
    draw();
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current.now = toWorld(e);
    const d = dragRef.current;
    setAimPower(Math.min(1, Math.hypot(d.start.x - d.now.x, d.start.y - d.now.y) / FULL_DRAG));
    draw();
  };
  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setAimPower(0);
    if (!d || !live.current.canFlick || playingRef.current) return draw();
    const dx = d.start.x - d.now.x;
    const dy = d.start.y - d.now.y;
    const power = Math.min(1, Math.hypot(dx, dy) / FULL_DRAG);
    if (power < 0.08) return draw(); // a tap, not a flick
    onFlick(Math.atan2(dy, dx), power);
    draw();
  };
  const onCancel = () => {
    dragRef.current = null;
    setAimPower(0);
    draw();
  };

  const scores = state?.scores ?? [0, 0];
  const need = state?.roundsToWin ?? 3;
  return (
    <div ref={wrapRef} className="relative w-full select-none">
      {/* round and score */}
      <div className="flex items-center justify-between mb-2 px-1 text-[11px] sm:text-xs font-black tracking-wide uppercase text-white">
        <ScoreDots label={names[0]} won={scores[0]} need={need} color={COLORS[0].body} />
        <span className="px-3 py-1 rounded-full bg-black/40 border border-white/10 font-mono text-amber-300">Round {state?.round ?? 1}</span>
        <ScoreDots label={names[1]} won={scores[1]} need={need} color={COLORS[1].body} right />
      </div>
      <canvas
        ref={canvasRef}
        aria-label="Pen Fight desk. Drag back to aim and let go to flick your pen."
        className={`w-full rounded-3xl bg-[#10121c]/80 border border-white/10 touch-none ${canFlick ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
        style={{ aspectRatio: `${worldW} / ${worldH}`, touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
      />
      {banner && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
          <div className="px-5 py-2 rounded-2xl bg-black/70 border border-amber-400/60 text-amber-200 font-black text-sm sm:text-base shadow-xl animate-in zoom-in-95 duration-200">{banner}</div>
        </div>
      )}
      {/* power meter */}
      <div className="mt-2 flex items-center gap-2 px-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 w-12 shrink-0">Power</span>
        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-rose-500 transition-[width] duration-75" style={{ width: `${Math.round(aimPower * 100)}%` }} />
        </div>
        <span className="text-[10px] font-mono text-zinc-400 w-16 text-right shrink-0">
          {canFlick ? 'drag back, release' : mySeat === null ? 'watching' : state?.winner ? 'match over' : 'their turn'}
        </span>
      </div>
    </div>
  );
}

function ScoreDots({ label, won, need, color, right = false }: { label: string; won: number; need: number; color: string; right?: boolean }) {
  return (
    <div className={`flex items-center gap-2 min-w-0 ${right ? 'flex-row-reverse' : ''}`}>
      <span className="truncate max-w-[84px] sm:max-w-[140px]">{label}</span>
      <span className="flex gap-1 shrink-0">
        {Array.from({ length: need }).map((_, i) => (
          <span key={i} className="w-2.5 h-2.5 rounded-full border" style={{ background: i < won ? color : 'transparent', borderColor: color }} />
        ))}
      </span>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function drawPen(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, c: { body: string; dark: string; glow: string }, radius: number, fall: number, turn: boolean) {
  ctx.save();
  ctx.translate(x, y);
  const scale = 1 - fall * 0.45;
  ctx.globalAlpha = 1 - fall * 0.85;
  ctx.scale(scale, scale);
  if (turn) {
    // whose turn it is: a pulsing ring under the pen
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
    ctx.beginPath();
    ctx.arc(0, 0, radius + 12 + pulse * 6, 0, Math.PI * 2);
    ctx.strokeStyle = c.glow;
    ctx.lineWidth = 6;
    ctx.stroke();
  }
  ctx.rotate(angle);
  const PEN_LEN = penLen(radius);
  const T = radius * 0.9; // thickness
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, -PEN_LEN / 2 + 6, -T * 0.5 + 9, PEN_LEN, T, T / 2);
  ctx.fill();
  // body
  const g = ctx.createLinearGradient(0, -T * 0.5, 0, T * 0.5);
  g.addColorStop(0, c.body);
  g.addColorStop(1, c.dark);
  ctx.fillStyle = g;
  roundRect(ctx, -PEN_LEN / 2, -T * 0.5, PEN_LEN * 0.78, T, T / 2);
  ctx.fill();
  // cone and ink tip
  ctx.beginPath();
  ctx.moveTo(PEN_LEN * 0.26, -T * 0.5);
  ctx.lineTo(PEN_LEN / 2, 0);
  ctx.lineTo(PEN_LEN * 0.26, T * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#e5e7eb';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(PEN_LEN * 0.4, -T * 0.14);
  ctx.lineTo(PEN_LEN / 2, 0);
  ctx.lineTo(PEN_LEN * 0.4, T * 0.14);
  ctx.closePath();
  ctx.fillStyle = '#111827';
  ctx.fill();
  // cap band and a shine
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-PEN_LEN / 2 + 16, -T * 0.5, 8, T);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  roundRect(ctx, -PEN_LEN / 2 + 30, -T * 0.38, PEN_LEN * 0.4, T * 0.16, T * 0.08);
  ctx.fill();
  ctx.restore();
}
