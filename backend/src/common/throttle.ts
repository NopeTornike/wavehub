// Per-IP overrides for authenticated write endpoints that are abusable at volume (spam, storage
// filling, notification flooding). Tighter than the global 100/min default but loose enough that a
// real user never notices. Credential/brute-force endpoints have their own stricter limits (5/min,
// see auth.controller.ts). Applied with `@Throttle(UPLOAD_THROTTLE)` etc.
export const UPLOAD_THROTTLE = { default: { limit: 20, ttl: 60_000 } };
// Listing photos: up to 6 per post, and a seller may post several in a row — 20/min refused the
// photos of the 4th post and the failed publishes were retried into duplicate listings (2026-10-07).
export const LISTING_PHOTO_THROTTLE = { default: { limit: 60, ttl: 60_000 } };
export const MESSAGE_THROTTLE = { default: { limit: 40, ttl: 60_000 } };
export const CREATE_THROTTLE = { default: { limit: 15, ttl: 60_000 } };
// Account lookups (e.g. a tournament captain checking a teammate's username) — enough for filling a
// roster, too few to walk the user table.
export const LOOKUP_THROTTLE = { default: { limit: 30, ttl: 60_000 } };
// Public search-as-you-type (users/search): the frontend debounces, so a person typing stays well
// under this; it still stops anyone walking the whole user table.
export const SEARCH_THROTTLE = { default: { limit: 60, ttl: 60_000 } };
