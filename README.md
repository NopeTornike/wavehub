# WaveHub

A marketplace for gaming services and item listings. See [`CLAUDE.md`](./CLAUDE.md) for the project
map (module docs, non-negotiable rules, architecture notes) and
[`SPECIFICATION.md`](./SPECIFICATION.md) for the full product narrative.

- Backend: NestJS, TypeORM, PostgreSQL — `backend/`
- Frontend: Next.js — `frontend/`
- Shared types: `packages/shared-types/`
- Local dev: Docker Compose with PostgreSQL

This is an npm workspaces monorepo — one `npm install` at the repo root covers both apps.

## Quick Start With Docker

```bash
docker compose build
docker compose up
```

Backend runs on `http://localhost:4000`.
Frontend runs on `http://localhost:3000/register`.

`docker-compose.yml` fills in insecure local-only defaults for everything required to boot
(including `JWT_SECRET`) so this works out of the box — **override `JWT_SECRET` via a real `.env`
file or your deployment's secret manager for anything beyond local/throwaway use.** `BOG_CLIENT_ID`/
`BOG_CLIENT_SECRET` are left unset by default; only `/payments/bog/*` (WaveCoin top-up) needs them,
everything else works without them.

> **Caveat:** `backend/Dockerfile`, `frontend/Dockerfile`, and this `docker-compose.yml` were
> rewritten to work with the npm-workspaces monorepo layout (the versions from before that
> migration built from `./backend`/`./frontend` as isolated contexts and couldn't resolve the
> `@wavehub/shared-types` workspace dependency at all — see `backend/CLAUDE.md`). This rewrite has
> **not** been run against a real Docker daemon — the environment it was written in had none
> available. Do a real `docker compose build && docker compose up` before relying on this for an
> actual deployment.

## Local Development

Requires Node.js 20.9+.

```bash
npm install                    # from the repo root — installs backend, frontend, and shared-types together
npm run backend:build
npm run frontend:build
```

Per-workspace scripts are exposed at the root (`backend:dev`, `backend:lint`, `backend:test`,
`frontend:dev`, `frontend:lint`, etc. — see the root `package.json`).

Copy `backend/.env.example` to `backend/.env` (or set the equivalent env vars) before running the
backend outside Docker Compose.

For local database schema sync, `TYPEORM_SYNC=true` is enabled in `docker-compose.yml`. For
anything beyond quick local experiments, use migrations instead
(`npm run migration:run -w backend`) and leave `TYPEORM_SYNC` unset or `false` — see
`backend/src/data-source.ts`.

## Bank of Georgia Payments

WaveCoin top-ups use two backend endpoints:

- `POST /payments/bog/create-order` (requires an authenticated session) — starts a BOG checkout for
  the current user. The WaveCoin amount is derived server-side from `amountGel` at a fixed 1:1 rate;
  a client cannot request a different exchange rate.
- `POST /payments/bog/callback` — BOG calls this when a payment's status changes. The request's
  `Callback-Signature` header is verified (RSA-SHA256 over the raw body) against BOG's published
  public key before anything is trusted, and the order's status is then re-fetched from BOG's API
  (not read from the callback body) before any WaveCoin is credited. See
  `backend/src/payments/bog-signature.util.ts` and `backend/src/payments/CLAUDE.md`.

Configure these environment variables on the backend (see `backend/.env.example` for the full list):

```bash
BACKEND_PUBLIC_URL=https://your-domain.ge   # must be reachable by BOG's servers for the callback to arrive
BOG_CLIENT_ID=your_client_id
BOG_CLIENT_SECRET=your_client_secret
```

Optional overrides:

```bash
BOG_OAUTH_URL=https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token
BOG_ORDERS_URL=https://api.bog.ge/payments/v1/ecommerce/orders
BOG_CALLBACK_PUBLIC_KEY=...   # only if BOG rotates their callback-signing key
```
