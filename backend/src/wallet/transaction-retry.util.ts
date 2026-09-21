// Postgres SQLSTATEs that mean "the database rolled this transaction back for a transient
// concurrency reason; running it again from the top is safe and expected to succeed":
//   40P01 deadlock_detected, 40001 serialization_failure.
const RETRYABLE_SQLSTATES = new Set(['40P01', '40001']);

export const DEFAULT_TRANSACTION_ATTEMPTS = 4;

export function isRetryableTransactionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const e = err as { code?: unknown; driverError?: { code?: unknown } };
  // TypeORM wraps driver errors in QueryFailedError, exposing the pg error as `driverError`
  // (and copying `code` onto the wrapper) — check both.
  const code = e.driverError?.code ?? e.code;
  return typeof code === 'string' && RETRYABLE_SQLSTATES.has(code);
}

// Runs a whole transaction callback, re-running it (a brand-new transaction each time) if Postgres
// aborts it with a deadlock/serialization failure. Only wrap functions whose entire effect lives
// inside the DB transaction: on retry the callback is executed again from scratch, so it must not
// perform external side effects (emails, notifications, HTTP calls) before the transaction
// commits. Non-retryable errors (including business errors like INSUFFICIENT_BALANCE) propagate
// immediately, untouched. After `attempts` failures the last error is rethrown.
export async function withTransactionRetry<T>(
  fn: () => Promise<T>,
  attempts: number = DEFAULT_TRANSACTION_ATTEMPTS,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryableTransactionError(err) || attempt === attempts) {
        throw err;
      }
      lastError = err;
      // Small jittered backoff so the transactions that just deadlocked don't collide again in
      // lockstep.
      await sleep(10 * attempt + Math.floor(Math.random() * 20));
    }
  }
  throw lastError;
}
