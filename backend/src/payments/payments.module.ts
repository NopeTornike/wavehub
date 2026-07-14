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
})
export class PaymentsModule {}
