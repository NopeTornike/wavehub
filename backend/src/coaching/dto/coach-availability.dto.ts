import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, Matches, Max, Min, ValidateNested } from 'class-validator';

// One weekly working range in Tbilisi time (minutes after local midnight, 30-minute steps).
export class CoachAvailabilityRangeDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day: number;

  @IsInt()
  @Min(0)
  @Max(1410)
  from: number;

  @IsInt()
  @Min(30)
  @Max(1440)
  to: number;
}

// Coach working hours (coaches.availability). Ordering/overlap and 30-minute steps are checked in
// normalizeAvailability (coaches.service.ts).
export class CoachAvailabilityDto {
  @IsArray()
  @ArrayMaxSize(28)
  @ValidateNested({ each: true })
  @Type(() => CoachAvailabilityRangeDto)
  weekly: CoachAvailabilityRangeDto[];

  @IsArray()
  @ArrayMaxSize(90)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true, message: 'Days off must be YYYY-MM-DD dates' })
  daysOff: string[];

  @IsInt()
  @Min(0)
  @Max(72)
  noticeHours: number;
}
