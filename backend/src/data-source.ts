// Must be the first import — see main.ts's identical note. Populates process.env from
// backend/.env before this file reads DATABASE_HOST/etc below.
import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './users/user.entity';
import { EmailVerificationToken } from './auth/email-verification-token.entity';
import { PasswordResetToken } from './auth/password-reset-token.entity';
import { WalletLedgerEntry } from './wallet/wallet-ledger-entry.entity';
import { BogTopupIntent } from './payments/bog-topup-intent.entity';
import { Listing } from './listings/listing.entity';
import { ListingImage } from './listings/listing-image.entity';
import { ServiceDetails } from './listings/service-details.entity';
import { ItemDetails } from './listings/item-details.entity';
import { Package } from './listings/package.entity';
import { Category } from './listings/category.entity';
import { Game } from './listings/game.entity';
import { Order } from './orders/order.entity';
import { OrderDeliveryFile } from './orders/order-delivery-file.entity';
import { Review } from './reviews/review.entity';
import { ReviewReport } from './reviews/review-report.entity';

// Used by the TypeORM CLI (migration:generate / migration:run / migration:revert — see
// package.json scripts) and, in future phases, by tests that need a real DB connection outside
// of Nest's DI container. Keep the entity list here in sync with app.module.ts — Nest's
// TypeOrmModule.forRoot() call is the one the running app actually uses; this DataSource exists
// for the CLI only.
// The TypeORM CLI (typeorm-ts-node-commonjs) requires this file to have exactly one export —
// don't add a second named export alongside this one, even if it points at the same instance.
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
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
    Order,
    OrderDeliveryFile,
    Review,
    ReviewReport,
  ],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});

export default AppDataSource;
