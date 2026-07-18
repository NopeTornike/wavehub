import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispute } from './dispute.entity';
import { DisputeMessage } from './dispute-message.entity';
import { DisputeEvidence } from './dispute-evidence.entity';
import { Order } from '../orders/order.entity';
import { Listing } from '../listings/listing.entity';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { WalletModule } from '../wallet/wallet.module';
import { StorageModule } from '../storage/storage.module';
import { ChatModule } from '../chat/chat.module';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dispute, DisputeMessage, DisputeEvidence, Order, Listing]),
    WalletModule,
    StorageModule,
    ChatModule,
    AuthModule,
    AdminModule,
  ],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
