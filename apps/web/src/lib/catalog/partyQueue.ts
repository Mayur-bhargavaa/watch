import type { SelectedTitle, TitleQueueEntry, TitleRoomState } from '@synccinema/common';

/** Pure view helpers for the room "Party queue" panel. */
export interface CountdownView {
  phase: 'none' | 'counting' | 'started';
  secondsLeft: number;
}
/** `serverNow` = Date.now() + clock offset from the existing sync:ping mechanism, so every client counts down together. */
export function countdownView(selected: SelectedTitle | null, serverNow: number): CountdownView {
  if (!selected || selected.startAt === null) return { phase: 'none', secondsLeft: 0 };
  const left = selected.startAt - serverNow;
  if (left <= 0) return { phase: 'started', secondsLeft: 0 };
  return { phase: 'counting', secondsLeft: Math.ceil(left / 1000) };
}
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
export function sortedQueue(queue: TitleQueueEntry[]): TitleQueueEntry[] {
  return [...queue].sort((a, b) => b.votes.length - a.votes.length || a.proposedAt - b.proposedAt);
}
export const hasVoted = (e: TitleQueueEntry, userId: string): boolean => e.votes.includes(userId);
export function readySummary(selected: SelectedTitle | null, memberCount: number): string {
  if (!selected) return '';
  return `${selected.ready.length} of ${Math.max(memberCount, selected.ready.length)} ready`;
}
/** Payload for host actions: carry the version we saw so a stale tab cannot overwrite newer state. */
export const versionOf = (s: TitleRoomState): number => s.selectionVersion;
/** Start time for "start in N minutes", always in server time. */
export function startAtIn(minutes: number, serverNow: number): number {
  return Math.round(serverNow + Math.max(1, Math.min(10, minutes)) * 60_000);
}
