import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { UserStatus } from '@wavehub/shared-types';
import { User } from '../users/user.entity';
import { EmailVerificationToken } from './email-verification-token.entity';
import { PasswordResetToken } from './password-reset-token.entity';
import { EmailService } from '../email/email.service';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(EmailVerificationToken)
    private readonly verificationTokens: Repository<EmailVerificationToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
    private readonly email: EmailService,
  ) {}

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

    return user;
  }

  async sendEmailVerification(user: User): Promise<void> {
    const rawToken = randomBytes(32).toString('hex');
    const token = this.verificationTokens.create({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    });
    await this.verificationTokens.save(token);

    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${rawToken}`;
    await this.email.send(
      user.email,
      'Verify your WaveHub email',
      `Hi ${user.firstName},\n\nVerify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    );
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
    await this.email.send(
      user.email,
      'Reset your WaveHub password',
      `Hi ${user.firstName},\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    );
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
