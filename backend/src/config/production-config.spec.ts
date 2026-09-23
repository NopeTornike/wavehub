import { assertProductionConfig, collectProductionConfigProblems } from './production-config';

const GOOD_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  JWT_SECRET: 'a'.repeat(16) + 'b'.repeat(16) + 'c1',
  KEY_ENCRYPTION_SECRET: 'f0e1d2c3b4a5968778695a4b3c2d1e0f'.repeat(2),
  DATABASE_HOST: 'postgres',
  DATABASE_PASSWORD: 'a-really-strong-db-password',
  FRONTEND_URL: 'https://example.com',
  BACKEND_PUBLIC_URL: 'https://example.com/api',
  CORS_ORIGIN: 'https://example.com',
  TRUST_PROXY: '1',
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_test',
  EMAIL_FROM: 'WaveHub <no-reply@example.com>',
};

describe('production config validation', () => {
  it('accepts a fully configured production environment', () => {
    expect(collectProductionConfigProblems(GOOD_ENV)).toEqual([]);
    expect(() => assertProductionConfig(GOOD_ENV)).not.toThrow();
  });

  it('does nothing outside production', () => {
    expect(() => assertProductionConfig({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertProductionConfig({})).not.toThrow();
  });

  it('throws listing every problem for an empty production env', () => {
    expect(() => assertProductionConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET[\s\S]*KEY_ENCRYPTION_SECRET[\s\S]*DATABASE_PASSWORD/);
  });

  it.each([
    ['JWT_SECRET', undefined],
    ['JWT_SECRET', 'short'],
    ['JWT_SECRET', 'wavehub-local-dev-secret-change-me'],
    ['JWT_SECRET', 'CHANGE_ME_generate_with_openssl_rand_hex_32'],
    ['DATABASE_PASSWORD', 'CHANGE_ME_generate_with_openssl_rand_hex_24'],
    ['KEY_ENCRYPTION_SECRET', undefined],
    ['KEY_ENCRYPTION_SECRET', 'not-hex'],
    ['KEY_ENCRYPTION_SECRET', '0'.repeat(64)],
    ['DATABASE_PASSWORD', 'wavehubpass'],
    ['DATABASE_PASSWORD', undefined],
    ['FRONTEND_URL', 'http://example.com'],
    ['BACKEND_PUBLIC_URL', 'http://localhost:4000'],
    ['CORS_ORIGIN', 'http://example.com'],
    ['CORS_ORIGIN', undefined],
    ['TRUST_PROXY', undefined],
    ['EMAIL_PROVIDER', undefined],
    ['EMAIL_PROVIDER', 'carrier-pigeon'],
    ['RESEND_API_KEY', undefined],
    ['TYPEORM_SYNC', 'true'],
    ['STORAGE_DRIVER', 'ftp'],
  ])('rejects %s = %s', (key, value) => {
    const env = { ...GOOD_ENV, [key]: value };
    expect(() => assertProductionConfig(env)).toThrow(/Refusing to start/);
  });

  it('allows an explicit EMAIL_PROVIDER=console opt-in', () => {
    expect(collectProductionConfigProblems({ ...GOOD_ENV, EMAIL_PROVIDER: 'console', RESEND_API_KEY: undefined })).toEqual([]);
  });

  it('requires SMTP_HOST and EMAIL_FROM when EMAIL_PROVIDER=smtp', () => {
    const problems = collectProductionConfigProblems({
      ...GOOD_ENV,
      EMAIL_PROVIDER: 'smtp',
      RESEND_API_KEY: undefined,
      EMAIL_FROM: undefined,
    });
    expect(problems.join('\n')).toMatch(/SMTP_HOST[\s\S]*EMAIL_FROM|EMAIL_FROM[\s\S]*SMTP_HOST/);
    expect(
      collectProductionConfigProblems({
        ...GOOD_ENV,
        EMAIL_PROVIDER: 'smtp',
        RESEND_API_KEY: undefined,
        SMTP_HOST: 'host.docker.internal',
        EMAIL_FROM: 'no-reply@example.com',
      }),
    ).toEqual([]);
  });

  it('requires the S3 settings when STORAGE_DRIVER=s3', () => {
    const problems = collectProductionConfigProblems({ ...GOOD_ENV, STORAGE_DRIVER: 's3' });
    expect(problems.join('\n')).toMatch(/S3_BUCKET[\s\S]*S3_ACCESS_KEY_ID[\s\S]*S3_SECRET_ACCESS_KEY[\s\S]*S3_PUBLIC_BASE_URL/);
    expect(
      collectProductionConfigProblems({
        ...GOOD_ENV,
        STORAGE_DRIVER: 's3',
        S3_BUCKET: 'b',
        S3_ACCESS_KEY_ID: 'k',
        S3_SECRET_ACCESS_KEY: 's',
        S3_PUBLIC_BASE_URL: 'https://cdn.example.com',
      }),
    ).toEqual([]);
  });
});
