'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { LINK_TITLE_MAX, normalizeLinkUrl, youtubeIdFromUrl, youtubeThumbnail } from '@synccinema/common';
import { useWatchlist } from '../../lib/catalog/watchlist';
import { defaultLinkTitle } from '../../lib/catalog/watchlistView';
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS, SURFACE } from '../discover/ui';

const INPUT = `w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-white/10 dark:bg-[#0c0d12] dark:text-white ${FOCUS}`;

/** "Add a link": a YouTube video or any https page. Nothing is fetched from the URL; the title is what you type. */
export function AddLinkDialog({ onClose }: { onClose: () => void }) {
  const wl = useWatchlist();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    urlRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  const normalized = normalizeLinkUrl(url);
  const yt = normalized ? youtubeIdFromUrl(normalized) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalized) {
      setError('Enter a full https:// link, for example a YouTube video.');
      urlRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const res = await wl.saveLink({ url: normalized, title: title.trim() || defaultLinkTitle(normalized) || 'Saved link' });
    setBusy(false);
    if (res.ok) {
      wl.dismissNotice();
      onClose();
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="add-link-title">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <form onSubmit={submit} className={`${SURFACE} relative w-full max-w-md space-y-3 rounded-2xl p-4 sm:p-5`}>
        <div className="flex items-center justify-between">
          <h2 id="add-link-title" className="text-base font-bold text-zinc-900 dark:text-white">Add a link</h2>
          <button type="button" onClick={onClose} aria-label="Close" className={`rounded p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white ${FOCUS}`}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div>
          <label htmlFor="wl-url" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300">Link</label>
          <input ref={urlRef} id="wl-url" type="url" inputMode="url" value={url} onChange={(e) => { setUrl(e.target.value); setError(null); }} placeholder="https://www.youtube.com/watch?v=..." maxLength={2048} autoComplete="off" aria-invalid={error ? true : undefined} aria-describedby={error ? 'wl-err' : 'wl-hint'} className={`${INPUT} mt-1`} />
          <p id="wl-hint" className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">https links only. YouTube links get their thumbnail automatically.</p>
        </div>
        <div>
          <label htmlFor="wl-title" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300">Title (optional)</label>
          <input id="wl-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={normalized ? defaultLinkTitle(normalized) : 'What is it?'} maxLength={LINK_TITLE_MAX} className={`${INPUT} mt-1`} />
        </div>
        {yt && (
          <div className="flex items-center gap-3 rounded-md border border-zinc-200 p-2 dark:border-white/10">
            <img src={youtubeThumbnail(yt)} alt="" className="h-12 w-20 shrink-0 rounded object-cover" referrerPolicy="no-referrer" />
            <p className="text-xs text-zinc-600 dark:text-zinc-300">YouTube video detected. A watch party will play it in sync.</p>
          </div>
        )}
        {error && <p id="wl-err" role="alert" className="text-xs text-amber-600 dark:text-amber-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
          <button type="submit" disabled={busy || !url.trim()} className={BTN_PRIMARY}>
            {busy && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />} Add to Watchlist
          </button>
        </div>
      </form>
    </div>
  );
}
