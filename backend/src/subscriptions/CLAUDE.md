# subscriptions

## Purpose
BOG-billed recurring membership plans (LAUNCH_PLAN.md §3). Two plan types sharing one schema —
`SubscriptionAudience.Buyer` (Buyer Membership) and `SubscriptionAudience.SellerCoach` (Seller/Coach
Visibility) — each with multiple admin-defined tiers and an extensible `perks` jsonb bag (adding a
perk means a new key + teaching the reading module, no migration).

## Key files
- `subscription-plan.entity.ts` — `SubscriptionPlan` (audience, tier, name, description, `priceGel`,
  `billingPeriodDays`, `perks`, `sortOrder`, `isActive`). No seed data — admins create plans.
- `user-subscription.entity.ts` — `UserSubscription` (status `active`/`past_due`/`cancelled`/
  `expired`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `bogParentOrderId`). `audience` is snapshotted
  onto the row so a partial unique index (`UQ_user_subscriptions_active_per_audience`) can enforce
  one live (active/past_due) subscription per user per audience, race-safe at the DB level.
- `subscription-charge-attempt.entity.ts` — mirrors `BogTopupIntent`: `id` is the
  `external_order_id` sent to BOG, `kind` `checkout`|`recharge`, `status` pending|completed|failed.
- `subscriptions.service.ts` — plan CRUD, `startCheckout`, `handleBogCallback`, `cancel`, the hourly
  `@Cron('0 * * * *') sweepDueSubscriptions`, and the read API other modules use:
  `getActivePerks(userId, audience)`, `getActivePerksForUsers(ids, audience)` (batched),
  `effectiveFeePercent(sellerOrCoachId, basePercent)`.
- `subscriptions.controller.ts` — `GET subscriptions/plans` (public), `GET subscriptions/mine`,
  `POST subscriptions/checkout`, `POST subscriptions/:id/cancel`, `POST subscriptions/bog-callback`
  (signature-verified, `@SkipThrottle`, always 200), `GET/POST admin/subscription-plans`,
  `POST admin/subscription-plans/:id` (SuperAdmin only, audit-logged).

## Billing model (researched against BOG's API, not guessed)
1. `startCheckout` creates a one-time BOG checkout order (`BogPaymentsService.createSubscriptionOrder`)
   and a `checkout` attempt row.
2. On the (verified, re-fetched via `getOrderDetails`) `completed` callback, `saveCard(orderId)` marks
   the paid order as a recurring "parent"; only then is the `UserSubscription` created. If saving the
   card fails the attempt stays `pending` (retryable, logged for manual review) — no subscription
   without a working renewal path.
3. The hourly sweep finds subscriptions at/after `currentPeriodEnd`: `cancelAtPeriodEnd` → `cancelled`;
   `past_due` beyond the 7-day grace → `expired`; otherwise `chargeSavedCard(parent…)` (BOG background
   recharge, amount **fixed to the parent order** — so changing price/plan means cancel + fresh
   checkout; `startCheckout` enforces cancel-first) and a `recharge` attempt. A recent `pending`
   attempt (<24h) blocks re-dispatch; a dispatch error or `rejected` callback → `past_due`, which
   **keeps perks** during grace. A `completed` recharge callback extends the period from
   `max(oldEnd, now)` and reactivates.

## Perks: who reads what
| Key | Read by |
|---|---|
| `platformFeeDiscountPercent` | `OrdersService.purchase()` (seller's plan), `CoachingSessionsService.request()` (coach's plan) via `effectiveFeePercent` — **percentage points subtracted** from the platform fee, floored at 0, rounded, snapshotted onto the order/session. Seller/Coach audience only. |
| `featuredListings` | `ListingsService.browseActive`, `CoachesService.browseVerified` — live join at query time (no cached flag), boost ordered ahead of existing sort. |
| `prioritySupport` | `SupportService.createTicket` — either audience's plan opens the ticket as `High`. |
| `profileBadge` | `GET users/:username` (Seller/Coach badge wins over Buyer), `PublicCoachSummary/Detail`. |

## Status / caveats
- Unit-tested (`subscriptions.service.spec.ts`) and every perk verified against live Postgres with
  seeded `user_subscriptions` rows (badge, coach + listing boost incl. live revocation, `High` ticket,
  fee 10%→7% snapshot), plus a browser click-through of `/plans` (list, cancel-at-period-end,
  checkout error path) and `/admin/subscription-plans`.
- **NOT verified against real BOG**: no credentials and no public callback URL in dev (same limit as
  `backend/src/payments/`). The saved-card/recurring endpoints (`PUT …/orders/:id/subscriptions`,
  `POST …/ecommerce/orders/:parent/subscribe`) are implemented from BOG's published docs; BOG may
  need saved-card enablement on the merchant account — confirm with BOG before launch, and confirm
  the real callback payload shapes with a sandbox payment.
- No admin UI to manually grant/revoke a user's subscription, no email on `past_due`, no proration.
