import { WATCHLIST_MAX_ITEMS, type LinkSnapshot, type TitleSnapshot, type WatchlistItem } from '@synccinema/common';
import { linkTitleKey } from '@synccinema/common';
import { EMPTY_WATCHLIST, isSaved, watchlistReducer, type WatchlistModel, type WatchlistSnapshot } from './watchlistState';

/**
 * THE watchlist store: one module-level cache with subscribers (like the membership / billing caches), shared by every
 * save and remove button in the app. Optimistic updates with rollback, de-duplicated requests, signed-in accounts only.
 * Pure of React and of the network (the real API is injected), so it is unit tested.
 */
export interface WatchlistNotice {
  id: number;
  text: string;
  tone: 'error' | 'info';
  /** true when the notice should offer a sign-in link */
  signIn?: boolean;
}
export interface WatchlistView {
  /** the session has been checked (false during server render and the first paint) */
  ready: boolean;
  signedIn: boolean;
  loaded: boolean;
  loadFailed: boolean;
  items: WatchlistItem[];
  max: number;
  notice: WatchlistNotice | null;
}
export type MutationResult =
  | { ok: true; duplicate: boolean; titleKey: string }
  | { ok: false; reason: 'signin' | 'full' | 'invalid' | 'error'; message: string };

export interface StoreDeps {
  /** the signed-in (non-guest) account, or null */
  getUser(): { id: string } | null;
  list(): Promise<{ items: WatchlistItem[]; max?: number }>;
  addTitle(snap: TitleSnapshot): Promise<{ duplicate: boolean }>;
  addLink(link: LinkSnapshot): Promise<{ duplicate: boolean; titleKey?: string }>;
  remove(titleKey: string): Promise<unknown>;
  now(): number;
  /** tell other tabs the list changed (optional) */
  announce?(): void;
}

export const SERVER_VIEW: WatchlistView = { ready: false, signedIn: false, loaded: false, loadFailed: false, items: [], max: WATCHLIST_MAX_ITEMS, notice: null };

const messageFor = (e: unknown, max: number): { reason: 'signin' | 'full' | 'invalid' | 'error'; message: string } => {
  const code = (e as any)?.code;
  const status = (e as any)?.status;
  if (code === 'WATCHLIST_FULL') return { reason: 'full', message: `Your watchlist is full (${max} items). Remove something to add more.` };
  if (status === 401) return { reason: 'signin', message: 'Sign in to save to your watchlist.' };
  if (status === 400) return { reason: 'invalid', message: 'That item cannot be saved.' };
  if (status === 429) return { reason: 'error', message: 'Too many changes at once. Wait a moment and try again.' };
  return { reason: 'error', message: 'Could not update your watchlist. Try again.' };
};

export function createWatchlistStore(deps: StoreDeps) {
  let model: WatchlistModel = EMPTY_WATCHLIST;
  let userId: string | null = null;
  let ready = false;
  let loadFailed = false;
  let max = WATCHLIST_MAX_ITEMS;
  let notice: WatchlistNotice | null = null;
  let noticeSeq = 0;
  let loading: Promise<void> | null = null;
  const inflight = new Map<string, Promise<MutationResult>>();
  const subs = new Set<() => void>();
  let view: WatchlistView = SERVER_VIEW;

  const compute = (): WatchlistView => ({ ready, signedIn: userId !== null, loaded: model.loaded, loadFailed, items: model.items, max, notice });
  const emit = () => {
    view = compute();
    subs.forEach((f) => f());
  };
  const say = (text: string, tone: 'error' | 'info', signIn = false) => {
    notice = { id: ++noticeSeq, text, tone, signIn };
  };

  /** Re-reads the session. A different account (or sign-out) drops everything cached for the previous one. */
  function syncSession(): string | null {
    const id = deps.getUser()?.id ?? null;
    if (!ready || id !== userId) {
      if (id !== userId) {
        model = EMPTY_WATCHLIST;
        loading = null;
        loadFailed = false;
        inflight.clear();
        max = WATCHLIST_MAX_ITEMS;
      }
      userId = id;
      ready = true;
      emit();
    }
    return userId;
  }

  function ensureLoaded(force = false): Promise<void> {
    const uid = syncSession();
    if (!uid) return Promise.resolve();
    if (model.loaded && !force) return Promise.resolve();
    if (loading) return loading; // concurrent callers share one request
    const p: Promise<void> = deps
      .list()
      .then((r) => {
        if (userId !== uid) return; // signed out / switched account while loading
        model = watchlistReducer(model, { type: 'loaded', items: r.items });
        if (typeof r.max === 'number') max = r.max;
        loadFailed = false;
      })
      .catch(() => {
        if (userId === uid) loadFailed = true;
      })
      .finally(() => {
        if (loading === p) loading = null;
        emit();
      });
    loading = p;
    return p;
  }

  function fail(result: Extract<MutationResult, { ok: false }>): MutationResult {
    say(result.message, 'error', result.reason === 'signin');
    emit();
    return result;
  }

  /** Synchronous up to the point the request is registered, so two quick clicks can never both go out. */
  function run(key: string, op: 'add' | 'remove', snapshot: WatchlistSnapshot | null, send: () => Promise<{ duplicate?: boolean; titleKey?: string } | unknown>): Promise<MutationResult> {
    const uid = syncSession();
    if (!uid) return Promise.resolve(fail({ ok: false, reason: 'signin', message: 'Sign in to save to your watchlist.' }));
    const existing = inflight.get(key);
    if (existing) return existing;
    if (op === 'add' && !isSaved(model, key) && model.items.length >= max) {
      return Promise.resolve(fail({ ok: false, reason: 'full', message: `Your watchlist is full (${max} items). Remove something to add more.` }));
    }
    model = watchlistReducer(model, op === 'add' ? { type: 'optimistic-add', snapshot: snapshot as WatchlistSnapshot, now: deps.now() } : { type: 'optimistic-remove', titleKey: key });
    emit();
    const p: Promise<MutationResult> = (async (): Promise<MutationResult> => {
      try {
        const r = (await send()) as { duplicate?: boolean } | undefined;
        if (userId === uid) model = watchlistReducer(model, { type: 'confirm', titleKey: key });
        deps.announce?.();
        return { ok: true, duplicate: Boolean(r && (r as any).duplicate), titleKey: key };
      } catch (e) {
        if (userId === uid) model = watchlistReducer(model, { type: 'rollback', titleKey: key });
        const m = messageFor(e, max);
        say(m.message, 'error', m.reason === 'signin');
        return { ok: false, ...m };
      } finally {
        inflight.delete(key);
        emit();
      }
    })();
    inflight.set(key, p);
    return p;
  }

  const store = {
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
    getView: () => view,
    /** Called when a component mounts: checks the session and loads the list once (shared request). */
    start(): Promise<void> {
      return ensureLoaded();
    },
    reload: () => ensureLoaded(true),
    isSaved: (titleKey: string) => isSaved(model, titleKey),
    /** Adds a title or link (a duplicate is fine and reported). */
    async save(snapshot: WatchlistSnapshot): Promise<MutationResult> {
      if (!syncSession()) return fail({ ok: false, reason: 'signin', message: 'Sign in to save to your watchlist.' });
      return run(snapshot.titleKey, 'add', snapshot, () =>
        'url' in snapshot ? deps.addLink({ title: snapshot.title, url: snapshot.url, platform: snapshot.platform, thumbnail: snapshot.thumbnail, category: snapshot.category, tagline: snapshot.tagline }) : deps.addTitle(snapshot)
      );
    },
    /** Adds a link from raw input. Returns a refusal (not a throw) for URLs the server would refuse anyway. */
    async saveLink(link: LinkSnapshot): Promise<MutationResult> {
      const titleKey = linkTitleKey(link.url);
      if (!titleKey) return fail({ ok: false, reason: 'invalid', message: 'Enter a full https:// link.' });
      return store.save({ kind: 'link', titleKey, title: link.title, url: link.url, platform: link.platform ?? '', thumbnail: link.thumbnail ?? null, category: link.category ?? null, tagline: link.tagline ?? null });
    },
    async remove(titleKey: string): Promise<MutationResult> {
      if (!syncSession()) return fail({ ok: false, reason: 'signin', message: 'Sign in to manage your watchlist.' });
      await ensureLoaded();
      return run(titleKey, 'remove', null, () => deps.remove(titleKey));
    },
    /** Save when not saved, remove when saved. Waits for the first load so it never guesses. */
    async toggle(snapshot: WatchlistSnapshot): Promise<MutationResult> {
      if (!syncSession()) return fail({ ok: false, reason: 'signin', message: 'Sign in to save to your watchlist.' });
      await ensureLoaded();
      return isSaved(model, snapshot.titleKey) ? run(snapshot.titleKey, 'remove', null, () => deps.remove(snapshot.titleKey)) : store.save(snapshot);
    },
    dismissNotice() {
      if (!notice) return;
      notice = null;
      emit();
    },
    notify(text: string, tone: 'error' | 'info' = 'info') {
      say(text, tone);
      emit();
    }
  };
  return store;
}
export type WatchlistStore = ReturnType<typeof createWatchlistStore>;
