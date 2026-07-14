# users

## Purpose
Owns the `User` entity and `UsersService` — the shared, read-mostly way for other modules to look
up a user without each reimplementing repository queries.

## Key files
- `user.entity.ts` — TypeORM entity: `id` (uuid), `username` (unique), `email` (unique),
  `firstName`, `lastName`, `passwordHash` (`select: false`), `role` (`'buyer' | 'seller'`, default
  `'buyer'`), `status` (`UserStatus` from `@wavehub/shared-types`, default `pending_verification`),
  `emailVerifiedAt` (nullable)
- `users.service.ts` — `findById`/`findByUsername`/`findByEmail`, `markEmailVerified`,
  `setPasswordHash`, `toPublicUser` (maps the entity to the `PublicUser` shape from
  `@wavehub/shared-types` — the one place that mapping happens, use it instead of hand-building a
  public user object elsewhere)
- `users.module.ts` — exports `UsersService` for other modules to import

## Data model
`users` table. Schema built up across three migrations: `InitUsersTable` (Phase 0 baseline),
`AddUserEmailStatusVerification` (adds `email`/`status`/`emailVerifiedAt`, Phase 1), and
`CreateAuthTokenTables` (the two token tables that FK into `users`, Phase 1).

## Conventions & gotchas
- `role` is still a blunt `'buyer' | 'seller'` flag, unrelated to `status`. Per the build plan, a
  future `seller_profiles` table (1:1 with `users`, created lazily on first listing) should become
  the real "is this person a seller" signal — don't build authorization logic that treats `role` as
  that gate once `seller_profiles` exists.
- `passwordHash` has `select: false` — `auth.service.ts` explicitly selects it when needed
  (password comparison, or updating it via `setPasswordHash`). Don't change the default.
- `UsersService.toPublicUser()` currently hardcodes `adminRole: null` — the entity has no
  `admin_role` column yet (that's a Phase 11/admin-panel addition per the build plan). When that
  column lands, update `toPublicUser` to read it for real, not just here — check `auth/CLAUDE.md`
  and `frontend/lib/api.ts` too, since `PublicUser`'s shape is shared.
- `status` starts at `pending_verification` on every new registration and flips to `active` only
  via `AuthService.verifyEmail()` (see `backend/src/auth/CLAUDE.md`) — don't set it directly from
  outside that flow.

## Related modules
- `backend/src/auth/` — the primary consumer; also owns direct write access to this entity for
  registration/status changes (this module intentionally doesn't expose a generic `update()`).
- `packages/shared-types/` — `UserStatus` and `PublicUser` come from here; keep them in sync if this
  entity's shape changes.

## Status
Covers what registration/login/session/verification need today. Fields the build plan's fuller
schema adds later: `avatar_url`, `bio`, `theme_pref`, `wavecoin_balance` (Phase 3, wallet ledger),
`admin_role` (Phase 11, admin panel).
