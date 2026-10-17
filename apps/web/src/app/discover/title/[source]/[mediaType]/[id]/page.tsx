'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { isValidTitleRef, type CatalogSource } from '@synccinema/common';
import { DiscoverShell, cleanRoomParam } from '../../../../../../components/discover/Shell';
import { TitleDetail } from '../../../../../../components/discover/TitleDetail';

function Inner() {
  const p = useParams<{ source: string; mediaType: string; id: string }>();
  const roomSlug = cleanRoomParam(useSearchParams().get('room'));
  // strict allow-list shared with the server: tmdb (movie|tv) and tvmaze (tv only), numeric id
  const valid = isValidTitleRef(p.source, p.mediaType, p.id);
  if (!valid) {
    return (
      <div className="space-y-2">
        <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">Title not found</h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">That link does not point to a title we know.</p>
        <Link href="/discover" className="text-xs sm:text-sm font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 underline">Back to Discover</Link>
      </div>
    );
  }
  return <TitleDetail source={p.source as CatalogSource} mediaType={p.mediaType} id={p.id} roomSlug={roomSlug} />;
}

export default function TitlePage() {
  return (
    <DiscoverShell>
      <Suspense fallback={null}>
        <Inner />
      </Suspense>
    </DiscoverShell>
  );
}
