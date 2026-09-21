#!/bin/sh
# Restores a database dump produced by scripts/backup.sh into the running Postgres container.
# DESTRUCTIVE: the dump uses --clean, so it drops and recreates every table. Stop the app first:
#
#     docker compose stop backend frontend
#     ./scripts/restore-db.sh backups/db-YYYYMMDD-HHMMSS.sql.gz
#     docker compose start backend frontend
#
# Practise this on a scratch server before you need it.
set -eu

[ $# -eq 1 ] || { echo "usage: $0 <backups/db-....sql.gz>" >&2; exit 2; }
FILE="$1"
[ -f "$FILE" ] || { echo "no such file: $FILE" >&2; exit 2; }

cd "$(dirname "$0")/.."
if [ -f .env ]; then
  POSTGRES_USER="$(grep -E '^POSTGRES_USER=' .env | tail -n1 | cut -d= -f2- || true)"
  POSTGRES_DB="$(grep -E '^POSTGRES_DB=' .env | tail -n1 | cut -d= -f2- || true)"
fi
POSTGRES_USER="${POSTGRES_USER:-wavehub}"
POSTGRES_DB="${POSTGRES_DB:-wavehubdb}"

printf "This will OVERWRITE database %s with %s. Type 'restore' to continue: " "$POSTGRES_DB" "$FILE"
read -r answer
[ "$answer" = "restore" ] || { echo "aborted"; exit 1; }

gzip -dc "$FILE" | docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1
echo "restored. Start the backend again; it will apply any migrations newer than the dump."
