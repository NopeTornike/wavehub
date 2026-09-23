import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

type Provider = 'console' | 'resend' | 'smtp';

const RESEND_URL = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 10_000;

// Transactional email. Provider is chosen by EMAIL_PROVIDER:
//   - `resend` — Resend's HTTP API (`POST https://api.resend.com/emails`) through plain `fetch`, no
//                SDK/dependency. Needs RESEND_API_KEY and EMAIL_FROM (a sender on a domain verified
//                in Resend).
//   - `smtp`   — plain SMTP via `nodemailer` (the one real dependency this module carries — hand-
//                rolling STARTTLS/AUTH/MIME correctly is exactly the kind of thing that turns into a
//                security bug, e.g. header injection via a crafted `to`/`subject`; a maintained
//                library earns its place here). Needs SMTP_HOST; SMTP_PORT defaults to 587,
//                SMTP_SECURE to false (STARTTLS). SMTP_USER/SMTP_PASSWORD are optional — leave both
//                unset to talk to an unauthenticated local relay (e.g. a Postfix instance on the
//                same box/network, restricted to that network — see backend/src/email/CLAUDE.md and
//                docs/DEPLOY.md's "Self-hosted SMTP" section for why an authenticated third-party
//                relay is the safer default and what self-hosting actually requires to be
//                deliverable: SPF, DKIM, DMARC, and a matching PTR record).
//   - `console` — logs instead of sending. Default when `EMAIL_PROVIDER` is unset *outside*
//                 production. Development logs the full body (so you can copy the verification
//                 link); with `NODE_ENV=production` it logs only the recipient's domain and the
//                 subject, never the body or address, because bodies carry one-time
//                 account-takeover-grade links.
//
// `send()` never throws: an email-provider outage must not turn into a 500 on registration or
// password reset (which would also leak whether an address exists, via a timing/status difference).
// Failures are logged with the recipient's domain only — no address, subject or body. Callers that
// need delivery guarantees don't exist yet; users can always re-request a link.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: Provider;
  private readonly smtpTransport?: Transporter;

  constructor() {
    const configured = (process.env.EMAIL_PROVIDER || '').toLowerCase();
    if (configured === 'resend') {
      if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
        throw new Error('EMAIL_PROVIDER=resend requires RESEND_API_KEY and EMAIL_FROM');
      }
      this.provider = 'resend';
    } else if (configured === 'smtp') {
      if (!process.env.SMTP_HOST || !process.env.EMAIL_FROM) {
        throw new Error('EMAIL_PROVIDER=smtp requires SMTP_HOST and EMAIL_FROM');
      }
      const port = Number(process.env.SMTP_PORT) || 587;
      const auth =
        process.env.SMTP_USER && process.env.SMTP_PASSWORD
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined;
      this.smtpTransport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE === 'true', // true = implicit TLS (465); false = plaintext/STARTTLS (587, 25)
        auth,
        connectionTimeout: SEND_TIMEOUT_MS,
        greetingTimeout: SEND_TIMEOUT_MS,
        socketTimeout: SEND_TIMEOUT_MS,
      });
      this.provider = 'smtp';
    } else if (configured === '' || configured === 'console') {
      this.provider = 'console';
    } else {
      throw new Error(`Unsupported EMAIL_PROVIDER "${configured}" (use "resend", "smtp", or "console")`);
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

    if (this.provider === 'smtp') {
      await this.sendViaSmtp(to, subject, body);
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

  // Same never-throw, one-retry, domain-only-logging contract as the Resend branch above — a
  // relay outage looks identical to the caller either way.
  private async sendViaSmtp(to: string, subject: string, body: string): Promise<void> {
    const domain = to.split('@')[1] ?? 'unknown';
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await this.smtpTransport!.sendMail({ from: process.env.EMAIL_FROM, to, subject, text: body });
        return;
      } catch (err) {
        this.logger.warn(`SMTP send error (attempt ${attempt}) sending to ${domain}: ${(err as Error).message}`);
      }
    }
    this.logger.error(`Giving up sending an email to ${domain} after retries`);
  }
}
