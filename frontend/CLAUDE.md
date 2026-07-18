# frontend

## Purpose
The Next.js app — **this is the one real frontend going forward** (confirmed decision, see root
`CLAUDE.md`). The static HTML/JS prototype at the repo root is UI/UX reference only; port ideas from
it into real components here, don't extend it further.

## Key files
- `pages/_app.tsx` — trivial App wrapper, imports `styles/global.css`
- `pages/index.tsx` — minimal home page, links into `/marketplace`
- `pages/marketplace.tsx` — browse grid with category/game/type filters + pagination, wrapped in
  `Layout`
- `pages/listings/[id].tsx` — listing detail: gallery, description, requirements/FAQ (service),
  package picker (service) or stock/price (item), reviews with sort. The "buy" button is a visible
  placeholder (`ყიდვა`) — checkout has no frontend yet (Phase 5's Orders backend exists, its
  frontend doesn't), so it deliberately does not wire to anything real yet rather than fake success
- `pages/login.tsx`, `pages/register.tsx` — auth forms
- `pages/forgot-password.tsx` — request a reset link by email
- `pages/reset-password.tsx` — landing page for the reset link (`?token=`), sets a new password
- `pages/verify-email.tsx` — landing page for the verification link (`?token=`), auto-verifies on
  load; offers a "resend" button on failure (only works if the visitor still has a valid session —
  see `api.resendVerification` in `lib/api.ts`)
- `components/Layout.tsx`, `components/Header.tsx`, `components/Footer.tsx` — shared chrome.
  `Header` calls `api.me()` itself on mount (see Status below re: no shared auth state). `Layout` is
  applied per-page, not globally in `_app.tsx` — the auth pages (`login`/`register`/etc.) intentionally
  render bare, without the marketing header/footer
- `lib/api.ts` — the shared API client. **Every backend call goes through this**, not ad hoc
  `fetch()` per page — it centralizes the base URL, `credentials: 'include'` (required for the
  httpOnly session cookie to work cross-origin), and error unwrapping (`ApiError`). Note the
  marketplace methods (`listCategories`/`listGames`/`browseListings`/`getListing`/
  `listReviewsForListing`) return the raw backend shape, unlike the auth methods which are wrapped in
  `{ ok: true, ... }` — don't assume a uniform envelope
- `styles/global.css` — CSS custom properties for a dark/purple gradient theme (`--bg`,
  `--gradient-start/mid/end`, etc.), plus the marketplace/detail-page classes (`.listing-grid`,
  `.listing-card`, `.filter-bar`, `.detail-layout`, `.package-list`, `.review-item`, etc.)

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
- `marketplace.tsx` and `listings/[id].tsx` each have one `// eslint-disable-next-line
  react-hooks/set-state-in-effect` on the `setLoading(true)` at the top of their data-fetching
  effect — this is `eslint-plugin-react-hooks@7`'s new (React 19-era) rule flagging any synchronous
  `setState` at the start of an effect body. It's a real, standard "refetch when a dependency
  changes" pattern, not a bug; don't remove the disable comment without an actual redesign (e.g.
  `useTransition`) to replace it.
- Copy is in Georgian, matching the existing auth pages — keep new user-facing text in Georgian
  unless told otherwise.

## Related modules
- `packages/shared-types/` — always check here first for an enum/type before defining one locally.
- `backend/src/auth/` — every endpoint `lib/api.ts` calls is defined there; check that module's doc
  for request/response shapes and behavior before changing either side.

## Status
The full auth flow is real and fully wired to the backend end-to-end (no fallback/mock path):
register, login, logout, `/me`, email verification (with a working landing page + resend), password
reset (request + confirm, both with working pages). Marketplace browsing is now real too: home page,
filtered/paginated browse grid, and a listing detail page with packages/reviews — all backed by the
real `backend/src/listings/` and `backend/src/reviews/` endpoints, no mock data. Still no persistent
client-side "am I logged in" state (every page that needs identity calls `api.me()` itself — a shared
auth context/provider is worth building once more pages need it, not before). No checkout/order-
tracking/cart pages yet (Orders backend exists, Orders frontend doesn't — that's the next natural
piece); no coaching, profile, messages, or wallet pages yet either. The repo-root static site remains
the reference mockup for all of that until it's ported here.

**Verification caveat**: this workspace has no Docker/Postgres available (a constraint noted
throughout this repo's `CLAUDE.md` files), so the marketplace pages above were verified via
`npm run build`/`lint`/typecheck only, against real response *shapes* from `packages/shared-types` —
not against a running backend with real seeded data in an actual browser. Do an end-to-end
browser click-through (`docker-compose up`, seed a listing, load `/marketplace` and click into it)
before trusting this in front of a real user.
