import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AdminAuditService } from './admin-audit.service';
import { AdminGuard } from './admin-role.guard';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { AdminUsersController } from '../users/admin-users.controller';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformSettings } from '../settings/platform-settings.entity';
import { PlatformSettingsService } from '../settings/platform-settings.service';

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
// PlatformSettingsService is provided here too (not exported) so AdminUsersController can read the
// Super-Admin-controlled Support permissions: SettingsModule already imports AdminModule, so
// importing SettingsModule back would be circular. This instance only reads; its in-memory
// maintenance cache is never consulted.
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, PlatformSettings]), UsersModule, AuthModule, WalletModule, NotificationsModule],
  controllers: [AdminUsersController],
  providers: [AdminGuard, AdminAuditService, PlatformSettingsService],
  exports: [AdminGuard, AdminAuditService],
})
export class AdminModule {}
