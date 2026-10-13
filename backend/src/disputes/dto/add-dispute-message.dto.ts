import { IsString, Length } from 'class-validator';

export class AddDisputeMessageDto {
  @IsString()
  @Length(1, 2000)
  body: string;
}
