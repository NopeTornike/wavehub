# common (cross-cutting runtime plumbing)

## Purpose
Everything that applies to the whole HTTP surface rather than one domain: the global exception
filter, the PII-free access log, the health endpoint, and shared throttle presets. Wired together
with the rest of the app bootstrap in `backend/src/app.setup.ts` (shared by `main.ts` and the e2e
harness so tests run the same middleware/pipes/filters as production).

## Key files
- `all-exceptions.filter.ts` — global `@Catch()` filter. `HttpException`s render exactly as Nest
  would. A Postgres `22P02` (invalid uuid in a path param — `GET /orders/not-a-uuid`) becomes a
  clean **404** instead of a 500; `22003/22001/22007/22008` become 400; body-parser 4xx keep their
  status with a generic message; **everything else is logged server-side (with the request id and
  stack) and answered with `{statusCode:500, message:'Internal server error'}`** — never SQL text, a
  stack, or a driver message (root `CLAUDE.md` security rule).
- `request-logger.middleware.ts` — `requestLogger()`: one JSON line per finished request:
  `{rid, method, path, status, ms}` with uuids collapsed to `:id` and the query string dropped. **No
  IP, cookies, headers, bodies, usernames or user ids** (nothing that identifies a person). Also
  sets `X-Request-Id` (adopting a well-formed client-supplied id, else minting one) so a user-
  reported error can be matched to a log line. `/health` is not logged; `REQUEST_LOG=off` and
  `NODE_ENV=test` silence it.
- `health.controller.ts` — `GET /health` (unauthenticated, `@SkipThrottle`): `SELECT 1` with a 2 s
  timeout → `200 {status:'ok', db:'up', maintenance:boolean}` or `503 {status:'error', db:'down'}`.
  Used by the Docker healthchecks, Caddy's upstream check and external uptime monitors. Reveals
  nothing else (no versions/config/error text).
- `throttle.ts` — `UPLOAD_THROTTLE` (20/min), `MESSAGE_THROTTLE` (40/min), `CREATE_THROTTLE` (15/min)
  per-IP overrides applied to abusable authenticated writes (uploads, chat/DM/dispute/ticket
  messages, order/ticket/review/coach/withdrawal/subscription creation). Credential endpoints keep
  their own 5/min limits (`auth.controller.ts`).
- `common.module.ts` — registers `HealthController` (imports `SettingsModule` for the maintenance
  flag).

## Conventions & gotchas
- The global `ThrottlerGuard` keys on the client IP, which is only the real client IP when
  `TRUST_PROXY` matches the actual proxy chain (`1` behind Caddy) **and the backend port is not
  published to the internet** — `docker-compose.yml` publishes only Caddy for exactly that reason.
- Add new cross-cutting middleware/filters in `app.setup.ts`, not `main.ts`, so the e2e harness
  covers them.
- Graceful shutdown: `main.ts` calls `app.enableShutdownHooks()`; the compose file gives the backend a
  30 s `stop_grace_period`.

## Related modules
- `backend/src/config/` — production boot-time configuration validation.
- `backend/src/settings/` — `MaintenanceGuard` (global 503 while maintenance mode is on).
- `backend/test/hardening.e2e-spec.ts`, `backend/test/security.e2e-spec.ts` — end-to-end coverage.

## Status
Implemented; exercised by the e2e suite (health, error hygiene, request id, throttling headers) and
by running the compiled backend against a real Postgres.
