# email

## Purpose
Sends transactional emails. Currently a placeholder — logs instead of sending. Real provider choice
(Resend vs Postmark vs SES) is an open product/cost decision deferred to build-plan Phase 9.

## Key files
- `email.service.ts` — `EmailService.send(to, subject, body)`, the one method every call site uses
- `email.module.ts` — exports `EmailService`

## Data model
None.

## Conventions & gotchas
- Every caller (currently just `backend/src/auth/auth.service.ts`, for verification/reset emails)
  goes through `EmailService.send()`. When a real provider is chosen, only this file's internals
  need to change — don't let call sites reach for a provider SDK directly.
- In the meantime, "sending" an email just logs it via Nest's `Logger` — check the server console
  for verification/reset links during local testing, there's no actual email arriving anywhere.

## Related modules
- `backend/src/auth/` — the only current consumer.

## Status
Stub only, by design (see Purpose). Swap the body of `send()` for a real provider call when Phase 9
happens; the interface is deliberately minimal so that's a contained change.
