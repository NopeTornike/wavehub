import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { PaymentsModule } from './payments/payments.module';
import { UsersModule } from './users/users.module';
import { User } from './users/user.entity';
import { EmailVerificationToken } from './auth/email-verification-token.entity';
import { PasswordResetToken } from './auth/password-reset-token.entity';

// Postgres is mandatory from Phase 1 onward — the JSON-file fallback that used to make this
// conditional (USE_FILE_STORE) was removed along with AuthService's dual-mode logic. See
// backend/src/auth/CLAUDE.md for why.
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT) || 5432,
      username: process.env.DATABASE_USER || 'wavehub',
      password: process.env.DATABASE_PASSWORD || 'wavehubpass',
      database: process.env.DATABASE_NAME || 'wavehubdb',
      entities: [User, EmailVerificationToken, PasswordResetToken],
      synchronize: process.env.TYPEORM_SYNC === 'true',
    }),
    UsersModule,
    AuthModule,
    PaymentsModule,
  ],
})
export class AppModule {}
