import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { TicketCategory } from '@wavehub/shared-types';

export class CreateTicketDto {
  @IsString()
  @Length(3, 200)
  subject: string;

  @IsEnum(TicketCategory)
  category: TicketCategory;

  @IsString()
  @Length(1, 5000)
  description: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}
