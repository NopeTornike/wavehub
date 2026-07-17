import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderDeliveryFile } from './order-delivery-file.entity';
import { Listing } from '../listings/listing.entity';
import { Package } from '../listings/package.entity';
import { ServiceDetails } from '../listings/service-details.entity';
import { ItemDetails } from '../listings/item-details.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { WalletModule } from '../wallet/wallet.module';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderDeliveryFile, Listing, Package, ServiceDetails, ItemDetails]),
    WalletModule,
    StorageModule,
    AuthModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
