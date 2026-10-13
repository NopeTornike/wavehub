# withdrawals

## Purpose
Seller-facing payout requests, plus the derived wallet-balance view a seller dashboard needs
(available/pending/earned/withdrawn). Build-plan Phase 9. Payout mechanism for MVP is
manual/admin-approved per SPECIFICATION.md §5.6 — no real bank/PayPal/Wise API integration, an
admin marks a request `completed` once they've sent the money outside the system.

## Key files
- `withdraw-request.entity.ts` — `WithdrawRequest`: `amountWaveCoin`, `method`
  (`WithdrawMethod`), `payoutDetails` (jsonb, shape varies by method — see the entity's own
  comment for why this isn't typed columns), `status` (`WithdrawStatus`), `adminNote`
  (required for a `Rejected` outcome), `processedBy`/`processedAt`
- `withdraw-lifecycle.ts` — `assertValidTransition(from, to)`, same pattern as
  `backend/src/orders/order-lifecycle.ts`. `Pending → Processing → Completed`, or
  `Pending`/`Processing → Rejected`, or `Pending → Cancelled` (seller-initiated, only while still
  Pending — once an admin starts `Processing` it, a seller can no longer unilaterally back out)
- `withdrawals.service.ts` — `request` (guard clauses below), `cancel` (seller, Pending-only),
  `process` (admin-only), `getBalanceSummary` (composes `WalletService`'s ledger-derived numbers
  with this module's own `WithdrawRequest` sums — see the wallet/CLAUDE.md cross-reference)
- `withdrawals.controller.ts` — also owns `GET wallet/balance` and `GET wallet/transactions`
  (routes named for `wallet`, module named for `withdrawals` — see the gotcha below)
- `dto/create-withdraw-request.dto.ts`, `dto/process-withdraw-request.dto.ts`

## Data model
`withdraw_requests` (migration: `CreateWithdrawRequests`), `CHECK (amountWaveCoin > 0)`. No new
columns on `wallet_ledger_entries` — a withdrawal's fund movement reuses that table's existing
`Withdrawal` ledger type (see `backend/src/wallet/CLAUDE.md`'s `holdForWithdrawal`/
`reverseWithdrawal`), it doesn't get its own schema.

## Conventions & gotchas
- **A withdrawal debits `wavecoinBalance` the moment the request is created, not when an admin
  approves it.** `WalletService.holdForWithdrawal` is called inside the same transaction as the
  `WithdrawRequest` insert (same "atomic, not compensated after the fact" principle as
  `OrdersService.purchase`). This is deliberate: it reserves the funds so a seller can't request a
  withdrawal and then also spend the same coins on a purchase before an admin gets to it. If the
  request is later `Rejected` or `Cancelled`, `WalletService.reverseWithdrawal` credits it back;
  `Completed` needs no wallet action at all, since the debit already happened.
- **`GET wallet/balance`/`GET wallet/transactions` live in this module's controller, not a
  `WalletController` in `backend/src/wallet/`.** The full balance view
  (`PublicWalletBalance`) needs both ledger-derived numbers (`WalletService.getBalanceSummary`)
  and withdraw-request-derived numbers (`pendingWithdrawal`/`totalWithdrawn`, summed from this
  module's own table) — `wallet/` has no access to `WithdrawRequest`, and shouldn't (dependency
  direction is `withdrawals → wallet`, one-way). Look here first if you're hunting for a wallet
  balance endpoint and it's not in `backend/src/wallet/`.
- **The minimum withdrawal (default 20, SPECIFICATION.md §5.6) is now admin-configurable** —
  `request()` reads it from `PlatformSettingsService.getMinWithdrawalWaveCoin()`
  (`backend/src/settings/`) instead of a hardcoded constant. Same module as the platform fee
  percent `orders.service.ts` reads.
- **`request()`'s active-dispute check queries `Dispute` directly** (`Not(In([Resolved,
  Closed]))` — any non-terminal status blocks a new withdrawal, not just `Open`) rather than
  importing `DisputesService`. Same "inject the entity you need, don't import the whole module"
  precedent as `backend/src/reviews/` injecting `Order` directly instead of importing
  `OrdersModule`. This only checks at request time — an existing `Pending`/`Processing` withdrawal
  isn't automatically cancelled if a dispute opens afterward; that's a gap, see Status.
- **`availableToWithdraw`'s cap-by-current-balance behavior lives in `WalletService`, not
  here** — see `wallet/CLAUDE.md`'s `getBalanceSummary` entry for why a seller who already spent
  earned coins on a purchase can't request a withdrawal against money they no longer have.
- **Only Super Admin can call `process()`'s route.** SPECIFICATION.md's Super Admin "Payments" CAN
  list is the only one with "approve/reject withdrawal"; every other role's CANNOT list explicitly
  excludes it (checked directly against the spec, not guessed — same discipline as
  `backend/src/admin/CLAUDE.md`'s other role citations).
- **`GET withdrawals/pending`** (same Super-Admin-only gate as `process`) is the payout queue —
  `listPending()` returns `AdminWithdrawRequestSummary[]` (`@wavehub/shared-types`), which
  includes `payoutDetails` (PayPal email / Wise account / bank+IBAN+SWIFT) since an admin manually
  paying this out needs it, unlike the seller's own `PublicWithdrawRequest` view.

## Related modules
- `backend/src/wallet/` — `holdForWithdrawal`/`reverseWithdrawal`/`getBalanceSummary`/
  `listTransactions`, all called from here. Read that module's doc for the ledger invariants
  before touching either side.
- `backend/src/disputes/` — the active-dispute check reads `Dispute` directly (see the gotcha
  above).
- `backend/src/admin/` — `AdminGuard`/`@RequireAdminRole`/`AdminAuditService`, used by `process()`.
- `backend/src/settings/` — `request()` reads the current minimum withdrawal from here.
- `backend/src/notifications/` — `WithdrawalStatusChanged`, fired on every `process()` call
  (Processing/Completed/Rejected all notify, not just the terminal ones).
- `packages/shared-types/` — `WithdrawStatus`/`WithdrawMethod` enums (already existed, unused
  until now), `PublicWalletBalance`/`PublicWalletTransaction`/`PublicWithdrawRequest` response
  shapes.

## Status
`request`/`cancel`/`process`/`getBalanceSummary`/`listPending` are implemented and unit-tested
(guard clauses: minimum threshold, active-dispute block, exceeds-available-balance, ownership on
cancel, the Rejected-reverses/Completed-doesn't-touch-wallet distinction) — 176 backend tests
total as of the last update. Not verified against a live Postgres transaction (no DB available in
the sandbox this was built in). Frontend exists on both sides now: `frontend/pages/wallet.tsx`
shows the seller's own full balance breakdown, a withdrawal request form (method-specific
payout-detail fields), their own requests with a cancel button for `Pending` ones, and a raw
transaction history list; `frontend/pages/admin/withdrawals.tsx` gives Super Admin the matching
payout-queue UI (`listPending`, then approve-as-completed or reject with a reason, via `process`).
Not built: seller-profile-stored payout details (the source spec's "seller profile stores payout
details" — this module asks fresh on every request instead, since there's no seller-profile
table yet), KYC status field, automatically cancelling an in-flight withdrawal when a dispute
opens afterward (only checked at request time), and any real bank/PayPal/Wise payout API
integration (manual/admin-marked per the MVP decision).
