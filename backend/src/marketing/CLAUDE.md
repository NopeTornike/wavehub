# marketing

## Purpose
Promo codes and homepage banners (SPECIFICATION.md §5.13 "Marketing" + "Content Management").

## Promo codes
- `promo-code.entity.ts`: `promo_codes` (code uppercase `^[A-Z0-9_-]{3,30}$`, `amountWaveCoin` 1–1000,
  `maxRedemptions` 1–100000, `redeemedCount`, optional `startsAt`/`expiresAt`, `active`, internal
  `note`) and `promo_redemptions` (UNIQUE `promoCodeId,userId`). Migration `1784374000000-PromoCodesBanners`.
- A code adds **spendable credit**: `WalletService.creditPromo` writes a `promo_credit` ledger row. It is
  not an earning, so it never becomes withdrawable (`availableToWithdraw` only counts order/session
  releases). `test/flows.ts#assertConserved` counts `promo_credit` with admin adjustments.
- `POST promo-codes/redeem` — AuthGuard + VerifiedEmailGuard, 5/min per IP. One transaction locks the
  code row (the cap holds under bursts), inserts the redemption (UNIQUE → 409 on reuse), bumps the
  counter and credits the wallet. Unknown / inactive / outside-window codes all answer the same 404
  "This code is not valid" so codes can't be probed.
- Admin (Super Admin only, audit-logged `promo_code.create|update`): `GET/POST admin/promo-codes`,
  `PATCH admin/promo-codes/:id` (`maxRedemptions` can't go below `redeemedCount`).

## Banners
- `banner.entity.ts`: `banners` (title, subtitle, `imageUrl`, `linkUrl`, `buttonLabel`, `active`,
  optional window, `sortOrder`). `linkUrl` must be a site path (`/coaching`) or `https://` URL
  (`BANNER_LINK`) — no `javascript:` or protocol-relative links.
- `GET banners` (public): active, in window, with an image, ≤10. Admin (Super Admin + Main
  Administrator, audit-logged `banner.*`): list/create/update/delete, `POST admin/banners/:id/image`
  (byte-sniffed image via `StorageService`, 8MB). A banner can't be published without an image.
- Frontend: `components/HomeBanners.tsx` on the homepage (renders nothing without banners),
  `pages/admin/banners.tsx`, `pages/admin/promo-codes.tsx`, `components/PromoCodeForm.tsx` (wallet).

## Tests
`test/marketing.e2e-spec.ts`.

## 2026-10-04 Promo code delete
`DELETE admin/promo-codes/:id` (Super Admin) removes a code **only while `redeemedCount = 0`** — the
condition is inside the DELETE, so a racing redemption turns it into a 409, never a lost record.
A used code is deactivated (`PATCH … {active:false}`) instead. Audited (`promo_code.delete`).
