# email

## Purpose
Sends transactional emails (verification, password reset). One method, two drivers selected by
`EMAIL_PROVIDER`.

## Key files
- `email.service.ts` — `EmailService.send(to, subject, body)`, the one method every call site uses.
  Driver chosen once at construction:
  - **`resend`** — Resend's HTTP API (`POST https://api.resend.com/emails`) through plain `fetch`, no
    SDK/dependency. Needs `RESEND_API_KEY` and `EMAIL_FROM` (a sender on a domain verified in
    Resend) — constructing the service throws if either is missing. 10 s timeout; one retry on a
    network error/5xx, none on a 4xx (our request is wrong; retrying can't help).
  - **`console`** — logs instead of sending. Default when `EMAIL_PROVIDER` is unset *outside*
    production. Development logs the full body (so you can copy the verification link); with
    `NODE_ENV=production` it logs only the recipient's **domain** and the subject, never the body
    or address, because bodies carry one-time account-takeover-grade links.
- `email.module.ts` — exports `EmailService`
- `email.service.spec.ts` — driver selection, request shape, no-throw/retry behavior, and the
  "production console mode never logs the body" guarantee.

## Data model
None.

## Conventions & gotchas
- **`send()` never throws.** A provider outage must not become a 500 on registration/password reset
  (and a status difference on reset would leak whether an address is registered). Failures are
  logged as `HTTP <status>` + the recipient domain only — never the address, subject or body. The
  cost: a lost email is invisible to the caller; users recover with "resend verification"/"forgot
  password". Add a queue/outbox only if delivery guarantees ever matter.
- **In production `EMAIL_PROVIDER` must be set explicitly** (`backend/src/config/production-config.ts`
  fails the boot otherwise) — `console` is allowed only as a conscious opt-in for smoke tests,
  since with it nobody can ever verify an account.
- Every caller (currently `backend/src/auth/auth.service.ts`) goes through `EmailService.send()`;
  don't let call sites reach for a provider directly. To add a provider (Postmark, SES, SMTP), add a
  branch in the constructor + `send()` and extend `production-config.ts` and
  `.env.production.example`.
- The e2e harness (`backend/test/helpers.ts`) replaces `EmailService.prototype.send` to capture
  verification links, so e2e never hits a provider.
- Sending domain DNS (SPF/DKIM/DMARC) is an owner task — `docs/LAUNCH_CHECKLIST.md`.

## Related modules
- `backend/src/auth/` — the only current consumer.
- `backend/src/config/production-config.ts` — enforces the production requirements above.

## Status
Resend driver implemented and unit-tested with a mocked `fetch`; **never exercised against the real
Resend API** (no account/key available when written) — send a real verification email as part of
the launch checklist.
