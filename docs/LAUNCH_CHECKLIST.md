# WaveHub launch checklist

Tick every box before pointing real users (and real money) at the site. Section A is work only the
**owner** can do (needs accounts, secrets, money or legal judgement). Section B is engineering
verification that should be re-run on the real server. Deployment steps live in `docs/DEPLOY.md`.

## A. Owner-only items (cannot be done by engineering alone)

- [ ] **Domain + DNS.** Register/choose the domain; create the A (and AAAA) record to the VPS IP;
      confirm with `dig +short <domain>` *before* first `docker compose up`.
- [ ] **VPS.** Ubuntu 24.04, 2 vCPU / 4 GB RAM recommended; provider-side firewall allows 22/80/443.
- [ ] **Email provider account.** Create a Resend account, verify the sending domain (SPF/DKIM DNS
      records), create an API key → `RESEND_API_KEY`, choose the sender → `EMAIL_FROM`.
      *(If you'd rather use another provider, that needs a small new driver — `backend/src/email/`.)*
      Without this, users cannot verify their email and therefore cannot buy, sell or withdraw.
- [ ] **Bank of Georgia production credentials** → `BOG_CLIENT_ID` / `BOG_CLIENT_SECRET`, and
      register the production callback URLs with BOG:
      `https://<domain>/api/payments/bog/callback` and `https://<domain>/api/subscriptions/bog-callback`.
      The BOG integration has **never been exercised against real BOG** (sandbox or production):
      run a real small top-up end to end (see B-3) before announcing.
- [ ] **BOG saved-card / recurring payments enabled on the merchant account.** Subscriptions
      (`backend/src/subscriptions/`) depend on BOG's saved-card + background-recharge API; ask BOG
      to enable it and confirm the callback shape for recurring charges. Until then, disable or hide
      the plans page — checkout will fail at the recharge step.
- [ ] **Object-storage bucket** *(optional but recommended)*: create an S3-compatible bucket
      (R2/B2/S3/Hetzner) with **public read** (or behind a CDN), an access key with write-only to
      that bucket, and fill `STORAGE_DRIVER=s3` + `S3_*`. Skip only if you accept uploads living on
      the single server's disk (`local` driver; backed up by `scripts/backup.sh`).
- [ ] **Legal review of all copy.** The 10 CMS pages (Terms, Privacy, Refund, Delivery, Disputes,
      Community, Seller/Coach Standards, About, Contact) were ported from the prototype and are
      **not lawyer-reviewed** — check them against Georgian law and BOG's merchant requirements
      (consumer refund/withdrawal rights, data-protection notice, marketplace/intermediary status,
      resale of Steam keys, payout/tax treatment). Edit them in Admin → Content.
- [ ] **CAPTCHA / bot-protection decision.** Registration and login are IP-rate-limited (5/min) but
      have no CAPTCHA (deliberately deferred, root `CLAUDE.md`). Decide: launch without, or add
      Cloudflare Turnstile / hCaptcha (needs a site key; small code change on `/auth/register`).
- [ ] **Payout process.** Seller withdrawals are *manual*: staff process requests and pay out
      by bank transfer outside the app, then mark them completed. Decide who does this, how often,
      and how the fee/tax side is handled.
- [ ] **Support operations.** Name the staff who hold each admin role; create the first
      `super_admin` (see `docs/DEPLOY.md` §6); decide support hours/SLAs.
- [ ] **Backups off-server.** Choose the destination for the backup copy (second host / bucket) and
      store `.env` (esp. `KEY_ENCRYPTION_SECRET`) in a password manager.
- [ ] **Business settings.** In Admin → Settings set the platform fee % and minimum withdrawal;
      decide the subscription plans/prices (Admin → Subscription plans).

## B. Engineering verification (repeat on the real server)

1. **Config gate.** `docker compose up -d`; backend reaches `healthy`. (It refuses to boot on any
   dev secret, http URL, missing `TRUST_PROXY`/`EMAIL_PROVIDER`, or `TYPEORM_SYNC=true`.)
2. **Smoke.** `curl https://<domain>/api/health` → `{"status":"ok","db":"up",...}`; register →
   receive the real email → verify → log in; upload a listing image and see it render; place a test
   order with a fabricated balance (`UPDATE` via psql on a *test account only*, or a tiny real
   top-up) and walk purchase → deliver → accept.
3. **BOG end to end.** With production (or sandbox) credentials: top up the smallest amount as a
   real user, confirm the callback arrives (backend log line, wallet credited exactly once), then
   test a failed/abandoned payment, and — if subscriptions are on — a plan checkout and a recharge.
4. **Headers/TLS.** `curl -sI https://<domain>/` shows HSTS; SSL Labs grade A; `http://` redirects
   to `https://`.
5. **Rate limiting uses real client IPs.** From two different networks, trigger the login throttle
   (6 wrong passwords in a minute) and confirm it limits per client, not globally.
6. ✅ **Backups** — `./scripts/backup.sh` verified working; restore drill performed 2026-09-23 by
   restoring the real dump into a scratch database (`wavehubdb_restoretest`, not production) and
   confirming every table's row count matched production exactly, then dropped. Off-server backup
   destination is still an owner decision (section A).
7. **Maintenance mode.** Toggle it in Admin → Settings: a normal user's write gets `503`,
   browsing still works, an admin can still act; switch it back off.
8. ✅ **Reboot test** — performed for real 2026-09-23, twice. First reboot found a real bug: the
   self-hosted mail server's `postfix.service` reported "active" but the actual daemon never
   started (Debian's postfix systemd unit doesn't reliably track the real process — see
   `docs/DEPLOY.md`'s fifth SMTP gotcha). Fixed with a verifying start wrapper; second reboot
   confirmed postfix, the whole Docker stack, fail2ban, and ufw all return correctly on their own.
   Caddy's `health_interval 30s` means there's a normal ~30s window right after boot where the
   site briefly answers `503` before Caddy notices the backend is up — not a bug, just its check
   cadence; it self-resolves without intervention.
9. **Monitoring.** External uptime check on `/api/health`; alert on disk >80%.
10. **Dependency audit.** `npm audit --omit=dev` is clean (also enforced in CI).

## C. Known limitations at launch (accepted, documented)

- Single-instance design: in-memory rate-limit state, in-process cron jobs (order auto-complete,
  subscription recharge sweep). Do not run multiple backend replicas without reading
  `backend/src/orders/CLAUDE.md` and the throttler note in root `CLAUDE.md`.
- No malware scanning of uploads (type/size validated by content sniffing only).
- No CSRF tokens (SameSite=Lax + POST-only mutations, see root `CLAUDE.md`).
- A suspended/banned user is blocked immediately, but there is no per-device session revocation.
- No real payout automation (manual), no dispute path for coaching sessions, no Trust & Safety /
  analytics tooling, no promo codes/banners.
- The frontend has no dedicated maintenance banner: it shows the API's 503 message where a write
  fails, and `/api/health` exposes `maintenance: true` for a future banner.
- Docker artifacts have been validated statically and via CI/compiled-artifact runs, not yet on the
  production host (see the honesty note in `docs/DEPLOY.md`).
