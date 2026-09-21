import { ConflictException, Logger } from '@nestjs/common';
import { InvalidTransitionFilter } from './invalid-transition.filter';
import { InvalidWithdrawTransitionError } from './withdrawals/withdraw-lifecycle';
import { WithdrawStatus } from '@wavehub/shared-types';

describe('InvalidTransitionFilter', () => {
  function run(exception: unknown) {
    const reply = jest.fn();
    const filter = new InvalidTransitionFilter({ reply, isHeadersSent: () => false } as any);
    jest.spyOn(Logger, 'error').mockImplementation(() => undefined);
    filter.catch(exception, { getArgByIndex: () => ({}) } as any);
    return reply.mock.calls[0];
  }

  it('maps an Invalid*TransitionError to 409 with its message', () => {
    const [, body, status] = run(new InvalidWithdrawTransitionError(WithdrawStatus.Completed, WithdrawStatus.Rejected));
    expect(status).toBe(409);
    expect(body.message).toContain('Cannot transition withdrawal');
  });

  it('leaves HttpExceptions and unknown errors to Nest default handling', () => {
    expect(run(new ConflictException('x'))[2]).toBe(409);
    expect(run(new Error('boom'))[2]).toBe(500);
  });
});
