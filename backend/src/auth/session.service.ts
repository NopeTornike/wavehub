import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';

export const SESSION_COOKIE_NAME = 'wavehub_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
// "Remember me" off: a browser-session cookie (gone when the browser closes) whose token also
// expires within a day.
const SHORT_SESSION_TTL_SECONDS = 60 * 60 * 24;

export interface SessionPayload {
  sub: string;
}

// Stateless JWT-in-httpOnly-cookie session — no `sessions` table. Chosen over a DB-backed session
// for simplicity; if a real logout-everywhere/session-revocation requirement shows up later, that's
// the point to add a session table (or a Redis-backed denylist), not before.
@Injectable()
export class SessionService {
  constructor(private readonly jwt: JwtService) {}

  sign(userId: string, ttlSeconds = SESSION_TTL_SECONDS): string {
    return this.jwt.sign({ sub: userId }, { expiresIn: ttlSeconds });
  }

  verify(token: string): SessionPayload {
    // Algorithm pinned so a token can never be accepted under a different (e.g. `none`) algorithm.
    return this.jwt.verify<SessionPayload>(token, { algorithms: ['HS256'] });
  }

  attach(res: Response, userId: string, remember = true) {
    res.cookie(SESSION_COOKIE_NAME, this.sign(userId, remember ? SESSION_TTL_SECONDS : SHORT_SESSION_TTL_SECONDS), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      ...(remember ? { maxAge: SESSION_TTL_SECONDS * 1000 } : {}),
      path: '/',
    });
  }

  // Sliding session (2026-11-01): an active user was signed out mid-visit when their 7-day token ran
  // out with the tab open. Every page load calls GET /auth/me; once the token has used a seventh of
  // its life (1 day for "remember me", ~3.4 hours otherwise) it is re-issued with a full lifetime and
  // the same remember choice. Only an already-valid token is renewed — AuthGuard has rejected
  // expired, tampered and suspended/banned sessions before this runs.
  renewIfAged(token: string | undefined, res: Response) {
    if (!token) return;
    let payload: SessionPayload & { iat?: number; exp?: number };
    try {
      payload = this.verify(token);
    } catch {
      return;
    }
    if (!payload.iat || !payload.exp) return;
    const lifetime = payload.exp - payload.iat;
    const age = Math.floor(Date.now() / 1000) - payload.iat;
    if (age < lifetime / 7) return;
    this.attach(res, payload.sub, lifetime > SHORT_SESSION_TTL_SECONDS);
  }

  clear(res: Response) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  }
}
