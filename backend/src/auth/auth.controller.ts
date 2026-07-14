import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { SessionService } from './session.service';
import { CurrentUserId } from './current-user.decorator';
import { UsersService } from '../users/users.service';
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN } from './password-policy';

class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'Username must contain only English letters, numbers, underscore, and hyphen',
  })
  username: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long` })
  @Matches(PASSWORD_PATTERN, { message: 'Password must contain at least one letter and one number' })
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

class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

class RequestPasswordResetDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;
}

// Stricter than the global 100/60s default (see app.module.ts) — these endpoints are brute-force
// targets (credential guessing, account enumeration via check-username/email, token guessing) and
// legitimate use never needs this much throughput. Keep in sync with any similar decision made in
// backend/src/payments/bog-payments.controller.ts.
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
const USERNAME_CHECK_THROTTLE = { default: { limit: 20, ttl: 60_000 } }; // live-typing feedback, needs more headroom

class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long` })
  @Matches(PASSWORD_PATTERN, { message: 'Password must contain at least one letter and one number' })
  newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) res: Response) {
    try {
      const user = await this.auth.register(body);
      this.sessions.attach(res, user.id);
      return { ok: true, user: this.usersService.toPublicUser(user) };
    } catch (err: any) {
      if (err.message === 'USERNAME_TAKEN') {
        throw new HttpException({ ok: false, error: 'Username already taken' }, HttpStatus.CONFLICT);
      }
      if (err.message === 'EMAIL_TAKEN') {
        throw new HttpException({ ok: false, error: 'Email already registered' }, HttpStatus.CONFLICT);
      }
      throw new HttpException({ ok: false, error: 'Server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    try {
      const user = await this.auth.login(body);
      this.sessions.attach(res, user.id);
      return { ok: true, user: this.usersService.toPublicUser(user) };
    } catch (err: any) {
      if (err.message === 'INVALID_CREDENTIALS') {
        throw new HttpException({ ok: false, error: 'Invalid username or password' }, HttpStatus.UNAUTHORIZED);
      }
      throw new HttpException({ ok: false, error: 'Server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    this.sessions.clear(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUserId() userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new HttpException({ ok: false, error: 'User not found' }, HttpStatus.NOT_FOUND);
    }
    return { ok: true, user: this.usersService.toPublicUser(user) };
  }

  @Get('check-username')
  @Throttle(USERNAME_CHECK_THROTTLE)
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

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  async verifyEmail(@Body() body: VerifyEmailDto) {
    try {
      await this.auth.verifyEmail(body.token);
      return { ok: true };
    } catch {
      throw new HttpException({ ok: false, error: 'Invalid or expired verification link' }, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @Throttle(AUTH_THROTTLE)
  async resendVerification(@CurrentUserId() userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new HttpException({ ok: false, error: 'User not found' }, HttpStatus.NOT_FOUND);
    }
    await this.auth.sendEmailVerification(user);
    return { ok: true };
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  async requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    await this.auth.requestPasswordReset(body.email);
    // Always ok:true regardless of whether the email matched an account — see AuthService for why.
    return { ok: true };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  async resetPassword(@Body() body: ResetPasswordDto) {
    try {
      await this.auth.resetPassword(body.token, body.newPassword);
      return { ok: true };
    } catch {
      throw new HttpException({ ok: false, error: 'Invalid or expired reset link' }, HttpStatus.BAD_REQUEST);
    }
  }
}
