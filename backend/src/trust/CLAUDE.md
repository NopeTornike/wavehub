# trust

## Purpose
Trust & Safety (SPECIFICATION.md §5.13.5): user reports, an explained risk score, shared-network
detection, staff notes / official warnings / watchlist. No wallet, refund or role powers.

## Data (migration `1784375000000-TrustSafety`)
- `user_reports` — reporter, target (`user|listing|coach|review|message` + id), resolved
  `targetUserId`, reason, details, `evidence` (copy of the reported review/message text), status
  `open|reviewing|actioned|dismissed`, staff note. Partial UNIQUE index: one live report per reporter
  and target.
- `user_staff_notes` — `note|warning|flag|unflag` timeline per account.
- `login_events` — successful/failed logins and registrations with **keyed hashes only**
  (`login-hash.ts`: HMAC-SHA256 keyed from `JWT_SECRET`) of the IP and user agent; raw values are never
  stored. Written by `AuthService#recordLogin`; rows older than 90 days are deleted daily.
- `users.flagged` — watchlist flag (never in any public/own projection; the security sweep checks).

## Behaviour
- `POST reports` — verified users; can't report yourself; messages only from your own conversations.
- Risk score (`TrustService.score`) — 0–100 from real rows, every point listed with its reason:
  watchlist, open/actioned reports, warnings, seller cancellations and disputes, shared network with
  other accounts in 30 days, promo farming (linked accounts redeeming the same code), failed logins,
  new or unverified account. low <25 ≤ medium <50 ≤ high.
- Staff (Trust & Safety Officer, Operation Lead, Main Administrator, Super Admin; everything
  audit-logged, including viewing a user): `GET admin/trust/overview|reports|users?q=|users/:id`,
  `PATCH admin/trust/reports/:id`, `POST admin/trust/users/:id/notes|warn|flag`. A warning is an
  `account_warning` notification (also emailed).
- Frontend: `components/ReportButton.tsx` (profile, listing, coach, received direct messages),
  `pages/admin/trust.tsx`.

## Tests
`test/trust.e2e-spec.ts`.
