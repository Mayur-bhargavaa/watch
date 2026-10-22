'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CLASH_COLORS } from '@synccinema/common';
import type { ClashCard, ClashColor, ClashPlayerView, ClashPublicState } from '@synccinema/common';
import { COLOR_HEX, cardLabel, eventText, isClashState, isLive, seatsAround, sortHand, turnPrompt, turnSeconds, type TablePosition } from '../../../lib/clashView';
import { newMoveId } from '../../../lib/zeroCrossView';
import { ClashCardBack, ClashCardFace } from './ClashCard';

/** the colour chooser after a Wild: four big buttons with the colour NAME on each (not colour alone) */
export function ColorPickerDialog({ onPick, onCancel }: { onPick: (c: ClashColor) => void; onCancel: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cc-color-title" onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}>
      <div className="w-[calc(100vw-2rem)] max-w-xs rounded-3xl p-5 bg-[#161220] border border-white/20 text-white shadow-2xl space-y-3">
        <h3 id="cc-color-title" className="text-lg font-black text-center">Choose a colour</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {CLASH_COLORS.map((c, i) => (
            <button
              key={c}
              ref={i === 0 ? first : undefined}
              type="button"
              onClick={() => onPick(c)}
              className="h-16 rounded-2xl border-2 border-white/40 font-black text-sm tracking-wide shadow-lg active:scale-95 outline-none focus-visible:ring-4 focus-visible:ring-amber-300/80 cursor-pointer"
              style={{ background: `linear-gradient(145deg,${COLOR_HEX[c].from},${COLOR_HEX[c].to})`, color: COLOR_HEX[c].ink }}
            >
              {COLOR_HEX[c].name}
            </button>
          ))}
        </div>
        <button type="button" onClick={onCancel} className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer">Keep my card</button>
      </div>
    </div>
  );
}

function Avatar({ name, url, size = 'w-10 h-10' }: { name: string; url?: string | null; size?: string }) {
  return (
    <span className={`${size} rounded-full overflow-hidden border-2 border-white/30 bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white font-black text-sm shrink-0`}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : (name[0] || '?').toUpperCase()}
    </span>
  );
}

/** one opponent: avatar, name, how many cards (backs only), the last-card badge and a Catch button when they can be caught */
function Opponent({ p, current, position, avatar, canCatch, onCatch, connected }: { p: ClashPlayerView; current: boolean; position: TablePosition; avatar?: string | null; canCatch: boolean; onCatch: () => void; connected: boolean }) {
  const shown = Math.min(p.cards, 6);
  return (
    <div
      className={`flex min-w-0 max-w-full flex-col items-center gap-1 rounded-2xl px-1.5 py-1 sm:px-2.5 sm:py-1.5 border motion-safe:transition-all ${current ? 'bg-rose-500/20 border-rose-400 shadow-lg shadow-rose-500/25' : 'bg-black/35 border-white/10'} ${position === 'left' ? 'self-start' : position === 'right' ? 'self-end' : ''}`}
      aria-label={`${p.displayName}, ${p.cards} cards${p.declared ? ', last card declared' : ''}${current ? ', their turn' : ''}${connected ? '' : ', disconnected'}`}
    >
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <span className="relative shrink-0"><Avatar name={p.displayName} url={avatar} size="w-8 h-8 sm:w-10 sm:h-10" />{!connected && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-zinc-500 border border-black" title="Disconnected" />}</span>
        <div className="min-w-0 text-left">
          <div className="text-[11px] sm:text-xs font-black text-white truncate max-w-[56px] sm:max-w-[120px]">{p.displayName}</div>
          <div className="text-[10px] font-mono text-rose-200 whitespace-nowrap">{p.cards} {p.cards === 1 ? 'card' : 'cards'}</div>
        </div>
      </div>
      <div className="flex -space-x-3 justify-center" aria-hidden>
        {Array.from({ length: shown }).map((_, i) => <ClashCardBack key={i} size="mini" />)}
      </div>
      {p.declared && p.cards <= 2 && <span className="text-[9px] font-black text-amber-300 tracking-wide">LAST CARD!</span>}
      {canCatch && (
        <button type="button" onClick={onCatch} className="mt-0.5 px-2.5 py-1 rounded-full bg-amber-400 text-black text-[10px] font-black cursor-pointer animate-pulse motion-reduce:animate-none active:scale-95 outline-none focus-visible:ring-4 focus-visible:ring-amber-200">
          Catch! (no Last Card)
        </button>
      )}
    </div>
  );
}

interface Props {
  state: ClashPublicState | null;
  online: boolean;
  clockOffsetMs: number;
  connectedIds: ReadonlySet<string>;
  avatarOf?: (userId: string) => string | null | undefined;
  onPlay: (card: ClashCard, color: ClashColor | undefined, moveId: string, baseVersion: number) => void;
  onDraw: (moveId: string, baseVersion: number) => void;
  onPass: (moveId: string, baseVersion: number) => void;
  onDeclare: () => void;
  onCatch: (seat: number) => void;
  onChallenge: (moveId: string, baseVersion: number) => void;
  /** a rejection from the server to show (the table shakes) */
  rejection?: { id: number; message: string } | null;
}

/**
 * The card table. Opponents sit around it with face-down cards only; the draw and discard piles are in the middle with the active
 * colour and the direction; your own hand is at the bottom (scroll sideways when it is long). It sends what you tap and draws what
 * the server answers: which cards are playable, whose turn it is and the clock all come from the server.
 */
export function ClashTable({ state: incoming, online, clockOffsetMs, connectedIds, avatarOf, onPlay, onDraw, onPass, onDeclare, onCatch, onChallenge, rejection }: Props) {
  const state = isClashState(incoming) ? incoming : null;
  const [selected, setSelected] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<ClashCard | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // one request per table version: a second tap while the answer is on its way is ignored (the server also ignores a repeated move id)
  const sentFor = useRef<number>(-1);
  const sentAt = useRef<number>(0);
  const [toast, setToast] = useState<string | null>(null);
  const lastEvent = useRef<string>('');

  useEffect(() => {
    if (!state || !isLive(state) || (!state.deadlineAt && !state.lastCardWindow)) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    const wake = () => setNow(Date.now());
    document.addEventListener('visibilitychange', wake);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', wake); };
  }, [state]);

  // the server said no: the player may act again at once
  useEffect(() => { if (rejection) sentFor.current = -1; }, [rejection]);

  // forget a selection that no longer makes sense (the turn passed, the card is gone or not playable)
  useEffect(() => {
    if (!state) return;
    if (selected && !state.playable.includes(selected)) setSelected(null);
    if (pickFor && !state.playable.includes(pickFor.id)) setPickFor(null);
  }, [state, selected, pickFor]);

  // say what just happened, briefly
  useEffect(() => {
    if (!state?.lastEvent) return;
    const text = eventText(state.lastEvent, state.players);
    const key = `${state.version}:${text}`;
    if (!text || key === lastEvent.current) return;
    lastEvent.current = key;
    setToast(text);
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [state]);

  const hand = useMemo(() => sortHand(state?.myHand ?? []), [state?.myHand]);
  if (!state) {
    return incoming ? (
      <p role="alert" className="mx-auto max-w-xs text-center text-sm font-semibold text-amber-200 p-4 rounded-2xl bg-black/40 border border-amber-400/40">
        This room is not a Color Clash game. Leave and start a new one.
      </p>
    ) : null;
  }

  const live = isLive(state);
  const me = state.mySeat !== null;
  const myTurn = live && me && state.currentSeat === state.mySeat;
  const prompt = turnPrompt(state);
  const seconds = turnSeconds(state, now, clockOffsetMs);
  const low = seconds !== null && seconds <= 8 && live;
  const around = seatsAround(state.players, state.mySeat);
  const canAct = online && live && me;
  // true when nothing has been sent for this table yet (or the answer is late: 1.5 s later the player may try again)
  const free = () => sentFor.current !== state.version || Date.now() - sentAt.current > 1500;
  const markSent = () => { sentFor.current = state.version; sentAt.current = Date.now(); };

  const playCard = (card: ClashCard, color?: ClashColor) => {
    if (!canAct || !free()) return;
    markSent();
    setSelected(null);
    setPickFor(null);
    onPlay(card, color, newMoveId(), state.version);
  };
  const tapCard = (card: ClashCard) => {
    if (!canAct || !state.playable.includes(card.id)) return;
    if (selected !== card.id) { setSelected(card.id); return; }
    if (card.color === null) setPickFor(card);
    else playCard(card);
  };
  const confirmSelected = () => {
    const card = hand.find((c) => c.id === selected);
    if (!card) return;
    if (card.color === null) setPickFor(card);
    else playCard(card);
  };
  const draw = () => { if (canAct && state.canDraw && free()) { markSent(); setSelected(null); onDraw(newMoveId(), state.version); } };
  const pass = () => { if (canAct && state.canPass && free()) { markSent(); onPass(newMoveId(), state.version); } };
  const challenge = () => { if (canAct && state.canChallengeWild && free()) { markSent(); onChallenge(newMoveId(), state.version); } };

  const catchSeats = new Set(state.catchable);
  const slot = (pos: TablePosition) => around.find((a) => a.position === pos);
  const opp = (pos: TablePosition) => {
    const a = slot(pos);
    return a ? (
      <Opponent p={a.player} current={live && state.currentSeat === a.player.seat} position={pos} avatar={avatarOf?.(a.player.userId)} canCatch={catchSeats.has(a.player.seat)} onCatch={() => onCatch(a.player.seat)} connected={connectedIds.has(a.player.userId)} />
    ) : null;
  };
  const selectedCard = hand.find((c) => c.id === selected) ?? null;

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-2 sm:gap-3 select-none touch-manipulation" aria-label="Color Clash table">
      {/* turn line, clock, direction */}
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-black/40 border border-white/10 px-3 py-2">
        <div className="min-w-0 flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${prompt.tone === 'you' ? 'bg-emerald-400 motion-safe:animate-pulse' : prompt.tone === 'over' ? 'bg-zinc-500' : 'bg-amber-300'}`} />
          <p className={`text-[11px] sm:text-sm font-black truncate ${prompt.tone === 'you' ? 'text-emerald-200' : 'text-white'}`} aria-live="polite">{prompt.text}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] font-bold text-zinc-300 flex items-center gap-1" title={state.direction === 1 ? 'Clockwise' : 'Counter-clockwise'} aria-label={state.direction === 1 ? 'Direction: clockwise' : 'Direction: counter-clockwise'}>
            <svg viewBox="0 0 24 24" className={`w-4 h-4 ${state.direction === 1 ? '' : '-scale-x-100'}`} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5" /></svg>
          </span>
          <span role="timer" aria-label={seconds === null ? 'No turn timer' : `${seconds} seconds left`} className={`font-mono font-black tabular-nums text-sm ${low ? 'text-rose-300 motion-safe:animate-pulse' : 'text-amber-200'}`}>{seconds === null ? '--' : `${seconds}s`}</span>
        </div>
      </div>

      {/* the table: opponents around the piles */}
      <div className="relative rounded-[28px] p-2.5 pb-9 sm:p-4 sm:pb-10 bg-[#10121c]/85 border border-white/15 shadow-2xl">
        <div className="flex justify-center min-h-[64px]">{opp('top')}</div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 py-2 sm:py-3">
          <div className="flex min-w-0">{opp('left')}</div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-3 sm:gap-5">
              <button type="button" onClick={draw} disabled={!canAct || !state.canDraw} aria-label={`Draw pile, ${state.drawCount} cards`} className={`relative rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-amber-300/80 ${canAct && state.canDraw ? 'cursor-pointer ring-2 ring-emerald-300/80 motion-safe:animate-pulse' : 'cursor-default opacity-90'} active:scale-95`}>
                <ClashCardBack label={`Draw pile, ${state.drawCount} cards`} />
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 rounded-full bg-black/80 border border-white/20 text-[10px] font-mono text-white">{state.drawCount}</span>
              </button>
              <div className="relative shrink-0" aria-label={`Top of the pile: ${cardLabel(state.top)}. Active colour ${COLOR_HEX[state.activeColor].name}`}>
                <span className="absolute -inset-1.5 rounded-2xl" style={{ boxShadow: `0 0 0 3px ${COLOR_HEX[state.activeColor].from}, 0 0 22px ${COLOR_HEX[state.activeColor].from}88` }} aria-hidden />
                <ClashCardFace card={state.top} size="pile" chosen={state.top.color === null ? state.activeColor : null} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-200" data-testid="active-color">
              <span className="w-3.5 h-3.5 rounded-full border border-white/70" style={{ background: COLOR_HEX[state.activeColor].from }} aria-hidden />
              Active colour: {COLOR_HEX[state.activeColor].name}
            </div>
          </div>
          <div className="flex min-w-0 justify-end">{opp('right')}</div>
        </div>
        {slot('bottom') && <div className="flex justify-center">{opp('bottom')}</div>}
        {toast && <p className="absolute left-1/2 -translate-x-1/2 bottom-1 max-w-[92%] px-3 py-1 rounded-full bg-black/80 border border-white/20 text-[11px] font-semibold text-white text-center motion-safe:animate-in motion-safe:fade-in" role="status">{toast}</p>}
        {rejection && <p className="absolute left-1/2 -translate-x-1/2 top-1 px-3 py-1 rounded-full bg-rose-950/90 border border-rose-400/50 text-[11px] font-semibold text-rose-200" role="alert">{rejection.message}</p>}
      </div>

      {/* what you can do */}
      {me && live && (
        <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Actions">
          {selectedCard && myTurn && (
            <button type="button" onClick={confirmSelected} className="px-4 h-10 rounded-full bg-emerald-500 text-black text-xs font-black cursor-pointer active:scale-95 outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">
              Play {cardLabel(selectedCard)}
            </button>
          )}
          <button type="button" onClick={draw} disabled={!canAct || !state.canDraw} className="px-4 h-10 rounded-full bg-white/10 border border-white/20 text-white text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 outline-none focus-visible:ring-4 focus-visible:ring-amber-300/80">
            {state.turnPhase === 'challenge' ? 'Draw 4' : 'Draw card'}
          </button>
          {state.canChallengeWild && (
            <button type="button" onClick={challenge} className="px-4 h-10 rounded-full bg-amber-400 text-black text-xs font-black cursor-pointer active:scale-95 outline-none focus-visible:ring-4 focus-visible:ring-amber-200">Challenge +4</button>
          )}
          {state.canPass && (
            <button type="button" onClick={pass} className="px-4 h-10 rounded-full bg-white/10 border border-white/20 text-white text-xs font-black cursor-pointer active:scale-95 outline-none focus-visible:ring-4 focus-visible:ring-amber-300/80">Pass</button>
          )}
          {state.canDeclare && (
            <button type="button" onClick={onDeclare} disabled={!online} className={`px-4 h-10 rounded-full bg-[#ee1d49] text-white text-xs font-black cursor-pointer active:scale-95 outline-none focus-visible:ring-4 focus-visible:ring-rose-200 ${(state.myHand?.length ?? 9) <= 2 ? 'motion-safe:animate-pulse' : ''}`}>
              LAST CARD!
            </button>
          )}
        </div>
      )}

      {/* your hand */}
      {me && (
        <div className="rounded-2xl bg-black/35 border border-white/10 px-2 pt-6 pb-2 sm:pt-7" aria-label={`Your hand, ${hand.length} cards`}>
          <div role="list" className="flex gap-1.5 sm:gap-2 overflow-x-auto snap-x px-1 pb-1 pt-2 justify-start [@media(min-width:640px)]:justify-center">
            {hand.map((card) => {
              const playable = canAct && state.playable.includes(card.id);
              return (
                <div role="listitem" key={card.id} className="snap-center shrink-0">
                  <ClashCardFace card={card} playable={playable} selected={selected === card.id} dim={live && !playable} onClick={() => tapCard(card)} />
                </div>
              );
            })}
            {hand.length === 0 && <p className="text-xs text-zinc-400 py-6 mx-auto">No cards left</p>}
          </div>
        </div>
      )}
      {!me && <p className="text-center text-xs text-zinc-300">You are watching. Only the players can move.</p>}

      {pickFor && <ColorPickerDialog onPick={(c) => playCard(pickFor, c)} onCancel={() => setPickFor(null)} />}
    </div>
  );
}
