# auth

## Purpose
Registration, login, real session management (httpOnly JWT cookie), email verification, and
password reset. Every other module that needs to know "who's making this request" depends on
`AuthGuard`/`CurrentUserId` from here.

## Key files
- `auth.controller.ts` — `POST /auth/register`, `/login`, `/logout`, `GET /me`,
  `GET /check-username`, `POST /verify-email`, `POST /resend-verification` (guarded),
  `POST /request-password-reset`, `POST /reset-password`
- `auth.service.ts` — registration/login logic, email-verification and password-reset token
  issuance/consumption, bcrypt hashing
- `session.service.ts` — signs/verifies the session JWT, sets/clears the httpOnly cookie
  (`SESSION_COOKIE_NAME = 'wavehub_session'`)
- `auth.guard.ts` — `AuthGuard`, verifies the session cookie and attaches `request.userId`
- `current-user.decorator.ts` — `@CurrentUserId()` param decorator, only valid on guarded routes
- `password-policy.ts` — the password strength rule (min length + letter/digit), exported so both
  the DTO validators and `password-policy.spec.ts` use the same source of truth
- `email-verification-token.entity.ts`, `password-reset-token.entity.ts` — single-use, hashed,
  expiring tokens (24h / 1h respectively)
- `auth.module.ts` — wires the above; also where `JWT_SECRET` is required/validated at boot

## Data model
Owns `email_verification_tokens` and `password_reset_tokens` (see
`backend/src/migrations/*-CreateAuthTokenTables.ts`). Reads/writes the `users` table via direct
repository injection here (registration/status updates) — for read-only lookups from *other*
modules, use `UsersService` (`backend/src/users/CLAUDE.md`) instead of injecting `Repository<User>`
directly, to keep one place owning "how do I fetch a user."

## Conventions & gotchas
- **Session is a stateless JWT in an httpOnly cookie — there is no `sessions` table.** There's no
  way to revoke a single session early (e.g. "log out this device") without waiting for the 7-day
  expiry. If that becomes a real requirement, that's the point to add a session table or a
  denylist — don't build around the gap by inventing something ad hoc in another module.
- `AuthGuard` verifies the JWT's signature/expiry, then does one lightweight `UsersService
  .findStatusById()` lookup (id + status columns only) and rejects with 403 if the account is
  `suspended`/`banned` — added when admin suspend/ban became a real reachable action
  (`backend/src/users/admin-users.controller.ts`), since a ban is meaningless if the banned user's
  existing session cookie keeps working for up to 7 more days. This adds one small DB round-trip to
  every guarded request; that's accepted as the cost of a ban actually taking effect immediately.
  There is still no way to revoke one specific session early ("log out this device") short of a
  full account suspend — only the suspended/banned case is covered.
- **`AuthModule`'s `exports` includes `UsersModule`, not just `AuthGuard`/`SessionService` — this
  is load-bearing, not decorative.** When `AuthGuard` gained the `UsersService` dependency above,
  every module that only imports `AuthModule` (which is nearly every controller-owning module in
  this app) needs `UsersService` visible too, since Nest resolves a guard's own constructor
  dependencies through whatever module ends up instantiating it. Exporting `UsersModule` alongside
  `AuthGuard` here means any consumer of `AuthModule` transitively gets everything `AuthGuard`
  needs, without every single consumer separately importing `UsersModule` itself. This was a real,
  total-boot-failure bug (`UnknownDependenciesException` the instant Nest reached the first
  affected module) found only by actually booting the app against a real Postgres for the first
  time (2026-07-22) — unit tests construct services directly with fake dependencies and never
  exercise Nest's real DI graph, so this was invisible to the entire test suite. If `AuthGuard`
  ever gains another dependency from a different module, re-export that module here too, or
  every consumer of `AuthGuard` will break the same way.
- Both verification and reset tokens are stored as **SHA-256 hashes**, never the raw token — same
  reasoning as password hashing. Compare by hashing the incoming token and looking up the hash.
- `requestPasswordReset` always returns `{ ok: true }` regardless of whether the email matched an
  account — this is deliberate (prevents email enumeration), don't "fix" it to return a clearer
  error for unknown emails.
- Passwords are bcrypt-hashed (cost 10). Password strength floor lives in `password-policy.ts` —
  update both it and `frontend/pages/register.tsx`'s mirrored constants together if it changes.
- `JWT_SECRET` throws at boot if unset **and** `NODE_ENV=production`; otherwise falls back to a
  logged, insecure dev default. Never remove the production check.
- Registration auto-attaches a session cookie immediately (status starts at
  `pending_verification`) — being logged in and being email-verified are two different gates.
  Don't conflate them; features that require verification should check `status`, not "is there a
  session."
- No real email provider exists yet — `EmailService` (`backend/src/email/`) just logs. Verification
  and reset links are fully functional (tokens really work), you just won't get an email; check the
  server console for the link during local testing.
- `register`/`login`/`verify-email`/`resend-verification`/`request-password-reset`/`reset-password`
  are all rate-limited to 5 requests/60s (`AUTH_THROTTLE` in `auth.controller.ts`) — much stricter
  than the global default (see root `CLAUDE.md`'s Security section). `check-username` gets a looser
  20/60s limit since it's called on every keystroke-debounce during registration. Any new
  credential-adjacent endpoint added here should default to the strict limit, not the global one.

## Related modules
- `backend/src/users/` — the entity and `UsersService` this module builds on.
- `backend/src/email/` — the (stubbed) email sender used for verification/reset messages.
- `frontend/lib/api.ts` — the frontend's client for every endpoint here; keep them in sync if you
  change a request/response shape.
- Every future guarded module should import `AuthGuard`/`CurrentUserId` from here rather than
  reimplementing session verification.

## Status
Real session, guard, `/me`, email verification, password reset, rate limiting, and
suspended/banned enforcement in `AuthGuard` are all implemented and functional end-to-end
(register → verify → login → me → reset), pending real Postgres/CI verification (no live DB was
available in the sandbox this was authored in — see the migration files' own notes). Not yet built:
CAPTCHA/bot protection, OAuth ("Gmail-ით რეგისტრაცია" noted in the frontend copy as a future
addition), single-session revocation short of a full suspend/ban.
