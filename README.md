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
