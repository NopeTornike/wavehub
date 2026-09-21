#!/bin/sh
# Backs up the two things that can't be rebuilt from git: the Postgres database and (when
# STORAGE_DRIVER=local) the uploads volume. Run from the repo directory on the server (cron example
# in docs/DEPLOY.md). Writes timestamped files under $BACKUP_DIR (default ./backups), keeps the most
# recent $KEEP_DAYS days (default 14), and exits non-zero on any failure so cron/monitoring notices.
#
# This protects against corruption and mistakes, NOT against losing the whole server: copy
# $BACKUP_DIR off the machine too (rsync/rclone to another host or bucket) — see docs/DEPLOY.md.
# Also back up your `.env` (especially KEY_ENCRYPTION_SECRET) somewhere safe, separately.
set -eu

cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

umask 077 # backups contain personal data and encrypted keys: owner-only
mkdir -p "$BACKUP_DIR"

# Load POSTGRES_USER / POSTGRES_DB from .env (compose defaults otherwise).
if [ -f .env ]; then
  POSTGRES_USER="$(grep -E '^POSTGRES_USER=' .env | tail -n1 | cut -d= -f2- || true)"
  POSTGRES_DB="$(grep -E '^POSTGRES_DB=' .env | tail -n1 | cut -d= -f2- || true)"
fi
POSTGRES_USER="${POSTGRES_USER:-wavehub}"
POSTGRES_DB="${POSTGRES_DB:-wavehubdb}"

DB_FILE="$BACKUP_DIR/db-$STAMP.sql.gz"
echo "[backup] dumping database $POSTGRES_DB -> $DB_FILE"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists | gzip > "$DB_FILE.partial"
# pipefail isn't in POSIX sh; verify the dump is a non-trivial, valid gzip instead.
gzip -t "$DB_FILE.partial"
[ "$(wc -c < "$DB_FILE.partial")" -gt 1000 ] || { echo "[backup] dump suspiciously small, aborting" >&2; rm -f "$DB_FILE.partial"; exit 1; }
mv "$DB_FILE.partial" "$DB_FILE"

if docker compose exec -T backend sh -c 'test -d /data/uploads && [ "$(ls -A /data/uploads 2>/dev/null)" ]' 2>/dev/null; then
  UP_FILE="$BACKUP_DIR/uploads-$STAMP.tar.gz"
  echo "[backup] archiving uploads -> $UP_FILE"
  docker compose exec -T backend tar czf - -C /data uploads > "$UP_FILE.partial"
  gzip -t "$UP_FILE.partial"
  mv "$UP_FILE.partial" "$UP_FILE"
else
  echo "[backup] no local uploads to archive (empty, or STORAGE_DRIVER=s3)"
fi

echo "[backup] pruning backups older than $KEEP_DAYS days"
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.sql.gz' -o -name 'uploads-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete

echo "[backup] done"
