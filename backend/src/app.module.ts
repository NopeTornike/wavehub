import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { PaymentsModule } from './payments/payments.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';
import { User } from './users/user.entity';
import { EmailVerificationToken } from './auth/email-verification-token.entity';
import { PasswordResetToken } from './auth/password-reset-token.entity';
import { WalletLedgerEntry } from './wallet/wallet-ledger-entry.entity';
import { BogTopupIntent } from './payments/bog-topup-intent.entity';
import { ListingsModule } from './listings/listings.module';
import { Listing } from './listings/listing.entity';
import { ListingImage } from './listings/listing-image.entity';
import { ServiceDetails } from './listings/service-details.entity';
import { ItemDetails } from './listings/item-details.entity';
import { Package } from './listings/package.entity';
import { Category } from './listings/category.entity';
import { Game } from './listings/game.entity';

// Postgres is mandatory from Phase 1 onward — the JSON-file fallback that used to make this
// conditional (USE_FILE_STORE) was removed along with AuthService's dual-mode logic. See
// backend/src/auth/CLAUDE.md for why.
@Module({
  imports: [
    // Global default: 100 requests / 60s per IP. Individual auth-sensitive endpoints override this
    // with a much stricter limit via @Throttle() — see auth.controller.ts and
    // bog-payments.controller.ts. Keying is by IP (ThrottlerGuard's default), which only reflects
    // the real client IP if TRUST_PROXY is configured correctly in a real deployment — see main.ts.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT) || 5432,
      username: process.env.DATABASE_USER || 'wavehub',
      password: process.env.DATABASE_PASSWORD || 'wavehubpass',
      database: process.env.DATABASE_NAME || 'wavehubdb',
      entities: [
        User,
        EmailVerificationToken,
        PasswordResetToken,
        WalletLedgerEntry,
        BogTopupIntent,
        Listing,
        ListingImage,
        ServiceDetails,
        ItemDetails,
        Package,
        Category,
        Game,
      ],
      synchronize: process.env.TYPEORM_SYNC === 'true',
    }),
    UsersModule,
    AuthModule,
    WalletModule,
    PaymentsModule,
    ListingsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
