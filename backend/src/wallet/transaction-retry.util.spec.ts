import { isRetryableTransactionError, withTransactionRetry } from './transaction-retry.util';

const noSleep = async () => undefined;
const pgError = (code: string) => Object.assign(new Error('pg'), { driverError: { code } });

describe('isRetryableTransactionError', () => {
  it('recognises deadlock and serialization SQLSTATEs, wrapped or bare', () => {
    expect(isRetryableTransactionError(pgError('40P01'))).toBe(true);
    expect(isRetryableTransactionError(pgError('40001'))).toBe(true);
    expect(isRetryableTransactionError(Object.assign(new Error('x'), { code: '40P01' }))).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isRetryableTransactionError(pgError('23505'))).toBe(false);
    expect(isRetryableTransactionError(new Error('INSUFFICIENT_BALANCE'))).toBe(false);
    expect(isRetryableTransactionError(null)).toBe(false);
    expect(isRetryableTransactionError('40P01')).toBe(false);
  });
});

describe('withTransactionRetry', () => {
  it('returns immediately on success without retrying', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(withTransactionRetry(fn, 3, noSleep)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a deadlock and returns the eventual result', async () => {
    const fn = jest.fn().mockRejectedValueOnce(pgError('40P01')).mockRejectedValueOnce(pgError('40001')).mockResolvedValue('ok');
    await expect(withTransactionRetry(fn, 4, noSleep)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('gives up after the bounded number of attempts and rethrows the deadlock', async () => {
    const err = pgError('40P01');
    const fn = jest.fn().mockRejectedValue(err);
    await expect(withTransactionRetry(fn, 3, noSleep)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('never retries business errors', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('INSUFFICIENT_BALANCE'));
    await expect(withTransactionRetry(fn, 4, noSleep)).rejects.toThrow('INSUFFICIENT_BALANCE');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
