import { IsObject, IsOptional, IsUUID } from 'class-validator';

export class PurchaseOrderDto {
  @IsUUID()
  listingId: string;

  // Required for service listings, ignored for item listings — validated imperatively in
  // OrdersService, not here, matching the pattern in listings/dto/create-listing.dto.ts.
  @IsOptional()
  @IsUUID()
  packageId?: string;

  @IsOptional()
  @IsObject()
  requirementsAnswers?: Record<string, unknown>;
}
