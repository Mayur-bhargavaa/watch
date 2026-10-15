'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Flame, MessageSquare, Users, ArrowLeft, Play, Sparkles, Lock, Crown } from 'lucide-react';
import { API_BASE, authHeaders } from '../../../../lib/api';
import { ReactionHeatmap } from '../../../../components/social/ReactionHeatmap';
import { formatSecondsToTimestamp } from '@synccinema/common';

export default function RecapPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadRecap() {
      try {
        const res = await fetch(`${API_BASE}/api/rooms/${slug}/recap`, { headers: authHeaders() });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Failed to load room recap:', err);
      } finally {
        setIsLoading(false);
      }
    }
    void loadRecap();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-3 bg-cinema-darkest p-4 text-center">
        <div className="w-8 h-8 border-2 border-cinema-gold border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-cinema-muted uppercase tracking-wider font-semibold">
          Compiling Social Recap & Best Moments...
        </span>
      </div>
    );
  }

  if (!data || !data.room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4 bg-cinema-darkest p-6 text-center">
        <h1 className="text-lg font-bold text-white">Recap Not Available</h1>
        <p className="text-xs text-cinema-muted max-w-sm">This viewing room has not accumulated any social data yet.</p>
        <Link href="/rooms" className="px-5 py-2.5 bg-cinema-accent text-white rounded-xl text-xs font-semibold shadow-lg shadow-cinema-accent/25 transition active:scale-95">
          Return to Rooms
        </Link>
      </div>
    );
  }

  const { room, members } = data;
  const advanced: boolean = data.advanced === true;
  const heatmap: any[] = data.heatmap || [];
  const topMoments: any[] = data.topMoments || [];
  const chatHighlights: any[] = data.chatHighlights || [];
  const memberStats: any[] = data.memberStats || [];
  const totalReactions: number = typeof data.totalReactions === 'number' ? data.totalReactions : heatmap.reduce((acc: number, curr: any) => acc + curr.count, 0);
  const UpgradeCard = ({ what }: { what: string }) => (
    <div className="bg-cinema-card rounded-2xl sm:rounded-3xl p-5 border border-dashed border-amber-400/40 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0"><Lock className="w-4 h-4" /></span>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-bold text-white">{what}</p>
          <p className="text-[11px] text-slate-400">Part of the advanced recap in Watch+ (VIP Pass).</p>
        </div>
      </div>
      <Link href="/pricing" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shrink-0">
        <Crown className="w-3.5 h-3.5" /> Upgrade
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-cinema-darkest text-slate-100 p-4 sm:p-8 lg:p-12 max-w-5xl mx-auto space-y-5 sm:space-y-8 animate-fadeIn pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3">
        <Link
          href={`/room/${slug}`}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-cinema-muted hover:text-white transition w-fit py-1 cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Room</span>
        </Link>

        <div className="flex items-center space-x-1.5 sm:space-x-2 text-[11px] sm:text-xs text-cinema-gold bg-cinema-gold/10 px-3 py-1.5 rounded-full border border-cinema-gold/30 w-fit">
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cinema-gold shrink-0" />
          <span>Post-Watch Social Timeline</span>
        </div>
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-cinema-accent">
          {room.currentMedia?.title || 'Shared Entertainment'}
        </span>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight break-words leading-tight">
          {room.title} — Best Moments
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-400 max-w-xl">
          Relive your group's peak synchronized reactions and favorite moments.
        </p>
      </div>

      {/* Quick Metrics: Responsive 3-Column Stats */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <div className="p-3 sm:p-4 bg-cinema-card rounded-2xl border border-cinema-border space-y-0.5 sm:space-y-1 shadow-xs">
          <div className="flex items-center space-x-1.5 text-cinema-muted text-[10px] sm:text-xs truncate">
            <Users className="w-3.5 h-3.5 text-cinema-accent shrink-0" />
            <span className="truncate">Watchers</span>
          </div>
          <div className="text-base sm:text-2xl font-black text-white">{members.length}</div>
        </div>

        <div className="p-3 sm:p-4 bg-cinema-card rounded-2xl border border-cinema-border space-y-0.5 sm:space-y-1 shadow-xs">
          <div className="flex items-center space-x-1.5 text-cinema-muted text-[10px] sm:text-xs truncate">
            <Flame className="w-3.5 h-3.5 text-cinema-neon shrink-0" />
            <span className="truncate">Reactions</span>
          </div>
          <div className="text-base sm:text-2xl font-black text-white">
            {totalReactions}
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-cinema-card rounded-2xl border border-cinema-border space-y-0.5 sm:space-y-1 shadow-xs">
          <div className="flex items-center space-x-1.5 text-cinema-muted text-[10px] sm:text-xs truncate">
            <MessageSquare className="w-3.5 h-3.5 text-cinema-emerald shrink-0" />
            <span className="truncate">Comments</span>
          </div>
          <div className="text-base sm:text-2xl font-black text-white">{advanced ? chatHighlights.length : <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" aria-label="Watch+ only" />}</div>
        </div>
      </div>

      {/* Reaction Intensity Timeline Heatmap */}
      {advanced ? (
        <ReactionHeatmap
          buckets={heatmap}
          durationSeconds={room.currentMedia?.durationSeconds || 3600}
          onSeek={(sec) => router.push(`/room/${slug}`)}
        />
      ) : (
        <UpgradeCard what="Full reaction timeline" />
      )}

      {/* Per-person stats (Watch+) */}
      {advanced && memberStats.length > 0 && (
        <div className="bg-cinema-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-cinema-border space-y-3 shadow-sm">
          <h2 className="text-xs sm:text-sm font-bold text-white flex items-center space-x-2">
            <Users className="w-4 h-4 text-cinema-accent shrink-0" />
            <span>Who did what</span>
          </h2>
          <div className="space-y-2">
            {memberStats.map((m: any) => (
              <div key={m.userId} className="p-3 bg-cinema-base rounded-xl border border-cinema-border/50 flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-slate-100 truncate">{m.userName}</span>
                <span className="text-slate-400 shrink-0">{m.messages} messages · {m.reactions} reactions{m.topEmoji ? <span className="ml-1.5 text-base align-middle">{m.topEmoji}</span> : null}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Reacted Moments */}
      <div className="bg-cinema-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-cinema-border space-y-3 sm:space-y-4 shadow-sm">
        <h2 className="text-xs sm:text-sm font-bold text-white flex items-center space-x-2">
          <Flame className="w-4 h-4 text-cinema-gold shrink-0" />
          <span>Top Reacted Moments</span>
        </h2>

        {topMoments.length === 0 ? (
          <div className="text-xs text-cinema-muted py-2">No peak reactions recorded yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {topMoments.map((m: any, idx: number) => (
              <div
                key={m.bucketStart}
                className="p-3 bg-cinema-base rounded-xl border border-cinema-border/60 flex items-center justify-between gap-2 min-w-0"
              >
                <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
                  <span className="text-xs sm:text-sm font-black text-cinema-gold font-mono shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold text-white truncate">
                      {formatSecondsToTimestamp(m.bucketStart)}
                    </div>
                    <span className="text-[10px] sm:text-[11px] text-cinema-muted truncate block">
                      {m.count} reactions
                    </span>
                  </div>
                </div>
                <div className="text-xl sm:text-2xl shrink-0">{m.topEmoji}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat Highlights */}
      {!advanced ? <UpgradeCard what="Chat highlights and per-person stats" /> : (
      <div className="bg-cinema-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-cinema-border space-y-3 sm:space-y-4 shadow-sm">
        <h2 className="text-xs sm:text-sm font-bold text-white flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-cinema-accent shrink-0" />
          <span>Chat Highlights</span>
        </h2>

        {chatHighlights.length === 0 ? (
          <div className="text-xs text-cinema-muted py-2">No timestamped comments in this session.</div>
        ) : (
          <div className="space-y-2">
            {chatHighlights.map((c: any) => (
              <div
                key={c.id}
                className="p-3 bg-cinema-base rounded-xl border border-cinema-border/50 flex flex-col xs:flex-row xs:items-center justify-between gap-1.5 xs:gap-3 text-xs"
              >
                <div className="min-w-0 break-words leading-snug">
                  <span className="font-bold text-indigo-300 mr-1.5">{c.userName}:</span>
                  <span className="text-slate-100">{c.content}</span>
                </div>
                {c.mediaTimestamp !== null && (
                  <span className="font-mono text-[10px] text-cinema-accent bg-cinema-accent/10 px-2 py-0.5 rounded-md shrink-0 self-start xs:self-auto border border-cinema-accent/20">
                    {formatSecondsToTimestamp(c.mediaTimestamp)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Actions: Responsive Stack on mobile */}
      <div className="pt-3 sm:pt-4 flex flex-col-reverse xs:flex-row items-stretch xs:items-center justify-between gap-2.5 sm:gap-4 border-t border-cinema-border/60">
        <Link
          href="/dashboard"
          className="px-4 py-2.5 bg-cinema-card hover:bg-cinema-border text-xs font-bold text-white rounded-xl border border-cinema-border transition text-center active:scale-95 cursor-pointer"
        >
          Start Another Watch Room
        </Link>

        <Link
          href={`/room/${slug}`}
          className="px-5 py-2.5 bg-cinema-accent hover:bg-indigo-600 text-xs font-bold text-white rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-cinema-accent/20 active:scale-95 text-center cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Return to Watch Party</span>
        </Link>
      </div>
    </div>
  );
}
