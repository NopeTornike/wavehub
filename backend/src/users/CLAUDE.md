# users

## Purpose
Owns the `User` entity — the one real database table that exists in the backend today.

## Key files
- `user.entity.ts` — TypeORM entity: `id` (uuid), `username` (unique), `firstName`, `lastName`,
  `passwordHash` (excluded from default `select`), `role` (`'buyer' | 'seller'`, default `'buyer'`)

## Data model
`users` table, schema created by `backend/src/migrations/*-InitUsersTable.ts`. This is the *only*
migration that exists so far — every other table in the build plan's schema (seller_profiles,
listings, orders, wallet_ledger, etc.) is still design, not code.

## Conventions & gotchas
- `role` is currently a blunt `'buyer' | 'seller'` flag. Per the build plan, this should eventually
  represent "primary persona for nav" rather than a hard access-control gate — any user should be able
  to become a seller by creating a listing (see the future `seller_profiles` table, 1:1 with `users`,
  created lazily). Don't build authorization logic that treats `role` as the sole gate for seller
  actions once `seller_profiles` exists.
- `passwordHash` has `select: false` — always fetch it explicitly (`select: {...}`) when you need to
  compare a password, as `auth.service.ts` already does. Don't change the default to `select: true`.
- Fields the build plan's schema adds here that don't exist yet: `email` (unique), `status`
  (`pending_verification|active|suspended|banned`), `email_verified_at`, `avatar_url`, `bio`,
  `theme_pref`, `wavecoin_balance`, `admin_role`. These land in Phase 1 (session/verification) and
  Phase 3 (wallet ledger foundation) of the build plan — check there before adding a field ad hoc.

## Related modules
- `backend/src/auth/` — the only current consumer of this entity.
- Future `backend/src/wallet/` will add `wavecoin_balance` here.
- Future `backend/src/admin/` will add `admin_role` here for RBAC.

## Status
Minimal — only the fields needed for basic register/login exist. Expect this entity to grow
significantly in Phases 1 and 3 of the build plan; update this doc when it does.
