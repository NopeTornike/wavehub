import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AdminAuditService } from './admin-audit.service';
import { AdminGuard } from './admin-role.guard';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { AdminUsersController } from '../users/admin-users.controller';

// Imported by every module that has an admin-guarded route (ListingsModule, ReviewsModule,
// DisputesModule, WithdrawalsModule so far) — exports both AdminGuard (needs UsersService, hence
// importing UsersModule here) and AdminAuditService so callers don't each need their own wiring.
//
// AdminUsersController (user list/suspend/restore/ban/unban) is declared here rather than in
// UsersModule itself: it needs both AuthGuard and AdminGuard, and UsersModule can't import
// AuthModule or AdminModule without a circular dependency (both of those already import
// UsersModule for UsersService). AdminModule importing AuthModule + UsersModule directly has no
// such cycle, so this is where the controller lives — same file-location-vs-module-membership
// split as disputes/CLAUDE.md documents for a different reason.
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), UsersModule, AuthModule],
  controllers: [AdminUsersController],
  providers: [AdminGuard, AdminAuditService],
  exports: [AdminGuard, AdminAuditService],
})
export class AdminModule {}
