'use client';

import { formatSecondsToTimestamp } from '@synccinema/common';

interface HeatmapBucket {
  bucketStart: number;
  count: number;
  topEmoji: string;
}

interface ReactionHeatmapProps {
  buckets: HeatmapBucket[];
  durationSeconds?: number;
  onSeek?: (timestamp: number) => void;
}

export function ReactionHeatmap({ buckets, durationSeconds = 3600, onSeek }: ReactionHeatmapProps) {
  if (buckets.length === 0) {
    return (
      <div className="p-6 text-center text-cinema-muted text-xs bg-cinema-base/40 rounded-xl border border-cinema-border">
        No reactions recorded yet. React while watching to build the heatmap!
      </div>
    );
  }

  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  return (
    <div className="w-full bg-cinema-card rounded-xl p-4 border border-cinema-border space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
        <span>🔥 Reaction Intensity Timeline</span>
        <span className="text-cinema-muted">Click any peak to jump to that moment</span>
      </div>

      <div className="h-28 flex items-end space-x-1.5 pt-4 pb-1 overflow-x-auto">
        {buckets.map((b) => {
          const heightPercent = Math.max(15, Math.round((b.count / maxCount) * 100));
          return (
            <button
              key={b.bucketStart}
              onClick={() => onSeek && onSeek(b.bucketStart)}
              className="flex-1 min-w-[28px] max-w-[48px] group flex flex-col items-center justify-end h-full hover:opacity-80 transition"
            >
              <span className="text-xs mb-1 opacity-0 group-hover:opacity-100 transition">
                {b.topEmoji}
              </span>
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-cinema-accent to-cinema-neon group-hover:from-indigo-400 group-hover:to-pink-400 transition"
                style={{ height: `${heightPercent}%` }}
              />
              <span className="text-[10px] font-mono text-cinema-muted mt-1 truncate">
                {formatSecondsToTimestamp(b.bucketStart)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
