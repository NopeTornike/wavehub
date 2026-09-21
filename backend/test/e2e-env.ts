import { tmpdir } from 'os';
import { join } from 'path';

export const TEST_DB_NAME = process.env.E2E_DATABASE_NAME || 'wavehubdb_test';

// Applied both in globalSetup (for the migration child process) and setupFiles (for the app).
export function applyE2eEnv(): void {
  process.env.DATABASE_NAME = TEST_DB_NAME;
  process.env.JWT_SECRET = 'e2e-test-jwt-secret';
  process.env.KEY_ENCRYPTION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  // Lets each test client present its own X-Forwarded-For so the per-IP auth throttles (5/60s)
  // never trip across the many users the suite registers. Test-only.
  process.env.TRUST_PROXY = 'true';
  process.env.NODE_ENV = 'test';
  process.env.UPLOADS_DIR = join(tmpdir(), 'wavehub-e2e-uploads');
  process.env.BACKEND_PUBLIC_URL = 'http://localhost:4000';
  process.env.FRONTEND_URL = 'http://localhost:3000';
}
