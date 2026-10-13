import { createHash, createHmac } from 'crypto';

// Keyed hash of an IP / user agent for login_events: equal inputs give equal hashes (so shared
// networks can be matched) but the raw value can't be read back, and without the server secret
// the hash can't be brute-forced from the IPv4 space. Key derived from JWT_SECRET (required, ≥32
// chars in production — config/).
function key(): Buffer {
  return createHash('sha256').update(`wavehub-login-hash:${process.env.JWT_SECRET ?? 'dev'}`).digest();
}

export function loginHash(value: string | undefined | null): string {
  return createHmac('sha256', key()).update(value || 'unknown').digest('hex');
}
