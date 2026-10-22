'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ZeroCrossGameState } from '@synccinema/common';
import { actionForTap, formatClock, isLive, isZeroCrossState, markOfSeat, movablePieces, newMoveId, ROW_COL, secondsLeft, targetCells, type ZeroMark } from '../../../lib/zeroCrossView';

type Action = { kind: 'place'; to: number } | { kind: 'move'; from: number; to: number };

interface BoardProps {
  state: ZeroCrossGameState | null;
  /** 0 or 1 for a player, null for a spectator (who can only watch) */
  mySeat: number | null;
  /** the connection is open */
  online: boolean;
  /** how far this device's clock is from the server's */
  clockOffsetMs: number;
  onAct: (action: Action, moveId: string, baseVersion: number) => void;
  /** a rejection coming from the server: the board shakes and says why */
  rejection: { id: number; message: string } | null;
  names: { X: string; O: string };
}

const MARK_LABEL: Record<ZeroMark, string> = { X: 'Cross', O: 'Zero' };

/** The mark, drawn in a different SHAPE as well as a different colour (a cross and a ring), so colour is never the only difference. */
function Piece({ mark, selected, ghost = false }: { mark: ZeroMark; selected?: boolean; ghost?: boolean }) {
  const tone = mark === 'X' ? 'from-rose-400 to-rose-600 text-rose-100' : 'from-cyan-300 to-sky-500 text-cyan-950';
  return (
    <span
      aria-hidden
      className={`relative flex shrink-0 items-center justify-center rounded-full w-[62%] aspect-square bg-gradient-to-br ${tone} shadow-lg ring-2 ${selected ? 'ring-amber-300 scale-110' : 'ring-white/25'} ${ghost ? 'opacity-30' : ''} motion-safe:transition-transform motion-safe:duration-200`}
    >
      {mark === 'X' ? (
        <svg viewBox="0 0 24 24" className="w-1/2 h-1/2" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" className="w-1/2 h-1/2" fill="none" stroke="currentColor" strokeWidth="3.4"><circle cx="12" cy="12" r="6.5" /></svg>
      )}
    </span>
  );
}

/** the match clock, counted down from the server's deadline (never from a timer started on this device) */
export function ZeroCrossClock({ state: incoming, clockOffsetMs }: { state: ZeroCrossGameState | null; clockOffsetMs: number }) {
  const state = isZeroCrossState(incoming) ? incoming : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!state?.deadlineAt || !isLive(state)) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    // a tab that was asleep recalculates the moment it wakes
    const wake = () => setNow(Date.now());
    document.addEventListener('visibilitychange', wake);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', wake); };
  }, [state]);
  const left = secondsLeft(state, now, clockOffsetMs);
  const low = left !== null && left <= 30 && isLive(state);
  return (
    <span
      role="timer"
      aria-label={left === null ? 'No match timer' : `Time left ${formatClock(left)}`}
      className={`font-mono font-black tabular-nums text-sm sm:text-base ${low ? 'text-rose-300 motion-safe:animate-pulse' : 'text-amber-200'}`}
    >
      {formatClock(left)}
    </span>
  );
}

/**
 * The Zero Cross board: 3 x 3, three pieces each. While pieces are being placed, tap an empty square. After that, tap one of your
 * own pieces and then ANY empty square to move it. The server checks every move; this only draws the board and sends the taps.
 */
export function ZeroCrossBoard({ state: incoming, mySeat, online, clockOffsetMs, onAct, rejection, names }: BoardProps) {
  // a room made before Zero Cross had its own rules holds an old-format state: never draw (or crash on) that
  const state = isZeroCrossState(incoming) ? incoming : null;
  const [selected, setSelected] = useState<number | null>(null);
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bump = () => {
    setShaking(true);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShaking(false), 380);
  };
  useEffect(() => () => { if (shakeTimer.current) clearTimeout(shakeTimer.current); }, []);
  const myMark = markOfSeat(mySeat);
  const live = isLive(state);
  const myTurn = !!state && !!myMark && live && state.currentTurnMark === myMark;

  // drop a selection that no longer makes sense (the turn passed, the match ended, my piece is gone)
  useEffect(() => {
    if (selected === null) return;
    if (!state || !myMark || !myTurn || state.board[selected] !== myMark) setSelected(null);
  }, [state, myMark, myTurn, selected]);
  // an illegal move comes back from the server: shake the board
  const lastRejection = useRef(0);
  useEffect(() => {
    if (rejection && rejection.id !== lastRejection.current) {
      lastRejection.current = rejection.id;
      bump();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejection]);

  const targets = useMemo(() => (state && myMark ? new Set(targetCells(state, myMark, selected)) : new Set<number>()), [state, myMark, selected]);
  const movable = useMemo(() => (state && myMark ? new Set(movablePieces(state, myMark)) : new Set<number>()), [state, myMark]);

  if (!state) {
    return incoming ? (
      <p role="alert" className="mx-auto max-w-xs text-center text-sm font-semibold text-amber-200 p-4 rounded-2xl bg-black/40 border border-amber-400/40">
        This match was started by an older version of Zero Cross. Leave and start a new game to play with the new rules.
      </p>
    ) : null;
  }
  const winning = new Set(state.winningLine ?? []);
  const last = state.lastMove;

  const tap = (cell: number) => {
    if (!myMark || !online) return;
    const step = actionForTap(state, myMark, selected, cell);
    if (!step) {
      bump();
      return;
    }
    if (step.type === 'select') setSelected(step.cell);
    else if (step.type === 'deselect') setSelected(null);
    else {
      setSelected(null);
      onAct(step.action, newMoveId(), state.version);
    }
  };

  const phaseText = !live
    ? 'Match over'
    : state.phase === 'placement'
      ? myTurn ? `Place a piece (${state.remainingPlacements[myMark as ZeroMark]} left)` : `${names[state.currentTurnMark]} is placing a piece`
      : myTurn ? (selected === null ? 'Pick up one of your pieces' : 'Now tap any empty square') : `${names[state.currentTurnMark]} is moving a piece`;

  return (
    <div className="w-full max-w-[min(92vw,420px)] mx-auto select-none touch-manipulation">
      {/* pieces each player still has to place */}
      <div className="flex items-center justify-between mb-2 px-1">
        {(['X', 'O'] as const).map((m) => (
          <div key={m} className="flex items-center gap-1.5" aria-label={`${names[m]} (${MARK_LABEL[m]}) has ${state.remainingPlacements[m]} pieces left to place`}>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-300">{MARK_LABEL[m]}</span>
            <span className="flex gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i} className={`w-2.5 h-2.5 rounded-full border ${m === 'X' ? 'border-rose-400' : 'border-cyan-300'} ${i < state.remainingPlacements[m] ? (m === 'X' ? 'bg-rose-400' : 'bg-cyan-300') : 'bg-transparent opacity-40'}`} />
              ))}
            </span>
          </div>
        ))}
      </div>

      <div
        role="grid"
        aria-label="Zero Cross board"
        className={`relative aspect-square w-full rounded-[24px] sm:rounded-[32px] p-3 sm:p-4 bg-[#10121c]/90 border border-white/15 shadow-2xl ${shaking ? 'motion-safe:animate-[zcshake_0.35s_ease-in-out]' : ''}`}
      >
        <div className="grid grid-cols-3 grid-rows-3 gap-2 sm:gap-3 w-full h-full">
          {state.board.map((cell, idx) => {
            const isTarget = targets.has(idx);
            const isMovable = movable.has(idx);
            const isSel = selected === idx;
            const isWin = winning.has(idx);
            const isLast = last?.to === idx;
            const wasFrom = last?.from === idx && cell === null;
            const disabled = !myMark || !online || !live || !myTurn;
            const label = cell
              ? `${ROW_COL(idx)}: ${MARK_LABEL[cell]} piece${isSel ? ', selected' : ''}${isMovable && !isSel ? ', you can move it' : ''}`
              : `${ROW_COL(idx)}: empty${isTarget ? ', you can go here' : ''}`;
            return (
              <button
                key={idx}
                type="button"
                role="gridcell"
                aria-label={label}
                aria-pressed={cell ? isSel : undefined}
                aria-disabled={disabled}
                onClick={() => tap(idx)}
                className={`relative rounded-xl sm:rounded-2xl flex items-center justify-center border motion-safe:transition-all motion-safe:duration-200 outline-none focus-visible:ring-4 focus-visible:ring-amber-300/70 ${
                  isWin
                    ? 'bg-amber-500/25 border-amber-400 shadow-xl shadow-amber-500/30'
                    : isSel
                    ? 'bg-amber-400/15 border-amber-300'
                    : isTarget
                    ? 'bg-emerald-400/10 border-emerald-300/70 border-dashed cursor-pointer'
                    : isLast
                    ? 'bg-white/[0.07] border-white/30'
                    : 'bg-white/[0.04] border-white/10'
                } ${disabled || (!isTarget && !isMovable && !isSel && cell === null) ? 'cursor-default' : 'cursor-pointer active:scale-95'}`}
              >
                {cell ? (
                  <span className={`flex h-full w-full items-center justify-center ${isLast ? 'motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300' : ''}`}>
                    <Piece mark={cell} selected={isSel} />
                  </span>
                ) : wasFrom ? (
                  <span className="flex h-full w-full items-center justify-center"><Piece mark={last!.seat === 0 ? 'X' : 'O'} ghost /></span>
                ) : isTarget ? (
                  <span aria-hidden className="w-3 h-3 rounded-full bg-emerald-300/80 motion-safe:animate-pulse" />
                ) : null}
                {isMovable && !isSel && (
                  <span aria-hidden className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-300 motion-safe:animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-2.5 text-center text-xs sm:text-sm font-semibold text-zinc-200 min-h-[1.25rem]" aria-live="polite">
        {rejection ? <span className="text-rose-300">{rejection.message}</span> : phaseText}
      </p>
      <style>{`@keyframes zcshake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}`}</style>
    </div>
  );
}
