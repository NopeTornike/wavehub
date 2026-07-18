import { IsEnum, IsString, Length } from 'class-validator';
import { DisputeResolution } from '@wavehub/shared-types';

export class ResolveDisputeDto {
  @IsEnum(DisputeResolution)
  resolution: DisputeResolution;

  @IsString()
  @Length(1, 1000)
  note: string;
}
