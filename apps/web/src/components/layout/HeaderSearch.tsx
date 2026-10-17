'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Film, Gamepad2, Loader2, Play, Plus, Search, TriangleAlert, Users, X } from 'lucide-react';
import { tmdbImageUrl, type CatalogTitle } from '@synccinema/common';
import { getStoredSession } from '../../lib/api';
import { catalogApi, CatalogApiError } from '../../lib/catalog/api';
import {
  announceSuggestions,
  buildSuggestions,
  classifySearchInput,
  enterDestination,
  flattenOptions,
  shouldSearchCatalog,
  type CatalogSuggestState,
  type SuggestionOption
} from '../../lib/headerSearch';

const DEBOUNCE_MS = 280;

/**
 * THE search of the app. One input that understands a pasted YouTube link (starts a party), a room link or code
 * (opens the room) and free text (live suggestions: movies and shows, games, join room; Enter opens /discover?q=).
 * Accessible combobox: arrow keys, Enter, Escape, click outside closes, result count announced politely.
 */
export function HeaderSearch({
  variant,
  placeholder,
  autoFocus = false,
  busy = false,
  onLaunchVideo,
  onDone
}: {
  variant: 'bar' | 'sheet';
  placeholder: string;
  autoFocus?: boolean;
  busy?: boolean;
  /** start an instant watch party (with the video when an id is given); the header owns the create-room flow */
  onLaunchVideo: (ytId?: string) => void;
  /** called after something was chosen / submitted (the mobile sheet closes itself) */
  onDone?: () => void;
}) {
  const router = useRouter();
  const uid = useId();
  const listId = `${uid}-list`;
  const optId = (o: SuggestionOption) => `${uid}-${o.id}`;
  const wrapRef = useRef<HTMLFormElement>(null);

  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [signedIn, setSignedIn] = useState(false);
  const [catalog, setCatalog] = useState<CatalogTitle[]>([]);
  const [catalogState, setCatalogState] = useState<CatalogSuggestState>('idle');

  const intent = useMemo(() => classifySearchInput(value), [value]);
  const searchText = shouldSearchCatalog(intent) ? intent.text : '';

  const refreshSession = useCallback(() => {
    const s = getStoredSession();
    setSignedIn(Boolean(s && s.token && s.user && !s.user.isAnonymous));
  }, []);
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Debounced catalog suggestions. A new keystroke cancels the previous request (AbortController).
  useEffect(() => {
    if (!searchText) {
      setCatalog([]);
      setCatalogState('idle');
      return;
    }
    if (!signedIn) {
      setCatalog([]);
      setCatalogState('guest'); // the catalog routes need an account: guests get rooms, links and games only
      return;
    }
    setCatalogState((s) => (s === 'ok' ? s : 'loading'));
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      catalogApi
        .search(new URLSearchParams({ q: searchText }), ctrl.signal)
        .then((r) => {
          setCatalog(r.results.slice(0, 5));
          setCatalogState('ok');
        })
        .catch((e) => {
          if (e?.name === 'AbortError') return;
          setCatalog([]);
          // 503 CATALOG_NOT_CONFIGURED: no "Movies & shows" group and no error row; Enter still opens /discover,
          // which shows the owner setup message. Anything else shows a quiet "Search unavailable" row.
          setCatalogState(e instanceof CatalogApiError && e.notConfigured ? 'not_configured' : 'unavailable');
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [searchText, signedIn]);

  const groups = useMemo(() => buildSuggestions({ intent, catalog, catalogState }), [intent, catalog, catalogState]);
  const options = useMemo(() => flattenOptions(groups), [groups]);
  const live = announceSuggestions(groups, catalogState, intent);
  useEffect(() => setActive(-1), [groups]);

  // click outside closes
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const finish = () => {
    setOpen(false);
    setActive(-1);
    onDone?.();
  };
  const choose = (o: SuggestionOption) => {
    if (o.disabled) return;
    if (o.kind === 'youtube') {
      finish();
      onLaunchVideo(o.youtubeId);
      return;
    }
    if (o.href) {
      finish();
      setValue('');
      router.push(o.href);
    }
  };
  const submit = () => {
    const dest = enterDestination(intent);
    if (!dest) return;
    finish();
    if (dest.type === 'youtube') onLaunchVideo(dest.id);
    else {
      setValue('');
      router.push(dest.href);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!options.length) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % options.length : i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0 && options[active]) choose(options[active]);
      else submit();
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setActive(-1);
      }
    }
  };

  const expanded = open && intent.kind !== 'empty';
  const showList = expanded && (groups.length > 0 || catalogState === 'loading' || (catalogState === 'ok' && intent.kind === 'text'));
  const activeId = showList && active >= 0 && options[active] ? optId(options[active]) : undefined;
  const ytId = intent.kind === 'youtube' ? intent.id : null;

  const iconFor = (o: SuggestionOption) => {
    if (o.kind === 'title') {
      const src = tmdbImageUrl(o.posterPath, 'w92');
      return src ? <img src={src} alt="" loading="lazy" decoding="async" className="h-10 w-7 shrink-0 rounded object-cover" /> : <span className="flex h-10 w-7 shrink-0 items-center justify-center rounded bg-zinc-200 text-zinc-400 dark:bg-[#1c1d25]"><Film className="h-4 w-4" aria-hidden="true" /></span>;
    }
    const cls = 'flex h-8 w-7 shrink-0 items-center justify-center text-zinc-500 dark:text-zinc-400';
    if (o.kind === 'game') return <span className={cls}><Gamepad2 className="h-4 w-4" aria-hidden="true" /></span>;
    if (o.kind === 'room') return <span className={cls}><Users className="h-4 w-4" aria-hidden="true" /></span>;
    if (o.kind === 'youtube') return <span className={cls}><Play className="h-4 w-4" aria-hidden="true" /></span>;
    if (o.kind === 'all') return <span className={cls}><ArrowRight className="h-4 w-4" aria-hidden="true" /></span>;
    return <span className={cls}><TriangleAlert className="h-4 w-4 text-amber-500" aria-hidden="true" /></span>;
  };

  const listBox = showList && (
    <div
      className={
        variant === 'bar'
          ? 'absolute left-0 right-0 top-full z-40 mt-1.5 max-h-[70vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 text-left shadow-md dark:border-white/10 dark:bg-[#14151b]'
          : 'mt-2 max-h-[55vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 text-left dark:border-white/10 dark:bg-[#14151b]'
      }
    >
      <ul id={listId} role="listbox" aria-label="Search suggestions" className="space-y-1">
        {groups.map((g) => (
          <li key={g.id} role="presentation">
            <div role="group" aria-label={g.label}>
              {g.id !== 'all' && <div className="px-2 pb-0.5 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400" aria-hidden="true">{g.label}</div>}
              <ul role="presentation">
                {g.options.map((o) => {
                  const index = options.findIndex((x) => x.id === o.id);
                  const isActive = index === active && index >= 0;
                  return (
                    <li
                      key={o.id}
                      id={optId(o)}
                      role="option"
                      aria-selected={isActive}
                      aria-disabled={o.disabled || undefined}
                      onMouseEnter={() => !o.disabled && setActive(index)}
                      onMouseDown={(e) => e.preventDefault() /* keep focus in the input */}
                      onClick={() => choose(o)}
                      className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-xs ${o.disabled ? 'cursor-default' : 'cursor-pointer'} ${isActive ? 'bg-zinc-100 dark:bg-white/10' : ''}`}
                    >
                      {iconFor(o)}
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate ${o.kind === 'all' ? 'font-semibold text-[#ee1d49]' : 'font-semibold text-zinc-900 dark:text-white'}`}>{o.label}</span>
                        {o.detail && <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">{o.detail}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </li>
        ))}
        {catalogState === 'loading' && (
          <li role="presentation" className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" /> Searching movies and shows
          </li>
        )}
        {catalogState === 'ok' && groups.length === 0 && (
          <li role="presentation" className="px-2 py-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">No quick matches. Press Enter to search all results.</li>
        )}
      </ul>
    </div>
  );

  const field = (
    <div className={variant === 'bar' ? 'flex w-full items-center' : 'flex items-center rounded-2xl border border-zinc-300 bg-white px-3 py-2.5 text-xs text-zinc-900 focus-within:border-[#ee1d49] dark:border-white/15 dark:bg-[#0c0d12] dark:text-white'}>
      <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-zinc-400 sm:h-4 sm:w-4" aria-hidden="true" />
      <input
        type="text"
        role="combobox"
        aria-label="Search"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus={autoFocus}
        maxLength={300}
        placeholder={placeholder}
        value={value}
        onFocus={() => {
          refreshSession();
          setOpen(true);
        }}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="w-full truncate border-none bg-transparent text-[11px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-zinc-500 sm:text-xs"
      />
      {value && (
        <button type="button" onClick={() => { setValue(''); setOpen(false); }} aria-label="Clear search" className="ml-1 shrink-0 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      {variant === 'bar' &&
        (ytId ? (
          <button type="submit" disabled={busy} className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-[#ee1d49] px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-[#d6143c] disabled:opacity-50 sm:px-3">
            <Play className="h-3 w-3 fill-current" aria-hidden="true" />
            <span className="hidden xs:inline">Launch</span>
          </button>
        ) : (
          <button type="button" onClick={() => onLaunchVideo()} disabled={busy} title="Create instant watch party" aria-label="Create instant watch party" className="ml-1 shrink-0 p-1 text-slate-400 transition hover:text-slate-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-white">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        ))}
    </div>
  );

  return (
    <form
      ref={wrapRef}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={variant === 'bar' ? 'relative hidden w-64 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 transition focus-within:border-[#ee1d49] dark:border-white/[0.08] dark:bg-[#14151b] dark:text-white sm:flex md:w-80 lg:w-96 sm:px-4 sm:py-2' : 'space-y-3'}
    >
      {field}
      {listBox}
      <p className="sr-only" role="status" aria-live="polite">{live}</p>
      {variant === 'sheet' && (
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[10.5px] text-slate-500 dark:text-zinc-400">{ytId ? 'YouTube video found' : 'Titles, games, a YouTube link or a room code'}</p>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => { finish(); onLaunchVideo(); }} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5">New Room</button>
            <button type="submit" disabled={!value.trim() || busy} className="flex items-center gap-1.5 rounded-xl bg-[#ee1d49] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[#d6143c] disabled:cursor-not-allowed disabled:opacity-50">
              {ytId && <Play className="h-3 w-3 fill-current" aria-hidden="true" />}
              <span>{ytId ? 'Launch' : 'Go'}</span>
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
