import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStatus } from '@wavehub/shared-types';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findByUsername(username: string) {
    return this.repo.findOne({ where: { username } });
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  async markEmailVerified(id: string) {
    await this.repo.update(id, { status: UserStatus.Active, emailVerifiedAt: new Date() });
  }

  async setPasswordHash(id: string, passwordHash: string) {
    await this.repo.update(id, { passwordHash });
  }

  toPublicUser(user: User) {
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      adminRole: null as null,
    };
  }
}
