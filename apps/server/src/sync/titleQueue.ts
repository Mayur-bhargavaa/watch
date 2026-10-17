import {
  TITLE_COUNTDOWN_MAX_MS,
  TITLE_QUEUE_MAX,
  capabilitiesForProvider,
  parseTitleKey,
  type SelectedTitle,
  type TitleQueueEntry,
  type TitleRoomState
} from '@synccinema/common';
import { cleanSnapshot } from '../services/catalog/watchlist.js';

/**
 * Pure state machine for the room "Party queue" (Cineverse). RoomSyncManager stays the authority: it calls
 * applyTitleAction with the caller's verified identity/role and broadcasts the result.
 *
 * Rules
 *  - only room members may act (isMember)
 *  - propose: max TITLE_QUEUE_MAX titles; proposing a title that is already queued just adds your vote; the proposer votes for it
 *  - vote: one vote per member per title (voting again withdraws the vote)
 *  - confirm / clear: HOST only. Confirming NEVER issues playback commands, it only records the choice,
 *    the provider, an optional synchronized start time and the (re-validated) provider link
 *  - ready: any member, only for the currently selected title
 *  - every accepted change bumps `version`; confirm/ready/clear carrying a `version` older than `selectionVersion`
 *    are stale and ignored, so late messages after a reconnect cannot overwrite newer state
 */
export type TitleAction =
  | { type: 'room:title_propose'; payload: any }
  | { type: 'room:title_vote'; payload: any }
  | { type: 'room:title_confirm'; payload: any }
  | { type: 'room:title_ready'; payload: any }
  | { type: 'room:title_clear'; payload: any };

export interface TitleActor {
  userId: string;
  displayName: string;
  isHost: boolean;
  isMember: boolean;
}
export interface TitleApplyResult {
  ok: boolean;
  code?: 'NOT_MEMBER' | 'FORBIDDEN' | 'INVALID_TITLE' | 'QUEUE_FULL' | 'NOT_FOUND' | 'STALE_TITLE_STATE' | 'BAD_START_TIME' | 'NOTHING_SELECTED';
  message?: string;
  state: TitleRoomState;
}

const fail = (state: TitleRoomState, code: NonNullable<TitleApplyResult['code']>, message: string): TitleApplyResult => ({ ok: false, code, message, state });
const cleanProvider = (p: any): { id: string; name: string } | null =>
  p && typeof p.id === 'string' && typeof p.name === 'string' && p.id.length <= 32 && p.name.trim() ? { id: p.id.slice(0, 32), name: p.name.replace(/[<>]/g, '').trim().slice(0, 80) } : null;

export function applyTitleAction(
  state: TitleRoomState,
  action: TitleAction,
  actor: TitleActor,
  ctx: { now: number; destinationUrl?: string | null }
): TitleApplyResult {
  if (!actor.isMember) return fail(state, 'NOT_MEMBER', 'Only people in this room can use the party queue');
  const p = action.payload ?? {};
  const next: TitleRoomState = { ...state, queue: state.queue.map((q) => ({ ...q, votes: [...q.votes] })), selected: state.selected ? { ...state.selected, ready: [...state.selected.ready] } : null };
  const bump = () => {
    next.version = state.version + 1;
    return next;
  };

  switch (action.type) {
    case 'room:title_propose': {
      const snap = cleanSnapshot(p.snapshot);
      if (!snap || snap.titleKey !== p.titleKey || !parseTitleKey(p.titleKey)) return fail(state, 'INVALID_TITLE', 'That title could not be added');
      const existing = next.queue.find((q) => q.titleKey === snap.titleKey);
      if (existing) {
        if (existing.votes.includes(actor.userId)) return { ok: true, state }; // nothing changes
        existing.votes.push(actor.userId);
        return { ok: true, state: bump() };
      }
      if (next.queue.length >= TITLE_QUEUE_MAX) return fail(state, 'QUEUE_FULL', `The queue holds up to ${TITLE_QUEUE_MAX} titles`);
      const entry: TitleQueueEntry = {
        titleKey: snap.titleKey,
        snapshot: snap,
        proposedBy: { userId: actor.userId, displayName: actor.displayName.slice(0, 100) },
        provider: cleanProvider(p.provider),
        votes: [actor.userId],
        proposedAt: ctx.now
      };
      next.queue.push(entry);
      return { ok: true, state: bump() };
    }

    case 'room:title_vote': {
      const entry = next.queue.find((q) => q.titleKey === p.titleKey);
      if (!entry) return fail(state, 'NOT_FOUND', 'That title is not in the queue');
      const i = entry.votes.indexOf(actor.userId);
      if (i >= 0) entry.votes.splice(i, 1);
      else entry.votes.push(actor.userId);
      return { ok: true, state: bump() };
    }

    case 'room:title_confirm': {
      if (!actor.isHost) return fail(state, 'FORBIDDEN', 'Only the host can confirm a title');
      if (typeof p.version === 'number' && p.version < state.selectionVersion) return fail(state, 'STALE_TITLE_STATE', 'The room moved on; refreshed');
      const inQueue = next.queue.find((q) => q.titleKey === p.titleKey);
      const snap = inQueue?.snapshot ?? cleanSnapshot(p.snapshot);
      if (!snap || snap.titleKey !== p.titleKey) return fail(state, 'INVALID_TITLE', 'That title could not be confirmed');
      let startAt: number | null = null;
      if (p.startAt !== undefined && p.startAt !== null) {
        if (typeof p.startAt !== 'number' || !Number.isFinite(p.startAt) || p.startAt < ctx.now - 2000 || p.startAt > ctx.now + TITLE_COUNTDOWN_MAX_MS) {
          return fail(state, 'BAD_START_TIME', 'The start time must be within the next 10 minutes');
        }
        startAt = Math.round(p.startAt);
      }
      const provider = cleanProvider(p.provider) ?? inQueue?.provider ?? null;
      const selected: SelectedTitle = {
        titleKey: snap.titleKey,
        snapshot: snap,
        provider,
        destinationUrl: provider ? ctx.destinationUrl ?? null : null,
        capabilities: capabilitiesForProvider(provider?.name),
        startAt,
        ready: [],
        confirmedBy: { userId: actor.userId, displayName: actor.displayName.slice(0, 100) },
        confirmedAt: ctx.now
      };
      next.queue = next.queue.filter((q) => q.titleKey !== snap.titleKey);
      next.selected = selected;
      bump();
      next.selectionVersion = next.version;
      return { ok: true, state: next };
    }

    case 'room:title_ready': {
      if (!next.selected) return fail(state, 'NOTHING_SELECTED', 'No title is selected');
      if (typeof p.version === 'number' && p.version < state.selectionVersion) return fail(state, 'STALE_TITLE_STATE', 'The room moved on; refreshed');
      if (next.selected.titleKey !== p.titleKey) return fail(state, 'STALE_TITLE_STATE', 'The room moved on; refreshed');
      if (next.selected.ready.includes(actor.userId)) return { ok: true, state };
      next.selected.ready.push(actor.userId);
      return { ok: true, state: bump() };
    }

    case 'room:title_clear': {
      if (!actor.isHost) return fail(state, 'FORBIDDEN', 'Only the host can clear the selected title');
      if (typeof p.version === 'number' && p.version < state.selectionVersion) return fail(state, 'STALE_TITLE_STATE', 'The room moved on; refreshed');
      if (!next.selected) return { ok: true, state };
      next.selected = null;
      bump();
      next.selectionVersion = next.version;
      return { ok: true, state: next };
    }
  }
  return fail(state, 'INVALID_TITLE', 'Unknown action');
}
