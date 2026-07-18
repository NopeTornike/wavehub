# WaveHub

WaveHub is a marketplace for gaming services (rank boosting, coaching, duo/squad play, account setup)
and item listings (accounts/skins), across PUBG Mobile, COD Mobile, Free Fire, Mobile Legends, and
Roblox. Buyers purchase from sellers using an internal WaveCoin balance (topped up via Bank of Georgia);
funds move through an internal ledger that holds them until delivery is confirmed, then releases to the
seller minus a platform fee.

**Read `SPECIFICATION.md` in full only for cross-module or product-decision work** (it's the full
narrative distillation of the source product spec, with every contradiction in that spec resolved).
**For a task scoped to one module, read that module's `CLAUDE.md` below instead** — don't re-explore the
whole repo for context a module doc should already summarize. If a module doc is missing information you
needed, that's a doc bug — fix it as part of your change, in the same PR.

The full build plan (phased architecture, schema, decisions) lives at
`/Users/sarvat/.claude/plans/mighty-mapping-robin.md` on the machine this was planned on — if that path
isn't available to you, `SPECIFICATION.md` §6-8 and this file are the durable record.

## Module doc index

| Module | Purpose | Doc |
|---|---|---|
| `backend/src/auth/` | Registration, login, sessions, guards | `backend/src/auth/CLAUDE.md` |
| `backend/src/users/` | User entity + shared lookup service | `backend/src/users/CLAUDE.md` |
| `backend/src/payments/` | BOG WaveCoin top-up integration | `backend/src/payments/CLAUDE.md` |
| `backend/src/email/` | Email-sending stub (console.log until a provider is chosen) | `backend/src/email/CLAUDE.md` |
| `backend/src/wallet/` | WaveCoin ledger — the only writer of `users.wavecoinBalance` | `backend/src/wallet/CLAUDE.md` |
| `backend/src/listings/` | Marketplace listings (service + item), moderation lifecycle | `backend/src/listings/CLAUDE.md` |
| `backend/src/storage/` | File storage abstraction (local disk today, not production-ready) | `backend/src/storage/CLAUDE.md` |
| `backend/src/orders/` | Purchase flow, delivery lifecycle, the only trigger for wallet money movement | `backend/src/orders/CLAUDE.md` |
| `backend/src/reviews/` | Buyer reviews of completed orders, seller/listing rating aggregates | `backend/src/reviews/CLAUDE.md` |
| `packages/shared-types/` | Enums/DTOs shared between backend and frontend | `packages/shared-types/CLAUDE.md` |
| `frontend/` | Next.js app (the one real frontend — see below) | `frontend/CLAUDE.md` |

New top-level modules (`backend/src/disputes/`, `backend/src/chat/`, `backend/src/notifications/`,
`backend/src/admin/`, `backend/src/content/`) will each get a row here
and their own `CLAUDE.md` as they're built — see the phased build plan. Add the row in the same
change that adds the module.

## Non-negotiable rules (apply everywhere, not phase-gated)

1. Passwords are always hashed (bcrypt/argon2) — never optional.
2. No raw card/payment data ever touches WaveHub's own servers or database.
3. Every admin-panel mutation is audit-logged (who/what/when/why).
4. Email verification is required before an account is fully active.
5. Real server-side auth session (httpOnly cookie/JWT) gates anything that depends on "who's logged
   in" — don't build features assuming a client-trusted identity.
6. Never show fabricated data as if real (e.g. no `Math.random()` "online now" counters). If real data
   isn't built yet, omit the UI element rather than fake it.

Full reasoning for each of these (including which contradictions in the source spec they resolve) is in
`SPECIFICATION.md` §4.

## Security

Baseline hardening that exists today (added Phase 2 after a dedicated pass — see
`/Users/sarvat/.claude/plans/mighty-mapping-robin.md` progress log for what prompted it):

- **`helmet`** is applied globally in `main.ts` for standard security headers.
- **Rate limiting** (`@nestjs/throttler`) is applied globally (100 req/60s/IP default) via
  `APP_GUARD` in `app.module.ts`, with stricter per-route limits (5/60s) on brute-force-prone
  endpoints — registration, login, password reset, email verification. **Any new public endpoint
  that authenticates a credential, issues a token, or otherwise has a brute-force/enumeration
  surface must get an explicit `@Throttle()` override, not just rely on the generous global
  default.** Server-to-server webhook endpoints protected by signature verification instead
  (only one exists so far: `POST /payments/bog/callback`) should use `@SkipThrottle()` instead —
  dropping a legitimate signed callback under IP-based rate limiting is a worse failure mode than
  the flood risk that limiting would prevent.
  - Known limitation: throttler state is in-memory per process. A multi-instance deployment behind
    a load balancer effectively multiplies the real limit by instance count. Fine for now; revisit
    (Redis-backed throttler storage) if/when this actually runs on more than one instance.
  - Rate limiting only reflects the real client IP if `TRUST_PROXY` is correctly configured in
    front of a real reverse proxy/load balancer — see `main.ts` and `.env.example`. Never set it
    without an actual trusted proxy in front; doing so lets any client spoof its own IP via
    `X-Forwarded-For` and silently defeats the rate limit.
- **Every mutating endpoint validates input via a `class-validator` DTO** under a global
  `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` — unexpected
  body fields are rejected outright, not silently ignored (defends against mass-assignment-style
  bugs). Keep using DTOs for any new endpoint; don't read `req.body` untyped.
- **Never trust a client-supplied identity or amount on a money-moving endpoint.** Two real bugs of
  exactly this shape were found and fixed in `backend/src/payments/` while building Phase 2: a
  client-supplied `username` deciding whose account gets credited, and a client-supplied WaveCoin
  amount independent of what was actually paid. Always derive "who" from `@CurrentUserId()` (the
  verified session) and derive "how much" from a server-side calculation, never from a request body
  field with the same name as something security-sensitive.
- **Don't forward upstream/internal error messages to API clients.** Log the real error server-side
  (`Logger.error`), return a generic message. `backend/src/payments/bog-payments.controller.ts` is
  the reference example (BOG's raw error text is logged, never returned).
- **Validate any URL a client asks the server to redirect to or store**, against an allowlist (e.g.
  same-origin as `FRONTEND_URL`) — see `backend/src/payments/same-origin.util.ts` for the pattern.
  An unvalidated redirect target is an open-redirect and, on a post-payment flow specifically, a
  phishing setup.
- **CSRF posture**: session cookies are `httpOnly`, `sameSite: 'lax'`, `secure` in production (see
  `backend/src/auth/session.service.ts`). Combined with every mutating endpoint being POST (never
  GET), `SameSite=Lax` already blocks the standard cross-site-form/fetch CSRF vector — a cross-site
  POST doesn't carry the cookie under Lax. This is a deliberate choice not to add explicit CSRF
  tokens on top; revisit only if a mutating endpoint is ever added that must be reachable via GET
  (it shouldn't be) or if the frontend and backend end up on genuinely cross-site (not just
  cross-port-same-site) domains in a way that changes this analysis.
- **`npm` `overrides` (used to pin a transitive dependency past a known CVE — e.g. the `postcss`
  entry in root `package.json`) only take effect when declared in the workspace ROOT
  `package.json`.** An override in `backend/package.json` or `frontend/package.json` is silently
  ignored by npm workspaces. This bit us once already (Phase 2) — a real CVE fix stopped applying
  the moment the root `package.json` was introduced in Phase 0, undetected until an explicit `npm
  audit` pass. Run `npm audit --omit=dev` after any dependency change and treat a new finding as
  something to actually fix, not defer.
- `.github/workflows/ci.yml` has an `audit` job running `npm audit --omit=dev` on every PR — a
  vulnerable production dependency fails CI, it doesn't rely on someone remembering to check.
- Not yet done, tracked for later phases: CSRF tokens (see reasoning above — currently judged
  unnecessary, not forgotten), CAPTCHA/bot-protection on registration, structured audit logging
  (exists as a *rule* for the future admin panel, §non-negotiable-rule-3, but the `audit_logs` table
  itself doesn't exist until Phase 11).

## Architecture notes

- **Monorepo**: npm workspaces (`backend`, `frontend`, `packages/*`). One root `npm install`. Per-app
  scripts are exposed at the root (`npm run backend:dev`, `npm run frontend:build`, etc. — see root
  `package.json`).
- **Payment model**: WaveCoin top-up (via Bank of Georgia), not per-order fiat escrow. The order/dispute
  lifecycle uses an internal ledger (`backend/src/wallet/`) with held/available balance states — it's
  just denominated in WaveCoin instead of real currency per order. Real money only ever enters via
  the BOG top-up flow (`backend/src/payments/`), whose callback is signature-verified and re-checks
  order status against BOG's API before crediting anything — see that module's doc before touching
  payment/wallet code. `backend/src/orders/` is the only module that actually triggers movement
  between buyer and seller balances (purchase debits, delivery-acceptance releases, cancellation
  refunds) — it composes `WalletService` calls into its own transactions via an optional `manager`
  param rather than each opening a separate one; read that module's doc before adding a new
  money-moving call site anywhere.
- **Frontend**: the Next.js app in `frontend/` is the one real frontend going forward. The static
  HTML/JS prototype at the repo root (`index.html`, `marketplace.html`, etc.) is UI/UX reference only —
  don't extend it, and don't wire new features to its `localStorage`-based state.
- **Database**: Postgres via TypeORM, schema changes go through migrations (`backend/src/migrations/`,
  run via `npm run migration:run -w backend`) — not `synchronize` outside of quick local experiments.
- **Auth session**: stateless JWT in an httpOnly cookie (`backend/src/auth/session.service.ts`), not a
  DB-backed session table. Any endpoint that needs to know the caller's identity uses `AuthGuard` +
  `@CurrentUserId()` from `backend/src/auth/` — see that module's doc before building a new guarded
  route.
- **Admin panel scope**: much larger than the original 80-page spec suggested — 6 staff roles (Super
  Admin plus 5 subordinate roles, each an explicit permission subset), a distinct **Coach** entity
  separate from Seller, full support ticketing, promo codes, content/banner management, platform
  settings, and Trust & Safety/fraud tooling. Full per-role CAN/CANNOT catalog is in
  `SPECIFICATION.md` §5.13 — read it before starting Phase 11 or before assuming what a role can/
  can't do; don't infer from a role's name.

## Tool portability

`CLAUDE.md` is a Claude Code-specific auto-load filename. `AGENTS.md` is the emerging cross-tool
convention (Codex CLI and others look for it instead). Every `CLAUDE.md` in this repo has a sibling
`AGENTS.md` that's a plain symlink to it (`ln -s CLAUDE.md AGENTS.md`) — one file's content, two
discoverable names, no duplication to keep in sync. **When you add a new module's `CLAUDE.md`, add the
matching `AGENTS.md` symlink in the same change.**

## Agent workflow rule

For a scoped task: read this file's module table, open the relevant module's `CLAUDE.md`, and start
there. Only read `SPECIFICATION.md` end-to-end for genuinely cross-cutting work (e.g. reshaping a status
enum used by multiple modules, or a new product decision). Update the module's `CLAUDE.md` in the same
PR as any change to that module's schema or externally-visible behavior — an undocumented behavior
change is treated the same as a missing test: incomplete work.
