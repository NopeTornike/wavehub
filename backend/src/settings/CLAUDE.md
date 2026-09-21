# settings

## Purpose
Platform-wide configurable numbers that used to be hardcoded constants scattered across other
modules: the order platform-fee percentage and the minimum seller withdrawal amount. Build-plan
Phase 11f ("Platform Settings"), pulled forward as a small, bounded slice rather than waiting for
the rest of that phase (promo codes, banners, API/commission settings beyond these two). Maintenance
Mode enforcement landed with the launch-readiness pass (see below).

## Key files
- `platform-settings.entity.ts` — `PlatformSettings`: a deliberate **singleton table**, exactly
  one row at a fixed well-known id (`PLATFORM_SETTINGS_SINGLETON_ID`), seeded by the
  `CreatePlatformSettings` migration. `platformFeePercent` (was `DEFAULT_PLATFORM_FEE_PERCENT` in
  `backend/src/orders/orders.service.ts`), `minWithdrawalWaveCoin` (was `MIN_WITHDRAWAL_WAVECOIN`
  in `backend/src/withdrawals/withdrawals.service.ts`), `maintenanceMode` (enforced by
  `MaintenanceGuard` — see below)
- `platform-settings.service.ts` — `PlatformSettingsService.get()`/`.getPlatformFeePercent()`/
  `.getMinWithdrawalWaveCoin()`/`.update()`. `get()` throws `InternalServerErrorException` if the
  singleton row is missing rather than silently creating a default one — a missing row means the
  migration never ran, which is a real deployment bug worth surfacing loudly, not masking.
- `platform-settings.controller.ts` — `GET`/`POST admin/platform-settings`, both **Super Admin
  only** (see gotcha below), audit-logged on update.
- `maintenance.guard.ts` — `MaintenanceGuard`, a **global `APP_GUARD`** (registered in
  `settings.module.ts`). While `maintenanceMode` is on, every non-`GET/HEAD/OPTIONS` request gets
  `503` + `Retry-After: 300` and a body `{statusCode, error, message, maintenance: true}` (the human
  text is in `error` because `frontend/lib/api.ts` displays `error` before `message`). **Exempt:**
  staff (any `adminRole`, checked against the DB from the session cookie — the guard runs before the
  per-route `AuthGuard`, so it does its own lookup), `POST /auth/login` + `/auth/logout` (so an admin
  can sign in to switch it off; non-admins can log in but still can't write anything else), and the
  two BOG server-to-server callbacks (`/payments/bog/callback`, `/subscriptions/bog-callback`) —
  dropping those would leave a customer who already paid uncredited. Reads stay up so the site
  can render read-only. Background cron jobs (order auto-complete, subscription recharges) are not
  HTTP and are unaffected. `GET /health` reports `maintenance` publicly.
- `PlatformSettingsService.isMaintenanceMode()` — the flag, cached in memory for 5 s (the guard runs
  on every write, so no per-request DB read); `update()` refreshes it immediately. **Fails open**
  (returns false) if the row can't be read, so a DB blip doesn't add a self-inflicted outage.
- `dto/update-platform-settings.dto.ts` — all fields optional (a partial update), validated ranges
  (fee 0–100, min withdrawal ≥ 1).

## Data model
`platform_settings` (migration: `CreatePlatformSettings`) — exactly one row, id
`00000000-0000-0000-0000-000000000001`. Never insert a second row; `update()` always targets that
fixed id.

## Conventions & gotchas
- **Super Admin only, for both viewing and editing.** SPECIFICATION.md §5.13.1 is the only role
  section whose CAN list includes "Platform Settings" / "change commission" at all — every other
  role's CANNOT list explicitly excludes changing platform settings or commissions. Don't widen
  this to other roles without re-checking the spec first.
- **`OrdersService.purchase()` and `WithdrawalsService.request()` both now call this service** (one
  extra DB read each) instead of reading a hardcoded constant. `purchase()` still snapshots the
  rate it read onto `Order.platformFeePercentSnapshot` at creation time — changing the platform fee
  here never retroactively changes an existing order's math, same guarantee as before this module
  existed.
- **`SettingsModule` is imported by `OrdersModule` and `WithdrawalsModule`, not the other way
  around** — `SettingsModule` itself imports `AuthModule`/`AdminModule` for its own controller's
  guards, and neither of those import Orders/Withdrawals, so there's no circular-dependency risk
  from this direction (same reasoning as `backend/src/admin/CLAUDE.md`'s note on why
  `AdminUsersController` had to live in `AdminModule` instead of `UsersModule`).

## Related modules
- `backend/src/orders/` — reads `platformFeePercent` at purchase time.
- `backend/src/withdrawals/` — reads `minWithdrawalWaveCoin` at withdrawal-request time.
- `backend/src/admin/` — `AdminGuard`/`@RequireAdminRole`/`AdminAuditService`, used by this
  module's controller.
- `frontend/pages/admin/settings.tsx` — the admin UI (view + edit form), Super Admin only per the
  backend gate above; every other staff role sees the nav link (same "don't hide nav per role"
  convention as the rest of `frontend/pages/admin/`) but gets a 403 error banner if they try.
- `packages/shared-types/` — `PublicPlatformSettings` response shape.

## Status
`get`/`update`/`getPlatformFeePercent`/`getMinWithdrawalWaveCoin` are implemented and unit-tested
(missing-row failure, both getters, partial-update behavior) — 179 backend tests total as of the
last update. Not verified against a live Postgres transaction (no DB available in the sandbox this
was built in). Frontend: `frontend/pages/admin/settings.tsx` is a real form wired to both
endpoints. **`maintenanceMode` is enforced** (`MaintenanceGuard`, unit-tested in
`maintenance.guard.spec.ts` and exercised end to end in `backend/test/hardening.e2e-spec.ts`: non-admin/
anonymous writes 503, reads/admin/login/BOG webhook keep working, recovery after switch-off). The
frontend has no dedicated banner — a refused write shows the 503 text where it happens. Not built: payment-method toggles, escrow parameters, or anything else
SPECIFICATION.md §5.13.1's "Platform Settings" line mentions beyond these two numbers and the
maintenance flag — those weren't concretely specified enough elsewhere in the source spec to model
yet.
