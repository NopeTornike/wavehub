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

Harden SSH in a drop-in that sorts **before** any cloud-init-provided one (see the gotcha below) —
`/etc/ssh/sshd_config.d/00-wavehub-hardening.conf`, **after confirming your key works in a second
terminal**:

```
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
X11Forwarding no
AllowTcpForwarding no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
```

`sudo sshd -t && sudo systemctl reload ssh` (the `-t` syntax-checks the config first — never reload
a config you haven't checked, on a connection you can't afford to lose).

> **Gotcha, found deploying this exact server**: some providers' cloud images (OVH's does) ship
> their own `NN-cloud-init.conf` drop-in that sets `PasswordAuthentication yes` — sshd's `Include`
> processes `sshd_config.d/*.conf` in filename order and the **first** occurrence of a directive
> wins, so a `99-*.conf` sorts *after* a `50-cloud-init.conf` and silently loses. Name your drop-in
> `00-*.conf` so it's read first, and verify with `sudo sshd -T | grep passwordauthentication` —
> it must say `no`, not just "the file I wrote says no."

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

## 5b. Self-hosted SMTP (alternative to Resend)

Skip this section if using `EMAIL_PROVIDER=resend`. Running your own mail server gets you real email
without a third-party account, but **deliverability is on you** — without every piece below, most of
what you send lands in spam or gets rejected outright by Gmail/Outlook. This is genuinely more
fragile than a dedicated provider; only do it if you have a specific reason to avoid one.

**Prerequisite**: confirm outbound port 25 isn't blocked — `timeout 5 bash -c '</dev/tcp/smtp.gmail.com/25' && echo open || echo blocked`.
Some cloud providers block it by default and require a support ticket to open it (OVH does not, as
of writing).

1. **Install Postfix + OpenDKIM** (host-level, not in Docker — needs to bind to a privileged-ish
   port range other services shouldn't share, and DKIM key material shouldn't live in an image):
   ```bash
   sudo apt -y install postfix opendkim opendkim-tools mailutils
   # postfix installer prompts: "Internet Site", mailname = your domain
   ```

2. **Configure Postfix to relay only from this server's own Docker network — never a public open
   relay.** `docker-compose.yml` pins the compose network to `172.28.0.0/16` (gateway
   `172.28.0.1`) specifically so this step has a fixed, known address instead of whatever Docker
   would otherwise auto-assign — see that file's `networks:` block for why that matters (the
   gotcha in step 6 below is exactly what happens if you skip pinning it):
   ```bash
   sudo postconf -e "myhostname = mail.your-domain"
   sudo postconf -e "mydomain = your-domain"
   sudo postconf -e "myorigin = your-domain"
   # Only loopback + the pinned docker bridge gateway — never the public interface. Sending only,
   # never receiving; ufw already has no rule for 25 either, so it's unreachable from the internet
   # twice over.
   sudo postconf -e "inet_interfaces = 127.0.0.1, 172.28.0.1"
   sudo postconf -e "inet_protocols = ipv4"
   sudo postconf -e "mydestination = localhost"
   sudo postconf -e "mynetworks = 127.0.0.0/8, 172.28.0.0/16"
   sudo postconf -e "smtpd_relay_restrictions = permit_mynetworks, reject_unauth_destination"
   sudo postconf -e "smtp_tls_security_level = may"
   sudo postconf -e "smtpd_tls_security_level = may"
   sudo postconf -e "milter_default_action = accept"
   sudo postconf -e "milter_protocol = 6"
   sudo postconf -e "smtpd_milters = inet:127.0.0.1:8891"
   sudo postconf -e "non_smtpd_milters = inet:127.0.0.1:8891"
   ```

   **`ufw` blocks this hop too, by default, silently.** `ufw`'s default-deny-incoming policy
   applies to traffic arriving on the Docker bridge interface, not just the public one — a
   container connecting to a host-listening port (like Postfix here) counts as "incoming" from
   `ufw`'s point of view and gets dropped with no error either side sees, only a UFW BLOCK line in
   `/var/log/ufw.log` if you go looking. Allow exactly this one hop, nothing wider:
   ```bash
   sudo ufw allow from 172.28.0.0/16 to any port 25 proto tcp comment 'backend -> local Postfix relay'
   ```

3. **Generate a DKIM key and wire up OpenDKIM.** Three gotchas that will otherwise cost you an hour:
   the key directory must be owned by the `opendkim` user with no group/other write bit or the
   daemon refuses to trust it as "unsafe"; `opendkim.conf` needs an explicit `UserID opendkim:opendkim`
   or it never drops root privileges and the same "unsafe" check trips again; and it needs an explicit
   `PidFile` matching systemd's `PIDFile=` or the service times out waiting for a PID file that gets
   written somewhere systemd never looks.
   ```bash
   sudo mkdir -p /etc/opendkim/keys/your-domain
   cd /etc/opendkim/keys/your-domain
   sudo opendkim-genkey -b 2048 -d your-domain -s wh2026 -v
   sudo chown -R opendkim:opendkim /etc/opendkim/keys
   sudo chmod 750 /etc/opendkim/keys /etc/opendkim/keys/your-domain
   sudo chmod 640 /etc/opendkim/keys/your-domain/wh2026.private

   sudo tee /etc/opendkim.conf > /dev/null <<'EOF'
   Domain                  your-domain
   KeyFile                 /etc/opendkim/keys/your-domain/wh2026.private
   Selector                wh2026
   Socket                  inet:8891@127.0.0.1
   PidFile                 /run/opendkim/opendkim.pid
   Syslog                  yes
   UMask                   022
   Mode                    sv
   UserID                  opendkim:opendkim
   SubDomains              no
   AutoRestart             yes
   AutoRestartRate         10/1h
   OversignHeaders         From
   EOF
   echo 'd /run/opendkim 0750 opendkim opendkim -' | sudo tee /etc/tmpfiles.d/opendkim.conf
   sudo systemd-tmpfiles --create /etc/tmpfiles.d/opendkim.conf
   ```

   **Fourth gotcha, easy to miss because nothing errors**: without `InternalHosts`, OpenDKIM
   treats the backend container's IP as an untrusted external sender and silently declines to
   sign on its behalf (correct default — it's refusing to become an open DKIM-signing relay for
   arbitrary senders) — you'll see mail actually deliver (Postfix logs `status=sent`) but every
   message arrives unsigned, and a spam checker will flag it as "not fully authenticated." Fix:
   ```bash
   sudo tee /etc/opendkim/TrustedHosts > /dev/null <<'EOF'
   127.0.0.1
   localhost
   172.28.0.0/16
   *.your-domain
   EOF
   sudo chown opendkim:opendkim /etc/opendkim/TrustedHosts
   sudo sed -i '/^Domain/a InternalHosts            /etc/opendkim/TrustedHosts' /etc/opendkim.conf
   sudo systemctl restart opendkim postfix
   sudo systemctl is-active opendkim postfix   # both must say "active"
   cat /etc/opendkim/keys/your-domain/wh2026.txt   # the DKIM DNS record, see step 4
   ```

4. **Add three DNS TXT records** (the `p=` value is every quoted chunk from `wh2026.txt`
   concatenated, no spaces):
   | Host | Value |
   |---|---|
   | `@` | `v=spf1 ip4:<this-server's-IP> -all` |
   | `wh2026._domainkey` | `v=DKIM1; h=sha256; k=rsa; p=<the concatenated key>` |
   | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:you@your-domain; pct=100` |

5. **Set the PTR (reverse DNS) record** for the server's IP to `mail.your-domain` — in your VPS
   provider's control panel, not DNS. A mismatched or default PTR (e.g. `vps-xxxx.provider.net`) is
   one of the strongest spam signals there is; SPF/DKIM alone won't save you without it.

6. **Point the backend at it.** `docker-compose.yml`'s `backend` service has a **static**
   `extra_hosts: host.docker.internal:172.28.0.1` entry:
   ```
   EMAIL_PROVIDER=smtp
   SMTP_HOST=host.docker.internal
   SMTP_PORT=25
   SMTP_SECURE=false
   # SMTP_USER / SMTP_PASSWORD stay empty — mynetworks trusts the docker subnet, no auth needed.
   EMAIL_FROM="WaveHub <no-reply@your-domain>"
   ```
   `docker compose up -d backend` (no rebuild needed for an env-only change).

   > **Gotcha, found running this exact setup**: Docker's `extra_hosts: host.docker.internal:
   > host-gateway` special value resolves to the gateway of Docker's own **default** bridge
   > network (typically `172.17.0.1`), not necessarily the gateway of the specific compose
   > network your containers are actually attached to — and a container isn't attached to the
   > default bridge at all unless something explicitly puts it there. The result: every SMTP send
   > timed out silently (caught by `EmailService`'s own never-throw design, so nothing looked
   > broken until someone actually checked whether an email arrived — see step 7, don't skip it).
   > Fix: pin the compose network's subnet explicitly (already done in `docker-compose.yml`) and
   > point `extra_hosts` at that pinned gateway's literal IP instead of the `host-gateway` alias.
   > If you ever change the pinned subnet, update both places together.

7. **Actually test delivery**, don't assume it worked because Postfix accepted the message locally —
   [mail-tester.com](https://www.mail-tester.com) gives you a throwaway `@srv1.mail-tester.com`
   address; register a real (throwaway) account on your own site using that address as the email,
   so the test exercises the real code path (`EmailService` → nodemailer → Postfix → real MX), not
   a hand-sent message. Then load `mail-tester.com/<your-test-id>` for a real SPF/DKIM/DMARC/
   blocklist/spam score — this repo's own setup scored a clean 10/10 once all four gotchas above
   were fixed; a lower score almost always means one of them is still unresolved on your server,
   not that the code itself is wrong. Give SPF/DKIM/DMARC/PTR a few minutes to propagate first
   (`dig +short TXT your-domain`, `dig +short TXT wh2026._domainkey.your-domain`,
   `dig +short -x <server-ip>`).

A fresh IP with no sending history will still land in spam at first even with everything above
correct — mailbox providers build reputation over time from consistent, low-complaint sending. This
is the real, unavoidable tradeoff against a dedicated provider like Resend, which already has that
reputation built up.

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
