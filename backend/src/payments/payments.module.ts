import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BogPaymentsController } from './bog-payments.controller';
import { BogPaymentsService } from './bog-payments.service';
import { BogTopupIntent } from './bog-topup-intent.entity';
import { UsersModule } from '../users/users.module';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([BogTopupIntent]), UsersModule, WalletModule, AuthModule],
  controllers: [BogPaymentsController],
  providers: [BogPaymentsService],
  // BogPaymentsService is reused by backend/src/subscriptions/ for its own checkout/save-card/
  // recharge calls — one-directional import (subscriptions → payments), same shape as
  // orders → chat/wallet elsewhere in this codebase, so this module never needs to know
  // subscriptions exist.
  exports: [BogPaymentsService],
})
export class PaymentsModule {}
