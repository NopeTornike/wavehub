import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
// Named import of `default`, not a default/namespace import — helmet's CJS type declarations use
// `export { helmet as default }` (ESM-style), which needs esModuleInterop for a true default
// import; this codebase deliberately doesn't enable that (see tsconfig.json), so import the named
// `default` binding explicitly instead.
import { default as helmet } from 'helmet';
import { extname } from 'path';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { requestLogger } from './common/request-logger.middleware';
import { resolveUploadsDir } from './storage/storage.service';

const INLINE_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const LOCAL_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

// Everything that isn't the listen() call, shared by main.ts and the e2e harness (backend/test/
// helpers.ts) so tests exercise the same middleware/pipes/filters the real process runs.
export function configureApp(app: NestExpressApplication): void {
  // Only trust X-Forwarded-* headers when explicitly told there's a real proxy in front (e.g. Caddy
  // in docker-compose.yml) — trusting them by default would let any client spoof its own IP address
  // via the header, which would silently defeat rate limiting (see ThrottlerModule in
  // app.module.ts) and corrupt secure-cookie detection. Production requires it (production-
  // config.ts); `1` = exactly one proxy hop.
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
  }

  app.use(requestLogger());

  // helmet's default Cross-Origin-Resource-Policy is 'same-origin', which silently blocks a
  // cross-origin frontend from loading anything under /uploads as an <img>/background-image (the
  // browser drops it with ERR_BLOCKED_BY_RESPONSE.NotSameOrigin, not a CORS error). Relaxed to
  // 'cross-origin' since uploads are public images by design.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  // Local-driver uploads (see backend/src/storage/CLAUDE.md). Hardened because these files are
  // attacker-supplied and served from the API's own origin: nosniff so a browser never reinterprets
  // a body's type, a locked-down CSP (`sandbox` neuters any script even if something did render),
  // and non-image files (PDF/ZIP) forced to download rather than render inline. StorageService only
  // ever writes sniffed jpg/png/webp/pdf/zip under random names, so this is defence in depth.
  app.useStaticAssets(resolveUploadsDir(), {
    prefix: '/uploads',
    index: false,
    dotfiles: 'deny',
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      if (!INLINE_IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase())) {
        res.setHeader('Content-Disposition', 'attachment');
      }
    },
  });

  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isProduction = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: (origin, callback) => {
      // No Origin header = not a browser cross-origin request (curl, server-to-server webhooks).
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      // Dev conveniences (file:// pages send Origin: null; any localhost port) — never in production.
      if (!isProduction && (origin === 'null' || LOCAL_ORIGIN_PATTERN.test(origin))) return callback(null, true);
      // Reject by omitting CORS headers — NOT `callback(new Error(...))`, which surfaced as a 500
      // with a logged stack for every disallowed-origin request.
      return callback(null, false);
    },
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
}
