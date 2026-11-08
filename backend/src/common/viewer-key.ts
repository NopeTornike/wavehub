import { createHash } from 'crypto';
import type { Request } from 'express';

// A short hash of the visitor's IP + user agent: enough to tell visitors apart for view counting
// (one view per visitor per hour). Never stored or logged.
export function viewerKey(req: Request): string {
  return createHash('sha256').update(`${req.ip ?? ''}|${req.headers['user-agent'] ?? ''}`).digest('base64url').slice(0, 22);
}
