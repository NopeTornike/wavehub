# backend/src/analytics

## Purpose
Read-only business statistics for the **Super Admin** dashboard (`frontend/pages/admin/analytics.tsx`):
sales, what sold (games, product types, categories, listings, sellers), subscriptions, coaching, money in
and out, users — for a date range, plus a zero-filled time series for the trend chart.

## Key files
- `analytics.controller.ts` — `GET /admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD`, `AuthGuard` +
  `AdminGuard` + `@RequireAdminRole()` (no roles = **Super Admin only**; every other staff role gets 403).
  Read-only, so nothing is audit-logged.
- `analytics.service.ts` — every figure is one parameterised SQL aggregate over real rows (rule 6).
- `dto/analytics-range.dto.ts` — both dates optional (`to` = today, `from` = 29 days before), inclusive,
  UTC; `from > to` or a range over 10 years → 400.

## Definitions (keep these consistent if you add metrics)
- **Sale** = an order whose status is not `pending_payment`/`expired` (money actually moved).
- **Sales value (GMV)** = price of those orders excluding `cancelled`/`refunded`.
- **Platform fees** = `platformFeeWaveCoin` of orders **completed** in the range (by `completedAt`) —
  fees are earned at completion. Coaching fees are reported separately.
- **In escrow** = right now (not range-bound): orders `paid`/`in_progress`/`delivered`/`disputed`, summed as
  `buyerTotalWaveCoin` (what the buyer actually paid — price + fee since the buyer carries the fee,
  2026-10-03). **Refunded value** = `buyerTotalWaveCoin` of cancelled/refunded orders (what went back).
  GMV stays the listing price; platform fees are paid by the buyer on new orders.
- **Subscriptions**: revenue = completed `subscription_charge_attempts.amountGel` in range; active = status
  `active`/`past_due`; MRR = active **paid** (not admin-granted) plans normalised to 30 days.
- **Top-ups** = completed `bog_topup_intents.amountGel`; **withdrawals paid** = `completed` by `processedAt`.
- Money is WaveCoin, 1:1 GEL. Series bucket = day for ranges ≤120 days, else month.
- Output carries only aggregates, listing titles and seller usernames (both public) — no PII.

## Tests
`test/analytics.e2e-spec.ts`: role matrix (buyer/operation lead 403, Super Admin 200), range validation,
bucket sizes, and exact deltas after real purchases (completed/paid/cancelled → orders, GMV, fees,
refunds, escrow, series, top seller, by-type) plus a no-PII check.
