import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AdminAuditService } from './admin-audit.service';
import { AdminGuard } from './admin-role.guard';
import { UsersModule } from '../users/users.module';

// Imported by every module that has an admin-guarded route (ListingsModule, ReviewsModule,
// DisputesModule so far) — exports both AdminGuard (needs UsersService, hence importing
// UsersModule here) and AdminAuditService so callers don't each need their own wiring.
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), UsersModule],
  providers: [AdminGuard, AdminAuditService],
  exports: [AdminGuard, AdminAuditService],
})
export class AdminModule {}
