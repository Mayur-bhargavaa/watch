/**
 * Error text that is safe to show to API clients.
 * Business-rule errors thrown by our own code ("Room is full", "Room code not found"...) are shown as written;
 * anything that looks like it came from a driver, the database or the runtime (stack frames, SQLite/Mongo
 * messages, errno codes, constraint names, file paths) is replaced by a generic fallback.
 */
const INTERNAL = /(sqlite|mongo|e11000|constraint|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ERR_[A-Z_]+|node:|\bat .+\(|\/Users\/|\/home\/|\\node_modules|TypeError|ReferenceError|SyntaxError|RangeError|cannot read propert|is not a function|undefined|\$[a-z]+ )/i;

export function publicMessage(err: unknown, fallback: string): string {
  const e = err as any;
  const msg = typeof e?.message === 'string' ? e.message : '';
  if (!msg || msg.length > 200) return fallback;
  if (e?.code && typeof e.code === 'string' && /^(E[A-Z0-9_]+|ERR_[A-Z_]+)$/.test(e.code)) return fallback; // errno-style codes
  if (e?.name && /^(Mongo|Sqlite|TypeError|ReferenceError|RangeError|SyntaxError|AssertionError)/.test(e.name)) return fallback;
  if (INTERNAL.test(msg)) return fallback;
  return msg;
}
