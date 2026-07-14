import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true makes `request.rawBody` available on every request — required by
  // POST /payments/bog/callback to verify BOG's signature over the exact bytes it sent, before
  // the body gets parsed into a JS object. See backend/src/payments/bog-signature.util.ts.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.use(cookieParser());
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
