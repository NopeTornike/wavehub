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
- `badges` (since 2026-10-04): the stored grants from `backend/src/badges/` (`listVisible`, with
  `description` for tooltips) plus `champion` (captained a team that won a recorded final) or
  `finalist` (played a final). The old computed set (tier / coach / top-rated / trusted-seller /
  deals-100 / first-deal) is gone. The Wave tier is `waveRank`, and `facts()` calls
  `BadgesService.onRank` so the top tier earns Max Level.
- `shortId` = first 8 hex chars of the user id (the design's "WaveHubX ID"); `userId` is public like
  `PublicSeller.id`.

Self-entered profile fields live on `users` (migration `1784356000000-ProfilesAndFollows`):
`location`, `tagline`, `platform`, `preferredRole`, `achievement`, edited via `PATCH /me/profile`.

## Tests
`test/profiles.e2e-spec.ts` (fields + privacy sweep, follow rules, deals/reviews → role/badges).

## Follow lists (client feedback #15, 2026-10-04)
`MyFollowsController`: `GET me/following` and `GET me/followers` (`AuthGuard`).

- Each returns `PublicFollowEntry[]`: id, username, first/last name, avatar, `followedAt`.
  No email or balance.
- The frontend shows them in `components/FollowLists.tsx` on `/profile`, with unfollow.
- A new follower still gets one `new_follower` notification, now naming the follower by full name
  (`common/person-name.ts`).

## 2026-10-07
`reviews.latest[]` also carries `buyerFirstName`, `buyerLastName`, `buyerAvatarUrl`.
`/u/[username]` shows the reviewer by photo + full name (client #9; it still showed `@handle`).
