import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AdminUserSummary, UserStatus } from '@wavehub/shared-types';
import { User } from './user.entity';
import { ListUsersDto } from './dto/list-users.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  // Minimal projection for AuthGuard's per-request suspended/banned check — deliberately not
  // `findById` (which also selects passwordHash-adjacent columns unnecessarily for a check that
  // runs on every guarded request).
  findStatusById(id: string): Promise<Pick<User, 'id' | 'status'> | null> {
    return this.repo.findOne({ where: { id }, select: ['id', 'status'] });
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
      adminRole: user.adminRole,
      wavecoinBalance: user.wavecoinBalance,
    };
  }

  toAdminUser(user: User): AdminUserSummary {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      adminRole: user.adminRole,
      wavecoinBalance: user.wavecoinBalance,
      moderationReason: user.moderationReason,
      createdAt: user.createdAt.toISOString(),
    };
  }

  // Backs `GET /admin/users` — see SPECIFICATION.md §5.13's "User Management: view, search,
  // filter" line, present in every role's CAN list that has User Management at all. `query`
  // matches username/email/first+last name with a simple case-insensitive LIKE — fine at this
  // scale, revisit (pg_trgm/full-text) only if it's ever actually slow.
  async listAdmin(dto: ListUsersDto): Promise<{ items: AdminUserSummary[]; total: number }> {
    const qb = this.repo.createQueryBuilder('user').orderBy('user.createdAt', 'DESC');

    if (dto.status) {
      qb.andWhere('user.status = :status', { status: dto.status });
    }
    if (dto.query) {
      const like = `%${dto.query.toLowerCase()}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('LOWER(user.username) LIKE :like', { like })
            .orWhere('LOWER(user.email) LIKE :like', { like })
            .orWhere('LOWER(user.firstName) LIKE :like', { like })
            .orWhere('LOWER(user.lastName) LIKE :like', { like });
        }),
      );
    }

    const [rows, total] = await qb
      .take(dto.limit ?? 20)
      .skip(dto.offset ?? 0)
      .getManyAndCount();

    return { items: rows.map((row) => this.toAdminUser(row)), total };
  }

  async getAdminOne(id: string): Promise<AdminUserSummary> {
    return this.toAdminUser(await this.getOrThrow(id));
  }

  // Temporary suspend — reversible via `restore`. Refuses to act on an already-banned account
  // (banning is the stronger action; unban first if the intent is really "just suspend").
  async suspend(id: string, reason: string): Promise<AdminUserSummary> {
    const user = await this.getOrThrow(id);
    if (user.status === UserStatus.Banned) {
      throw new BadRequestException('User is banned — unban before suspending');
    }
    await this.repo.update(id, { status: UserStatus.Suspended, moderationReason: reason });
    return this.toAdminUser({ ...user, status: UserStatus.Suspended, moderationReason: reason });
  }

  async restore(id: string): Promise<AdminUserSummary> {
    const user = await this.getOrThrow(id);
    if (user.status !== UserStatus.Suspended) {
      throw new BadRequestException('User is not currently suspended');
    }
    await this.repo.update(id, { status: UserStatus.Active, moderationReason: null });
    return this.toAdminUser({ ...user, status: UserStatus.Active, moderationReason: null });
  }

  // Permanent ban — Super Admin only, enforced at the controller via @RequireAdminRole(), not
  // here (this service has no notion of "who's calling").
  async ban(id: string, reason: string): Promise<AdminUserSummary> {
    const user = await this.getOrThrow(id);
    await this.repo.update(id, { status: UserStatus.Banned, moderationReason: reason });
    return this.toAdminUser({ ...user, status: UserStatus.Banned, moderationReason: reason });
  }

  async unban(id: string): Promise<AdminUserSummary> {
    const user = await this.getOrThrow(id);
    if (user.status !== UserStatus.Banned) {
      throw new BadRequestException('User is not currently banned');
    }
    await this.repo.update(id, { status: UserStatus.Active, moderationReason: null });
    return this.toAdminUser({ ...user, status: UserStatus.Active, moderationReason: null });
  }

  private async getOrThrow(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
