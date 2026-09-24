import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, Length, MaxLength, ValidateNested } from 'class-validator';

export class PrizePlaceDto {
  @IsString()
  @Length(1, 30)
  place: string;

  @IsString()
  @Length(1, 30)
  amount: string;

  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  rewards: string[];
}

// The Prize Pool tab's breakdown — see TournamentPrizes in shared-types.
export class PrizesDto {
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PrizePlaceDto)
  places: PrizePlaceDto[];

  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  specialRewards: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string | null;
}
