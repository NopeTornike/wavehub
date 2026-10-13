import { IsOptional, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Inclusive calendar dates (UTC). Both optional: `to` defaults to today, `from` to 29 days before.
export class AnalyticsRangeDto {
  @IsOptional()
  @Matches(DATE, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(DATE, { message: 'to must be YYYY-MM-DD' })
  to?: string;
}
