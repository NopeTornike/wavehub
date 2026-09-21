import { IsString, Length } from 'class-validator';

export class RevokeSubscriptionDto {
  @IsString()
  @Length(3, 500)
  reason: string;
}
