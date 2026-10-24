/**
 * One look per chat, shared by both people: whoever picks a theme in the app changes it for the other too. Stored per
 * conversation (the canonical id of the two users). A theme id is just a short name the apps know ("ocean"); the server
 * only checks its shape, so a new theme needs no server change. `null` = the normal look.
 */
export const THEME_ID_RE = /^[a-z][a-z0-9-]{1,23}$/;

export interface ChatThemeRow { themeId: string; setBy: string; updatedAt: number }

export const cleanThemeId = (v: unknown): string | null | undefined => (v === null || v === 'default' ? null : typeof v === 'string' && THEME_ID_RE.test(v) ? v : undefined);

export interface ChatThemeStore {
  get(conversationId: string): Promise<ChatThemeRow | null>;
  /** themeId null removes it (back to the normal look) */
  set(conversationId: string, themeId: string | null, setBy: string, now: number): Promise<void>;
}

export class MemoryChatThemeStore implements ChatThemeStore {
  rows = new Map<string, ChatThemeRow>();
  async get(id: string) { return this.rows.get(id) ?? null; }
  async set(id: string, themeId: string | null, setBy: string, now: number) {
    if (themeId === null) this.rows.delete(id); else this.rows.set(id, { themeId, setBy, updatedAt: now });
  }
}

interface ColLike {
  findOne(q: any): Promise<any | null>;
  updateOne(q: any, u: any, o: any): Promise<unknown>;
  deleteOne(q: any): Promise<unknown>;
}
export class MongoChatThemeStore implements ChatThemeStore {
  constructor(private col: () => ColLike) {}
  async get(id: string) {
    const d = await this.col().findOne({ _id: id });
    return d && typeof d.themeId === 'string' ? { themeId: d.themeId, setBy: d.setBy, updatedAt: d.updatedAt } : null;
  }
  async set(id: string, themeId: string | null, setBy: string, now: number) {
    if (themeId === null) await this.col().deleteOne({ _id: id });
    else await this.col().updateOne({ _id: id }, { $set: { themeId, setBy, updatedAt: now } }, { upsert: true });
  }
}
