import { ArgumentsHost, Catch, ConflictException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

// The status-lifecycle helpers (order/listing/withdrawal/coach/coaching-session) throw plain
// `Invalid*TransitionError`s for an illegal state change (e.g. cancelling a withdrawal that is
// already being processed). Left unhandled, Nest logs them as a 500; they are really a conflict
// with the resource's current state, so answer 409. Every other exception keeps Nest's default
// handling (HttpException passthrough, generic 500 + server-side log).
@Catch()
export class InvalidTransitionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof Error && /^Invalid.*TransitionError$/.test(exception.constructor.name)) {
      super.catch(new ConflictException(exception.message), host);
      return;
    }
    super.catch(exception, host);
  }
}
