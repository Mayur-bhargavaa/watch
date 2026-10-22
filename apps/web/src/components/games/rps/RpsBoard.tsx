'use client';

import React, { useEffect, useState } from 'react';
import type { RpsChoice, RpsGameState } from '@synccinema/common';
import { CHOICE_LIST, countdownWord, formatLabel, isRpsLive, isRpsState, opponentStatus, outcomeFor, outcomeText, phaseSeconds } from '../../../lib/rpsView';

/** Hand-drawn icons: a rock, a sheet of paper and a pair of scissors (not emoji, so they look the same on every device). */
export function ChoiceIcon({ choice, className = 'w-full h-full' }: { choice: RpsChoice | null; className?: string }) {
  if (choice === 'rock') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden>
        <path d="M10 40c-2-9 2-19 11-24 8-4 17-3 24 2 8 5 12 14 9 23-2 6-8 10-15 10H24c-7 0-13-3-14-11z" fill="#9ca3af" />
        <path d="M21 16c8-4 17-3 24 2l-9 5-8-2z" fill="#d1d5db" />
        <path d="M14 40c1 6 5 8 10 8h12l-6-9-9 1z" fill="#6b7280" />
        <path d="M30 28l7 6-4 7" stroke="#4b5563" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  if (choice === 'paper') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden>
        <path d="M16 8h24l12 12v34a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3z" fill="#f8fafc" />
        <path d="M40 8l12 12H43a3 3 0 0 1-3-3z" fill="#cbd5e1" />
        <path d="M21 28h22M21 35h22M21 42h15" stroke="#94a3b8" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (choice === 'scissors') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden>
        <path d="M24 10l16 26-5 3L19 13z" fill="#e5e7eb" />
        <path d="M40 10L24 36l5 3 16-26z" fill="#cbd5e1" />
        <circle cx="21" cy="47" r="8" fill="none" stroke="#f43f5e" strokeWidth="5" />
        <circle cx="43" cy="47" r="8" fill="none" stroke="#fb7185" strokeWidth="5" />
        <circle cx="32" cy="33" r="2.6" fill="#64748b" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="6 8" opacity="0.5" />
      <text x="32" y="41" textAnchor="middle" fontSize="28" fontWeight="900" fill="currentColor" opacity="0.7">?</text>
    </svg>
  );
}

interface Props {
  state: RpsGameState | null;
  /** 0 or 1 for a player, null for a spectator */
  mySeat: number | null;
  online: boolean;
  clockOffsetMs: number;
  /** my own pick for the open round (private: the server never sends me the other player's) */
  myPick: { roundId: string; choice: string | null; locked: boolean } | null;
  onChoose: (roundId: string, choice: RpsChoice) => void;
  onLock: (roundId: string, choice: RpsChoice) => void;
  names: [string, string];
}

/** one seconds counter that follows the server deadline (never a timer started on this device) */
function useSeconds(state: RpsGameState | null, clockOffsetMs: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  const live = !!state && isRpsLive(state) && !!state.deadlineAt;
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    const wake = () => setNow(Date.now());
    document.addEventListener('visibilitychange', wake);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', wake); };
  }, [live, state?.deadlineAt]);
  return phaseSeconds(state, now, clockOffsetMs);
}

/**
 * The Rock Paper Scissors arena: score strip, a synchronized countdown, three big choice buttons with a Lock button, the other
 * player's status ("Choosing..." / "Locked"), then the reveal of both choices and the round result. It only draws what the
 * server sends: the other player's choice does not exist on this device until the reveal.
 */
export function RpsBoard({ state: incoming, mySeat, online, clockOffsetMs, myPick, onChoose, onLock, names }: Props) {
  const state = isRpsState(incoming) ? incoming : null;
  const seconds = useSeconds(state, clockOffsetMs);
  // my pick for THIS round only (a pick from an earlier round never carries over)
  const mine = state && myPick && myPick.roundId === state.roundId ? myPick : null;
  const [local, setLocal] = useState<{ roundId: string; choice: RpsChoice } | null>(null);
  useEffect(() => { if (state && local && local.roundId !== state.roundId) setLocal(null); }, [state, local]);
  if (!state) {
    return incoming ? (
      <p role="alert" className="mx-auto max-w-xs text-center text-sm font-semibold text-amber-200 p-4 rounded-2xl bg-black/40 border border-amber-400/40">
        This room is not a Rock Paper Scissors match. Leave and start a new game.
      </p>
    ) : null;
  }

  const player = mySeat === 0 || mySeat === 1;
  const picked = (local && local.roundId === state.roundId ? local.choice : (mine?.choice as RpsChoice | null)) ?? null;
  const locked = !!mine?.locked || (player && state.locked[mySeat as number]);
  const choosing = state.status === 'choosing';
  const canPick = player && online && choosing && !locked;
  const reveal = state.reveal;
  const outcome = outcomeFor(reveal, mySeat);
  const opp = opponentStatus(state, mySeat);
  const showReveal = (state.status === 'revealing' || state.status === 'round-result' || state.status === 'match-result') && !!reveal;
  const total = state.chooseSeconds || 10;
  const barPct = choosing && seconds !== null ? Math.max(0, Math.min(100, (seconds / total) * 100)) : 0;
  const seatName = (s: number) => names[s] || `Player ${s + 1}`;

  const pick = (c: RpsChoice) => {
    if (!canPick) return;
    setLocal({ roundId: state.roundId, choice: c });
    onChoose(state.roundId, c);
  };

  return (
    <div className="w-full max-w-[min(94vw,460px)] mx-auto select-none touch-manipulation">
      {/* match, round and score */}
      <div className="flex items-center justify-between rounded-2xl bg-black/40 border border-white/10 px-3 py-2 mb-3 text-white">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">{formatLabel(state.format)}</div>
          <div className="text-xs font-bold">Round {state.round}</div>
        </div>
        <div className="flex items-center gap-3 font-black tabular-nums" aria-label={`Score ${state.scores[0]} to ${state.scores[1]}`}>
          <span className="text-rose-300 text-lg">{state.scores[0]}</span>
          <span className="text-zinc-500 text-xs">-</span>
          <span className="text-cyan-300 text-lg">{state.scores[1]}</span>
        </div>
      </div>

      <div className="relative rounded-[28px] p-4 sm:p-5 bg-[#10121c]/90 border border-white/15 shadow-2xl min-h-[300px] flex flex-col items-center justify-center gap-4">
        {/* countdown */}
        {state.status === 'countdown' && (
          <div className="flex flex-col items-center gap-2" role="timer" aria-live="polite" aria-label={`Round starts in ${seconds ?? 0}`}>
            <div className="text-xs font-black tracking-widest text-zinc-300 uppercase">Round {state.round}</div>
            <div key={countdownWord(seconds)} className="text-7xl sm:text-8xl font-black text-white motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300" style={{ textShadow: '0 0 40px rgba(244,63,94,0.6)' }}>
              {countdownWord(seconds)}
            </div>
            <div className="text-xs text-zinc-400">Pick in secret. Reveal together.</div>
          </div>
        )}

        {/* choosing */}
        {choosing && (
          <>
            <div className="w-full">
              <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                <span className="text-amber-300 uppercase tracking-wider">{player ? (locked ? 'Choice locked' : 'Choose now') : 'Players are choosing'}</span>
                <span role="timer" aria-label={`${seconds ?? 0} seconds left`} className={`font-mono tabular-nums ${seconds !== null && seconds <= 3 ? 'text-rose-300' : 'text-white'}`}>{seconds ?? 0}s</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-rose-500 transition-[width] duration-200" style={{ width: `${barPct}%` }} /></div>
            </div>

            <div role="radiogroup" aria-label="Your choice" className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full">
              {CHOICE_LIST.map((c) => {
                const on = picked === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={c.label}
                    disabled={!canPick}
                    onClick={() => pick(c.id)}
                    className={`relative aspect-square rounded-2xl border flex flex-col items-center justify-center gap-1 p-2 outline-none focus-visible:ring-4 focus-visible:ring-amber-300/70 motion-safe:transition-all motion-safe:duration-150 ${
                      on
                        ? locked
                          ? 'bg-emerald-500/20 border-emerald-300 shadow-lg shadow-emerald-500/20 scale-105'
                          : 'bg-amber-400/20 border-amber-300 shadow-lg shadow-amber-500/20 scale-105'
                        : canPick
                        ? 'bg-white/[0.05] border-white/15 hover:bg-white/10 active:scale-95 cursor-pointer'
                        : 'bg-white/[0.03] border-white/10 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span className="block w-3/5"><ChoiceIcon choice={c.id} /></span>
                    <span className="text-[11px] font-black uppercase tracking-wide text-white">{c.label}</span>
                    {on && locked && <span className="absolute top-1.5 right-1.5 text-[9px] font-black text-emerald-200">LOCKED</span>}
                  </button>
                );
              })}
            </div>

            {player ? (
              <button
                type="button"
                disabled={!canPick || !picked}
                onClick={() => picked && onLock(state.roundId, picked)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-400 text-white font-black text-sm tracking-wide shadow-lg cursor-pointer disabled:cursor-not-allowed active:scale-[0.98] motion-safe:transition"
              >
                {locked ? 'Locked in' : picked ? 'Lock Choice' : 'Pick one first'}
              </button>
            ) : null}

            {opp && (
              <div className="flex items-center gap-2 text-xs font-semibold" aria-live="polite">
                <span className={`w-2 h-2 rounded-full ${opp === 'locked' ? 'bg-emerald-400' : 'bg-amber-300 motion-safe:animate-pulse'}`} />
                <span className="text-zinc-200">{opp === 'locked' ? 'Opponent has locked their choice' : 'Opponent is choosing...'}</span>
              </div>
            )}
          </>
        )}

        {/* the reveal and the result */}
        {showReveal && reveal && (
          <div className="w-full flex flex-col items-center gap-4" aria-live="polite">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 w-full">
              {[0, 1].map((seat) => (
                <React.Fragment key={seat}>
                  {seat === 1 && <span className="text-zinc-500 font-black text-sm">VS</span>}
                  <div className={`flex flex-col items-center gap-1.5 ${seat === 0 ? 'motion-safe:animate-in motion-safe:slide-in-from-left-6' : 'motion-safe:animate-in motion-safe:slide-in-from-right-6'} motion-safe:duration-300`}>
                    <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl border flex items-center justify-center p-3 ${reveal.winnerSeat === seat ? 'bg-amber-400/20 border-amber-300 shadow-xl shadow-amber-500/25' : 'bg-white/[0.05] border-white/15'}`}>
                      <ChoiceIcon choice={reveal.choices[seat]} />
                    </div>
                    <div className="text-[11px] font-black text-white truncate max-w-[110px]">{seatName(seat)}{mySeat === seat ? ' (You)' : ''}</div>
                    <div className="text-[10px] uppercase tracking-wide text-zinc-400">{reveal.choices[seat] ?? (reveal.timedOut.includes(seat) ? 'no choice' : '')}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
            {(state.status === 'round-result' || state.status === 'match-result') && (
              <div className="text-center">
                <div className={`text-3xl font-black ${outcome === 'win' ? 'text-emerald-300' : outcome === 'lose' ? 'text-rose-300' : 'text-amber-200'}`}>
                  {outcome ? outcomeText(outcome) : reveal.winnerSeat === null ? 'Draw' : `${seatName(reveal.winnerSeat)} wins the round`}
                </div>
                {reveal.reason === 'timeout-award' && <div className="text-[11px] text-zinc-300 mt-1">The other player ran out of time.</div>}
                {reveal.reason === 'timeout-draw' && <div className="text-[11px] text-zinc-300 mt-1">Nobody locked a choice in time.</div>}
                {state.status === 'round-result' && <div className="text-xs text-zinc-400 mt-2">Next round in {seconds ?? 0}...</div>}
              </div>
            )}
          </div>
        )}

        {/* a match that ended without a reveal (cancelled, or forfeited before the first one) */}
        {!showReveal && (state.status === 'cancelled' || state.status === 'forfeit') && (
          <p className="text-center text-sm font-bold text-white" aria-live="polite">{state.statusMessage}</p>
        )}
      </div>
    </div>
  );
}
