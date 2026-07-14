import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';

export const SESSION_COOKIE_NAME = 'wavehub_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  sub: string;
}

// Stateless JWT-in-httpOnly-cookie session — no `sessions` table. Chosen over a DB-backed session
// for simplicity; if a real logout-everywhere/session-revocation requirement shows up later, that's
// the point to add a session table (or a Redis-backed denylist), not before.
@Injectable()
export class SessionService {
  constructor(private readonly jwt: JwtService) {}

  sign(userId: string): string {
    return this.jwt.sign({ sub: userId }, { expiresIn: SESSION_TTL_SECONDS });
  }

  verify(token: string): SessionPayload {
    return this.jwt.verify<SessionPayload>(token);
  }

  attach(res: Response, userId: string) {
    res.cookie(SESSION_COOKIE_NAME, this.sign(userId), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_TTL_SECONDS * 1000,
      path: '/',
    });
  }

  clear(res: Response) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  }
}
