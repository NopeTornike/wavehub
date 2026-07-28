import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';

// Deliberately no controller here and no other module imports — this stays a leaf module
// (mirrors the reasoning in backend/src/admin/admin.module.ts's own comment: AuthModule already
// imports UsersModule, so UsersModule importing anything that itself imports AuthModule — like
// ListingsModule — would be circular). The public profile controller that needs both
// UsersService and ListingsService lives in ListingsModule instead — see
// backend/src/listings/listings.module.ts.
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
