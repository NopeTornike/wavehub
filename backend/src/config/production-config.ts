// Fail-closed boot check for NODE_ENV=production. Every dev-only default in this codebase (the
// insecure JWT secret, the all-zero key-encryption key, the well-known DB password, http:// URLs,
// TYPEORM_SYNC, a console-only email fallback) is fine locally and catastrophic in a real
// deployment, so in production each one must be replaced by a real value or the process refuses to
// start — a crash loop at deploy time is a much better failure than silently running with a
// guessable secret. Pure function of `env` so it's unit-testable without touching process.env.

const KNOWN_INSECURE_VALUES = new Set([
  'wavehub-local-dev-secret-change-me',
  'dev-only-insecure-secret-do-not-use-in-production',
  'changeme',
  'change-me',
  'secret',
  'wavehubpass',
  'e2e-test-jwt-secret',
]);

// The literal placeholders shipped in .env.production.example must never be accepted as real values.
const isPlaceholder = (value: string) => KNOWN_INSECURE_VALUES.has(value) || /change_?me/i.test(value);

export function collectProductionConfigProblems(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = [];
  const isHttps = (value: string | undefined) => !!value && /^https:\/\/[^\s/]+/.test(value);

  const jwt = env.JWT_SECRET;
  if (!jwt) problems.push('JWT_SECRET is not set');
  else if (jwt.length < 32) problems.push('JWT_SECRET must be at least 32 characters (use `openssl rand -hex 32`)');
  else if (isPlaceholder(jwt)) problems.push('JWT_SECRET is a known insecure placeholder');

  const keySecret = env.KEY_ENCRYPTION_SECRET;
  if (!keySecret) problems.push('KEY_ENCRYPTION_SECRET is not set');
  else if (!/^[0-9a-f]{64}$/i.test(keySecret)) problems.push('KEY_ENCRYPTION_SECRET must be 64 hex characters (`openssl rand -hex 32`)');
  else if (/^(.)\1{63}$/.test(keySecret) || keySecret === '0123456789abcdef'.repeat(4)) {
    problems.push('KEY_ENCRYPTION_SECRET is a known insecure placeholder');
  }

  if (!env.DATABASE_HOST) problems.push('DATABASE_HOST is not set');
  const dbPassword = env.DATABASE_PASSWORD;
  if (!dbPassword) problems.push('DATABASE_PASSWORD is not set');
  else if (dbPassword.length < 12 || isPlaceholder(dbPassword)) {
    problems.push('DATABASE_PASSWORD must be a strong secret (>= 12 chars, not the dev default)');
  }

  if (env.TYPEORM_SYNC === 'true') problems.push('TYPEORM_SYNC=true is forbidden in production — schema changes go through migrations');

  if (!isHttps(env.FRONTEND_URL)) problems.push('FRONTEND_URL must be an https:// URL');
  if (!isHttps(env.BACKEND_PUBLIC_URL)) problems.push('BACKEND_PUBLIC_URL must be an https:// URL');

  const origins = (env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
  if (origins.length === 0) problems.push('CORS_ORIGIN must be set to the public frontend origin(s)');
  else if (origins.some((o) => !isHttps(o))) problems.push('CORS_ORIGIN entries must all be https:// origins');

  if (!env.TRUST_PROXY) {
    problems.push('TRUST_PROXY must be set (e.g. 1) — the backend runs behind a reverse proxy and per-IP rate limits need the real client IP');
  }

  const emailProvider = (env.EMAIL_PROVIDER || '').toLowerCase();
  if (!emailProvider) {
    problems.push('EMAIL_PROVIDER must be set explicitly (resend, or console to knowingly disable real email)');
  } else if (emailProvider === 'resend') {
    if (!env.RESEND_API_KEY) problems.push('RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
    if (!env.EMAIL_FROM) problems.push('EMAIL_FROM is required when EMAIL_PROVIDER=resend');
  } else if (emailProvider !== 'console') {
    problems.push(`EMAIL_PROVIDER "${emailProvider}" is not supported (use resend or console)`);
  }

  const storageDriver = (env.STORAGE_DRIVER || 'local').toLowerCase();
  if (storageDriver === 's3') {
    for (const name of ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL']) {
      if (!env[name]) problems.push(`${name} is required when STORAGE_DRIVER=s3`);
    }
    if (env.S3_PUBLIC_BASE_URL && !isHttps(env.S3_PUBLIC_BASE_URL)) problems.push('S3_PUBLIC_BASE_URL must be https://');
  } else if (storageDriver !== 'local') {
    problems.push(`STORAGE_DRIVER "${storageDriver}" is not supported (use local or s3)`);
  }

  return problems;
}

export function assertProductionConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  const problems = collectProductionConfigProblems(env);
  if (problems.length > 0) {
    throw new Error(
      `Refusing to start in production with unsafe/missing configuration:\n  - ${problems.join('\n  - ')}\n` +
        'See .env.production.example and docs/DEPLOY.md.',
    );
  }
}
