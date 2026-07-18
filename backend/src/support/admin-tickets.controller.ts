import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AdminRole, TicketPriority, TicketStatus } from '@wavehub/shared-types';
import { SupportService } from './support.service';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';

class ListTicketsQueryDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}

// View/list roles — every role section whose CAN list includes "Support Tickets"/"Support
// Management" at all: Super Admin (implicit bypass, §5.13.1), Operation Lead ("Support Team
// Management", §5.13.2), Main Administrator ("Support Management", §5.13.3), Support Specialist
// (§5.13.6, its whole reason for existing). Marketplace & Coaching Ops Manager and Trust & Safety
// Officer's sections don't mention tickets at all.
const TICKET_VIEW_ROLES = [AdminRole.OperationLead, AdminRole.MainAdministrator, AdminRole.SupportSpecialist];

// Reply/internal-note roles — narrower than view: Operation Lead's CAN list is "view all,
// redistribute, change priority, SLA control, close ticket, evaluate performance" — it does NOT
// say "reply", unlike every other role with ticket access. Taken literally per this repo's
// "explicit lists, not role-name inference" discipline (see backend/src/admin/CLAUDE.md).
const TICKET_REPLY_ROLES = [AdminRole.MainAdministrator, AdminRole.SupportSpecialist];

@Controller('admin/tickets')
@UseGuards(AuthGuard, AdminGuard)
export class AdminTicketsController {
  constructor(
    private readonly support: SupportService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  @RequireAdminRole(...TICKET_VIEW_ROLES)
  list(@Query() query: ListTicketsQueryDto) {
    return this.support.listAll(query);
  }

  @Get(':id')
  @RequireAdminRole(...TICKET_VIEW_ROLES)
  getOne(@Param('id') id: string) {
    return this.support.getForAdmin(id);
  }

  @Post(':id/reply')
  @RequireAdminRole(...TICKET_REPLY_ROLES)
  async reply(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id') id: string,
    @Body() dto: ReplyTicketDto,
  ) {
    const ticket = await this.support.staffReply(adminId, id, dto.body);
    await this.audit.log({ adminId, adminRole, action: 'ticket.reply', entityType: 'ticket', entityId: id });
    return ticket;
  }

  @Post(':id/internal-note')
  @RequireAdminRole(...TICKET_REPLY_ROLES)
  async internalNote(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id') id: string,
    @Body() dto: ReplyTicketDto,
  ) {
    const ticket = await this.support.addInternalNote(adminId, id, dto.body);
    await this.audit.log({ adminId, adminRole, action: 'ticket.internal_note', entityType: 'ticket', entityId: id });
    return ticket;
  }

  // Status/priority/assignment — Operation Lead is allowed here (unlike reply/internal-note
  // above) per its explicit "redistribute, change priority, close ticket" CAN list.
  @Post(':id/update')
  @HttpCode(HttpStatus.OK)
  @RequireAdminRole(AdminRole.OperationLead, AdminRole.MainAdministrator, AdminRole.SupportSpecialist)
  async update(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    const ticket = await this.support.updateTicket(id, dto);
    await this.audit.log({
      adminId,
      adminRole,
      action: 'ticket.update',
      entityType: 'ticket',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });
    return ticket;
  }
}

// Separate controller (own top-level path, `admin/saved-replies`) rather than nesting under
// `admin/tickets/:id` — `admin/tickets/saved-replies` would collide with the `:id` route above
// (same one-segment-path Express-registration-order gotcha as
// `backend/src/listings/CLAUDE.md`'s `pending-review` note), so this gets its own controller
// instead of relying on careful ordering within one.
@Controller('admin/saved-replies')
@UseGuards(AuthGuard, AdminGuard)
export class AdminSavedRepliesController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @RequireAdminRole(AdminRole.OperationLead, AdminRole.MainAdministrator, AdminRole.SupportSpecialist)
  list() {
    return this.support.listSavedReplies();
  }
}
