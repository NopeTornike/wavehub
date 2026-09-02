import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { AUTH_COOKIE_NAME, AuthGuard } from './auth.guard';

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
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) response: Response) {
    try {
      const created = await this.auth.register(body);
      const session = this.auth.createSession(created);
      this.setSessionCookie(response, session.token, session.maxAgeMs);
      return { ok: true, user: session.user };
    } catch (err: any) {
      if (err.message === 'USERNAME_TAKEN') {
        throw new HttpException({ ok: false, error: 'Username already taken' }, HttpStatus.CONFLICT);
      }
      throw new HttpException({ ok: false, error: 'Server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    try {
      const user = await this.auth.login(body);
      const session = this.auth.createSession(user as any);
      this.setSessionCookie(response, session.token, session.maxAgeMs);
      return { ok: true, user: session.user };
    } catch (err: any) {
      if (err.message === 'INVALID_CREDENTIALS') {
        throw new HttpException({ ok: false, error: 'Invalid username or password' }, HttpStatus.UNAUTHORIZED);
      }
      throw new HttpException({ ok: false, error: 'Server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() request: Request) {
    return { ok: true, user: (request as any).user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: this.getCookieOptions().sameSite,
      secure: this.getCookieOptions().secure,
      path: '/',
    });
    return { ok: true };
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

  private setSessionCookie(response: Response, token: string, maxAge: number) {
    response.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      ...this.getCookieOptions(),
      path: '/',
      maxAge,
    });
  }

  private getCookieOptions(): Pick<CookieOptions, 'sameSite' | 'secure'> {
    const configuredSameSite = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
    if (!['lax', 'strict', 'none'].includes(configuredSameSite)) {
      throw new Error('COOKIE_SAME_SITE must be lax, strict, or none');
    }

    const configuredSecure = process.env.COOKIE_SECURE?.toLowerCase();
    if (configuredSecure && !['true', 'false'].includes(configuredSecure)) {
      throw new Error('COOKIE_SECURE must be true or false');
    }
    const secure = configuredSecure
      ? configuredSecure === 'true'
      : process.env.NODE_ENV === 'production';
    if (configuredSameSite === 'none' && !secure) {
      throw new Error('COOKIE_SECURE must be true when COOKIE_SAME_SITE is none');
    }

    return { sameSite: configuredSameSite as CookieOptions['sameSite'], secure };
  }
}
