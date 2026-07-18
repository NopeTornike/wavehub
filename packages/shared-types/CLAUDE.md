# shared-types

## Purpose
Enums and API shapes shared between the NestJS backend and the Next.js frontend, so the two apps
can't silently drift on things like order/dispute/wallet status values. Types only — no business
logic, no runtime dependencies, no build step (consumed as TS source directly via the npm workspace).

## Key files
- `src/index.ts` — everything lives in this one file for now; split into multiple files only if it
  grows past a few hundred lines.

## Data model
N/A — this package has no persistence of its own. It mirrors enum values that the backend's TypeORM
entities and migrations are the actual source of truth for (see each domain module's own CLAUDE.md).

## Conventions & gotchas
- Enum string values here MUST match the corresponding Postgres check-constraint/enum values exactly
  — if a migration changes an enum's underlying values, update this file in the same change.
- No build step: both `backend` (ts-node/tsc) and `frontend` (Next.js) resolve `.ts` source directly
  through the workspace symlink. Don't add a compiled `dist/` output unless a consumer genuinely needs
  pre-built JS (e.g. a non-TS runtime) — it's unnecessary complexity otherwise.
- Keep this package to types/enums only. If you're tempted to add a helper function here, ask whether
  it belongs in the specific backend/frontend module instead.
- **`Public*` interfaces (`PublicListingSummary`, `PublicListingDetail`, `PublicSeller`,
  `PublicReview`, etc.) describe API response shapes, not TypeORM entities** — they're hand-written
  to match what a controller actually returns (see `ListingsService#browseActive`/`#findPublicById`),
  deliberately excluding internal-only fields even where the entity would already exclude them
  (e.g. `User.passwordHash` is `select: false`) — treat that as defense in depth, not a reason to
  skip typing the public shape explicitly. **If you change what a controller returns, update the
  matching `Public*` interface in the same change** — nothing enforces these stay in sync
  automatically (there's no runtime validation against them), they're a discipline, not a contract.
- **`RequirementField`/`FaqEntry` are the canonical definitions** — `backend/src/listings/
  service-details.entity.ts` re-exports them (`export type { RequirementField, FaqEntry }`) for
  backward-compat import paths rather than defining its own copy. If you're adding a new type that
  started life in an entity file, prefer moving it here and re-exporting, following this precedent,
  rather than leaving two competing definitions.

## Related modules
- Every backend domain module (`backend/src/orders/`, `backend/src/wallet/`, `backend/src/disputes/`,
  etc.) imports its relevant enums from here instead of redefining them locally.
- `frontend/` imports these same enums for status displays, form options, and API response typing.

## Status
Scaffolded in Phase 0 with the full enum set anticipated by the build plan. As of Phase 1,
`UserStatus` and `PublicUser`/`AuthMeResponse` are live and actually consumed (`backend/src/users/
user.entity.ts` and `users.service.ts#toPublicUser`, `frontend/lib/api.ts`) — keep those three in
sync across both apps if they change. `AdminRole` was expanded from a 3-value placeholder to the
real 6 named roles (client's "Staff Management System" docs — see `SPECIFICATION.md` §5.13) and now
has a real backing column (`users.adminRole`, Phase 8's admin-foundation work) — `toPublicUser()`
reads it for real, no longer hardcoded `null` (see `backend/src/users/CLAUDE.md` and
`backend/src/admin/CLAUDE.md`, whose `AdminGuard` is the actual consumer that gates on it).
`PublicUser` gained `wavecoinBalance` when the frontend wallet page first needed somewhere to read
it from — a real `GET wallet/balance` endpoint exists now too (see
`backend/src/withdrawals/CLAUDE.md`), returning the fuller `PublicWalletBalance`, but `/auth/me`
still carries the raw spendable number for anywhere that just needs the header display, not the
full breakdown. `PublicOrderSummary`/`PublicOrderDetail`/`PublicOrderParty`/
`PublicOrderListingRef`/`PublicOrderPackageRef`/`PublicOrderDeliveryFile` were added alongside
`backend/src/orders/`'s `OrdersService#toSummary` and the frontend's `orders/` pages — same
hand-written-not-derived-from-the-entity discipline as the `PublicListing*` shapes. `PublicMessage`
was added alongside `backend/src/chat/` — `ConversationType`/`MessageType`/`MessageStatus` now have
a backing table too (`ChatService#toPublicMessage`). `PublicDispute`/`PublicDisputeMessage`/
`PublicDisputeEvidence` were added alongside `backend/src/disputes/` — `DisputeStatus`/
`DisputeResolution` now have a backing table too (`DisputesService#toPublic`).
`PublicWalletBalance`/`PublicWalletTransaction`/`PublicWithdrawRequest` were added alongside
`backend/src/withdrawals/` — `WithdrawStatus`/`WithdrawMethod` now have a backing table too
(previously scaffolded-but-unused since Phase 0), and `PublicWalletTransaction` finally gives
`WalletLedgerType`/`WalletLedgerStatus` (backed by `wallet_ledger_entries` since Phase 2, but with
no response shape of its own until now) a `Public*` wrapper, since `GET wallet/transactions` needed
one. Every enum in this file now has both a backing table and at least one `Public*` consumer.
