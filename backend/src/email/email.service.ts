import { Injectable, Logger } from '@nestjs/common';

// Deliberately minimal placeholder — no real transactional email provider is chosen yet (that's an
// open item for Phase 9 of the build plan: Resend vs Postmark vs SES, a product/cost decision, not
// an engineering one). This logs instead of sending. When a provider is picked, replace the body of
// `send()` with a real API call — every call site here already goes through this one method, so
// nothing else needs to change.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async send(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`[dev email stub] to=${to} subject="${subject}"\n${body}`);
  }
}
