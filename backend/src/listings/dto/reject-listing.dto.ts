import { IsString, Length } from 'class-validator';

export class RejectListingDto {
  @IsString()
  @Length(1, 1000)
  reason: string;
}
