# payments

## Purpose
Integrates with Bank of Georgia's (BOG) e-commerce API to let a buyer top up their WaveCoin balance
with real money. This is the *only* real-money entry point into WaveHub (see root `CLAUDE.md`
architecture notes — WaveCoin top-up, not per-order fiat escrow, is the chosen payment model).

## Key files
- `bog-payments.controller.ts` — `POST /payments/bog/create-order` (guarded, requires a session) and
  `POST /payments/bog/callback` (public — BOG calls this, verified by signature instead of auth)
- `bog-payments.service.ts` — talks to BOG's API: OAuth2 client-credentials token, order creation,
  and `getOrderDetails` (authoritative status lookup, used by the callback handler)
- `bog-signature.util.ts` — `verifyBogCallbackSignature`, RSA-SHA256 verification of the
  `Callback-Signature` header against BOG's published public key (embedded as
  `BOG_DEFAULT_CALLBACK_PUBLIC_KEY`, overridable via `BOG_CALLBACK_PUBLIC_KEY` env var)
- `same-origin.util.ts` — `isSameOriginAsFrontend`, validates `successUrl`/`failUrl` are on our own
  frontend before accepting them (open-redirect defense — see `createOrder`'s
  `assertSameOriginAsFrontend` wrapper)
- `bog-topup-intent.entity.ts` — `BogTopupIntent`: created when checkout starts, keyed by the
  transactionId we generate (= BOG's `external_order_id`), so the callback can map back to a
  user + WaveCoin amount
- `payments.module.ts` — wires the above; imports `UsersModule`, `WalletModule`, `AuthModule`

## Data model
Owns `bog_topup_intents` (migration: `CreateWalletLedger`, same migration as the wallet ledger
tables since they landed together). Calls into `backend/src/wallet/` (`WalletService.recordTopup`)
to actually credit a balance — this module never touches `users.wavecoinBalance` itself.

## Conventions & gotchas
- **`create-order` derives the WaveCoin amount server-side at a fixed 1:1 rate from `amountGel`** —
  the client only sends `amountGel`, `successUrl`, `failUrl`. Earlier code accepted a client-supplied
  `wavecoins` field independent of `amountGel`, which meant a client could request being credited an
  arbitrary WaveCoin amount for whatever it actually paid. Do not reintroduce a client-supplied
  WaveCoin count.
- **`create-order` uses the authenticated user (`@CurrentUserId()`), not a client-supplied
  `username`.** Same class of bug as above — trusting the body for "which account gets credited" on
  a financial endpoint is a direct account-takeover-adjacent vector. Always derive identity from the
  session.
- **The callback handler does not trust the callback body's own status field.** It verifies the
  signature (proving BOG sent *something* for this `order_id`), then calls
  `BogPaymentsService.getOrderDetails(bogOrderId)` to re-fetch the authoritative current status from
  BOG's API before crediting anything. This is deliberate — treat the callback as a notification to
  go check the source of truth, not as itself trustworthy for money decisions, even though it's
  signed. If you're tempted to read `order_status` directly off the callback body to save a round
  trip, don't.
- **Signature verification needs the raw request bytes**, not a re-serialized copy of the parsed
  body (JSON re-serialization can differ in key order/whitespace and silently break RSA
  verification). This is why `main.ts` passes `{ rawBody: true }` to `NestFactory.create` — the
  controller reads `req.rawBody`, not `JSON.stringify(req.body)`.
- **`recordTopup` is idempotent**, so the callback handler doesn't need its own dedup logic beyond
  checking `intent.status !== 'completed'` before calling it — a duplicate BOG callback retry is
  safe either way.
- **The callback endpoint always returns `{ ok: true }` / HTTP 200**, even for invalid signatures,
  unknown orders, or lookup failures — this is deliberate so BOG doesn't retry indefinitely against
  something we've already permanently rejected. Errors are logged server-side (`Logger.warn`/`.error`),
  not surfaced to the caller. Don't change this to return 4xx/5xx for "expected" rejection cases;
  reserve non-200 for genuine infrastructure failures if you add retryable ones later.
- The BOG public key and API endpoints referenced here were fetched from
  `https://api.bog.ge/docs/en/payments/` on 2026-07-15. If BOG's docs have changed since, re-verify
  before trusting this module against production traffic — don't assume it's still current forever.
- **Every order-creation/charge call needs an `Accept-Language: ka` header, not a body field.**
  Found against real production BOG (2026-09-23, first-ever real-credential test): omitting it
  entirely made BOG reject the request with `"Invalid language *"` — their server appears to fall
  back to reading the default `Accept: */*` header instead and choking on the literal `*`. Their
  own docs' example request body doesn't mention this at all; it's covered on a separate docs page
  about the header only. `BOG_LANGUAGE_HEADER` in `bog-payments.service.ts` is the one place this is
  set — every new BOG call that creates/affects a checkout must spread it into its headers, and
  `bog-payments.service.spec.ts` locks this in so it can't silently regress again.
- **`successUrl`/`failUrl` are validated same-origin against `FRONTEND_URL`** before being sent to
  BOG (`assertSameOriginAsFrontend`). BOG redirects the buyer's browser to one of these after
  payment — an unvalidated redirect target here is a real open-redirect, and one that follows an
  actual payment is a specifically plausible phishing setup. Don't relax this to allow arbitrary
  URLs.
- **`create-order` is rate-limited** (10 req/60s, `CREATE_ORDER_THROTTLE`) — it's guarded, but still
  worth limiting since it triggers an outbound call to BOG per request. **`callback` is explicitly
  exempted** (`@SkipThrottle()`) since it's server-to-server traffic from BOG protected by signature
  verification rather than throughput limits, and IP-based throttling could plausibly drop a
  legitimate payment confirmation under load — see root `CLAUDE.md`'s Security section.
- **Never return an upstream error's raw message to the client** (`err.message` from BOG's API) —
  log it server-side, return a generic error. `createOrder`'s catch block is the reference example.

## Related modules
- `backend/src/wallet/` — the callback's only effect on state goes through
  `WalletService.recordTopup`.
- `backend/src/auth/` — `AuthGuard`/`@CurrentUserId()` gate `create-order`.
- `backend/src/users/` — looks up the user for their username (used in the BOG order description)
  and id.

## Status
2026-09-23: **real production BOG credentials are now configured** (`BOG_CLIENT_ID`/`BOG_CLIENT_SECRET`
in the server's `.env`, never in git — see `docs/DEPLOY.md`). Verified against the real API: OAuth
client-credentials token exchange succeeds (HTTP 200, real bearer token), and `POST
/payments/bog/create-order` was exercised through the real deployed app end-to-end — this is what
surfaced the `Accept-Language` bug above; after the fix, order creation against real BOG succeeds
and returns a real checkout redirect URL. **Not yet verified**: completing an actual checkout with a
real card (would move real money — deliberately not done by an agent; needs the account owner to
do it manually and confirm the callback fires and credits WaveCoin correctly), and the callback body's
exact real shape (still inferred from BOG's docs, `body.order_id` / `order_status.key`/
`external_order_id`, not yet observed from a real payload since no real payment has completed).
Signature verification is unit-tested (`bog-signature.util.spec.ts`); the public key has not been
independently reconfirmed against BOG's current published key since 2026-07-15.

## Subscription billing additions
`BogPaymentsService` also exposes `createSubscriptionOrder`, `saveCard(orderId)` and
`chargeSavedCard(parentOrderId, externalOrderId, callbackUrl)` for `backend/src/subscriptions/`
(exported via `PaymentsModule`). `saveCard`/`chargeSavedCard` deliberately have no "credentials not
configured" guard — they surface BOG's own error and callers catch it. Subscription callbacks land on
`POST /subscriptions/bog-callback` (same signature verification + authoritative re-fetch as the
top-up callback). Same unverified-against-real-BOG caveat as above; see the subscriptions doc.
