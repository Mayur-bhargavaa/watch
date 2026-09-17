'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Copy,
  Check,
  Sparkles,
  Flame,
  Inbox,
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  KeyRound
} from 'lucide-react';
import {
  addFriendByCode,
  getFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  FriendWithStreak,
  FriendRequestsData
} from '../../lib/api';

// Helper for bitmoji avatars
function getBitmojiAvatarUrl(url?: string | null, fallbackSeed?: string): string {
  if (url && url.trim() !== '') {
    if (url.startsWith('/avatars/')) return url;
    return url
      .replace(/[?&]radius=[^&]+/g, '')
      .replace(/[?&]backgroundColor=[^&]+/g, '');
  }
  const seed = encodeURIComponent(fallbackSeed || 'watch_avatar');
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&skinColor=edb98a&top=shortCurly&hairColor=4a312c&accessoriesProbability=0&clothing=blazerAndShirt&clothesColor=25557c&eyes=wink&mouth=smile`;
}

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  myFriendCode: string;
  token: string;
  initialRequests?: FriendRequestsData;
  onFriendAdded: (friend: FriendWithStreak) => void;
  onRequestsUpdated?: (requests: FriendRequestsData) => void;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({
  isOpen,
  onClose,
  myFriendCode,
  token,
  initialRequests,
  onFriendAdded,
  onRequestsUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'code' | 'requests'>('code');
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Requests state
  const [requests, setRequests] = useState<FriendRequestsData>(
    initialRequests || { incoming: [], outgoing: [] }
  );
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Sync initial requests if updated externally
  useEffect(() => {
    if (initialRequests) {
      setRequests(initialRequests);
    }
  }, [initialRequests]);

  // Load fresh requests when modal opens or tab changes to requests
  const loadRequests = async () => {
    if (!token) return;
    setLoadingRequests(true);
    try {
      const data = await getFriendRequests(token);
      setRequests(data);
      onRequestsUpdated?.(data);
    } catch {
      // Keep existing
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRequests();
      if (initialRequests && initialRequests.incoming.length > 0) {
        setActiveTab('requests');
      }
    }
  }, [isOpen]);

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
      setError('You cannot add yourself as a friend!');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await addFriendByCode(token, code);
      if (res.success) {
        if (res.status === 'ACCEPTED' && res.friend) {
          setSuccessMessage(`You and ${res.friend.friendUser.displayName} are now friends! 🔥`);
          onFriendAdded(res.friend);
        } else {
          setSuccessMessage(res.message || `Friend request sent to ${code}!`);
        }
        setFriendCodeInput('');
        await loadRequests();
        setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send request. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (senderUserId: string, displayName: string) => {
    setActionLoadingId(senderUserId);
    setError(null);
    try {
      const res = await acceptFriendRequest(token, senderUserId);
      if (res.success && res.friend) {
        const updatedIncoming = requests.incoming.filter((r) => r.user.id !== senderUserId);
        const newRequests = { ...requests, incoming: updatedIncoming };
        setRequests(newRequests);
        onRequestsUpdated?.(newRequests);

        onFriendAdded(res.friend);
        setSuccessMessage(`Accepted ${displayName}'s friend request! 🔥`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to accept friend request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeclineRequest = async (senderUserId: string, displayName: string) => {
    setActionLoadingId(senderUserId);
    setError(null);
    try {
      const res = await declineFriendRequest(token, senderUserId);
      if (res.success) {
        const updatedIncoming = requests.incoming.filter((r) => r.user.id !== senderUserId);
        const newRequests = { ...requests, incoming: updatedIncoming };
        setRequests(newRequests);
        onRequestsUpdated?.(newRequests);

        setSuccessMessage(`Declined request from ${displayName}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to decline request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelRequest = async (targetUserId: string) => {
    setActionLoadingId(targetUserId);
    setError(null);
    try {
      const res = await cancelFriendRequest(token, targetUserId);
      if (res.success) {
        const updatedOutgoing = requests.outgoing.filter((r) => r.user.id !== targetUserId);
        const newRequests = { ...requests, outgoing: updatedOutgoing };
        setRequests(newRequests);
        onRequestsUpdated?.(newRequests);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to cancel request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const incomingCount = requests.incoming.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-[#171821] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-white/10 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-md shadow-rose-600/25 shrink-0">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                Friends & Requests
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Connect and keep your 🔥 streaks alive
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

        {/* 2 Tabs: Join with Code & Requests */}
        <div className="flex items-center border-b border-slate-200/80 dark:border-white/10 px-6 pt-1 bg-slate-50/50 dark:bg-black/20 shrink-0">
          <button
            onClick={() => {
              setActiveTab('code');
              setError(null);
              setSuccessMessage(null);
            }}
            className={`relative py-3 px-4 text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'code'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Join with Code</span>
            {activeTab === 'code' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('requests');
              setError(null);
              setSuccessMessage(null);
              loadRequests();
            }}
            className={`relative py-3 px-4 text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'requests'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Requests</span>
            {incomingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-extrabold text-[10px] leading-none animate-pulse">
                {incomingCount}
              </span>
            )}
            {activeTab === 'requests' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Feedback Alerts */}
        {(error || successMessage) && (
          <div className="px-6 pt-4 shrink-0">
            {error && (
              <div className="p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-medium flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {successMessage && (
              <div className="p-3 text-xs rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Join with Code */}
        {activeTab === 'code' && (
          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Section 1: My Friend Code */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 via-amber-500/5 to-purple-500/10 border border-rose-500/20">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-rose-500" /> Your Friend Code
                </span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Share with friends
                </span>
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
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-[#101115] border border-slate-200 dark:border-white/10 rounded-xl font-mono text-sm uppercase tracking-wider text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-rose-600/50"
                    maxLength={16}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !friendCodeInput.trim()}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-lg shadow-rose-600/25 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'Sending Request...' : 'Send Friend Request'}</span>
              </button>
            </form>

            {/* Explanation Tip */}
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed bg-slate-50 dark:bg-[#101115]/60 p-3.5 rounded-xl border border-slate-200 dark:border-white/10">
              <p className="font-semibold text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                <span>🔥 How Friend Requests & Streaks Work:</span>
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-zinc-400">
                <li>Entering a friend's code sends a request to their Requests tab.</li>
                <li>Once accepted, they appear in your friends list and streaks begin!</li>
                <li>Watch movies, videos, or play games daily to keep your streaks alive.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 2: Requests List (Accept / Decline) */}
        {activeTab === 'requests' && (
          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Section: Incoming Requests */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-rose-600" /> Incoming Requests ({requests.incoming.length})
                </span>
                <button
                  onClick={loadRequests}
                  disabled={loadingRequests}
                  className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition"
                >
                  {loadingRequests ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {requests.incoming.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#101115]/50 border border-slate-200/80 dark:border-white/10 text-center space-y-1.5">
                  <Inbox className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    No incoming requests
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                    When someone sends you a friend request with your code, it will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {requests.incoming.map((req) => {
                    const isProcessing = actionLoadingId === req.user.id;
                    return (
                      <div
                        key={req.requestId}
                        className="p-3.5 rounded-2xl bg-white dark:bg-[#101115] border border-slate-200/80 dark:border-white/10 shadow-sm flex items-center justify-between gap-3 transition hover:border-slate-300 dark:hover:border-white/20"
                      >
                        {/* Avatar & User Details */}
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-white/[0.08] border border-slate-200 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                            <img
                              src={getBitmojiAvatarUrl(req.user.avatarUrl, req.user.id)}
                              alt={req.user.displayName}
                              className="w-10 h-10 object-contain drop-shadow-sm"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {req.user.displayName}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                              <span className="font-mono uppercase">{req.user.partnerCode}</span>
                              <span>•</span>
                              <span>Wants to be friends</span>
                            </div>
                          </div>
                        </div>

                        {/* Accept & Decline Buttons */}
                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            onClick={() => handleAcceptRequest(req.user.id, req.user.displayName)}
                            disabled={isProcessing}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-rose-600/25 flex items-center space-x-1 transition disabled:opacity-50"
                            title="Accept friend request"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isProcessing ? '...' : 'Accept'}</span>
                          </button>
                          <button
                            onClick={() => handleDeclineRequest(req.user.id, req.user.displayName)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 active:scale-95 text-slate-600 dark:text-zinc-300 font-semibold text-xs flex items-center space-x-1 transition disabled:opacity-50"
                            title="Decline friend request"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Decline</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section: Outgoing / Sent Requests */}
            {requests.outgoing.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-500" /> Sent Requests ({requests.outgoing.length})
                  </span>
                </div>

                <div className="space-y-2.5">
                  {requests.outgoing.map((req) => {
                    const isProcessing = actionLoadingId === req.user.id;
                    return (
                      <div
                        key={req.requestId}
                        className="p-3 rounded-2xl bg-slate-50/70 dark:bg-[#101115]/60 border border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                            <img
                              src={getBitmojiAvatarUrl(req.user.avatarUrl, req.user.id)}
                              alt={req.user.displayName}
                              className="w-8 h-8 object-contain"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate">
                              {req.user.displayName}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                              {req.user.partnerCode} • Pending approval
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleCancelRequest(req.user.id)}
                          disabled={isProcessing}
                          className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-xs font-medium transition"
                        >
                          {isProcessing ? '...' : 'Cancel'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
