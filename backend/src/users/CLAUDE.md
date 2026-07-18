# users

## Purpose
Owns the `User` entity and `UsersService` — the shared, read-mostly way for other modules to look
up a user without each reimplementing repository queries.

## Key files
- `user.entity.ts` — TypeORM entity: `id` (uuid), `username` (unique), `email` (unique),
  `firstName`, `lastName`, `passwordHash` (`select: false`), `role` (`'buyer' | 'seller'`, default
  `'buyer'`), `status` (`UserStatus` from `@wavehub/shared-types`, default `pending_verification`),
  `emailVerifiedAt` (nullable), `wavecoinBalance` (integer, default 0 — **never write to this
  directly, always go through `WalletService`**, see `backend/src/wallet/CLAUDE.md`),
  `sellerRatingAvg`/`sellerRatingCount` (nullable/0 default — **never write directly, only
  `ReviewsService` recomputes these**, see `backend/src/reviews/CLAUDE.md`; meaningless for a user
  with no listings, living here only as a stopgap until `seller_profiles` exists), `adminRole`
  (`AdminRole | null` from `@wavehub/shared-types`, nullable — null for every ordinary buyer/seller,
  same "pragmatic stopgap directly on `User`" precedent as the two fields above; see
  `backend/src/admin/CLAUDE.md` for the guard that reads it and why a separate `staff` table wasn't
  picked instead)
- `users.service.ts` — `findById`/`findByUsername`/`findByEmail`, `markEmailVerified`,
  `setPasswordHash`, `toPublicUser` (maps the entity to the `PublicUser` shape from
  `@wavehub/shared-types` — the one place that mapping happens, use it instead of hand-building a
  public user object elsewhere; includes `wavecoinBalance`, so `/auth/me` is how the frontend reads
  a logged-in user's spendable balance — see `frontend/pages/wallet.tsx` — there's no separate
  `GET /wallet/balance` endpoint)
- `users.module.ts` — exports `UsersService` for other modules to import

## Data model
`users` table. Schema built up across six migrations: `InitUsersTable` (Phase 0 baseline),
`AddUserEmailStatusVerification` (adds `email`/`status`/`emailVerifiedAt`, Phase 1),
`CreateAuthTokenTables` (the two token tables that FK into `users`, Phase 1),
`CreateWalletLedger` (adds `wavecoinBalance`, Phase 2), `CreateReviewsSchema` (adds
`sellerRatingAvg`/`sellerRatingCount`, Phase 5), and `AddUserAdminRole` (adds `adminRole`, Phase 8's
admin-foundation work).

## Conventions & gotchas
- `role` is still a blunt `'buyer' | 'seller'` flag, unrelated to `status`. Per the build plan, a
  future `seller_profiles` table (1:1 with `users`, created lazily on first listing) should become
  the real "is this person a seller" signal — don't build authorization logic that treats `role` as
  that gate once `seller_profiles` exists.
- `passwordHash` has `select: false` — `auth.service.ts` explicitly selects it when needed
  (password comparison, or updating it via `setPasswordHash`). Don't change the default.
- `UsersService.toPublicUser()` now reads the real `adminRole` column (no longer hardcoded `null`)
  — `/auth/me` and therefore `frontend/lib/auth.tsx`'s `useAuth()` reflect it for any logged-in
  staff account. There's still no admin-account-management flow (no way to *grant* `adminRole` via
  the API) — only a direct DB update can set one right now.
- `status` starts at `pending_verification` on every new registration and flips to `active` only
  via `AuthService.verifyEmail()` (see `backend/src/auth/CLAUDE.md`) — don't set it directly from
  outside that flow.

## Related modules
- `backend/src/auth/` — the primary consumer; also owns direct write access to this entity for
  registration/status changes (this module intentionally doesn't expose a generic `update()`).
- `backend/src/wallet/` — the only module allowed to write `wavecoinBalance`.
- `backend/src/reviews/` — the only module allowed to write `sellerRatingAvg`/`sellerRatingCount`.
- `backend/src/admin/` — `AdminGuard` reads `adminRole` on every admin-guarded request; nothing
  else should read or write it outside a direct DB update today.
- `packages/shared-types/` — `UserStatus`, `AdminRole`, and `PublicUser` come from here; keep them
  in sync if this entity's shape changes.

## Status
Covers what registration/login/session/verification/wallet-balance/admin-role-checking need today.
Fields the build plan's fuller schema adds later: `avatar_url`, `bio`, `theme_pref` (no phase
assigned yet). `admin_role` is no longer one of these — it landed in Phase 8's admin-foundation
work, ahead of the original Phase 11 estimate, because three other modules' admin-only methods
needed something real to gate on.
