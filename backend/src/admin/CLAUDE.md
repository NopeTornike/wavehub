# admin

## Purpose
The shared foundation every admin-guarded route in the repo builds on: role-checking (`AdminGuard`
+ `@RequireAdminRole(...)`) and audit logging (`AdminAuditService`). Started as the minimum 11a
slice ("Staff & Roles foundation") needed to give `ListingsService.approve`/`.reject`,
`ReviewsService.hide`/`.remove`/`.restore`, and `DisputesService.resolve` real HTTP routes; Phase
11c added real user management (`AdminUsersController`, declared here — see Key files) and, across
`backend/src/listings/`, `backend/src/reviews/`, `backend/src/disputes/`, and
`backend/src/withdrawals/`, the missing "what needs my attention" list endpoints those admin
actions had no way to discover before (`GET listings/pending-review`, `GET reviews/reported`,
`GET disputes`, `GET withdrawals/pending`) plus a real frontend (`frontend/pages/admin/*.tsx`,
`frontend/components/AdminLayout.tsx`) that actually calls all of it.

## Key files
- `admin-role.guard.ts` — `AdminGuard`: loads the fresh `User` row for `request.userId` (set by
  `AuthGuard`, which must run first in the same `@UseGuards(...)` array) and checks
  `user.adminRole` against the route's `@RequireAdminRole(...)` list. Fails closed if the decorator
  is missing entirely (treats that as a bug, not "no restriction")
- `require-admin-role.decorator.ts` — `@RequireAdminRole(...roles)`. `SuperAdmin` always passes
  regardless of what's listed (see gotcha below); `@RequireAdminRole()` with zero args means
  "SuperAdmin only," not "no requirement"
- `current-admin-role.decorator.ts` — `@CurrentAdminRole()`, mirrors `@CurrentUserId()`; only valid
  on routes actually guarded by `AdminGuard`
- `audit-log.entity.ts` — `AuditLog`: one row per admin mutation (SPECIFICATION.md §4.3's
  non-negotiable rule), `adminRole` is a snapshot at action time, not a live join
- `admin-audit.service.ts` — `AdminAuditService.log(...)`, called explicitly at the end of each
  admin controller action (see gotcha below on why this isn't automatic yet)
- `../users/admin-users.controller.ts` — `AdminUsersController` (`GET/POST /admin/users/...`) is
  physically in `backend/src/users/` but **declared in `admin.module.ts`**, not `users.module.ts` —
  it needs both `AuthGuard` and `AdminGuard`, and `UsersModule` can't import `AuthModule` or
  `AdminModule` without a circular dependency (both already import `UsersModule` for
  `UsersService`). `AdminModule` importing `AuthModule` + `UsersModule` directly has no such cycle.
  If you add another controller that needs both guards, follow this same split rather than fighting
  the cycle with `forwardRef()`.

## Data model
`audit_logs` (migration: `CreateAuditLogs`). Also owns the migration that added `users.adminRole`
(`AddUserAdminRole`) — a plain nullable column on the existing `User` entity, not a separate table;
see `backend/src/users/CLAUDE.md` and `user.entity.ts`'s own comment for why (SPECIFICATION.md
§5.13.7 flagged the separate-`staff`-table question as genuinely unanswered by the client — this
picks the lower-friction option now rather than blocking on an answer, and says so).

## Conventions & gotchas
- **`AdminGuard` must run after `AuthGuard`** in the same `@UseGuards(AuthGuard, AdminGuard)` array
  (or `AuthGuard` at the controller level, `AdminGuard` at the method level, as in
  `DisputesController` — either way, order matters). `AdminGuard` reads `request.userId`, which
  only `AuthGuard` sets; it does not verify the session itself.
- **`AdminGuard` always does a DB lookup, unlike `AuthGuard`.** `AuthGuard`'s own comment explains
  why it deliberately skips a per-request status check (keeps every guarded request cheap); that
  tradeoff doesn't apply here — admin routes are far lower-traffic, and a stale-session admin check
  (e.g. a just-revoked admin still passing off session-cookie data alone) is a real gap `AuthGuard`
  accepts but `AdminGuard` shouldn't.
- **`SuperAdmin` is never listed explicitly in any `@RequireAdminRole(...)` call** — `AdminGuard`
  special-cases it (`user.adminRole !== SuperAdmin && !required.includes(...)`) per
  SPECIFICATION.md §5.13's "Super Admin has unrestricted access to everything." Don't add
  `AdminRole.SuperAdmin` to a roles list; it's redundant and would suggest the bypass doesn't exist.
- **Per-route role lists came from reading SPECIFICATION.md §5.13's per-role CAN lists directly**,
  not guessed — see the comments at each call site (`listings.controller.ts`,
  `reviews.controller.ts`, `disputes.controller.ts`) for the citation. Notably, dispute resolution
  (`resolve`) is **Super-Admin-only**: Operation Lead and Main Administrator can participate in the
  dispute workflow per the spec but are explicitly barred from approving refunds/releasing funds
  independently — only the fund-moving `resolve()` action exists today, not their narrower
  review/prepare/escalate actions, so there's nothing else to gate yet.
- **Audit logging is a manual call at the end of each controller action, not a decorator +
  interceptor.** The original build plan's intended end state was `@Audited(action)` — deliberately
  not built yet, since there are only 3 admin action *types* (6 routes) so far and generalizing an
  interceptor from one example would be guessing at the right abstraction. Revisit once there are
  more admin routes to generalize from (Phase 11's remaining sub-parts will add plenty). Until
  then: **every new admin-guarded route must call `this.audit.log(...)` itself** — nothing enforces
  this automatically, so it's a discipline, not a contract (same caveat pattern as
  `packages/shared-types`' `Public*` interfaces).
- **`admin-role.guard.spec.ts` fakes both `Reflector` and `UsersService` directly** rather than
  using Nest's `Reflector` class or its test module — same lightweight fake-collaborator approach
  as every other `*.service.spec.ts` in this repo.

## Related modules
- `backend/src/users/` — owns the `adminRole` column this guard reads, and now also the
  suspend/restore/ban/unban actions `AdminUsersController` calls (declared here, see Key files
  above). There is still no way to *grant* `adminRole` via the API (no admin-account-management
  flow exists yet — Phase 11's fuller Staff & Roles work).
- `backend/src/listings/`, `backend/src/reviews/`, `backend/src/disputes/`,
  `backend/src/withdrawals/` — the modules with admin-guarded routes so far; each imports
  `AdminModule` and calls `AdminAuditService` from its controller. `disputes/` additionally has a
  second controller (`admin-disputes.controller.ts`) purely for the cross-order `GET disputes`
  list/detail routes — see that module's doc for why it isn't folded into the existing
  order-scoped `DisputesController`.
- `frontend/components/AdminLayout.tsx` + `frontend/pages/admin/*.tsx` — the first real UI that
  calls any of this. Role-gates at the page level (redirects a non-staff user to a plain "access
  denied" state) but does **not** mirror the backend's full per-role CAN/CANNOT matrix — every
  route here is still the actual enforcement; the frontend is a convenience layer, not a second
  copy of the authorization logic.
- `packages/shared-types/` — `AdminRole` enum, plus `AdminUserSummary`/`AdminListingSummary`/
  `AdminReviewSummary`/`AdminDisputeSummary`/`AdminWithdrawRequestSummary` — purpose-built response
  shapes for admin list views, deliberately distinct from the `Public*` shapes (which would leak
  full joined entities like a seller's email into an approval-queue table).

## Status
`AdminGuard`/`@RequireAdminRole`/`AdminAuditService` are implemented and unit-tested (guard logic:
missing decorator, no user, no role, wrong role, exact-match role, SuperAdmin bypass in both an
explicit-list and empty-list case). Real, guarded, audit-logged routes now exist for:
`ListingsController.approve`/`.reject` + `listPendingReview`, `ReviewsController.hide`/`.remove`/
`.restore` + `listReported`, `DisputesController.resolve` + `AdminDisputesController.listOpen`/
`getOne`, `WithdrawalsController.process` + `listPending`, and the full
`AdminUsersController` (list/suspend/restore/ban/unban). All of them are reachable from a real
frontend (`frontend/pages/admin/*.tsx`) for the first time as of Phase 11c — previously every one
of these except the mutation actions themselves had "built but nothing can reach it" as an open
gap; that's now closed for the six sections that exist. Not verified against a live Postgres
transaction (no DB available in the sandbox this was built in) — in particular, nothing has
exercised `AdminGuard`'s DB lookup against a real `users` row with a real `adminRole` set, since
there's no way to set one outside a direct DB update right now. Not yet built: any way to grant
`adminRole` via the API, the `AuditLog`/`ActivityLog` distinction question from
SPECIFICATION.md §5.13.7 (still open, still not guessed at), a permission-matrix-aware frontend
nav. Support ticketing (Phase 11d — `backend/src/support/CLAUDE.md`) has since landed too, using
this same `AdminGuard`/`AdminAuditService` foundation. Phase 11f is partially done (platform fee %
and minimum withdrawal are admin-configurable, `backend/src/settings/CLAUDE.md` — promo codes,
banners, and Maintenance Mode enforcement are not). Still fully ahead: Coaching (11b — a wholly
new domain, no Coach entity exists at all) and Trust & Safety/Analytics (11e, 11g).
