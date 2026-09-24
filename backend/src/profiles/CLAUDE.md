# backend/src/profiles

## Purpose
Follows and the computed half of the public profile (docs/design-mockups/12). The public profile
itself is still served by `users/users.controller.ts` (`GET users/:username`, declared in
ListingsModule); it spreads `ProfilesService.facts()` into the response.

## Key files
- `user-follow.entity.ts` — `user_follows` (PK follower+followee, CHECK not self, both FKs cascade).
- `profiles.service.ts` — `follow` / `unfollow` (idempotent, `orIgnore` insert; self → 400) /
  `status`, and `facts(userId, lastSeenAt, activeListingCount)`.
- `profiles.controller.ts` — `GET users/:username/follow-status`, `POST|DELETE users/:username/follow`
  (all `AuthGuard`; follow is `CREATE_THROTTLE`d).

## Computed facts (all from real rows)
- `role`: `coach` (verified coach) › `seller` (active listings or a completed sale) › `player`.
- `completedDeals` = completed orders + completed coaching sessions, as seller/coach and as buyer.
- `reviews`: published marketplace reviews of the user as seller **plus** coaching session reviews
  of them as coach — count, 1-decimal average, 5→1 star distribution, latest 3 (buyer username only).
- `waveRank` from `community/` (which counts coaching too).
- `online`: last authenticated request within the community window — shown publicly on profiles,
  same presence signal as the coach cards.
- `badges` (earned only): the Wave tier; `champion` (captained a team that won a recorded final) or
  `finalist` (played a final); `coach` (verified coach); `top-rated` (≥4.8 from ≥5 reviews);
  `trusted-seller` (≥10 completed sales and ≥4.5 average); `deals-100` (≥100 deals) or `first-deal`.
- `shortId` = first 8 hex chars of the user id (the design's "WaveHubX ID"); `userId` is public like
  `PublicSeller.id`.

Self-entered profile fields live on `users` (migration `1784356000000-ProfilesAndFollows`):
`location`, `tagline`, `platform`, `preferredRole`, `achievement`, edited via `PATCH /me/profile`.

## Tests
`test/profiles.e2e-spec.ts` (fields + privacy sweep, follow rules, deals/reviews → role/badges).
