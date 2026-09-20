'use client';

import React, { useState } from 'react';
import { X, Settings, Zap, ShieldAlert, Award, Clock, Sparkles } from 'lucide-react';
import { BingoMode, BingoWinCondition, BingoRoomConfig } from '@synccinema/common';
import { WinningConditionSelector } from './WinningConditionSelector';
import { CustomPatternBuilder } from './CustomPatternBuilder';

interface BingoRoomSettingsProps {
  config: BingoRoomConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: BingoRoomConfig) => void;
  isHost: boolean;
}

const SPEED_OPTIONS = [
  { label: 'Relaxed', sub: '5 seconds', value: 5000 },
  { label: 'Normal', sub: '3 seconds', value: 3000, isDefault: true },
  { label: 'Fast', sub: '2 seconds', value: 2000 },
  { label: 'Turbo', sub: '1 second', value: 1000 }
];

const PENALTY_OPTIONS = [
  { label: 'OFF', sub: 'No penalty', value: 0 },
  { label: '5s Penalty', sub: 'Wait 5 seconds', value: 5 },
  { label: '10s Penalty', sub: 'Wait 10 seconds', value: 10 }
];

export const BingoRoomSettings: React.FC<BingoRoomSettingsProps> = ({
  config: initialConfig,
  isOpen,
  onClose,
  onSave,
  isHost
}) => {
  const [activeTab, setActiveTab] = useState<'mode' | 'rules' | 'calling' | 'penalties'>('mode');
  const [config, setConfig] = useState<BingoRoomConfig>({ ...initialConfig });
  const [pointsEnabled, setPointsEnabled] = useState<boolean>(true);
  const [showPatternBuilder, setShowPatternBuilder] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleToggleCondition = (cond: BingoWinCondition) => {
    setConfig(prev => ({
      ...prev,
      winConditions: {
        ...prev.winConditions,
        [cond]: !prev.winConditions[cond]
      }
    }));
  };

  const handleUpdatePoints = (cond: BingoWinCondition, pts: number) => {
    setConfig(prev => ({
      ...prev,
      points: {
        ...prev.points,
        [cond]: Math.max(1, pts)
      }
    }));
  };

  const handleSavePattern = (pattern: boolean[][]) => {
    setConfig(prev => ({
      ...prev,
      customPattern: pattern,
      winConditions: {
        ...prev.winConditions,
        customPattern: true
      }
    }));
  };

  const handleApply = () => {
    onSave(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-2xl bg-[#0b0d17] border border-white/10 rounded-3xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white">Bingo Room Settings</h3>
              <p className="text-[11px] text-zinc-400">Configure rules, calling pace, and win conditions</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-6 border-b border-white/[0.06] bg-black/20 overflow-x-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('mode')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'mode'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Game Mode
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'rules'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Winning Rules
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('calling')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'calling'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Calling Pace
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('penalties')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'penalties'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            False Claims & Points
          </button>
        </div>

        {/* Tab Contents (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: GAME MODE */}
          {activeTab === 'mode' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-300 mb-1">
                  Select Game Mode
                </h4>
                <p className="text-xs text-zinc-400">
                  Choose between authentic Indian Tambola / Housie or international 75-Ball Bingo.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 90-Ball Tambola */}
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => setConfig(prev => ({ ...prev, mode: '90-ball' }))}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    config.mode === '90-ball'
                      ? 'bg-rose-500/10 border-[#ee1d49] ring-2 ring-[#ee1d49]/20 text-white'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl">🎱</span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-[#ee1d49] text-[10px] font-black uppercase">
                      Default
                    </span>
                  </div>
                  <div className="text-sm font-black text-white">90-Ball Tambola</div>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    Classic 3×9 ticket with 15 numbers. Features Early 5, individual lines, Four Corners, and Housefull.
                  </p>
                </button>

                {/* 75-Ball Bingo */}
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => setConfig(prev => ({ ...prev, mode: '75-ball' }))}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    config.mode === '75-ball'
                      ? 'bg-violet-600/10 border-violet-500 ring-2 ring-violet-500/20 text-white'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl">🎯</span>
                    <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-black uppercase">
                      5×5 Grid
                    </span>
                  </div>
                  <div className="text-sm font-black text-white">75-Ball Bingo</div>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    B-I-N-G-O 5×5 card with free center. Supports geometric patterns (X, Cross, Diamond, Custom).
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: RULES */}
          {activeTab === 'rules' && (
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-300">
                  Winning Conditions & Prizes
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Select which conditions players can claim during the duel.
                </p>
              </div>

              <WinningConditionSelector
                mode={config.mode}
                winConditions={config.winConditions}
                points={config.points}
                pointsEnabled={pointsEnabled}
                onToggleCondition={handleToggleCondition}
                onUpdatePoints={handleUpdatePoints}
                onOpenCustomPattern={() => setShowPatternBuilder(true)}
                readOnly={!isHost}
              />
            </div>
          )}

          {/* TAB 3: CALLING PACE */}
          {activeTab === 'calling' && (
            <div className="space-y-6">
              {/* Calling Mode */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-300">
                  Calling Mode
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!isHost}
                    onClick={() => setConfig(prev => ({ ...prev, autoCall: true }))}
                    className={`p-3.5 rounded-2xl border text-left transition ${
                      config.autoCall
                        ? 'bg-rose-500/10 border-rose-500 text-white'
                        : 'bg-white/[0.02] border-white/10 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-white">
                      <Zap className="w-4 h-4 text-rose-400" />
                      <span>Auto Call Numbers</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Numbers appear automatically based on selected calling speed.
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={!isHost}
                    onClick={() => setConfig(prev => ({ ...prev, autoCall: false }))}
                    className={`p-3.5 rounded-2xl border text-left transition ${
                      !config.autoCall
                        ? 'bg-rose-500/10 border-rose-500 text-white'
                        : 'bg-white/[0.02] border-white/10 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-white">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>Host Calls Manually</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Host presses [ Call Next Number ] when players are ready.
                    </p>
                  </button>
                </div>
              </div>

              {/* Calling Speed */}
              {config.autoCall && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-300">
                    Number Calling Pace
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SPEED_OPTIONS.map((spd) => (
                      <button
                        key={spd.value}
                        type="button"
                        disabled={!isHost}
                        onClick={() => setConfig(prev => ({ ...prev, callingSpeed: spd.value }))}
                        className={`p-3 rounded-xl border text-center transition ${
                          config.callingSpeed === spd.value
                            ? 'bg-rose-600 border-rose-600 text-white font-black shadow-md shadow-rose-600/20'
                            : 'bg-white/[0.02] border-white/10 text-zinc-300 hover:border-white/20'
                        }`}
                      >
                        <div className="text-xs font-bold">{spd.label}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{spd.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: FALSE CLAIM & POINTS */}
          {activeTab === 'penalties' && (
            <div className="space-y-6">
              {/* False Claim Penalty */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-300">
                    False Claim Penalty
                  </h4>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Players can only claim a win when the selected winning condition is actually completed.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {PENALTY_OPTIONS.map((pen) => (
                    <button
                      key={pen.value}
                      type="button"
                      disabled={!isHost}
                      onClick={() => setConfig(prev => ({ ...prev, falseClaimPenalty: pen.value }))}
                      className={`p-3 rounded-xl border text-center transition ${
                        config.falseClaimPenalty === pen.value
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                          : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:border-white/20'
                      }`}
                    >
                      <div className="text-xs font-bold">{pen.label}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{pen.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Point System Toggle */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-rose-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Points System</div>
                      <div className="text-[10px] text-zinc-400">
                        Award points for each round won. Total score determines match winner.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!isHost}
                    onClick={() => setPointsEnabled(!pointsEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      pointsEnabled ? 'bg-rose-600' : 'bg-zinc-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform transform ${
                        pointsEnabled ? 'translate-x-6' : 'translate-x-1'
                      } top-1 absolute`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <span className="text-[11px] text-zinc-400">
            {isHost ? '⚡ Changes update for all players in room' : '👁️ Viewing room rules (Host configures)'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold transition"
            >
              Cancel
            </button>
            {isHost && (
              <button
                type="button"
                onClick={handleApply}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-[#ee1d49] hover:brightness-110 text-white text-xs font-black transition shadow-lg shadow-rose-600/30"
              >
                Apply Settings
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Custom Pattern Builder Modal */}
      {showPatternBuilder && (
        <CustomPatternBuilder
          initialPattern={config.customPattern}
          onSave={handleSavePattern}
          onClose={() => setShowPatternBuilder(false)}
        />
      )}
    </div>
  );
};
