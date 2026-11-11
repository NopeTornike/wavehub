import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { ORDER_STAFF_ROLES, OrdersService } from './orders.service';

// Admin → Orders (owner 2026-11-10): every order with buyer, seller and listing, newest first, so
// staff can see what sold and contact the seller. Read-only — no action here moves money.
@Controller('admin/orders')
@UseGuards(AuthGuard, AdminGuard)
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequireAdminRole(...ORDER_STAFF_ROLES)
  list(@Query('status') status?: string, @Query('q') q?: string, @Query('page') page?: string) {
    const p = Math.max(1, Math.min(10_000, Number(page) || 1));
    return this.orders.adminList({ status, q, limit: 30, offset: (p - 1) * 30 });
  }
}
