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
  `recordTopup`, `debitForOrder`, `releaseSellerEarnings`, `refundBuyer`, `holdForWithdrawal`,
  `reverseWithdrawal`. Every balance-changing method takes an optional trailing
  `manager: EntityManager` param — pass one when the call must be atomic with other writes in the
  caller's own transaction (e.g. `OrdersService.purchase` creating the `Order` row and debiting the
  buyer together); omit it to let the method open its own transaction. Also has two read-only
  methods with no `manager` param since they never write: `getBalanceSummary` (derived
  available/pending/earned numbers) and `listTransactions` (paginated raw ledger history).
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
  equivalent job for wallet entries. `getBalanceSummary` doesn't need one either: it compares
  `availableAt` to `now()` at query time rather than trusting `status`, so the missing cron doesn't
  block correctness, only means `status` itself stays a slightly stale label.
- **`getBalanceSummary` derives `availableToWithdraw` as `min(walletBalance, clearedEarnings)`,
  not just `clearedEarnings`.** `walletBalance` (== `users.wavecoinBalance`) is a single pooled
  number that also includes buyer top-up money and already nets out every debit (purchases,
  withdrawal holds); `clearedEarnings` (`totalEarned - pendingClearance`) only tracks
  seller-earnings that have passed the 7-day hold, with no knowledge of what the seller has since
  spent. Capping by the actual current balance is what prevents a seller who already spent earned
  coins on a purchase from requesting a withdrawal against money they no longer have — see
  `wallet.service.spec.ts`'s two `getBalanceSummary` tests for both directions of this cap.
- **`getBalanceSummary` deliberately does NOT include `pendingWithdrawal`/`totalWithdrawn`** —
  this module has no access to `WithdrawRequest` (owned by `backend/src/withdrawals/`, which
  depends on this module, not the other way around). `WithdrawalsService#getBalanceSummary`
  composes this method's output with its own numbers into the full `PublicWalletBalance` the
  frontend actually renders — see that module's `CLAUDE.md`.
- **`holdForWithdrawal`/`reverseWithdrawal` follow the exact `debitForOrder`/`refundBuyer` shape**
  (lock the user row, check balance where relevant, write balance + ledger row in one step) with
  one addition: both are idempotent on a derived `reference` (`withdraw:<id>` /
  `withdraw-reversed:<id>`), same pattern as `recordTopup` — a duplicate call for the same
  withdrawal request (e.g. a network retry) is a no-op, not a double debit/credit.
- WaveCoin is always an integer — never switch any of these fields to a float/decimal.

## Related modules
- `backend/src/users/` — owns the `wavecoinBalance` column this module writes to.
- `backend/src/payments/` — calls `recordTopup`, via the BOG callback.
- `backend/src/orders/` — calls `debitForOrder` (purchase), `releaseSellerEarnings` (accept/
  auto-complete), and `refundBuyer` (cancellation) — all composed into `OrdersService`'s own
  transactions via the `manager` param. Read `orders/CLAUDE.md` for the composition pattern before
  adding a new money-moving call site anywhere.
- `backend/src/disputes/` — the second real caller of `releaseSellerEarnings`/`refundBuyer`
  (admin-decided outcomes via `DisputesService#resolve`), composed the same way via `manager`. This
  did **not** end up being the thing that sets `status: Held` on a ledger entry (an earlier version
  of this doc predicted it would) — dispute resolution reuses the existing `Pending`/`Available`
  statuses exactly as `OrdersService` already used them; `Held` is still unset by anything. See
  `backend/src/disputes/CLAUDE.md` for how a dispute "freezes" an order (via `Order.status`, not a
  wallet-ledger flag).
- `backend/src/withdrawals/` — the third real caller of `holdForWithdrawal`/`reverseWithdrawal`/
  `getBalanceSummary`/`listTransactions`. Also owns `GET wallet/balance`/`GET wallet/transactions`
  in its own controller, not a `WalletController` here — see that module's `CLAUDE.md` for why.
- `packages/shared-types/` — `WalletLedgerType`/`WalletLedgerStatus` enums,
  `PublicWalletTransaction` response shape.

## Status
`recordTopup`, `debitForOrder`, `releaseSellerEarnings`, `refundBuyer`, `holdForWithdrawal`, and
`reverseWithdrawal` are all fully wired to real callers now (`backend/src/payments/`,
`backend/src/orders/`, `backend/src/disputes/`, and `backend/src/withdrawals/`) and exercised by
unit tests — no more "built ahead of its caller" primitives left in this module.
`getBalanceSummary`/`listTransactions` are the read-side counterpart, also real and tested.
There's still no `WalletController` in this directory — see `backend/src/withdrawals/CLAUDE.md`
for where those routes actually live and why. `status: Held` on a ledger entry is finally used
too, by `holdForWithdrawal` — the one prediction from an earlier version of this doc (that
disputes would be the first to use it) turned out wrong, withdrawals got there instead.
