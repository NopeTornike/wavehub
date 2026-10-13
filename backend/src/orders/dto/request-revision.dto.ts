import { IsString, Length } from 'class-validator';

export class RequestRevisionDto {
  @IsString()
  @Length(1, 1000)
  reason: string;
}
