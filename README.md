# WaveHub - Starter Monorepo

Minimal starter scaffold for:

- Backend: NestJS, TypeORM, PostgreSQL
- Frontend: Next.js
- Local dev: Docker Compose with PostgreSQL

## Quick Start With Docker

```bash
docker compose build
docker compose up
```

Backend runs on `http://localhost:4000`.
The complete WaveHub site runs on `http://localhost:3000/`.

## Deployment API configuration

For production behind one domain, proxy `/auth`, `/state`, `/messages`, and `/payments` to the backend; the frontend then uses its own origin automatically.

If the API is hosted on a separate domain, set `deployedApiUrl` in `api-config.js` to its HTTPS origin (for example `https://api.wavehub.ge`) before deploying. Also set `CORS_ORIGIN` to the frontend's exact HTTPS origin, `COOKIE_SECURE=true`, and `COOKIE_SAME_SITE=none`.

On a `*.github.io` site only, login and registration fall back to a browser-only demo account when the API is unavailable. Its data is stored only in that browser and must not be used for real accounts or payments.

Copy `.env.example` to `.env` and replace `AUTH_TOKEN_SECRET` with a unique random value of at least 32 characters before starting Docker. Authentication uses a signed, HttpOnly session cookie; browser storage contains public display data only.

Set `CORS_ORIGIN` to the exact frontend origin. Production cookies are secure by default. For a frontend and API hosted on different sites, both must use HTTPS and `COOKIE_SAME_SITE=none`; plain HTTP local development can explicitly use `COOKIE_SECURE=false`.

Marketplace listings, profiles, reviews, orders, carts, favorites, tournaments, coaching data, and wallet records are persisted by the backend. Browser storage is now a synchronized display cache; wallet values and record ownership are enforced server-side.

## Local Development

Requires Node.js 20.9+.

```bash
cd backend
npm install
npm run start:dev

# In a separate terminal, serve the static site from the repository root.
```

The API listens on port `4000`. The browser must load the frontend through an HTTP server rather than directly from a `file://` URL.

For local database schema sync, `TYPEORM_SYNC=true` is enabled in `docker-compose.yml`.
For production, use migrations and leave `TYPEORM_SYNC` unset or `false`.

## Bank of Georgia Payments

WaveCoin top-ups use the backend endpoint `POST /payments/bog/create-order`.
Configure these environment variables on the backend:

```bash
BOG_CLIENT_ID=your_client_id
BOG_CLIENT_SECRET=your_client_secret
BOG_CALLBACK_URL=https://your-domain.ge/payments/bog/callback
```

Optional overrides:

```bash
BOG_OAUTH_URL=https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token
BOG_ORDERS_URL=https://api.bog.ge/payments/v1/ecommerce/orders
```
