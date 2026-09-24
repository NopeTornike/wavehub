# backend/src/community

## Purpose
Read-only aggregates behind the site shell ported from the static prototype: the sidebar/home
"N online" counter, per-game active-listing counts (home game grid, marketplace chips), the
marketplace seller-rank ordering, and the signed-in user's own **Wave rank** (topbar profile menu).
No writes, no entities of its own — it queries `users`, `listings`, `orders`, `reviews`, `games`.

## Key files
- `community.service.ts` — the four queries plus `computeWaveRank()` (pure, unit-tested) and the
  exported `ONLINE_WINDOW_MINUTES` (5). `coaching/coaches.service.ts` imports that constant so a
  coach card's online dot means exactly the same thing as the counter.
- `community.controller.ts` — `GET /stats/online`, `GET /stats/games`, `GET /stats/seller-ranks`
  (public) and `GET /me/wave-rank` (`AuthGuard`).
- `community.service.spec.ts` — Wave-rank weights/caps/tier boundaries.

## Data model
Uses `users.lastSeenAt` (migration `1784349000000-CommunityShellAndGameCatalogue`, which also seeded
the 14-game catalogue with `iconUrl`/`sortOrder`). `AuthGuard` calls `UsersService.touchLastSeen()`
on every guarded request; that UPDATE is conditional (only if the stored value is older than 60s) so
it's at most one write per user per minute, and its failure is swallowed — presence must never break
a request.

## Conventions & gotchas
- **Public routes return counts only**, never ids/usernames of who is online. The one per-person
  presence signal is the `online` flag on a *verified coach's* public directory card
  (`PublicCoachSummary.online`) — coaches are public service providers and the prototype's design
  shows it; nothing else exposes an individual's presence.
- "Online" = a guarded request within 5 minutes, accounts `active` or `pending_verification`
  (suspended/banned never count). It's a real signal, not a decoration (root rule #6) — a signed-out
  visitor browsing doesn't count.
- Wave rank mirrors `profile-nav.js#getWaveRankMetrics` weights exactly (listing 15, sold 60,
  bought 20, review 25, recent-30-day event 75; progress cap 500, activity cap 500, score cap 1000);
  tiers are `WAVE_RANK_TIERS` in shared-types. Only the inputs changed (real rows).
- Seller ranks are cached per process for 60s (every marketplace view asks for them).
- Reviews count only `status = 'published'` (the reviews module's real value — an earlier draft used
  `'visible'`, which silently counted nothing).

## Related modules
`users/` (lastSeenAt, touchLastSeen), `auth/` (AuthGuard writes presence), `coaching/` (reuses the
online window), `packages/shared-types` (`OnlineStats`, `GameListingCount`, `SellerRanks`,
`WaveRank`, `WAVE_RANK_TIERS`), `frontend/lib/shell.tsx` (the only consumer).

## Status
Built and verified against the local Postgres in the 2026-09-24 1:1 design port (sidebar counter,
home game counts, topbar Wave rank all render real numbers).

## 2026-09-24
Wave rank counts coaching too: a completed session is a sale for the coach and a purchase for the
student, a session review counts like a seller review, and completed sessions in the last 30 days
are recent events. `CommunityService` is exported (coach profiles show the coach's rank as a
0–100 "Wave Score").
