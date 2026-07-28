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
import { UsersModule } from '../users/users.module';
import { UsersController } from '../users/users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, ListingImage, ServiceDetails, ItemDetails, Package, Category, Game]),
    StorageModule,
    AuthModule,
    AdminModule,
    UsersModule,
  ],
  // UsersController (public GET /users/:username) is declared here rather than in UsersModule
  // itself — it needs both UsersService and ListingsService, and UsersModule must stay a leaf
  // module (see users.module.ts's own comment) since AuthModule already imports it.
  controllers: [ListingsController, UsersController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
