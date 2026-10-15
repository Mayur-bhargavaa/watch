'use client';

import React, { useState } from 'react';
import { Film, X } from 'lucide-react';
import type { ChatMoviePayload } from '@/types/chat';
import { DialogShell, FIELD_CLASS, LABEL_CLASS, PRIMARY_BTN, SECONDARY_BTN } from './DialogShell';

/** Only what the user typed is shared. (It used to attach an invented year, runtime, 8.6 rating and a stock poster.) */
export function buildMoviePayload(title: string, genresText: string): ChatMoviePayload | null {
  const cleanTitle = title.trim();
  if (!cleanTitle) return null;
  const genres = genresText.split(',').map((g) => g.trim()).filter(Boolean);
  return {
    movieId: `m-${Date.now()}`,
    title: cleanTitle,
    ...(genres.length > 0 ? { genres } : {})
  };
}

export const MovieDialog: React.FC<{ onSend: (movie: ChatMoviePayload) => void; onClose: () => void }> = ({ onSend, onClose }) => {
  const [title, setTitle] = useState('');
  const [genres, setGenres] = useState('Sci-Fi, Adventure');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildMoviePayload(title, genres);
    if (!payload) return;
    onSend(payload);
    onClose();
  };

  return (
    <DialogShell label="Share movie" onClose={onClose} onSubmit={submit} panelClassName="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Film className="w-4 h-4 text-indigo-500" />
          <span>Share Movie</span>
        </h3>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label className={LABEL_CLASS}>Movie Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Interstellar, Inception, Dune..." required maxLength={100} autoFocus className={FIELD_CLASS} />
      </div>

      <div>
        <label className={LABEL_CLASS}>Genres</label>
        <input type="text" value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="e.g. Sci-Fi, Adventure" maxLength={100} className={FIELD_CLASS} />
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onClose} className={SECONDARY_BTN}>Cancel</button>
        <button type="submit" className={PRIMARY_BTN}>Share Movie</button>
      </div>
    </DialogShell>
  );
};
