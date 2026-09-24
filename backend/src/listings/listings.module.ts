import { ProfilesModule } from '../profiles/profiles.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from './listing.entity';
import { ListingImage } from './listing-image.entity';
import { ServiceDetails } from './service-details.entity';
import { ItemDetails } from './item-details.entity';
import { ListingKeyInventory } from './listing-key-inventory.entity';
import { Package } from './package.entity';
import { Category } from './category.entity';
import { Game } from './game.entity';
import { ListingFavorite } from './listing-favorite.entity';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { UsersModule } from '../users/users.module';
import { UsersController } from '../users/users.controller';
import { ProfileController } from '../users/profile.controller';
import { User } from '../users/user.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    ProfilesModule,
    TypeOrmModule.forFeature([
      Listing,
      ListingImage,
      ServiceDetails,
      ItemDetails,
      ListingKeyInventory,
      Package,
      Category,
      Game,
      ListingFavorite,
      User,
    ]),
    StorageModule,
    AuthModule,
    AdminModule,
    UsersModule,
    SubscriptionsModule,
  ],
  // UsersController (public GET /users/:username) is declared here rather than in UsersModule
  // itself — it needs both UsersService and ListingsService, and UsersModule must stay a leaf
  // module (see users.module.ts's own comment) since AuthModule already imports it.
  controllers: [ListingsController, UsersController, ProfileController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
