// Must be the first import: populates process.env from backend/.env before anything else
// (notably auth.module.ts, imported transitively via AppModule below) reads it at module-eval
// time. Never overrides a variable already set in the real environment (Docker Compose, a real
// deployment's env injection, etc.) — see backend/CLAUDE.md's "Local dev" note for why this file
// previously did nothing outside Docker despite the README instructing you to create it.
import 'dotenv/config';
// Second: in NODE_ENV=production, refuses to boot on any unsafe/missing config (dev secrets,
// http:// URLs, TYPEORM_SYNC...) with one complete list — before AppModule's own module-level
// checks can throw piecemeal. See config/production-config.ts.
import './config/boot-check';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  // rawBody: true makes `request.rawBody` available on every request — required by
  // POST /payments/bog/callback to verify BOG's signature over the exact bytes it sent, before
  // the body gets parsed into a JS object. See backend/src/payments/bog-signature.util.ts.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  configureApp(app);
  // SIGTERM/SIGINT (docker stop, systemd) => Nest stops accepting connections, lets in-flight
  // requests finish, then closes the DB pool, instead of being killed mid-transaction.
  app.enableShutdownHooks();

  const port = process.env.PORT || 4000;
  await app.listen(port);
  new Logger('Bootstrap').log(`Backend listening on port ${port} (NODE_ENV=${process.env.NODE_ENV ?? 'unset'})`);
}
bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
