// Per-IP overrides for authenticated write endpoints that are abusable at volume (spam, storage
// filling, notification flooding). Tighter than the global 100/min default but loose enough that a
// real user never notices. Credential/brute-force endpoints have their own stricter limits (5/min,
// see auth.controller.ts). Applied with `@Throttle(UPLOAD_THROTTLE)` etc.
export const UPLOAD_THROTTLE = { default: { limit: 20, ttl: 60_000 } };
export const MESSAGE_THROTTLE = { default: { limit: 40, ttl: 60_000 } };
export const CREATE_THROTTLE = { default: { limit: 15, ttl: 60_000 } };
