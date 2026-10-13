import { IsString, Length } from 'class-validator';

export class RejectCoachDto {
  @IsString()
  @Length(1, 1000)
  reason: string;
}
