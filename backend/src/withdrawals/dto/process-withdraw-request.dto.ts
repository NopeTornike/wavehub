import { IsString, IsEnum, Length, ValidateIf } from 'class-validator';
import { WithdrawStatus } from '@wavehub/shared-types';

export class ProcessWithdrawRequestDto {
  @IsEnum(WithdrawStatus)
  status: WithdrawStatus;

  // Required for Rejected (per SPECIFICATION.md §5.6's "required reject reason") — `@ValidateIf`
  // alone already makes it optional for every other status (no validators run when the condition
  // is false), so no separate `@IsOptional()` is needed or wanted here; adding one would make it
  // optional even when Rejected, defeating the point.
  @ValidateIf((dto) => dto.status === WithdrawStatus.Rejected)
  @IsString()
  @Length(1, 1000)
  note?: string;
}
