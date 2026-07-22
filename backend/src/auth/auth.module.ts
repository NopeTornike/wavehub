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
  // Re-exports UsersModule (not just AuthGuard/SessionService) — AuthGuard's constructor needs
  // UsersService (added when it started checking suspended/banned status per-request, see
  // auth.guard.ts), and a module that only imports AuthModule needs that dependency visible too.
  // Without this, every single consumer of AuthGuard (Notifications, Settings, Listings, Orders,
  // Reviews, Disputes, Withdrawals, Support, Coaching, ...) would need to separately import
  // UsersModule just to satisfy AuthGuard's own dependency graph — re-exporting it here once is
  // the actual fix, not a per-module workaround. Caught by booting against a real Postgres for
  // the first time (previous "verification" was unit tests only, which fake the DI container).
  exports: [AuthGuard, SessionService, UsersModule],
})
export class AuthModule {}
