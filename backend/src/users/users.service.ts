import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AdminRole, AdminUserSummary, UserStatus } from '@wavehub/shared-types';
import type { PublicUserSearchResult } from '@wavehub/shared-types';
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

  // One conditional UPDATE, not a read-then-write: the WHERE clause makes it a no-op when the stamp
  // is under a minute old, so the per-request cost for an active session is a single indexed
  // lookup that touches no rows.
  async touchLastSeen(id: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(User)
      .set({ lastSeenAt: () => 'now()' })
      .where('id = :id', { id })
      .andWhere(`("lastSeenAt" IS NULL OR "lastSeenAt" < now() - interval '60 seconds')`)
      .execute();
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

  // Public username search: active accounts only, case-insensitive substring match, exact match
  // first, then prefix matches, then the rest (shorter usernames first); at most 8. Returns only
  // what a public profile already shows — never email, balance, role or status.
  async searchPublic(query: string, limit = 8): Promise<PublicUserSearchResult[]> {
    const q = query.trim().replace(/^@/, '').toLowerCase();
    if (q.length < 2) return [];
    const pattern = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    const rows = await this.repo
      .createQueryBuilder('u')
      .select(['u.id', 'u.username', 'u.avatarUrl'])
      .where('u.status = :active', { active: UserStatus.Active })
      .andWhere('lower(u.username) LIKE :pattern', { pattern })
      .orderBy('CASE WHEN lower(u.username) = :q THEN 0 WHEN lower(u.username) LIKE :prefix THEN 1 ELSE 2 END', 'ASC')
      .addOrderBy('length(u.username)', 'ASC')
      .addOrderBy('u.username', 'ASC')
      .setParameters({ q, prefix: `${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%` })
      .limit(Math.min(limit, 8))
      .getMany();
    return rows.map((u) => ({ id: u.id, username: u.username, avatarUrl: u.avatarUrl ?? null }));
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
      avatarUrl: user.avatarUrl ?? null,
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

  // Super Admin grants/changes/removes a staff role (admin-users.controller.ts). Guards: nobody changes
  // their own role (no self-escalation or accidental self-lockout), staff must be an active,
  // email-verified account, and the last Super Admin can't be demoted.
  async setAdminRole(actorId: string, id: string, role: AdminRole | null): Promise<AdminUserSummary> {
    if (actorId === id) throw new BadRequestException("You can't change your own staff role");
    const user = await this.getOrThrow(id);
    if (role && user.status !== UserStatus.Active) {
      throw new BadRequestException('Only an active, email-verified account can be given a staff role');
    }
    if (user.adminRole === AdminRole.SuperAdmin && role !== AdminRole.SuperAdmin) {
      const superAdmins = await this.repo.count({ where: { adminRole: AdminRole.SuperAdmin } });
      if (superAdmins <= 1) throw new BadRequestException("The last Super Admin can't be demoted");
    }
    await this.repo.update(id, { adminRole: role });
    return this.toAdminUser({ ...user, adminRole: role });
  }

  async restore(id: string): Promise<AdminUserSummary> {
    const user = await this.getOrThrow(id);
    if (user.status !== UserStatus.Suspended) {
      throw new BadRequestException('User is not currently suspended');
    }
    const status = this.statusAfterLifting(user);
    await this.repo.update(id, { status, moderationReason: null });
    return this.toAdminUser({ ...user, status, moderationReason: null });
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
    const status = this.statusAfterLifting(user);
    await this.repo.update(id, { status, moderationReason: null });
    return this.toAdminUser({ ...user, status, moderationReason: null });
  }

  // Lifting a suspension/ban must not hand a never-verified account full `active` status (that
  // would bypass the email-verification requirement) — such accounts go back to pending.
  private statusAfterLifting(user: User): UserStatus {
    return user.emailVerifiedAt ? UserStatus.Active : UserStatus.PendingVerification;
  }

  private async getOrThrow(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
