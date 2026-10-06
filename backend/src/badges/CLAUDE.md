# backend/src/badges

## Purpose
The owner's 13 profile badges (client feedback #10, 2026-10-04: icons + a badge-logic spec docx).
Each badge is a stored grant in `user_badges`, not a value computed per request. A grant is made
automatically by a trigger, by authorised staff, or by a coach for their own student. Every grant
and revoke is audit-logged and notifies the user (`NotificationType.BadgeGranted`).

## Key files
- `user-badge.entity.ts` — `user_badges` (migration `1784379000000-UserBadges`). Columns:
  `userId`, `badgeKey`, `source` (`system` / `admin` / `coach`), `grantedById`, `grantedAt`.
  UNIQUE(userId, badgeKey). The migration backfills `first-order`, `orders-100`, `verified`
  (verified coaches) and `subscriber` (live subscriptions).
- `badges.service.ts` — reads, triggers, staff and coach grants (below).
- `badges.controller.ts` — the routes. DTO classes sit **above** the controller: decorator
  metadata needs them at class-definition time.
- Catalogue (`BadgeKey`, `BADGE_CATALOG` with label / description / `mode`, `badgeIcon()`): lives in
  `packages/shared-types`. The art is in `frontend/public/assets/badges/<key>.png`.

## Who grants what (`BADGE_CATALOG[key].mode`)
| mode | badges | grant | revoke |
|---|---|---|---|
| `auto` | first-order, orders-100, subscriber, max-level | system trigger only | Super Admin only (a correction) |
| `auto_admin` | verified | trigger (coach verified) or staff | staff |
| `super_admin` | chosen, staff | Super Admin | Super Admin |
| `admin` | official-seller, official-coach, best-coach, best-seller | `BADGE_ADMIN_ROLES` + Super Admin | same |
| `coach` | strongest-student, coach-chosen-student | the coach, for their own student | the granting coach |

- `BADGE_ADMIN_ROLES` = Operation Lead, Main Administrator, Marketplace & Coaching Ops Manager.
  Other staff roles get 403.
- Coach grants require **at least one completed coaching session** between that coach and the
  student. A coach can't grant to themselves, and can only grant the two student badges.
  `coach-chosen-student` is one per coach: choosing a new student moves it.
- Error codes:
  - duplicate grant → 409 (also a concurrent one: unique-violation `23505`);
  - unknown key → 400;
  - staff granting an `auto` badge → 400;
  - revoking a badge the user doesn't have → 404.

## Triggers (never throw into the caller)
- `onOrdersCompleted(userIds)`: called from `OrdersService.completeOrder` and from a dispute's
  ReleaseToSeller. It counts completed orders as buyer or seller: ≥1 → `first-order`,
  ≥100 → `orders-100`.
- `onCoachVerified` (approve / restore) grants `verified`. `onCoachUnverified` (reject / suspend /
  delete) removes it, but only a **system** grant; a staff-granted Verified stays.
- `onSubscriptionActivated` (BOG activation and admin grant) grants `subscriber`. `listVisible`
  hides it while the user has no `active` / `past_due` subscription; the row stays and shows again
  on renewal.
- `onRank` (from `ProfilesService.facts`) grants `max-level` once the top Wave tier is reached.

## Routes
- `GET|POST admin/users/:id/badges`, `DELETE admin/users/:id/badges/:badgeKey`:
  `AuthGuard` + `AdminGuard` + `@RequireAdminRole(...BADGE_ADMIN_ROLES)`, plus the per-badge check
  above. Audited as `badge.grant` / `badge.revoke`.
- `GET coaches/mine/students` returns the coach's students with a completed session:
  name, avatar, session count, current student badges. No email or balance.
- `POST coaches/mine/students/:studentId/badges` (`VerifiedEmailGuard`, `CREATE_THROTTLE`) and
  `DELETE …/:badgeKey`. Audited with `adminRole: 'coach'`.
- **`:badgeKey` is parsed with its own `ParseEnumPipe`**, never with a whole-`@Param()` DTO. That DTO
  also receives `:id` / `:studentId`, and the global `forbidNonWhitelisted` pipe then rejects
  every request. This shipped once and made every revoke a 400, caught by
  `test/client-feedback.e2e-spec.ts`.

## Where badges show
- `PublicUserProfile.badges` (via profiles/) = `listVisible` plus the tournament `champion` /
  `finalist` achievements, which aren't stored badges. The Wave rank tier is its own field
  (`waveRank`), not a badge.
- `verifiedSet(userIds)` (batched) feeds the blue check next to names: `PublicSeller.verified`,
  order parties.
- Frontend:
  - `/u/[username]` badge art with tooltips;
  - `components/AdminBadgeManager.tsx` (Admin → Users → "ბეიჯები");
  - the `StudentBadges` panel on `/coaching-sessions/[id]` for the coach.

## Related modules
`orders/`, `disputes/`, `coaching/`, `subscriptions/`, `profiles/` (callers), `notifications/`,
`admin/` (audit). The red-lion art in the owner's icon folder isn't in the spec, so it wasn't added.
