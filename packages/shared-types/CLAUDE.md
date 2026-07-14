# shared-types

## Purpose
Enums and API shapes shared between the NestJS backend and the Next.js frontend, so the two apps
can't silently drift on things like order/dispute/wallet status values. Types only — no business
logic, no runtime dependencies, no build step (consumed as TS source directly via the npm workspace).

## Key files
- `src/index.ts` — everything lives in this one file for now; split into multiple files only if it
  grows past a few hundred lines.

## Data model
N/A — this package has no persistence of its own. It mirrors enum values that the backend's TypeORM
entities and migrations are the actual source of truth for (see each domain module's own CLAUDE.md).

## Conventions & gotchas
- Enum string values here MUST match the corresponding Postgres check-constraint/enum values exactly
  — if a migration changes an enum's underlying values, update this file in the same change.
- No build step: both `backend` (ts-node/tsc) and `frontend` (Next.js) resolve `.ts` source directly
  through the workspace symlink. Don't add a compiled `dist/` output unless a consumer genuinely needs
  pre-built JS (e.g. a non-TS runtime) — it's unnecessary complexity otherwise.
- Keep this package to types/enums only. If you're tempted to add a helper function here, ask whether
  it belongs in the specific backend/frontend module instead.

## Related modules
- Every backend domain module (`backend/src/orders/`, `backend/src/wallet/`, `backend/src/disputes/`,
  etc.) imports its relevant enums from here instead of redefining them locally.
- `frontend/` imports these same enums for status displays, form options, and API response typing.

## Status
Scaffolded in Phase 0 with the full enum set anticipated by the build plan. Most of these enums don't
have a backing table/entity yet — they're defined ahead of the modules that will use them so later
phases have a single place to import from instead of re-deriving the same status strings per module.
