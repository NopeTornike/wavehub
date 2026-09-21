import { Injectable, Logger } from '@nestjs/common';

type Provider = 'console' | 'resend';

const RESEND_URL = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 10_000;

// Transactional email. Provider is chosen by EMAIL_PROVIDER:
//   - `resend`  — Resend's HTTP API via plain `fetch` (no SDK/dependency). Needs RESEND_API_KEY and
//                 EMAIL_FROM (a sender on a domain verified in Resend).
//   - `console` — logs instead of sending. The default outside production (so local dev/CI need no
//                 account); in production it must be selected explicitly (production-config.ts) and
//                 never logs the body, because bodies contain one-time verification/reset links.
//
// `send()` never throws: an email-provider outage must not turn into a 500 on registration or
// password reset (which would also leak whether an address exists, via a timing/status difference).
// Failures are logged with the recipient's domain only — no address, subject or body. Callers that
// need delivery guarantees don't exist yet; users can always re-request a link.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: Provider;

  constructor() {
    const configured = (process.env.EMAIL_PROVIDER || '').toLowerCase();
    if (configured === 'resend') {
      if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
        throw new Error('EMAIL_PROVIDER=resend requires RESEND_API_KEY and EMAIL_FROM');
      }
      this.provider = 'resend';
    } else if (configured === '' || configured === 'console') {
      this.provider = 'console';
    } else {
      throw new Error(`Unsupported EMAIL_PROVIDER "${configured}" (use "resend" or "console")`);
    }
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    if (this.provider === 'console') {
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn(`[email disabled] would send "${subject}" to a ${to.split('@')[1] ?? 'unknown'} address`);
      } else {
        this.logger.log(`[dev email] to=${to} subject="${subject}"\n${body}`);
      }
      return;
    }

    const domain = to.split('@')[1] ?? 'unknown';
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(RESEND_URL, {
          method: 'POST',
          headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text: body }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
        if (res.ok) return;
        // 4xx = our request is wrong (bad key, unverified sender, invalid address) — retrying won't help.
        if (res.status < 500) {
          this.logger.error(`Email provider rejected a message to ${domain}: HTTP ${res.status}`);
          return;
        }
        this.logger.warn(`Email provider error HTTP ${res.status} (attempt ${attempt}) sending to ${domain}`);
      } catch (err) {
        this.logger.warn(`Email provider unreachable (attempt ${attempt}) sending to ${domain}: ${(err as Error).name}`);
      }
    }
    this.logger.error(`Giving up sending an email to ${domain} after retries`);
  }
}
