import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

export const AUTH_COOKIE_NAME = 'wavehub_session';

function readCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return '';

  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=');
    if (separator < 0) continue;
    const key = cookie.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(cookie.slice(separator + 1).trim());
  }

  return '';
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = readCookie(request.headers.cookie, AUTH_COOKIE_NAME);
    const user = token ? await this.auth.authenticate(token) : null;

    if (!user) {
      throw new UnauthorizedException({ ok: false, error: 'Authentication required' });
    }

    request.user = user;
    return true;
  }
}
