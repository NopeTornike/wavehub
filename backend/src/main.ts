// Must be the first import: populates process.env from backend/.env before anything else
// (notably auth.module.ts, imported transitively via AppModule below) reads it at module-eval
// time. Never overrides a variable already set in the real environment (Docker Compose, a real
// deployment's env injection, etc.) — see backend/CLAUDE.md's "Local dev" note for why this file
// previously did nothing outside Docker despite the README instructing you to create it.
import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
// Named import of `default`, not a default/namespace import — helmet's CJS type declarations use
// `export { helmet as default }` (ESM-style), which needs esModuleInterop for a true default
// import; this codebase deliberately doesn't enable that (see tsconfig.json), so import the named
// `default` binding explicitly instead.
import { default as helmet } from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true makes `request.rawBody` available on every request — required by
  // POST /payments/bog/callback to verify BOG's signature over the exact bytes it sent, before
  // the body gets parsed into a JS object. See backend/src/payments/bog-signature.util.ts.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Only trust X-Forwarded-* headers when explicitly told there's a real proxy in front (e.g. a
  // load balancer/CDN in production) — trusting them by default would let any client spoof its own
  // IP address via the header, which would silently defeat rate limiting (see ThrottlerModule in
  // app.module.ts) and corrupt secure-cookie detection. Set TRUST_PROXY=1 only when this is
  // actually deployed behind such a proxy.
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
  }

  // helmet's default Cross-Origin-Resource-Policy is 'same-origin', which silently blocks the
  // frontend (a different origin — see CORS_ORIGIN below) from loading anything under /uploads
  // (listing images, coach photos, tournament covers, delivery files) as an <img>/background-image
  // — the browser drops the response with ERR_BLOCKED_BY_RESPONSE.NotSameOrigin instead of a CORS
  // error, so it's easy to miss outside an actual browser check. Relaxed to 'cross-origin' since
  // this app's frontend/backend are deliberately cross-origin (found 2026-09-16 verifying the new
  // tournament cover-image feature in a real browser — see LAUNCH_PLAN.md).
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  // Serves whatever StorageService.save() wrote to disk (backend/src/storage/) — a stand-in for
  // real object storage. See backend/src/storage/CLAUDE.md for why this doesn't survive redeploys
  // or work with more than one instance.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const localOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      if (process.env.NODE_ENV !== 'production' && origin === 'null') {
        callback(null, true);
        return;
      }

      if (process.env.NODE_ENV !== 'production' && localOriginPattern.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}
bootstrap();
