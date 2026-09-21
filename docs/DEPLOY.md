# Deploying WaveHub to a single Ubuntu 24.04 VPS

Target: one server running Docker Compose — **Caddy** (automatic HTTPS) in front of the **Next.js
frontend** (`/`), the **NestJS backend** (`/api`), and **PostgreSQL 16**, all on a private Docker
network. Only ports 80/443 are exposed. One domain serves everything, so there is no CORS and the
session cookie is scoped to a single host.

> **Honesty note.** The Dockerfiles, compose file, Caddyfile and scripts below were written and
> statically checked in an environment with **no Docker daemon and no Caddy binary**. The compiled
> backend, the migration-on-boot command, and `/health` were exercised for real against Postgres,
> and CI (`.github/workflows/ci.yml`, job `docker`) builds both images and boots Postgres + backend
> on every PR — but **the first real `docker compose up` on your server is the first end-to-end run
> of the full stack, including Caddy and certificate issuance.** Do it on a staging domain first if
> you can, and read `docs/LAUNCH_CHECKLIST.md` before going live.

Sizing: 2 vCPU / 4 GB RAM / 40 GB disk is comfortable (the frontend image build is the RAM spike —
add 2 GB swap if you have less than 4 GB). All commands below run on the server as a sudo-capable
non-root user.

---

## 0. Before you touch the server

You need (see the owner-only list in `docs/LAUNCH_CHECKLIST.md`):

- A domain, with an **A record (and AAAA if you have IPv6)** pointing at the server's IP. Wait for
  DNS to propagate (`dig +short your-domain`) *before* step 6, otherwise Let's Encrypt issuance
  fails and can rate-limit you.
- A **Resend** account with your sending domain verified (or another decision on email — see
  `backend/src/email/CLAUDE.md`). Without working email nobody can verify an account and log in.
- (Optional) an S3-compatible bucket if you don't want uploads on the server's disk.
- (Later) Bank of Georgia production credentials.

## 1. Base system and firewall

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install ufw fail2ban unattended-upgrades git curl

# Firewall: SSH + web only. 443/udp is HTTP/3.
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
sudo ufw status verbose

# Automatic security updates + brute-force protection for SSH.
sudo dpkg-reconfigure -plow unattended-upgrades
sudo systemctl enable --now fail2ban
```

Harden SSH (key-only login) in `/etc/ssh/sshd_config.d/99-hardening.conf`, **after confirming your
key works in a second terminal**:

```
PasswordAuthentication no
PermitRootLogin no
```

`sudo systemctl reload ssh`.

> ufw does **not** filter ports that Docker publishes. That is why `docker-compose.yml` publishes
> only Caddy's 80/443 and nothing else — never add `ports:` to `postgres`, `backend` or `frontend`.

Optional swap (small servers):

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 2. Install Docker Engine + Compose plugin

From Docker's official apt repository (not the distro `docker.io` package):

```bash
sudo apt -y install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"   # log out/in afterwards
docker compose version
```

Docker starts on boot, and every service in the compose file has `restart: unless-stopped`, so the
stack comes back after a reboot.

## 3. Get the code

```bash
sudo mkdir -p /opt/wavehub && sudo chown "$USER": /opt/wavehub
git clone <your-repo-url> /opt/wavehub
cd /opt/wavehub
git checkout <the release branch/tag you are deploying>
```

## 4. Configure the environment

```bash
cp .env.production.example .env
chmod 600 .env
# Generate secrets — a different value for each:
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # KEY_ENCRYPTION_SECRET
openssl rand -hex 24   # POSTGRES_PASSWORD
nano .env              # fill in DOMAIN, ACME_EMAIL, URLs, secrets, email provider, ...
```

`.env.production.example` documents every variable. Things that bite:

- All URLs must be `https://`, and `BACKEND_PUBLIC_URL` / `NEXT_PUBLIC_API_URL` end in `/api`.
- The backend **refuses to boot** in production with a dev/placeholder/short secret, a missing
  `TRUST_PROXY`, an `http://` URL, `TYPEORM_SYNC=true`, or an unset `EMAIL_PROVIDER`. The error
  lists every problem at once (`docker compose logs backend`).
- **Back up `.env` — above all `KEY_ENCRYPTION_SECRET` — to a password manager, separately from the
  database backups.** Without it every stored Steam/digital key is permanently unreadable.
- `NEXT_PUBLIC_API_URL` is baked into the frontend at build time.

## 5. Build and start

```bash
docker compose build
docker compose up -d
docker compose ps            # all services should reach "healthy"
docker compose logs -f backend
```

On start the backend container runs `migration:run` from the compiled data source (creating the
whole schema on first boot, applying new migrations on later ones), then starts the API. If a
migration fails the container exits and restarts until you fix it — the schema is never served
half-migrated.

Caddy obtains the certificate on the first request to your domain; watch
`docker compose logs -f caddy` for `certificate obtained successfully`.

## 6. Smoke test

```bash
curl -s https://your-domain/api/health        # {"status":"ok","db":"up","maintenance":false}
curl -sI https://your-domain/ | head -5       # 200, with Strict-Transport-Security
```

Then in a browser: register (you should receive a verification email), log in, browse the
marketplace, upload an image on a draft listing and confirm it displays.

**Create the first admin** — there is deliberately no API for granting staff roles; do it in the
database once, after registering and verifying that account through the UI:

```bash
docker compose exec postgres psql -U wavehub -d wavehubdb \
  -c "UPDATE users SET \"adminRole\" = 'super_admin' WHERE username = 'your-username';"
```

Then check Admin → Settings (fee %, minimum withdrawal, maintenance mode).

## 7. Backups (do this before launch, and test a restore)

`scripts/backup.sh` writes a compressed `pg_dump` and (for local storage) a tarball of the uploads
volume into `./backups`, owner-readable only, pruning files older than 14 days.

```bash
./scripts/backup.sh                       # run it once by hand and inspect ./backups
crontab -e
```

```cron
# 03:15 every day; failures are appended to the log (add a mail/monitor hook if you like)
15 3 * * * cd /opt/wavehub && ./scripts/backup.sh >> /var/log/wavehub-backup.log 2>&1
```

**Off-server copy** — backups on the same disk don't survive losing the server. Pick one, e.g.:

```bash
# rsync to another host (add to the same cron entry, after backup.sh)
rsync -a --delete /opt/wavehub/backups/ backupuser@other-host:/srv/wavehub-backups/
# or rclone to any S3-compatible bucket
rclone sync /opt/wavehub/backups remote:wavehub-backups
```

Your VPS provider's disk snapshots are a useful extra layer, not a substitute.

**Restore** (destructive; practise it on a scratch server):

```bash
docker compose stop backend frontend
./scripts/restore-db.sh backups/db-YYYYMMDD-HHMMSS.sql.gz
docker compose start backend frontend
# uploads (local storage only):
docker compose exec -T backend tar xzf - -C /data < backups/uploads-YYYYMMDD-HHMMSS.tar.gz
```

## 8. Log rotation

- **Container logs** are size-capped in `docker-compose.yml` (json-file driver, 10 MB × 5 files per
  service) — Docker rotates them itself; nothing to configure.
- **Backup log**: `/etc/logrotate.d/wavehub`

  ```
  /var/log/wavehub-backup.log {
      weekly
      rotate 8
      compress
      missingok
      notifempty
  }
  ```

- The application's access log is one JSON line per request with **no IPs, cookies, bodies or user
  identifiers** (method, path with ids collapsed, status, duration, request id). Caddy's access log
  is intentionally off. View logs with `docker compose logs --since 1h backend`.

## 9. Updating to a new version

```bash
cd /opt/wavehub
./scripts/backup.sh                         # always take a fresh backup first
git fetch --tags && git checkout <new tag/branch> && git pull --ff-only
docker compose build
docker compose up -d                        # recreates changed containers; backend runs new migrations on start
docker compose ps && curl -s https://your-domain/api/health
docker image prune -f                       # reclaim old layers
```

Migrations run before the new backend serves traffic and are forward-only in normal operation. To
roll back code *and* schema: restore the pre-update backup (section 7) and check out the previous
version. There is a brief (seconds) interruption while the backend restarts.

For risky changes turn on **maintenance mode** first (Admin → Settings): all non-admin writes get a
`503` with a friendly message while reads keep working, and the BOG payment callbacks keep being
accepted so no paid top-up is lost. Turn it off afterwards.

## 10. Operations cheat-sheet

```bash
docker compose ps                       # status + health
docker compose logs -f backend          # follow backend logs
docker compose restart backend
docker compose exec postgres psql -U wavehub -d wavehubdb     # DB shell
docker stats                            # resource use
df -h; docker system df                 # disk
```

Graceful shutdown: `docker compose stop` sends SIGTERM; the backend stops accepting requests,
lets in-flight ones finish (up to 30 s) and closes its DB pool.

### Rotating secrets

| Secret | Effect / procedure |
|---|---|
| `JWT_SECRET` | Change in `.env`, `docker compose up -d`. Everyone is logged out; nothing else breaks. |
| `POSTGRES_PASSWORD` | Postgres only applies it at first init. To rotate: `docker compose exec postgres psql -U wavehub -c "ALTER USER wavehub PASSWORD 'new'"`, then update `.env`, then `docker compose up -d`. |
| `KEY_ENCRYPTION_SECRET` | **Do not rotate** without writing a re-encryption migration — existing keys become unreadable. |
| `RESEND_API_KEY`, `S3_*`, `BOG_*` | Update `.env`, `docker compose up -d backend`. |

### Monitoring

Point an external uptime monitor (UptimeRobot, Better Stack, ...) at `https://your-domain/api/health`
— it returns `503` when the database is unreachable. Consider also disk-space and certificate-expiry
alerts (Caddy renews automatically, ~30 days before expiry).

## Optional: separate `api.` subdomain

If you prefer `api.your-domain` over the `/api` prefix: add a second site block to
`deploy/Caddyfile` that `reverse_proxy backend:4000`, set `NEXT_PUBLIC_API_URL` and
`BACKEND_PUBLIC_URL` to `https://api.your-domain`, keep `CORS_ORIGIN=https://your-domain`, and
rebuild the frontend. The session cookie is `SameSite=Lax`, which still works between
`your-domain` and `api.your-domain` (same site), but a single domain remains simpler and safer.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `docker compose up` says `set X in .env` | A required variable is empty (by design). |
| Backend restarts, logs `Refusing to start in production...` | Read the listed problems; fix `.env`. |
| Caddy can't get a certificate | DNS not pointing here yet, or ports 80/443 blocked (cloud firewall + ufw). |
| Site loads but login/API calls fail | `NEXT_PUBLIC_API_URL` wrong or not rebuilt (`docker compose build frontend`). |
| Registered users get no email | `EMAIL_PROVIDER=console`, unverified Resend domain, or a bad `RESEND_API_KEY` (backend logs the provider's HTTP status, never the address). |
| `EACCES` on uploads | The `uploads` volume was created root-owned by an older image: `docker compose exec -u root backend chown -R node:node /data/uploads`. |
| Everyone gets rate-limited / same IP | `TRUST_PROXY` missing, or backend port published directly (it must not be). |
