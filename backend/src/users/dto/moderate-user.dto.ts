import { IsString, Length } from 'class-validator';

// Shared by suspend/ban — both require a reason for the audit trail (SPECIFICATION.md §5.13's
// User Management lists neither as reason-less anywhere staff act on another account).
export class ModerateUserDto {
  @IsString()
  @Length(1, 1000)
  reason: string;
}
