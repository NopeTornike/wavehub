# frontend

## Purpose
The Next.js app — **this is the one real frontend going forward** (confirmed decision, see root
`CLAUDE.md`). The static HTML/JS prototype at the repo root is UI/UX reference only; port ideas from
it into real components here, don't extend it further.

## Key files
- `pages/_app.tsx` — trivial App wrapper, imports `styles/global.css`
- `pages/login.tsx`, `pages/register.tsx` — auth forms
- `pages/forgot-password.tsx` — request a reset link by email
- `pages/reset-password.tsx` — landing page for the reset link (`?token=`), sets a new password
- `pages/verify-email.tsx` — landing page for the verification link (`?token=`), auto-verifies on
  load; offers a "resend" button on failure (only works if the visitor still has a valid session —
  see `api.resendVerification` in `lib/api.ts`)
- `lib/api.ts` — the shared API client. **Every backend call goes through this**, not ad hoc
  `fetch()` per page — it centralizes the base URL, `credentials: 'include'` (required for the
  httpOnly session cookie to work cross-origin), and error unwrapping (`ApiError`)
- `styles/global.css` — CSS custom properties for a dark/purple gradient theme (`--bg`,
  `--gradient-start/mid/end`, etc.)

## Data model
N/A on the frontend itself. Talks to the NestJS backend (`backend/`) over HTTP; shared request/response
shapes and status enums come from `packages/shared-types` — `lib/api.ts` already imports `PublicUser`/
`AuthMeResponse` from there. Add new types there first before defining a local one.

## Conventions & gotchas
- All backend calls go through `lib/api.ts`. If you need a new endpoint, add a method there rather
  than calling `fetch()` directly in a page/component.
- `credentials: 'include'` is required on every request (already set inside `lib/api.ts`) — the
  session is an httpOnly cookie (see `backend/src/auth/CLAUDE.md`), not a token you can read/attach
  yourself. There is nothing in `localStorage` for auth anymore — if you find yourself reaching for
  `localStorage` to track "is the user logged in," call `api.me()` instead.
- Non-negotiable: don't fabricate data as if real (see root `CLAUDE.md` rule #6) — the repo-root
  static prototype has several `Math.random()` fake "online now" counters; do not port that pattern
  here.
- `next.config.js` sets `turbopack.root` to the **monorepo root** (`path.join(__dirname, '..')`),
  not this directory — required because npm workspaces hoists `next` and other deps into the root
  `node_modules`, and Turbopack needs its root scope to include wherever `next/package.json`
  actually resolves. If you ever see "couldn't find the Next.js package" during a build, check this
  first before touching dependencies.
- Lint runs via `eslint .` (flat config at `eslint.config.mjs`), **not** `next lint` — that command
  was removed in Next.js 16. Don't reintroduce it.
- `register.tsx` mirrors the backend's password policy constants (min length, letter+digit pattern)
  as local constants for instant client-side feedback — if `backend/src/auth/password-policy.ts`
  changes, update the mirrored constants here too (a shared-types export would be cleaner if this
  drifts again; not worth the indirection for two primitives yet).

## Related modules
- `packages/shared-types/` — always check here first for an enum/type before defining one locally.
- `backend/src/auth/` — every endpoint `lib/api.ts` calls is defined there; check that module's doc
  for request/response shapes and behavior before changing either side.

## Status
The full auth flow is real and fully wired to the backend end-to-end (no fallback/mock path):
register, login, logout, `/me`, email verification (with a working landing page + resend), password
reset (request + confirm, both with working pages). No home page, no dashboard, no shared
layout/Header/Footer/Nav components, and no persistent client-side "am I logged in" state yet (every
page that needs to know currently has to call `api.me()` itself — a shared auth context/provider is
worth building once a second page needs that state, not before). The repo-root static site is where
the rest of the intended UI (marketplace, listing detail, cart/checkout, coaching, profile, messages,
wallet) currently lives as a mockup — porting it here, as real components backed by the real API, is
the bulk of build-plan Phases 4 onward.
