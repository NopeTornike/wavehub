import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import type { ReportReason, ReportStatus, ReportTargetType } from '@wavehub/shared-types';

export const REPORT_TARGETS: ReportTargetType[] = ['user', 'listing', 'coach', 'review', 'message'];
export const REPORT_REASONS: ReportReason[] = ['spam', 'harassment', 'fraud', 'scam_listing', 'fake_account', 'offensive', 'other'];
export const REPORT_STATUSES: ReportStatus[] = ['open', 'reviewing', 'actioned', 'dismissed'];

export class CreateReportDto {
  @IsIn(REPORT_TARGETS)
  targetType: ReportTargetType;

  @IsUUID()
  targetId: string;

  @IsIn(REPORT_REASONS)
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class ListReportsDto {
  @IsOptional()
  @IsIn([...REPORT_STATUSES, 'all'])
  status?: ReportStatus | 'all';
}

export class HandleReportDto {
  @IsIn(REPORT_STATUSES)
  status: ReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  staffNote?: string;
}

export class StaffNoteDto {
  @IsString()
  @Length(2, 1000)
  body: string;
}

export class WarnUserDto {
  @IsString()
  @Length(10, 1000)
  message: string;
}

export class FlagUserDto {
  @IsBoolean()
  flagged: boolean;

  @IsString()
  @Length(3, 1000)
  reason: string;
}

export class SearchTrustUsersDto {
  @IsString()
  @Length(2, 40)
  q: string;
}
