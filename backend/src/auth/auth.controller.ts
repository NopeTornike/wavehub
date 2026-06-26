import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'Username must contain only English letters, numbers, underscore, and hyphen',
  })
  username: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}

class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    try {
      const created = await this.auth.register(body);
      return { ok: true, id: created.id };
    } catch (err: any) {
      if (err.message === 'USERNAME_TAKEN') {
        throw new HttpException({ ok: false, error: 'Username already taken' }, HttpStatus.CONFLICT);
      }
      throw new HttpException({ ok: false, error: 'Server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto) {
    try {
      const user = await this.auth.login(body);
      return { ok: true, user };
    } catch (err: any) {
      if (err.message === 'INVALID_CREDENTIALS') {
        throw new HttpException({ ok: false, error: 'Invalid username or password' }, HttpStatus.UNAUTHORIZED);
      }
      throw new HttpException({ ok: false, error: 'Server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('check-username')
  async checkUsername(@Query('username') username: string) {
    if (!username?.trim()) {
      throw new HttpException({ ok: false, error: 'Username is required' }, HttpStatus.BAD_REQUEST);
    }

    const validUsernamePattern = /^[a-z0-9_-]+$/;
    const normalizedUsername = username.trim().toLowerCase();
    if (!validUsernamePattern.test(normalizedUsername)) {
      return { ok: true, available: false };
    }

    const available = !(await this.auth.usernameExists(normalizedUsername));
    return { ok: true, available };
  }
}
