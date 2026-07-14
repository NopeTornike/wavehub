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
| `packages/shared-types/` | Enums/DTOs shared between backend and frontend | `packages/shared-types/CLAUDE.md` |
| `frontend/` | Next.js app (the one real frontend — see below) | `frontend/CLAUDE.md` |

New top-level modules (`backend/src/orders/`, `backend/src/listings/`, `backend/src/disputes/`,
`backend/src/chat/`, `backend/src/reviews/`, `backend/src/notifications/`, `backend/src/admin/`,
`backend/src/content/`) will each get a row here and their own `CLAUDE.md` as they're built — see
the phased build plan. Add the row in the same change that adds the module.

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

## Architecture notes

- **Monorepo**: npm workspaces (`backend`, `frontend`, `packages/*`). One root `npm install`. Per-app
  scripts are exposed at the root (`npm run backend:dev`, `npm run frontend:build`, etc. — see root
  `package.json`).
- **Payment model**: WaveCoin top-up (via Bank of Georgia), not per-order fiat escrow. The order/dispute
  lifecycle still uses an internal ledger (`backend/src/wallet/`) with held/available balance states —
  it's just denominated in WaveCoin instead of real currency per order. Real money only ever enters via
  the BOG top-up flow (`backend/src/payments/`), whose callback is signature-verified and re-checks
  order status against BOG's API before crediting anything — see that module's doc before touching
  payment/wallet code.
- **Frontend**: the Next.js app in `frontend/` is the one real frontend going forward. The static
  HTML/JS prototype at the repo root (`index.html`, `marketplace.html`, etc.) is UI/UX reference only —
  don't extend it, and don't wire new features to its `localStorage`-based state.
- **Database**: Postgres via TypeORM, schema changes go through migrations (`backend/src/migrations/`,
  run via `npm run migration:run -w backend`) — not `synchronize` outside of quick local experiments.
- **Auth session**: stateless JWT in an httpOnly cookie (`backend/src/auth/session.service.ts`), not a
  DB-backed session table. Any endpoint that needs to know the caller's identity uses `AuthGuard` +
  `@CurrentUserId()` from `backend/src/auth/` — see that module's doc before building a new guarded
  route.

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
