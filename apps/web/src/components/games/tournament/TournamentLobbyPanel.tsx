'use client';

import React from 'react';
import { Shuffle, UserMinus, Hourglass } from 'lucide-react';
import type { TournamentConfig, TournamentGameView } from '@synccinema/common';
import { AppIcon } from '../../ui/AppIcon';
import { MATCH_GAMES, bracketPreview, gameName, thirdPlaceAllowed, type LobbyPlayer } from '../../../lib/tournamentView';

const CARD = 'rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4';
const LABEL = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const ICON_BTN = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-[#22232c] dark:hover:text-white';

function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: readonly { id: T; name: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <span className={LABEL}>{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-xl bg-zinc-100 p-0.5 dark:bg-[#22232c]">
        {options.map((o) => (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`h-7 rounded-lg px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] ${value === o.id ? 'bg-white text-zinc-900 ring-1 ring-zinc-200 dark:bg-[#ee1d49] dark:text-white dark:ring-0' : 'text-zinc-600 dark:text-zinc-300'}`}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Switch({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="block text-xs font-semibold text-zinc-900 dark:text-white">{label}</span>
        {hint && <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 disabled:opacity-40 dark:focus-visible:ring-offset-[#14151b] ${checked ? 'bg-[#ee1d49]' : 'bg-zinc-300 dark:bg-[#2f303b]'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-150 ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function SeedList({ players, onKick }: { players: LobbyPlayer[]; onKick?: (userId: string) => void }) {
  if (players.length === 0) {
    return <p className="rounded-xl border border-dashed border-zinc-300 px-3 py-3 text-center text-xs text-zinc-500 dark:border-white/15 dark:text-zinc-400">Nobody has joined yet. Share the room code.</p>;
  }
  return (
    <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" data-testid="seed-list">
      {players.map((p) => (
        <li key={p.userId} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1.5 dark:border-white/10 dark:bg-[#1b1c24]">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-200 text-[11px] font-bold tabular-nums text-zinc-700 dark:bg-[#2a2b35] dark:text-zinc-200" title={`Seed ${p.seed}`}>{p.seed}</span>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-900 dark:text-white">{p.displayName}</span>
          <span className={`h-2 w-2 shrink-0 rounded-full ${p.isConnected === false ? 'bg-zinc-400' : 'bg-emerald-500'}`} title={p.isConnected === false ? 'Not connected' : 'Connected'} />
          {onKick && (
            <button type="button" onClick={() => onKick(p.userId)} className={ICON_BTN} aria-label={`Remove ${p.displayName}`} title={`Remove ${p.displayName}`}>
              <UserMinus className="h-4 w-4" />
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

function preview(count: number): string {
  if (count < 2) return 'The bracket is drawn when the tournament starts.';
  const { rounds, byes } = bracketPreview(count);
  return `${count} players: ${rounds} ${rounds === 1 ? 'round' : 'rounds'}${byes > 0 ? `, ${byes} ${byes === 1 ? 'bye' : 'byes'} for the top ${byes === 1 ? 'seed' : 'seeds'}` : ', no byes'}.`;
}

interface OrganiserPanelProps {
  view: TournamentGameView | null;
  players: LobbyPlayer[];
  onConfig: (patch: Partial<TournamentConfig>) => void;
  onShuffle: () => void;
  onKick: (userId: string) => void;
  error?: string | null;
}

/** The organiser's panel in the waiting lobby: the game, the third place match, the Final length, the seed order, remove a player. */
export const TournamentOrganiserPanel: React.FC<OrganiserPanelProps> = ({ view, players, onConfig, onShuffle, onKick, error }) => {
  const config: TournamentConfig = view?.config ?? { game: 'tic-tac-toe', thirdPlace: false, finalBestOf: 1 };
  const canThird = thirdPlaceAllowed(players.length);
  return (
    <div className={`${CARD} space-y-4`} data-testid="organiser-panel">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-[#ee1d49] dark:bg-[#22232c]"><AppIcon name="crown" className="h-4 w-4" /></span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Organiser</h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">You run the bracket and do not play.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Segmented<string> label="Game" value={config.game} options={MATCH_GAMES} onChange={(game) => onConfig({ game: game as TournamentConfig['game'] })} />
        <Segmented<number> label="The Final" value={config.finalBestOf} options={[{ id: 1, name: 'Best of 1' }, { id: 3, name: 'Best of 3' }]} onChange={(n) => onConfig({ finalBestOf: n === 3 ? 3 : 1 })} />
      </div>

      <Switch
        label="Third place match"
        hint={canThird ? 'The two losing semi-finalists play for third.' : 'Needs at least 4 players.'}
        checked={config.thirdPlace && canThird}
        disabled={!canThird}
        onChange={(v) => onConfig({ thirdPlace: v })}
      />

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className={`${LABEL} mb-0`}>Players and seeds ({players.length})</span>
          <button type="button" onClick={onShuffle} disabled={players.length < 2} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] disabled:opacity-40 dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]">
            <Shuffle className="h-3.5 w-3.5" />
            Shuffle seeds
          </button>
        </div>
        <SeedList players={players} onKick={onKick} />
        <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">Seeds follow join order until you shuffle. {preview(players.length)}</p>
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
};

interface PlayerPanelProps {
  view: TournamentGameView | null;
  players: LobbyPlayer[];
  organiserName: string;
}

/** What players see while the organiser has not started: the settings and the seed order, read-only. */
export const TournamentPlayerLobbyPanel: React.FC<PlayerPanelProps> = ({ view, players, organiserName }) => {
  const config = view?.config;
  return (
    <div className={`${CARD} space-y-3`} data-testid="player-lobby-panel">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-[#22232c] dark:text-zinc-300"><Hourglass className="h-4 w-4" /></span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Waiting for the organiser</h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{organiserName} picks the game and starts the bracket.</p>
        </div>
      </div>
      {config && (
        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
          <span className="rounded-lg bg-zinc-100 px-2 py-1 dark:bg-[#22232c]">{gameName(config.game)}</span>
          <span className="rounded-lg bg-zinc-100 px-2 py-1 dark:bg-[#22232c]">Final: best of {config.finalBestOf}</span>
          {config.thirdPlace && <span className="rounded-lg bg-zinc-100 px-2 py-1 dark:bg-[#22232c]">Third place match</span>}
        </div>
      )}
      <div>
        <span className={LABEL}>Players and seeds ({players.length})</span>
        <SeedList players={players} />
        <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">{preview(players.length)}</p>
      </div>
    </div>
  );
};
