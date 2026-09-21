# config (production boot checks)

## Purpose
Make it impossible to run the backend in production with a development default. In
`NODE_ENV=production` the process **refuses to start** — with one complete list of every problem —
unless real values are supplied. Outside production nothing here does anything.

## Key files
- `production-config.ts` — `collectProductionConfigProblems(env)` (pure, returns strings) and
  `assertProductionConfig(env)` (throws). Checks: `JWT_SECRET` (set, >= 32 chars, not a known
  placeholder/`CHANGE_ME`), `KEY_ENCRYPTION_SECRET` (64 hex chars, not all-same/sequence
  placeholders), `DATABASE_HOST`, `DATABASE_PASSWORD` (>= 12 chars, not the dev default),
  `TYPEORM_SYNC` not `true`, `FRONTEND_URL`/`BACKEND_PUBLIC_URL` and every `CORS_ORIGIN` entry
  `https://`, `TRUST_PROXY` set, `EMAIL_PROVIDER` set explicitly (+ `RESEND_API_KEY`/`EMAIL_FROM` for
  `resend`), and `STORAGE_DRIVER=s3` completeness (+ `https://` `S3_PUBLIC_BASE_URL`).
- `boot-check.ts` — a side-effect module (`assertProductionConfig()` at import) that `main.ts`
  imports right after `dotenv/config` and before `AppModule`, so the operator sees the whole list
  instead of whichever module-level check (`auth.module.ts`, `key-encryption.util.ts`,
  `StorageService`/`EmailService` constructors) throws first. Those remain as a second line of
  defence.
- `production-config.spec.ts` — every rule, both directions.

## Conventions & gotchas
- **When you add an env var that has a dev-only default, add its production rule here in the same
  change** and document it in `/.env.production.example` and `backend/.env.example`.
- The e2e/CI environments use `NODE_ENV=test`, so they never trip these checks; the checks were
  verified by running the compiled backend with `NODE_ENV=production` and no env (prints the full
  problem list, exits non-zero).
- Cookie `secure` is derived from `NODE_ENV=production` (`auth/session.service.ts`), so the checks
  above also guarantee an `https://` deployment can't end up with an insecure session cookie.

## Related modules
- `backend/src/common/` — the other cross-cutting runtime plumbing.
- `docker-compose.yml` (`:?` required variables), `docs/DEPLOY.md`.
