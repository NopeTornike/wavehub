import { Injectable, Optional } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
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

  private toPublicUser(user: StoredUser | User) {
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  }
}
