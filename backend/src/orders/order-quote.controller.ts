import { Controller, Get, Query } from '@nestjs/common';
import { IsOptional, IsUUID } from 'class-validator';
import { OrdersService } from './orders.service';

class QuoteDto {
  @IsUUID()
  listingId: string;

  @IsOptional()
  @IsUUID()
  packageId?: string;
}

// Public price breakdown before buying (price + the buyer's marketplace fee = total). Separate from
// OrdersController, whose routes are all AuthGuard-protected.
@Controller('order-quote')
export class OrderQuoteController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  quote(@Query() dto: QuoteDto) {
    return this.orders.quote(dto.listingId, dto.packageId);
  }
}
