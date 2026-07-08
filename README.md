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
Frontend runs on `http://localhost:3000/register`.

## Local Development

Requires Node.js 20.9+.

```bash
cd backend
npm install
npm run build

cd ../frontend
npm install
npm run build
```

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
