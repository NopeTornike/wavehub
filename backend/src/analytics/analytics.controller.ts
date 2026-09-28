import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRangeDto } from './dto/analytics-range.dto';

// Super Admin only: `@RequireAdminRole()` with no roles admits nobody but Super Admin (AdminGuard).
// Read-only, so nothing to audit-log.
@Controller('admin/analytics')
@UseGuards(AuthGuard, AdminGuard)
@RequireAdminRole()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  get(@Query() range: AnalyticsRangeDto) {
    return this.analytics.get(range.from, range.to);
  }
}
