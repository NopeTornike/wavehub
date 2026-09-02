import { Injectable, Optional } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import * as bcrypt from 'bcrypt';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

type StoredUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  role: 'buyer' | 'seller';
};

@Injectable()
export class AuthService {
  private readonly usersFile = join(process.cwd(), 'data', 'users.json');
  private readonly sessionDurationSeconds = 60 * 60 * 24 * 7;

  constructor(@Optional() @InjectRepository(User) private repo?: Repository<User>) {}

  async usernameExists(username: string) {
    const normalizedUsername = username.trim().toLowerCase();

    if (!this.repo) {
      const users = await this.readStoredUsers();
      return users.some((user) => user.username === normalizedUsername);
    }

    const existing = await this.repo.findOne({ where: { username: normalizedUsername } });
    return !!existing;
  }

  async register(payload: {
    username: string;
    firstName: string;
    lastName: string;
    password: string;
  }) {
    const username = payload.username.trim().toLowerCase();
    const firstName = payload.firstName.trim();
    const lastName = payload.lastName.trim();

    if (await this.usernameExists(username)) {
      throw new Error('USERNAME_TAKEN');
    }

    const hash = await bcrypt.hash(payload.password, 10);
    if (!this.repo) {
      return this.saveStoredUser({
        id: randomUUID(),
        username,
        firstName,
        lastName,
        passwordHash: hash,
        role: 'buyer',
      });
    }

    const user = this.repo.create({
      username,
      firstName,
      lastName,
      passwordHash: hash,
    });

    try {
      return await this.repo.save(user);
    } catch (err: any) {
      if (err?.code === '23505' || err?.message?.includes('duplicate')) {
        throw new Error('USERNAME_TAKEN');
      }
      throw err;
    }
  }

  async login(payload: { username: string; password: string }) {
    const username = payload.username.trim().toLowerCase();

    if (!this.repo) {
      const users = await this.readStoredUsers();
      const user = users.find((storedUser) => storedUser.username === username);
      if (!user || !(await bcrypt.compare(payload.password, user.passwordHash))) {
        throw new Error('INVALID_CREDENTIALS');
      }

      return this.toPublicUser(user);
    }

    const user = await this.repo.findOne({
      where: { username },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
        role: true,
      },
    });

    if (!user || !(await bcrypt.compare(payload.password, user.passwordHash))) {
      throw new Error('INVALID_CREDENTIALS');
    }

    return this.toPublicUser(user);
  }

  createSession(user: StoredUser | User) {
    const now = Math.floor(Date.now() / 1000);
    const header = this.encodeTokenPart({ alg: 'HS256', typ: 'JWT' });
    const payload = this.encodeTokenPart({
      sub: user.id,
      username: user.username,
      iat: now,
      exp: now + this.sessionDurationSeconds,
    });
    const signature = this.sign(`${header}.${payload}`);

    return {
      token: `${header}.${payload}.${signature}`,
      maxAgeMs: this.sessionDurationSeconds * 1000,
      user: this.toPublicUser(user),
    };
  }

  async authenticate(token: string) {
    try {
      const [header, payload, signature] = token.split('.');
      if (!header || !payload || !signature) return null;

      const expected = Buffer.from(this.sign(`${header}.${payload}`));
      const received = Buffer.from(signature);
      if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
        sub?: string;
        exp?: number;
      };
      if (!claims.sub || !claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) return null;

      return this.findPublicUserById(claims.sub);
    } catch {
      return null;
    }
  }

  async findPublicUserById(id: string) {
    if (!this.repo) {
      const users = await this.readStoredUsers();
      const user = users.find((storedUser) => storedUser.id === id);
      return user ? this.toPublicUser(user) : null;
    }

    const user = await this.repo.findOne({ where: { id } });
    return user ? this.toPublicUser(user) : null;
  }

  private encodeTokenPart(value: object) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private sign(value: string) {
    const secret = process.env.AUTH_TOKEN_SECRET
      || (process.env.NODE_ENV !== 'production' ? 'wavehub-local-development-secret-key' : '');
    if (!secret || secret.length < 32) {
      throw new Error('AUTH_TOKEN_SECRET must contain at least 32 characters');
    }

    return createHmac('sha256', secret).update(value).digest('base64url');
  }

  private async readStoredUsers(): Promise<StoredUser[]> {
    try {
      const content = await readFile(this.usersFile, 'utf8');
      return JSON.parse(content) as StoredUser[];
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  private async saveStoredUser(user: StoredUser) {
    const users = await this.readStoredUsers();
    if (users.some((storedUser) => storedUser.username === user.username)) {
      throw new Error('USERNAME_TAKEN');
    }

    users.push(user);
    await mkdir(dirname(this.usersFile), { recursive: true });
    await writeFile(this.usersFile, `${JSON.stringify(users, null, 2)}\n`, 'utf8');
    return user;
  }

  toPublicUser(user: StoredUser | User) {
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  }
}
