'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Film, Flame, MessageSquare, Users, ArrowLeft, Play, Sparkles } from 'lucide-react';
import { API_BASE } from '../../../../lib/api';
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
        const res = await fetch(`${API_BASE}/api/rooms/${slug}/recap`);
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
    loadRecap();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-3 bg-cinema-darkest">
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
        <p className="text-xs text-cinema-muted">This viewing room has not accumulated any social data yet.</p>
        <Link href="/" className="px-4 py-2 bg-cinema-accent text-white rounded-lg text-xs font-semibold">
          Return Home
        </Link>
      </div>
    );
  }

  const { room, heatmap, topMoments, chatHighlights, members } = data;

  return (
    <div className="min-h-screen bg-cinema-darkest p-6 sm:p-12 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href={`/room/${slug}`}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-cinema-muted hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Room</span>
        </Link>

        <div className="flex items-center space-x-2 text-xs text-cinema-gold bg-cinema-gold/10 px-3 py-1.5 rounded-full border border-cinema-gold/30">
          <Sparkles className="w-4 h-4" />
          <span>Post-Watch Social Timeline</span>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-cinema-accent">
          {room.currentMedia?.title || 'Shared Entertainment'}
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-white">
          {room.title} — Best Moments
        </h1>
        <p className="text-xs text-slate-400">
          Relive your group's peak synchronized reactions and favorite moments.
        </p>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-cinema-card rounded-xl border border-cinema-border space-y-1">
          <div className="flex items-center space-x-2 text-cinema-muted text-xs">
            <Users className="w-4 h-4 text-cinema-accent" />
            <span>Watchers</span>
          </div>
          <div className="text-2xl font-bold text-white">{members.length}</div>
        </div>

        <div className="p-4 bg-cinema-card rounded-xl border border-cinema-border space-y-1">
          <div className="flex items-center space-x-2 text-cinema-muted text-xs">
            <Flame className="w-4 h-4 text-cinema-neon" />
            <span>Total Reactions</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {heatmap.reduce((acc: number, curr: any) => acc + curr.count, 0)}
          </div>
        </div>

        <div className="p-4 bg-cinema-card rounded-xl border border-cinema-border space-y-1">
          <div className="flex items-center space-x-2 text-cinema-muted text-xs">
            <MessageSquare className="w-4 h-4 text-cinema-emerald" />
            <span>Timestamped Comments</span>
          </div>
          <div className="text-2xl font-bold text-white">{chatHighlights.length}</div>
        </div>
      </div>

      {/* Reaction Intensity Timeline Heatmap */}
      <ReactionHeatmap
        buckets={heatmap}
        durationSeconds={room.currentMedia?.durationSeconds || 3600}
        onSeek={(sec) => router.push(`/room/${slug}`)}
      />

      {/* Top Reacted Moments */}
      <div className="bg-cinema-card rounded-xl p-5 border border-cinema-border space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center space-x-2">
          <Flame className="w-4 h-4 text-cinema-gold" />
          <span>Top Reacted Moments</span>
        </h2>

        {topMoments.length === 0 ? (
          <div className="text-xs text-cinema-muted">No peak reactions recorded yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topMoments.map((m: any, idx: number) => (
              <div
                key={m.bucketStart}
                className="p-3 bg-cinema-base rounded-lg border border-cinema-border/60 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-black text-cinema-gold font-mono">
                    #{idx + 1}
                  </span>
                  <div>
                    <div className="font-mono text-xs font-bold text-white">
                      {formatSecondsToTimestamp(m.bucketStart)}
                    </div>
                    <span className="text-[11px] text-cinema-muted">
                      {m.count} reactions
                    </span>
                  </div>
                </div>
                <div className="text-2xl">{m.topEmoji}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat Highlights */}
      <div className="bg-cinema-card rounded-xl p-5 border border-cinema-border space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-cinema-accent" />
          <span>Chat Highlights</span>
        </h2>

        {chatHighlights.length === 0 ? (
          <div className="text-xs text-cinema-muted">No timestamped comments in this session.</div>
        ) : (
          <div className="space-y-2">
            {chatHighlights.map((c: any) => (
              <div
                key={c.id}
                className="p-3 bg-cinema-base rounded-lg border border-cinema-border/50 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-300 mr-2">{c.userName}:</span>
                  <span className="text-slate-100">{c.content}</span>
                </div>
                {c.mediaTimestamp !== null && (
                  <span className="font-mono text-[10px] text-cinema-accent bg-cinema-accent/10 px-2 py-0.5 rounded">
                    {formatSecondsToTimestamp(c.mediaTimestamp)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="pt-4 flex items-center justify-between border-t border-cinema-border/60">
        <Link
          href="/"
          className="px-4 py-2.5 bg-cinema-card hover:bg-cinema-border text-xs font-bold text-white rounded-lg border border-cinema-border transition"
        >
          Start Another Watch Room
        </Link>

        <Link
          href={`/room/${slug}`}
          className="px-5 py-2.5 bg-cinema-accent hover:bg-indigo-600 text-xs font-bold text-white rounded-lg transition flex items-center space-x-2 shadow-lg shadow-cinema-accent/20"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Return to Watch Party</span>
        </Link>
      </div>
    </div>
  );
}
