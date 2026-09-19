'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  CheckCircle2,
  Plus,
  Lock,
  Vote,
  Film,
  Gamepad2
} from 'lucide-react';
import { VotingOption } from '../../types/plans';

interface CollaborativeVotingProps {
  question: string;
  type: 'movie' | 'game';
  options: VotingOption[];
  currentUserId: string;
  isClosed?: boolean;
  confirmedTitle?: string;
  isHost?: boolean;
  onVote: (optionId: string) => void;
  onConfirmSelection?: (optionId: string) => void;
  onAddOption?: (title: string) => void;
}

export const CollaborativeVoting: React.FC<CollaborativeVotingProps> = ({
  question,
  type,
  options,
  currentUserId,
  isClosed = false,
  confirmedTitle,
  isHost = false,
  onVote,
  onConfirmSelection,
  onAddOption
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  // Total votes calculation
  const totalVotes = options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !onAddOption) return;
    onAddOption(newTitle.trim());
    setNewTitle('');
    setShowAddModal(false);
  };

  return (
    <div className="rounded-3xl p-6 bg-gradient-to-br from-amber-500/5 via-violet-500/5 to-rose-500/5 bg-white dark:bg-[#151022] border border-amber-500/20 dark:border-amber-500/20 shadow-lg shadow-amber-500/5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Collaborative Decision · {isClosed ? 'Decided' : 'Voting Active'}
            </span>
          </div>
          <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {question}
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {isClosed
              ? `Poll closed. Confirmed pick: ${confirmedTitle || 'Selected option'}`
              : `Tap an option to cast your vote. (${totalVotes} total votes cast)`}
          </p>
        </div>

        {!isClosed && onAddOption && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-white/20 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Suggest</span>
          </button>
        )}
      </div>

      {/* Options List */}
      <div className="space-y-3">
        {options.map((option) => {
          const voteCount = option.votes?.length || 0;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const hasVoted = option.votes?.includes(currentUserId);
          const isWinner = isClosed && option.title === confirmedTitle;

          return (
            <div
              key={option.id}
              className={`relative overflow-hidden rounded-2xl border transition-all duration-200 ${
                isWinner
                  ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/10'
                  : hasVoted
                  ? 'border-[#ee1d49] bg-[#ee1d49]/5 dark:bg-[#ee1d49]/10'
                  : 'border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02]'
              }`}
            >
              {/* Vote Percentage Progress Bar */}
              <div
                className={`absolute left-0 top-0 bottom-0 opacity-15 transition-all duration-500 pointer-events-none ${
                  isWinner ? 'bg-emerald-500' : hasVoted ? 'bg-[#ee1d49]' : 'bg-slate-400 dark:bg-white'
                }`}
                style={{ width: `${percentage}%` }}
              />

              <div className="relative p-3.5 flex items-center justify-between gap-3 z-10">
                <button
                  type="button"
                  disabled={isClosed}
                  onClick={() => onVote(option.id)}
                  className={`flex-1 flex items-center gap-3 text-left transition ${
                    isClosed ? 'cursor-default' : 'cursor-pointer'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                      isWinner
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : hasVoted
                        ? 'bg-[#ee1d49] text-white shadow-sm'
                        : 'bg-white dark:bg-white/10 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10'
                    }`}
                  >
                    {isWinner ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : hasVoted ? (
                      <Check className="w-4 h-4" />
                    ) : type === 'movie' ? (
                      <Film className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <Gamepad2 className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {option.title}
                    </div>
                    {option.subtitle && (
                      <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 truncate">
                        {option.subtitle}
                      </div>
                    )}
                  </div>
                </button>

                {/* Vote stats and Host confirm */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-black text-slate-900 dark:text-white">
                      {percentage}%
                    </div>
                    <div className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">
                      {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
                    </div>
                  </div>

                  {isHost && !isClosed && onConfirmSelection && (
                    <button
                      type="button"
                      onClick={() => onConfirmSelection(option.id)}
                      className="px-2.5 py-1 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold hover:bg-[#ee1d49] dark:hover:bg-[#ee1d49] dark:hover:text-white transition cursor-pointer"
                      title="Lock this option as the chosen activity"
                    >
                      Pick
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Suggest Choice Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#171226] border border-slate-200 dark:border-white/10 p-5 space-y-4 shadow-2xl">
            <h4 className="text-base font-black text-slate-900 dark:text-white">
              Suggest an Option
            </h4>
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={type === 'movie' ? 'e.g. Spider-Man: Across the Spider-Verse' : 'e.g. Four in a Row'}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:border-[#ee1d49]"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ee1d49] text-white disabled:opacity-50"
                >
                  Add Option
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
