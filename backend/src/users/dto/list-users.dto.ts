import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { UserStatus } from '@wavehub/shared-types';

export class ListUsersDto {
  // Matched against username/email/first+last name — see UsersService.listAdmin for the exact query.
  @IsOptional()
  @IsString()
  @Length(1, 200)
  query?: string;

  @IsOptional()
  @IsIn(Object.values(UserStatus))
  status?: UserStatus;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
