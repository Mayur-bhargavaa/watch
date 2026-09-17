'use client';

import React, { useState } from 'react';
import { X, UserPlus, Copy, Check, Sparkles, Flame } from 'lucide-react';
import { addFriendByCode, FriendWithStreak } from '../../lib/api';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  myFriendCode: string;
  token: string;
  onFriendAdded: (friend: FriendWithStreak) => void;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({
  isOpen,
  onClose,
  myFriendCode,
  token,
  onFriendAdded
}) => {
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    if (!myFriendCode) return;
    try {
      await navigator.clipboard.writeText(myFriendCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = friendCodeInput.trim().toUpperCase();
    if (!code) return;

    if (code === myFriendCode?.toUpperCase()) {
      setError("You cannot add yourself as a friend!");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await addFriendByCode(token, code);
      if (res.success && res.friend) {
        setSuccessMessage(`Added ${res.friend.friendUser.displayName} as a friend! 🔥`);
        setFriendCodeInput('');
        onFriendAdded(res.friend);
        setTimeout(() => {
          onClose();
          setSuccessMessage(null);
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add friend. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-md max-h-[90vh] flex flex-col bg-white dark:bg-[#171821] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 dark:border-white/10 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20 shrink-0">
              <Flame className="w-5 h-5 fill-amber-300 text-amber-200" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                Add Friend & Streaks
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Watch or play daily to build your 🔥 streaks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Section 1: My Friend Code */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-purple-500/10 border border-amber-500/20">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Your Friend Code
              </span>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">Share with friends</span>
            </div>
            <div className="flex items-center justify-between bg-white dark:bg-[#101115] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5">
              <span className="font-mono text-base font-black tracking-widest text-rose-600 dark:text-rose-400">
                {myFriendCode || 'LOADING...'}
              </span>
              <button
                onClick={handleCopyCode}
                className="flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section 2: Enter Friend's Code */}
          <form onSubmit={handleAddFriend} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Enter Friend's Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={friendCodeInput}
                  onChange={(e) => {
                    setFriendCodeInput(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="e.g. JAYD91, RAHUL42"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-[#101115] border border-slate-200 dark:border-white/10 rounded-xl font-mono text-sm uppercase tracking-wider text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  maxLength={16}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-medium">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-3 text-xs rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-2">
                <Check className="w-4 h-4" />
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !friendCodeInput.trim()}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-[#FFFC00] hover:bg-[#F5F200] text-black font-black text-sm shadow-md shadow-amber-400/20 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-95"
            >
              <span className="text-base leading-none">👻</span>
              <span>{loading ? 'Adding Friend...' : 'Connect & Start Streaks'}</span>
            </button>
          </form>

          {/* Explanation Tip */}
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed bg-slate-50 dark:bg-[#101115]/60 p-3.5 rounded-xl border border-slate-200 dark:border-white/10">
            <p className="font-semibold text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
              <span>🔥 How Snapchat-style Streaks Work:</span>
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-zinc-400">
              <li>Every friend has their own independent streak counter.</li>
              <li>Watch any movie, video, or play a game together each day to increment your streak.</li>
              <li>If you miss a calendar day with a friend, that specific streak resets to Day 1!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
