'use client';

import React, { useState } from 'react';
import type { MurderGameView, MurderScoreRow } from '@synccinema/common';
import { AppIcon } from '../../ui/AppIcon';
import { ImposterPlayerChip } from '../imposter/ImposterPlayerChip';
import { REVEAL_STEPS, characterName, playerName, pointsBreakdown, resultHeadline, sortRows, stepVisible } from '../../../lib/murderMysteryView';

const CARD = 'rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4';
const LABEL = 'mb-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const BODY = 'text-xs leading-relaxed text-zinc-800 dark:text-zinc-100';

/** Everyone's accusation and points (public once the result is out). */
export const MurderRowsTable: React.FC<{ view: MurderGameView; rows: MurderScoreRow[]; myUserId: string }> = ({ view, rows, myUserId }) => (
  <ul className="space-y-1" data-testid="murder-rows">
    {sortRows(rows).map((r) => (
      <li key={r.userId} className={`rounded-xl border px-2.5 py-1.5 ${r.userId === myUserId ? 'border-[#ee1d49]' : 'border-zinc-200 dark:border-white/10'} bg-zinc-50 dark:bg-[#1b1c24]`}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="w-5 shrink-0 text-center font-mono text-[11px] font-bold text-zinc-500 dark:text-zinc-400">{r.rank}</span>
            <ImposterPlayerChip name={r.displayName} avatarUrl={r.avatarUrl} left={r.left} size="sm" isMe={r.userId === myUserId} />
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-zinc-900 dark:text-white">{r.displayName}{r.userId === myUserId ? ' (You)' : ''}</span>
              <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                {characterName(view, r.characterId)}{r.isMurderer ? ' - the murderer' : ''}
              </span>
            </span>
          </span>
          <span className="shrink-0 font-mono text-sm font-bold text-zinc-900 dark:text-white">{r.total}</span>
        </div>
        <p className="mt-1 flex items-start gap-1.5 text-[11px] text-zinc-700 dark:text-zinc-200">
          <AppIcon name={r.correct ? 'check' : 'close'} className={`mt-0.5 h-3 w-3 shrink-0 ${r.correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`} />
          <span>
            {r.accusedCharacterId ? `Accused ${characterName(view, r.accusedCharacterId)}${r.accusedMotive ? `: "${r.accusedMotive}"` : ''}` : 'Did not accuse anyone'}
            <span className="text-zinc-500 dark:text-zinc-400"> ({pointsBreakdown(r)})</span>
          </span>
        </p>
      </li>
    ))}
  </ul>
);

/** The secrets of every character (motive, alibi and what really happened, personal secret). */
export const MurderSecretsList: React.FC<{ view: MurderGameView }> = ({ view }) => {
  const r = view.result;
  if (!r) return null;
  return (
    <ul className="grid gap-1.5 md:grid-cols-2" data-testid="murder-secrets">
      {r.characters.map((c) => (
        <li key={c.id} className={`rounded-xl border p-2.5 ${c.isMurderer ? 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-950/40' : 'border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-[#1b1c24]'}`}>
          <p className="flex items-center justify-between gap-2 text-xs font-bold text-zinc-900 dark:text-white">
            <span className="truncate">{c.name}</span>
            <span className="shrink-0 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
              {c.withdrawn ? 'Left the party' : playerName(view.players, c.userId)}
            </span>
          </p>
          {c.isMurderer && <p className="text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-300">The murderer</p>}
          <p className={`${BODY} mt-1`}><strong>Motive:</strong> {c.secretMotive}</p>
          <p className={BODY}><strong>Alibi said:</strong> {c.alibi}</p>
          <p className={BODY}><strong>The truth:</strong> {c.alibiTruth}</p>
          <p className={BODY}><strong>Secret:</strong> {c.secret}</p>
        </li>
      ))}
    </ul>
  );
};

export const MurderTimeline: React.FC<{ timeline: string[] }> = ({ timeline }) => (
  <ol className="space-y-1" data-testid="murder-timeline">
    {timeline.map((t, i) => (
      <li key={i} className="flex items-start gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-800 dark:bg-[#1b1c24] dark:text-zinc-100">
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-700 dark:bg-[#22232c] dark:text-zinc-200">{i + 1}</span>
        <span>{t}</span>
      </li>
    ))}
  </ol>
);

interface MurderResultProps {
  view: MurderGameView;
  myUserId: string;
  isSpectator: boolean;
  isHost: boolean;
  onNext: () => void;
}

/** RESULT: the reveal, one step at a time (murderer, motive, method, then everyone's secrets, accusations and points). */
export const MurderResult: React.FC<MurderResultProps> = ({ view, myUserId, isSpectator, isHost, onNext }) => {
  const r = view.result;
  const [reached, setReached] = useState(0);
  if (!r) return null;
  const last = REVEAL_STEPS.length - 1;
  const murderer = r.characters.find((c) => c.id === r.murdererCharacterId);
  const done = reached >= last;

  return (
    <div className="space-y-2.5" data-testid="murder-result">
      <div className={`${CARD} text-center`}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">The truth</p>
        <h2 className="mt-0.5 text-xl font-bold text-zinc-900 dark:text-white sm:text-2xl">{resultHeadline(view, myUserId, isSpectator)}</h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{r.correctCount} of {r.otherCount} {r.otherCount === 1 ? 'player' : 'players'} named the murderer.{r.murdererSurvived ? ' The murderer got away with it.' : ''}</p>
      </div>

      <div className={`${CARD} space-y-2`}>
        {stepVisible(reached, 'murderer') && (
          <div data-testid="reveal-murderer" className="rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-500/40 dark:bg-red-950/40">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-300"><AppIcon name="skull" className="h-3.5 w-3.5" />The murderer</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-white">{murderer?.name || characterName(view, r.murdererCharacterId)}</p>
            <p className="text-xs text-zinc-700 dark:text-zinc-200">Played by {playerName(view.players, r.murdererUserId)}</p>
          </div>
        )}
        {stepVisible(reached, 'motive') && (
          <div data-testid="reveal-motive" className="rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 dark:border-white/10 dark:bg-[#1b1c24]"><p className={LABEL}>The motive</p><p className={BODY}>{r.motive}</p></div>
        )}
        {stepVisible(reached, 'method') && (
          <div data-testid="reveal-method" className="rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 dark:border-white/10 dark:bg-[#1b1c24]">
            <p className={LABEL}>The method</p><p className={BODY}>{r.method}</p>
            {r.summary && <p className={`${BODY} mt-1 text-zinc-600 dark:text-zinc-300`}>{r.summary}</p>}
          </div>
        )}
        {stepVisible(reached, 'secrets') && (
          <div data-testid="reveal-secrets">
            <p className={LABEL}>Everyone&apos;s secrets</p>
            <MurderSecretsList view={view} />
          </div>
        )}
        {stepVisible(reached, 'accusations') && (
          <div data-testid="reveal-accusations">
            <p className={LABEL}>Accusations and points</p>
            <MurderRowsTable view={view} rows={r.rows} myUserId={myUserId} />
            {r.timeline.length > 0 && (<><p className={`${LABEL} mt-2`}>What really happened</p><MurderTimeline timeline={r.timeline} /></>)}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
          {!done ? (
            <>
              <button type="button" onClick={() => setReached((n) => Math.min(last, n + 1))} className="h-9 flex-1 rounded-xl bg-[#ee1d49] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#14151b]">Reveal next</button>
              <button type="button" onClick={() => setReached(last)} className="h-9 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:text-white dark:hover:bg-[#1b1c24]">Show all</button>
            </>
          ) : isHost ? (
            <button type="button" onClick={onNext} className="h-9 flex-1 rounded-xl bg-[#ee1d49] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#14151b]">Show the leaderboard</button>
          ) : (
            <p className="flex-1 text-center text-xs text-zinc-500 dark:text-zinc-400">The final leaderboard follows shortly.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MurderResult;
