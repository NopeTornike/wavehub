# WaveHub

A marketplace for gaming services and item listings. See [`CLAUDE.md`](./CLAUDE.md) for the project
map (module docs, non-negotiable rules, architecture notes) and
[`SPECIFICATION.md`](./SPECIFICATION.md) for the full product narrative.

- Backend: NestJS, TypeORM, PostgreSQL — `backend/`
- Frontend: Next.js — `frontend/`
- Shared types: `packages/shared-types/`
- Deployment: Docker Compose + Caddy on one VPS (see below)

This is an npm workspaces monorepo — one `npm install` at the repo root covers both apps.

## Quick Start With Docker (local try-out)

```bash
docker compose -f docker-compose.local.yml up --build
```

Frontend `http://localhost:3000/register`, backend `http://localhost:4000` (`/health` for a status
check). This file uses insecure dev defaults (`NODE_ENV=development`) and is **for local use only**;
migrations run automatically when the backend container starts. BOG credentials are optional —
only `/payments/bog/*` needs them.

## Production deployment

`docker-compose.yml` is the **production** stack for a single Ubuntu 24.04 VPS (Caddy with automatic
HTTPS, frontend at `/`, API at `/api`, Postgres, non-root containers, healthchecks, restart policies).
It has no insecure defaults: secrets are required and the backend refuses to boot in production with
dev/placeholder values.

- Runbook: [`docs/DEPLOY.md`](./docs/DEPLOY.md) (firewall, Docker install, env file, backups, log
  rotation, updates)
- Every variable: [`.env.production.example`](./.env.production.example)
- Go-live list (incl. what only the owner can do): [`docs/LAUNCH_CHECKLIST.md`](./docs/LAUNCH_CHECKLIST.md)

> The Docker artifacts were written without a Docker daemon available; CI (`docker` job) builds the
> images and boots the backend on every PR, but the first full run on a real server is still yours —
> see the honesty note at the top of `docs/DEPLOY.md`.

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

Schema changes go through migrations (`npm run migration:run -w backend`); `TYPEORM_SYNC=true` is
for throwaway local experiments only and is refused in production. `npm run backend:build` builds
`packages/shared-types` first; the compiled backend must be started with
`node --conditions=wavehub-node-prod` (`npm run start -w backend` does this).

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
