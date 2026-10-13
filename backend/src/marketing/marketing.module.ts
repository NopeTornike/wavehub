import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromoCode, PromoRedemption } from './promo-code.entity';
import { Banner } from './banner.entity';
import { MarketingService } from './marketing.service';
import { MarketingController } from './marketing.controller';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { WalletModule } from '../wallet/wallet.module';
import { StorageModule } from '../storage/storage.module';

// Promo codes (spendable WaveCoin credit) and homepage banners — see marketing/CLAUDE.md.
@Module({
  imports: [TypeOrmModule.forFeature([PromoCode, PromoRedemption, Banner]), AuthModule, AdminModule, WalletModule, StorageModule],
  controllers: [MarketingController],
  providers: [MarketingService],
})
export class MarketingModule {}
