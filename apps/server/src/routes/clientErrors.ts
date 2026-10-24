import type { FastifyInstance } from 'fastify';
import { KeyedLimiter } from '../util/rateLimit.js';
import { cleanReport, fingerprint, type ClientErrorSink } from '../services/clientErrors.js';

export interface ClientErrorDeps {
  sink: ClientErrorSink;
  /** called once for a bug that was not seen before (a log line, so it shows up before users complain) */
  onNew?(id: string, summary: string): void;
  now?: () => number;
  perMinute?: number;
}

/**
 * `POST /api/client-errors`: the app reports a crash or an unexpected error. No sign-in needed (a crash can happen before
 * one), so it is limited per address, takes small bodies only and always answers 204 (the app never waits on it or retries a flood).
 */
export async function registerClientErrorRoutes(app: FastifyInstance, deps: ClientErrorDeps): Promise<void> {
  const limiter = new KeyedLimiter(deps.perMinute ?? 20, 60_000);
  const now = deps.now ?? Date.now;
  app.post('/api/client-errors', { bodyLimit: 16 * 1024 }, async (request, reply) => {
    if (limiter.hit(`ce:${request.ip}`)) return reply.code(429).send({ error: 'Too many reports' });
    const report = cleanReport(request.body);
    if (!report) return reply.code(400).send({ error: 'A message is required' });
    try {
      const id = fingerprint(report);
      if (await deps.sink.record(id, report, now())) deps.onNew?.(id, `${report.fatal ? 'FATAL ' : ''}${report.platform} ${report.appVersion} @${report.where}: ${report.message}`);
    } catch (err) {
      request.log.warn({ err: (err as Error)?.message }, 'could not store a client error report');
    }
    return reply.code(204).send();
  });
}
