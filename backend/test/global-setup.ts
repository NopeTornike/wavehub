import 'dotenv/config';
import { execSync } from 'child_process';
import { Client } from 'pg';
import { applyE2eEnv, TEST_DB_NAME } from './e2e-env';

// Drops and recreates the test database, then runs every real migration against it — so the suite
// exercises the actual schema (including partial unique indexes etc.), never `synchronize`.
export default async function globalSetup(): Promise<void> {
  const admin = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 5432,
    user: process.env.DATABASE_USER || 'wavehub',
    password: process.env.DATABASE_PASSWORD || 'wavehubpass',
    database: 'postgres',
  });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  await admin.end();

  applyE2eEnv();
  execSync('npx typeorm-ts-node-commonjs -d src/data-source.ts migration:run', {
    cwd: `${__dirname}/..`,
    env: process.env,
    stdio: 'pipe',
  });
}
