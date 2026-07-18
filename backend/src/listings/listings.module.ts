import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from './listing.entity';
import { ListingImage } from './listing-image.entity';
import { ServiceDetails } from './service-details.entity';
import { ItemDetails } from './item-details.entity';
import { Package } from './package.entity';
import { Category } from './category.entity';
import { Game } from './game.entity';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, ListingImage, ServiceDetails, ItemDetails, Package, Category, Game]),
    StorageModule,
    AuthModule,
    AdminModule,
  ],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
