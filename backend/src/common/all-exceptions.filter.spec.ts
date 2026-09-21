import { ConflictException, Logger } from '@nestjs/common';
import { WithdrawStatus } from '@wavehub/shared-types';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { InvalidWithdrawTransitionError } from '../withdrawals/withdraw-lifecycle';

describe('AllExceptionsFilter', () => {
  function run(exception: unknown) {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status, headersSent: false }), getRequest: () => ({ method: 'POST', path: '/x' }) }),
    } as any;
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    new AllExceptionsFilter().catch(exception, host);
    return { code: (status.mock.calls[0] as unknown[])[0], body: (json.mock.calls[0] as any[])[0] };
  }

  it('maps an Invalid*TransitionError to 409 with its message', () => {
    const { code, body } = run(new InvalidWithdrawTransitionError(WithdrawStatus.Completed, WithdrawStatus.Rejected));
    expect(code).toBe(409);
    expect(body.message).toContain('Cannot transition withdrawal');
  });

  it('keeps HttpExceptions and hides unknown error details behind a generic 500', () => {
    expect(run(new ConflictException('x')).code).toBe(409);
    const { code, body } = run(new Error('secret sql text'));
    expect(code).toBe(500);
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('maps a malformed-uuid Postgres error to 404', () => {
    expect(run(Object.assign(new Error('bad'), { code: '22P02' })).code).toBe(404);
  });
});
