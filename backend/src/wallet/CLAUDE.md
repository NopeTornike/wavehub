# wallet

## Purpose
The single source of truth for all WaveCoin movement. Owns `users.wavecoinBalance` and the ledger
that records every change to it. Nothing outside this module should ever write to
`wavecoinBalance` directly.

## Key files
- `wallet-ledger-entry.entity.ts` — `WalletLedgerEntry`: one row per balance change, with a signed
  `amountWaveCoin`, a `balanceAfter` snapshot, a `type`/`status` from `@wavehub/shared-types`, and
  an optional `reference` (unique — used for idempotency, e.g. a BOG transactionId)
- `wallet.service.ts` — `WalletService`, the only thing allowed to change a balance:
  `recordTopup`, `debitForOrder`, `releaseSellerEarnings`, `refundBuyer`. Every method takes an
  optional trailing `manager: EntityManager` param — pass one when the call must be atomic with
  other writes in the caller's own transaction (e.g. `OrdersService.purchase` creating the `Order`
  row and debiting the buyer together); omit it to let the method open its own transaction.
- `fee.util.ts` — `calculatePlatformFee(amountWaveCoin, feePercent)`, a pure function (floors the
  fee rather than losing a fractional coin) — reused wherever a seller payout needs a fee split
- `wallet.module.ts` — exports `WalletService`

## Data model
`wallet_ledger_entries` table (migration: `CreateWalletLedger`). `orderId`'s FK constraint to
`orders` was added later, in the `CreateOrdersSchema` migration (Phase 4), once that table existed
— a reminder that this module was deliberately built ahead of Orders, with the FK backfilled once
the referenced table caught up.

## Conventions & gotchas
- **Every method runs inside one transaction** that both updates `users.wavecoinBalance` and writes
  the matching ledger row — either one opened internally (`dataSource.transaction()`, the default
  when no `manager` is passed) or the caller's own (when composed via the `manager` param). Never
  split those two writes across separate calls/transactions — a crash between them would leave the
  balance and the audit trail disagreeing. See `backend/src/orders/orders.service.ts#purchase` for
  the reference example of composing a debit into a larger transaction.
- Balance reads use `lock: { mode: 'pessimistic_write' }` inside the transaction — this serializes
  concurrent debits/credits against the same user so two simultaneous requests can't both read a
  balance of 100, both debit 80, and leave the balance at -60. Don't remove the lock to "optimize"
  a read path.
- **`recordTopup` is idempotent on `reference`** — calling it twice with the same reference returns
  the original entry instead of double-crediting. This exists specifically because BOG retries
  callbacks; see `backend/src/payments/CLAUDE.md`. Any other caller that has a natural unique
  reference (a withdrawal request id, once that exists) should use the same pattern rather than
  inventing its own dedup logic.
- **There is no separate "hold" step before `releaseSellerEarnings`.** The seller's balance is
  credited immediately when an order completes; `status: Pending` + `availableAt` (default 7 days
  out) model *withdrawal eligibility*, not balance ownership. This was a deliberate simplification
  of the build plan's original "holdSellerEarnings + releaseSellerEarnings" two-primitive framing,
  and held even once Orders landed (Phase 4) and became a real caller — `OrdersService.acceptDelivery`
  /`autoCompleteDueOrders` both call `releaseSellerEarnings` directly, no separate hold step needed.
- **No platform-fee ledger row is written.** WaveHub's cut is just the gap between what a buyer was
  debited (`debitForOrder`) and what a seller receives (`releaseSellerEarnings`'s
  `sellerReceivesWaveCoin` argument, computed via `fee.util.ts`) — there's no "house" user account
  in this schema to attribute a fee entry to. A revenue report can derive platform revenue from
  Order data once Orders exist (build-plan Phase 11, Revenue Dashboard). Don't invent a fake user
  row just to hang a ledger entry off of.
- **No cron marks `pending` entries `available` yet**, even though `@nestjs/schedule` is now
  installed (Phase 4, for Orders' unrelated 72h auto-complete job) — nothing has wired an
  equivalent job for wallet entries because there's still no real caller needing "is this seller
  balance actually withdrawable" (that's Phase 8, seller-facing wallet/withdrawals). Anything that
  needs that question answered must compare `availableAt` to `now()` at query time, not trust
  `status` alone — `status` currently only distinguishes
  `available`/`pending`/`held`(future dispute-freeze use)/`reversed`, it isn't time-aware by itself.
- Derived views (available balance, pending balance, total earned, withdrawn — the numbers a seller
  dashboard would show) are **not implemented here**. They're `SUM()` queries over this table and
  belong with whatever module actually renders them (build-plan Phase 8, seller-facing wallet). Don't
  add balance-summary methods to `WalletService` speculatively before there's a real caller.
- WaveCoin is always an integer — never switch any of these fields to a float/decimal.

## Related modules
- `backend/src/users/` — owns the `wavecoinBalance` column this module writes to.
- `backend/src/payments/` — calls `recordTopup`, via the BOG callback.
- `backend/src/orders/` — calls `debitForOrder` (purchase), `releaseSellerEarnings` (accept/
  auto-complete), and `refundBuyer` (cancellation) — all composed into `OrdersService`'s own
  transactions via the `manager` param. Read `orders/CLAUDE.md` for the composition pattern before
  adding a new money-moving call site anywhere.
- `packages/shared-types/` — `WalletLedgerType`/`WalletLedgerStatus` enums.
- Future `backend/src/disputes/` (Phase 8) will be the next real caller of `refundBuyer`/
  `releaseSellerEarnings` for admin-decided outcomes, and the first thing to actually set
  `status: Held` on a ledger entry.

## Status
`recordTopup`, `debitForOrder`, `releaseSellerEarnings`, and `refundBuyer` are all fully wired to
real callers now (`backend/src/payments/` and `backend/src/orders/`) and exercised by unit tests —
no more "built ahead of its caller" primitives left in this module. Not yet built: withdrawals
(seller-facing balance requests, Phase 8), derived balance-summary views (available/pending/earned/
withdrawn, also Phase 8), dispute-driven freezing (`status: Held` is defined but nothing sets it yet
— Phase 8).
