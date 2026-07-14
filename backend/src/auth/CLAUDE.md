# auth

## Purpose
Registration and login. Will own real session issuance, auth guards, email verification, and
password reset once Phase 1 of the build plan lands — none of that exists yet (see Status below).

## Key files
- `auth.controller.ts` — `POST /auth/register`, `POST /auth/login`, `GET /auth/check-username`
- `auth.service.ts` — credential validation, bcrypt hashing, dual-mode (Postgres repo or JSON-file
  fallback at `backend/data/users.json`)
- `auth.module.ts` — wires the above into Nest DI

## Data model
Owns the `users` table via `backend/src/users/user.entity.ts` (see `backend/src/users/CLAUDE.md`).
No session/token table exists yet.

## Conventions & gotchas
- Passwords are bcrypt-hashed (cost 10) — keep doing this, never regress to a weaker/optional scheme
  (see root `CLAUDE.md` non-negotiable rules).
- `AuthService`'s JSON-file fallback (`usersFile`, active when no TypeORM repo is injected) is a
  **known-temporary shim**, not a pattern to extend — Phase 1 of the build plan removes it entirely;
  Postgres becomes mandatory past that point. Don't build new features against the file-store path.
- **No real session exists today.** `login()` returns a plain user object; nothing server-side proves
  identity on subsequent requests. Do not build anything that assumes "the logged-in user" until
  Phase 1's httpOnly-cookie session + `AuthGuard`/`@CurrentUser()` land — there's nothing to hook into
  yet.
- The frontend (`frontend/pages/login.tsx`, `register.tsx`) has a client-side SHA-256 local-account
  fallback for when this API is unreachable. It's a different hash scheme from this module's bcrypt
  and creates accounts that can never log in against the real backend — treat it as dead code to be
  deleted in Phase 1, not a pattern to preserve or extend.

## Related modules
- `backend/src/users/` — the entity this module reads/writes.
- Almost every future module (`orders`, `wallet`, `admin`, etc.) will depend on the real session/guard
  work this module is scheduled to gain in Phase 1 — check back here once that lands before assuming
  how to identify "the current user" in a new controller.

## Status
Register/login/check-username work today (bcrypt hashing is correct). Missing, planned for Phase 1:
real session (httpOnly JWT cookie), `GET /auth/me`, guards, email verification, password reset,
password-strength validation beyond a 6-char minimum, removal of the JSON-file fallback.
