'use client';

import React from 'react';
import { Play, Hourglass, Trophy } from 'lucide-react';
import type { TournamentGameView } from '@synccinema/common';
import { AppIcon } from '../../ui/AppIcon';
import { clockText, gameName, myActiveMatch, ordinal, playerName, secondsUntil, matchTitle } from '../../../lib/tournamentView';

interface TournamentNextMatchProps {
  view: TournamentGameView;
  myUserId: string;
  /** server clock minus client clock, in ms */
  offsetMs: number;
  nowMs: number;
  /** opens the match room (the existing game page) */
  onPlay: (roomCode: string) => void;
}

const CARD = 'rounded-2xl border p-3 sm:p-4';

/** "Your next match": the Play button with the join countdown, or what the player is waiting for. Players only. */
export const TournamentNextMatch: React.FC<TournamentNextMatchProps> = ({ view, myUserId, offsetMs, nowMs, onPlay }) => {
  const me = view.me;
  if (!me || me.role !== 'player' || view.phase !== 'RUNNING') return null;
  const match = myActiveMatch(view);

  if (match && match.roomCode) {
    const opponentId = match.a === myUserId ? match.b : match.a;
    const opponent = playerName(view, opponentId);
    const live = match.status === 'LIVE';
    const left = secondsUntil(match.joinDeadline, offsetMs, nowMs);
    const urgent = !live && left <= 30;
    return (
      <section aria-label="Your next match" data-testid="next-match" className={`${CARD} border-[#ee1d49] bg-white dark:bg-[#14151b]`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ee1d49] text-white"><AppIcon name="swords" className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#ee1d49]">{live ? 'Your match is live' : 'Your match is ready'}</p>
              <h2 className="truncate text-base font-bold text-zinc-900 dark:text-white">{match.roundName} vs {opponent}</h2>
              <p className="truncate text-xs text-zinc-600 dark:text-zinc-300">
                {gameName(view.config.game)}
                {match.bestOf > 1 ? `, best of ${match.bestOf}, game ${match.gameNo}` : match.gameNo > 1 ? `, replay ${match.gameNo - 1} (the last game was a draw)` : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {!live && match.joinDeadline !== null && (
              <div className="text-right" role="timer" aria-label="Time left to open the match">
                <p className={`text-xl font-bold tabular-nums ${urgent ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-white'}`} data-testid="join-countdown">{clockText(left)}</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">to open it, or you forfeit</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => onPlay(match.roomCode as string)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#ee1d49] px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#14151b]"
            >
              <Play className="h-4 w-4 fill-current" />
              {live ? 'Back to match' : 'Play'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  const upcoming = me.upcomingMatchId ? view.matches.find((m) => m.id === me.upcomingMatchId) : null;
  const wait = me.left
    ? { icon: <AppIcon name="flag" className="h-5 w-5" />, title: 'You left the tournament', text: 'Your remaining matches were forfeited.' }
    : me.eliminated
      ? { icon: <AppIcon name="flag" className="h-5 w-5" />, title: 'You are out', text: 'Thanks for playing. You can still watch the bracket and chat.' }
      : upcoming
        ? { icon: <Hourglass className="h-5 w-5" />, title: `Next: ${matchTitle(view, upcoming.id)}`, text: 'Waiting for your opponent: their match is still being played.' }
        : { icon: <Trophy className="h-5 w-5" />, title: 'Waiting for your match', text: 'The server opens your match room as soon as both players are known.' };
  return (
    <section aria-label="Your next match" data-testid="next-match-waiting" className={`${CARD} border-zinc-200 bg-white dark:border-white/10 dark:bg-[#14151b]`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-[#22232c] dark:text-zinc-300">{wait.icon}</span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-zinc-900 dark:text-white">{wait.title}</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-300">{wait.text}{me.seed ? ` You are seed ${me.seed} (${ordinal(me.seed)}).` : ''}</p>
        </div>
      </div>
    </section>
  );
};

export default TournamentNextMatch;
