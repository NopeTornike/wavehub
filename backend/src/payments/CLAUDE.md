# payments

## Purpose
Integrates with Bank of Georgia's (BOG) e-commerce API to let a buyer top up their WaveCoin balance
with real money. This is the *only* real-money entry point into WaveHub (see root `CLAUDE.md`
architecture notes — WaveCoin top-up, not per-order fiat escrow, is the chosen payment model).

## Key files
- `bog-payments.controller.ts` — `POST /payments/bog/create-order`
- `bog-payments.service.ts` — OAuth2 client-credentials token fetch against BOG, then creates a BOG
  order for a WaveCoin purchase, returns `{ orderId, redirectUrl }`
- `payments.module.ts` — wires the above into Nest DI

## Data model
Owns nothing yet. Once `backend/src/wallet/` exists (build plan Phase 3), this module's *success*
callback should call into `WalletService.recordTopup()` rather than mutating any balance directly —
this module's job is talking to BOG, not owning the ledger.

## Conventions & gotchas
- Requires `BOG_CLIENT_ID`/`BOG_CLIENT_SECRET` env vars; throws `503` cleanly if absent — this is
  correct behavior, don't "fix" it by hardcoding fallback credentials.
- `BOG_OAUTH_URL`/`BOG_ORDERS_URL` have working defaults pointing at BOG's real endpoints — only
  override for testing against a sandbox.
- **There is currently no callback/webhook handler** verifying a payment actually succeeded before
  crediting anything — `create-order` only kicks off the BOG checkout redirect. Before wiring this to
  `WalletService.recordTopup()`, make sure the success path is driven by a verified callback from BOG
  (`callback_url`/`BOG_CALLBACK_URL`), not by trusting the frontend's `successUrl` redirect, which a
  user could hit without actually paying.
- No idempotency handling yet — if BOG retries a callback, don't double-credit. Add an idempotency
  check (e.g. on `transactionId`) when the real webhook handler is built.

## Related modules
- `backend/src/wallet/` (not built yet) — this module's success path should feed into it.
- `backend/src/users/` — top-ups ultimately credit a user's `wavecoin_balance`.

## Status
Order creation (the "start a BOG checkout" half) exists. Missing: the callback/webhook handler that
actually confirms payment and credits WaveCoin, idempotency, and the wire-up to a real wallet ledger
(none of `wallet_ledger`/`WalletService` exist yet — this is build plan Phase 3).
