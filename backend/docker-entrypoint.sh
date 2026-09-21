#!/bin/sh
# Container entrypoint: apply pending TypeORM migrations, then exec the server (exec so node is the
# process that receives SIGTERM from `docker stop` and can shut down gracefully).
#
# Migrations run from the COMPILED data source (dist/data-source.js), so the image needs no ts-node.
# Set RUN_MIGRATIONS=false to skip (e.g. when running several backend replicas — run migrations
# from exactly one of them). A failed migration aborts the boot (set -e): a half-migrated schema
# must never serve traffic; the container restart policy will retry and the error stays visible in
# `docker compose logs backend`.
set -e

cd /app
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] running database migrations"
  npm run migration:run:prod -w backend
fi

echo "[entrypoint] starting backend"
exec node --conditions=wavehub-node-prod backend/dist/main.js
