import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt, createHash, timingSafeEqual } from 'crypto';
import { NotificationType, UserStatus } from '@wavehub/shared-types';
import { User } from '../users/user.entity';
import { EmailVerificationToken } from './email-verification-token.entity';
import { PasswordResetToken } from './password-reset-token.entity';
import { EmailService } from '../email/email.service';
import { passwordResetEmail, verificationEmail } from '../email/templates';
import { Notification } from '../notifications/notification.entity';
import { LoginEvent } from '../trust/trust.entities';
import { loginHash } from '../trust/login-hash';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
// Wrong 6-digit code entries before the code (and its link) stop working.
export const MAX_CODE_ATTEMPTS = 5;

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(EmailVerificationToken)
    private readonly verificationTokens: Repository<EmailVerificationToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    private readonly email: EmailService,
    @InjectRepository(LoginEvent)
    private readonly loginEvents: Repository<LoginEvent>,
  ) {}

  // Login history for Trust & Safety (trust/CLAUDE.md): keyed hashes only, never the raw IP/UA.
  // A failed attempt is recorded only when the username exists. Best-effort — never blocks auth.
  async recordLogin(who: { userId?: string; username?: string }, ip: string | undefined, userAgent: string | undefined, success: boolean): Promise<void> {
    try {
      const userId = who.userId ?? (await this.users.findOne({ where: { username: (who.username ?? '').trim().toLowerCase() }, select: { id: true } }))?.id;
      if (!userId) return;
      await this.loginEvents.insert({ userId, ipHash: loginHash(ip), uaHash: loginHash(userAgent), success });
    } catch (err) {
      this.logger.warn(`login event not recorded: ${(err as Error).message}`);
    }
  }

  // The in-app welcome (client request, 2026-10-02). Written directly to the notifications table:
  // NotificationsModule imports AuthModule, so injecting NotificationsService here would be circular.
  // Best-effort — never blocks registration.
  private async welcome(user: User): Promise<void> {
    try {
      await this.notifications.save(
        this.notifications.create({
          userId: user.id,
          type: NotificationType.Welcome,
          title: 'კეთილი იყოს შენი მობრძანება WaveHub-ზე!',
          body: 'დაადასტურე ელფოსტა და შემდეგ შეგიძლია იყიდო და გაყიდო ანგარიშები, დაჯავშნო ქოუჩინგი და მიიღო მონაწილეობა ტურნირებში.',
          metadata: null,
        }),
      );
    } catch (err) {
      this.logger.warn(`welcome notification failed: ${(err as Error).message}`);
    }
  }

  async usernameExists(username: string) {
    const existing = await this.users.findOne({ where: { username } });
    return !!existing;
  }

  async emailExists(email: string) {
    const existing = await this.users.findOne({ where: { email } });
    return !!existing;
  }

  async register(payload: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
  }): Promise<User> {
    const username = payload.username.trim().toLowerCase();
    const email = payload.email.trim().toLowerCase();
    const firstName = payload.firstName.trim();
    const lastName = payload.lastName.trim();

    if (await this.usernameExists(username)) {
      throw new Error('USERNAME_TAKEN');
    }
    if (await this.emailExists(email)) {
      throw new Error('EMAIL_TAKEN');
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = this.users.create({
      username,
      email,
      firstName,
      lastName,
      passwordHash,
      status: UserStatus.PendingVerification,
    });

    try {
      const saved = await this.users.save(user);
      await this.sendEmailVerification(saved);
      await this.welcome(saved);
      return saved;
    } catch (err: any) {
      if (err?.code === '23505' || err?.message?.includes('duplicate')) {
        throw new Error('USERNAME_TAKEN');
      }
      throw err;
    }
  }

  async login(payload: { username: string; password: string }): Promise<User> {
    const username = payload.username.trim().toLowerCase();

    const user = await this.users.findOne({
      where: { username },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
      },
    });

    if (!user || !(await bcrypt.compare(payload.password, user.passwordHash))) {
      throw new Error('INVALID_CREDENTIALS');
    }
    // Checked only AFTER the password matched, so it can't be used to probe which accounts are
    // suspended. Without this a banned user still received a fresh session cookie (which AuthGuard
    // then rejects on every guarded route) - a login that "succeeds" into an unusable session.
    if (user.status === UserStatus.Suspended || user.status === UserStatus.Banned) {
      throw new Error('ACCOUNT_SUSPENDED');
    }

    return user;
  }

  async sendEmailVerification(user: User): Promise<void> {
    const rawToken = randomBytes(32).toString('hex');
    // Also a 6-digit code: Gmail disables links in mail it files as spam, so the user can type it.
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const token = this.verificationTokens.create({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      codeHash: hashToken(`${user.id}:${code}`),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    });
    await this.verificationTokens.save(token);

    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${rawToken}`;
    await this.email.send(user.email, `${code} — WaveHub-ის დადასტურების კოდი · Verify your email`, verificationEmail(user.firstName, verifyUrl, code));
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const token = await this.verificationTokens.findOne({ where: { tokenHash } });

    if (!token || token.consumedAt || token.expiresAt < new Date()) {
      throw new Error('INVALID_OR_EXPIRED_TOKEN');
    }

    await this.verificationTokens.update(token.id, { consumedAt: new Date() });
    await this.users.update(token.userId, {
      status: UserStatus.Active,
      emailVerifiedAt: new Date(),
    });
  }

  // The signed-in (pending) user types the 6-digit code from the email. Checked against their newest
  // live token; every wrong try counts and MAX_CODE_ATTEMPTS burns it, so the 10^6 space can't be
  // walked (on top of the route's per-IP throttle).
  async verifyEmailCode(userId: string, code: string): Promise<void> {
    const token = await this.verificationTokens.findOne({ where: { userId }, order: { createdAt: 'DESC' } });
    if (!token || !token.codeHash || token.consumedAt || token.expiresAt < new Date()) {
      throw new Error('INVALID_OR_EXPIRED_TOKEN');
    }
    const given = Buffer.from(hashToken(`${userId}:${code}`));
    if (!timingSafeEqual(given, Buffer.from(token.codeHash))) {
      const attempts = token.codeAttempts + 1;
      await this.verificationTokens.update(token.id, { codeAttempts: attempts, ...(attempts >= MAX_CODE_ATTEMPTS ? { consumedAt: new Date() } : {}) });
      throw new Error(attempts >= MAX_CODE_ATTEMPTS ? 'CODE_LOCKED' : 'INVALID_CODE');
    }
    await this.verificationTokens.update(token.id, { consumedAt: new Date() });
    await this.users.update(userId, { status: UserStatus.Active, emailVerifiedAt: new Date() });
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findOne({ where: { email: email.trim().toLowerCase() } });
    // Always resolve silently even if no account matches — don't leak which emails are registered.
    if (!user) {
      return;
    }

    const rawToken = randomBytes(32).toString('hex');
    const token = this.resetTokens.create({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });
    await this.resetTokens.save(token);

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${rawToken}`;
    await this.email.send(user.email, 'პაროლის აღდგენა · Reset your WaveHub password', passwordResetEmail(user.firstName, resetUrl));
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const token = await this.resetTokens.findOne({ where: { tokenHash } });

    if (!token || token.consumedAt || token.expiresAt < new Date()) {
      throw new Error('INVALID_OR_EXPIRED_TOKEN');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.resetTokens.update(token.id, { consumedAt: new Date() });
    await this.users.update(token.userId, { passwordHash });
  }

  // Best-effort cleanup of expired/consumed tokens — not scheduled anywhere yet (no cron
  // infrastructure exists until Phase 5's @nestjs/schedule usage). Fine to call manually or wire
  // into a cron once that lands; tokens are harmless if left around since they're single-use and
  // expiry-checked on every verify, this is just table hygiene.
  async purgeExpiredTokens(): Promise<void> {
    const now = new Date();
    await this.verificationTokens.delete({ expiresAt: LessThan(now) });
    await this.resetTokens.delete({ expiresAt: LessThan(now) });
  }
}
