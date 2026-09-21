import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

// Postgres SQLSTATEs that mean "the client sent something the column type can't hold" — not a server
// fault. Notably 22P02 is what a malformed uuid path param (`GET /orders/not-a-uuid`) produces:
// without this it surfaced as a 500 (and logged a stack per probe).
const PG_INVALID_TEXT_REPRESENTATION = '22P02';
const PG_CLIENT_DATA_ERRORS = new Set(['22003', '22001', '22007', '22008']);

// Global filter. Guarantees an API client only ever sees `{ statusCode, message }` — never a stack,
// SQL text, or driver error details (root CLAUDE.md: don't forward upstream/internal errors). Known
// HttpExceptions keep their own status/body exactly as Nest would render them; everything else is
// logged server-side (with the request id) and answered with a generic 500.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request & { requestId?: string }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }

    const code = (exception as { code?: string } | null)?.code;
    if (code === PG_INVALID_TEXT_REPRESENTATION) {
      res.status(HttpStatus.NOT_FOUND).json({ statusCode: 404, message: 'Not found' });
      return;
    }
    if (code && PG_CLIENT_DATA_ERRORS.has(code)) {
      res.status(HttpStatus.BAD_REQUEST).json({ statusCode: 400, message: 'Invalid request' });
      return;
    }

    // Errors raised by Express middleware that carry their own 4xx (e.g. body-parser's
    // "request entity too large" / malformed JSON) — keep the status, generic message.
    const status = (exception as { status?: number; statusCode?: number } | null)?.status ??
      (exception as { statusCode?: number } | null)?.statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      res.status(status).json({ statusCode: status, message: status === 413 ? 'Payload too large' : 'Bad request' });
      return;
    }

    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(`[${req.requestId ?? '-'}] ${req.method} ${req.path} failed: ${err.message}`, err.stack);
    if (!res.headersSent) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'Internal server error' });
    }
  }
}
