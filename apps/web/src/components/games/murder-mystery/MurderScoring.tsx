import React from 'react';
import { MURDER_MAX_SHARES, MURDER_SCORING } from '@synccinema/common';
import { AppIcon } from '../../ui/AppIcon';

/** The scoring table, always visible in the room. Values come from the shared constants. */
export const MurderScoring: React.FC<{ className?: string }> = ({ className = '' }) => {
  const rows: Array<[string, string]> = [
    ['Correct accusation', `+${MURDER_SCORING.correct}`],
    [`Among the first ${MURDER_SCORING.speedSlots} correct`, `+${MURDER_SCORING.speedBonus}`],
    ['Murderer, if fewer than half of the others got it', `+${MURDER_SCORING.murdererSurvives}`],
    [`Each clue you reveal (max ${MURDER_MAX_SHARES})`, `+${MURDER_SCORING.perSharedClue}`],
    ['Wrong accusation', '0']
  ];
  return (
    <div data-testid="murder-scoring" className={`rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] ${className}`}>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"><AppIcon name="medal" className="h-3.5 w-3.5" />Scoring</h3>
      <dl className="space-y-1">
        {rows.map(([label, pts]) => (
          <div key={label} className="flex items-start justify-between gap-2 text-[11px]">
            <dt className="text-zinc-700 dark:text-zinc-200">{label}</dt>
            <dd className="shrink-0 font-mono font-bold text-zinc-900 dark:text-white">{pts}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default MurderScoring;
