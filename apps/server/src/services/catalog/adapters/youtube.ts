import { UpstreamClient } from '../upstream.js';

/**
 * YouTube Data API adapter (optional). Used ONLY to find an official trailer video id for a title. It never
 * reports availability, never returns stream URLs and is skipped entirely when YOUTUBE_API_KEY is not set.
 */
export interface YoutubeConfig {
  apiKey?: string;
}
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function normalizeTrailerId(raw: any): string | null {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  for (const it of items) {
    const id = it?.id?.videoId;
    if (typeof id === 'string' && VIDEO_ID_RE.test(id)) return id;
  }
  return null;
}

export class YoutubeAdapter {
  constructor(private cfg: YoutubeConfig, private http: UpstreamClient) {}
  get configured(): boolean {
    return Boolean(this.cfg.apiKey);
  }
  async trailerId(title: string, year: number | null): Promise<string | null> {
    const q = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '3', videoEmbeddable: 'true', q: `${title} ${year ?? ''} official trailer`.trim().slice(0, 150), key: this.cfg.apiKey || '' });
    return normalizeTrailerId(await this.http.getJson(`https://www.googleapis.com/youtube/v3/search?${q.toString()}`));
  }

  async searchFullMovie(title: string, year: number | null): Promise<string | null> {
    if (!this.configured) return null;
    const q = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      videoDuration: 'long',
      videoEmbeddable: 'true',
      maxResults: '3',
      q: `${title} ${year ?? ''} full movie`.trim().slice(0, 150),
      key: this.cfg.apiKey || ''
    });
    return normalizeTrailerId(await this.http.getJson(`https://www.googleapis.com/youtube/v3/search?${q.toString()}`));
  }
}
