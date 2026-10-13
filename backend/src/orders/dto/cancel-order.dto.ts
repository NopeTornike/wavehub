import { IsString, Length } from 'class-validator';

export class CancelOrderDto {
  @IsString()
  @Length(1, 1000)
  reason: string;
}
