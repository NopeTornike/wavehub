import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const SKIP_PATHS = new Set(['/health']);

// Access log without PII: one JSON line per finished request with method, route-ish path (ids
// collapsed to `:id`, query string dropped entirely), status, duration and a request id — and
// nothing else. No IP address, cookies, headers, bodies, usernames or user ids. The request id is
// echoed as `X-Request-Id` so a user-reported failure can be matched to a log line (and to the
// error filter's line) without logging who they are. Set REQUEST_LOG=off to silence.
export function requestLogger() {
  const logger = new Logger('HTTP');
  const enabled = (process.env.REQUEST_LOG || 'on').toLowerCase() !== 'off' && process.env.NODE_ENV !== 'test';

  return (req: Request & { requestId?: string }, res: Response, next: NextFunction) => {
    const incoming = req.headers['x-request-id'];
    // Only adopt a client-supplied id if it is short and harmless; otherwise mint our own.
    req.requestId = typeof incoming === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    if (!enabled) return next();

    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const path = req.path;
      if (SKIP_PATHS.has(path)) return;
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      logger.log(
        JSON.stringify({
          rid: req.requestId,
          method: req.method,
          path: path.replace(UUID, ':id').slice(0, 200),
          status: res.statusCode,
          ms: Math.round(ms),
        }),
      );
    });
    next();
  };
}
