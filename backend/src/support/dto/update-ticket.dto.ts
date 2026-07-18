import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TicketPriority, TicketStatus } from '@wavehub/shared-types';

// All fields optional — a partial update. At least one should be present in practice, but the
// service doesn't reject an empty patch (harmless no-op, not worth a dedicated validation rule).
export class UpdateTicketDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  // Pass an explicit `null` (not omit the field) to unassign — see SupportService#updateTicket.
  @IsOptional()
  @IsUUID()
  assignedToId?: string | null;
}
