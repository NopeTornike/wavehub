import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';

// Separate from DisputesController (`@Controller('orders/:orderId/dispute')`) because this is a
// top-level, cross-order listing route (`GET /disputes`) that doesn't fit that nested path — same
// reasoning as why chat piggybacks on OrdersController but disputes got its own controller in the
// first place, just one level further: a genuinely different route shape gets a genuinely
// different controller. Viewing is intentionally not opened up to Operation Lead/Main
// Administrator yet even though their own CAN lists include "view all" disputes — their narrower
// review/prepare/escalate workflow isn't built (see disputes/CLAUDE.md), and `resolve` (the only
// other admin action here) is Super-Admin-only, so widening the list's visibility alone wouldn't
// let those roles do anything with it yet.
@Controller('disputes')
@UseGuards(AuthGuard, AdminGuard)
export class AdminDisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  @RequireAdminRole()
  listOpen() {
    return this.disputes.listOpen();
  }

  // Full thread (messages + evidence) for one dispute, no participant check — an admin reviewing
  // a case they're not a party to needs this before `resolve` (on DisputesController) can be an
  // informed decision rather than a blind action by orderId.
  @Get(':orderId')
  @RequireAdminRole()
  getOne(@Param('orderId') orderId: string) {
    return this.disputes.getForOrderAsAdmin(orderId);
  }
}
