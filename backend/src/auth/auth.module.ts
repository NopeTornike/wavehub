import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { SessionService } from './session.service';
import { EmailVerificationToken } from './email-verification-token.entity';
import { PasswordResetToken } from './password-reset-token.entity';
import { User } from '../users/user.entity';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';

// JWT_SECRET is required in production and falls back to an insecure dev-only default locally
// (loudly logged) so `npm run start:dev`/CI don't need it configured just to boot. Never let this
// fallback silently reach a real deployment — see the throw below.
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}
if (!jwtSecret) {
  // eslint-disable-next-line no-console
  console.warn('[auth] JWT_SECRET is not set — using an insecure development-only default.');
}

@Module({
  imports: [
    TypeOrmModule.forFeature([User, EmailVerificationToken, PasswordResetToken]),
    JwtModule.register({ secret: jwtSecret || 'dev-only-insecure-secret-do-not-use-in-production' }),
    EmailModule,
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionService, AuthGuard],
  exports: [AuthGuard, SessionService],
})
export class AuthModule {}
