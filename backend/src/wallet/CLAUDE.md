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
  `recordTopup`, `debitForOrder`, `releaseSellerEarnings`, `refundBuyer`
- `fee.util.ts` — `calculatePlatformFee(amountWaveCoin, feePercent)`, a pure function (floors the
  fee rather than losing a fractional coin) — reused wherever a seller payout needs a fee split
- `wallet.module.ts` — exports `WalletService`

## Data model
`wallet_ledger_entries` table (migration: `CreateWalletLedger`). `orderId` is a bare nullable uuid
column with **no FK yet** — the `orders` table doesn't exist until build-plan Phase 5. Add the real
FK constraint once it does; don't leave this dangling indefinitely.

## Conventions & gotchas
- **Every method runs inside one `dataSource.transaction()`** that both updates `users.wavecoinBalance`
  and writes the matching ledger row. Never split those two writes across separate calls/transactions
  — a crash between them would leave the balance and the audit trail disagreeing.
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
  of the build plan's original "holdSellerEarnings + releaseSellerEarnings" two-primitive framing —
  the schema notes underlying that framing already described a single release step, and there was
  no real use case yet (Orders don't exist) that needed two. If a real reason to split them
  reappears when Orders lands (Phase 5), reconsider then, but don't add the split speculatively.
- **No platform-fee ledger row is written.** WaveHub's cut is just the gap between what a buyer was
  debited (`debitForOrder`) and what a seller receives (`releaseSellerEarnings`'s
  `sellerReceivesWaveCoin` argument, computed via `fee.util.ts`) — there's no "house" user account
  in this schema to attribute a fee entry to. A revenue report can derive platform revenue from
  Order data once Orders exist (build-plan Phase 11, Revenue Dashboard). Don't invent a fake user
  row just to hang a ledger entry off of.
- **No cron marks `pending` entries `available` yet** (`@nestjs/schedule` isn't installed until
  build-plan Phase 5). Anything that needs "is this seller balance actually withdrawable" must
  compare `availableAt` to `now()` at query time, not trust `status` alone — `status` currently only
  distinguishes `available`/`pending`/`held`(future dispute-freeze use)/`reversed`, it isn't
  time-aware by itself.
- Derived views (available balance, pending balance, total earned, withdrawn — the numbers a seller
  dashboard would show) are **not implemented here**. They're `SUM()` queries over this table and
  belong with whatever module actually renders them (build-plan Phase 8, seller-facing wallet). Don't
  add balance-summary methods to `WalletService` speculatively before there's a real caller.
- WaveCoin is always an integer — never switch any of these fields to a float/decimal.

## Related modules
- `backend/src/users/` — owns the `wavecoinBalance` column this module writes to.
- `backend/src/payments/` — the only current caller (`recordTopup`, via the BOG callback).
- `packages/shared-types/` — `WalletLedgerType`/`WalletLedgerStatus` enums.
- Future `backend/src/orders/` (Phase 5) and `backend/src/disputes/` (Phase 8) will be the real
  callers of `debitForOrder`/`releaseSellerEarnings`/`refundBuyer` — read this doc before wiring them
  up, the transaction/locking pattern here is the one to follow, not reinvent.

## Status
`recordTopup` is fully wired to a real caller (`backend/src/payments/bog-payments.controller.ts`'s
callback handler) and exercised by unit tests. `debitForOrder`, `releaseSellerEarnings`, and
`refundBuyer` are implemented and unit-tested in isolation but have no real caller yet — they're
built ahead of Orders (Phase 5) per the build plan, so their exact call sites/argument shapes may
need small adjustments once Orders exist for real. Not yet built: withdrawals, derived
balance-summary views, dispute-driven freezing (`status: Held` is defined but nothing sets it yet).
