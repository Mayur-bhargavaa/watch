import type { PlaybackStateEnum } from '@synccinema/common';

/**
 * Who may do what to the room's video. The host and co-hosts control everything (play, pause, seek). Every other person in
 * the room may PLAY and PAUSE for everybody, but not seek: their play/pause always acts at the room's own position, never at
 * a position they send, so one person's buffering or scrubbing cannot move the video for the others.
 */
export const GUEST_COMMAND_GAP_MS = 400;

export type PlaybackDecision =
  | { type: 'deny'; message: string }
  /** nothing to do (already in that state, or a repeat tap): no new version is made, nobody is disturbed */
  | { type: 'ignore' }
  | { type: 'apply'; position: number };

export function decidePlayback(i: {
  isController: boolean;
  action: 'PLAY' | 'PAUSE' | 'SEEK';
  state: PlaybackStateEnum;
  /** where the video is right now, by the room's clock */
  authoritative: number;
  /** the room's stored position (where it stopped, when paused) */
  storedPosition: number;
  /** the position the sender asked for */
  requested: number;
  sinceLastGuestCommandMs: number;
}): PlaybackDecision {
  if (i.isController) {
    // as before: a pause captures the exact current position, everything else goes where the controller says
    return { type: 'apply', position: i.action === 'PAUSE' && i.state === 'PLAYING' ? i.authoritative : i.requested };
  }
  if (i.action === 'SEEK') return { type: 'deny', message: 'Only the room host or co-hosts can skip ahead or back' };
  if (i.sinceLastGuestCommandMs < GUEST_COMMAND_GAP_MS) return { type: 'ignore' };
  const playing = i.state === 'PLAYING';
  if ((i.action === 'PLAY') === playing) return { type: 'ignore' };
  return { type: 'apply', position: i.action === 'PAUSE' ? i.authoritative : i.storedPosition };
}
