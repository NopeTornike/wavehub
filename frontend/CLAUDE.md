# frontend

## Purpose
The Next.js app — **this is the one real frontend going forward** (confirmed decision, see root
`CLAUDE.md`). The static HTML/JS prototype at the repo root is UI/UX reference only; port ideas from
it into real components here, don't extend it further.

## Key files
- `pages/_app.tsx` — trivial App wrapper, imports `styles/global.css`
- `pages/login.tsx`, `pages/register.tsx` — the only two real pages that exist so far
- `styles/global.css` — CSS custom properties for a dark/purple gradient theme (`--bg`,
  `--gradient-start/mid/end`, etc.)

## Data model
N/A on the frontend itself. Talks to the NestJS backend (`backend/`) over HTTP; shared request/response
shapes and status enums come from `packages/shared-types` — import from there instead of redefining a
local copy of e.g. `OrderStatus`.

## Conventions & gotchas
- **Remove, don't extend, the client-side SHA-256 local-account fallback** in `login.tsx`/`register.tsx`
  (search for `crypto.subtle.digest` and the `wavehub.users`/`wavehub.session` localStorage keys). It's
  a different hash scheme from the backend's bcrypt and creates accounts that can never authenticate
  against the real API. This gets deleted as part of build-plan Phase 1, not built upon.
- Both pages currently call the backend with a hardcoded fallback list
  (`http://127.0.0.1:4000`)/`NEXT_PUBLIC_API_URL` and a manual timeout. Once a real shared API client
  (`lib/api.ts`, build-plan Phase 1+) exists, route all backend calls through it instead of ad hoc
  `fetch` calls per page.
- Non-negotiable: don't fabricate data as if real (see root `CLAUDE.md` rule #6) — the repo-root static
  prototype has several `Math.random()` fake "online now" counters; do not port that pattern here.

## Related modules
- `packages/shared-types/` — always check here first for an enum/type before defining one locally.
- `backend/src/auth/` — the session/auth work this frontend depends on for anything past login/register.

## Conventions & gotchas (continued)
- `next.config.js` sets `turbopack.root` to the **monorepo root** (`path.join(__dirname, '..')`), not
  this directory — required because npm workspaces (added Phase 0) hoists `next` and other deps into
  the root `node_modules`, and Turbopack needs its root scope to include wherever `next/package.json`
  actually resolves. If you ever see "couldn't find the Next.js package" during a build, check this
  first before touching dependencies.
- Lint runs via `eslint .` (flat config at `eslint.config.mjs`), **not** `next lint` — that command was
  removed in Next.js 16. Don't reintroduce it.

## Status
Minimal — only login and register exist, both against the not-yet-real-session backend (see
`backend/src/auth/CLAUDE.md`). No home page, no dashboard, no shared layout/Header/Footer/Nav components
yet. The repo-root static site is where the rest of the intended UI (marketplace, listing detail, cart/
checkout, coaching, profile, messages, wallet) currently lives as a mockup — porting it here, as real
components backed by the real API, is the bulk of build-plan Phases 4 onward.
