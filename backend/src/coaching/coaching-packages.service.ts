import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AdminCoachingPackage, PublicCoachPackage } from '@wavehub/shared-types';
import { CoachingPackage } from './coaching-package.entity';
import { UpdateCoachingPackageDto } from './dto/coaching-package.dto';

// The platform's coaching packages (coaching/CLAUDE.md "2026-10-02 platform packages").
@Injectable()
export class CoachingPackagesService {
  constructor(@InjectRepository(CoachingPackage) private readonly packages: Repository<CoachingPackage>) {}

  private toPublic(p: CoachingPackage): PublicCoachPackage {
    return {
      id: p.id,
      key: p.key,
      name: p.name,
      tagline: p.tagline,
      description: p.description,
      features: p.features ?? [],
      sessionsCount: p.sessionsCount,
      durationMinutes: p.durationMinutes,
      priceWaveCoin: p.priceWaveCoin,
    };
  }

  // What every coach offers (coach profile, booking step 1, GET coaching-packages).
  async listActive(): Promise<PublicCoachPackage[]> {
    const rows = await this.packages.find({ where: { active: true }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
    return rows.map((p) => this.toPublic(p));
  }

  async listAll(): Promise<AdminCoachingPackage[]> {
    const rows = await this.packages.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
    return rows.map((p) => ({ ...this.toPublic(p), active: p.active, sortOrder: p.sortOrder, updatedAt: p.updatedAt.toISOString() }));
  }

  // Booking: only an active package can be bought.
  async getActive(id: string): Promise<CoachingPackage> {
    const pkg = await this.packages.findOne({ where: { id, active: true } });
    if (!pkg) throw new NotFoundException('This package is not available');
    return pkg;
  }

  // Returns the changed fields' old/new values for the audit log.
  async update(id: string, dto: UpdateCoachingPackageDto): Promise<{ before: Record<string, unknown>; after: Record<string, unknown> }> {
    const pkg = await this.packages.findOne({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    const after: Partial<CoachingPackage> = {};
    if (dto.name !== undefined) after.name = dto.name.trim();
    if (dto.sessionsCount !== undefined) after.sessionsCount = dto.sessionsCount;
    if (dto.durationMinutes !== undefined) after.durationMinutes = dto.durationMinutes;
    if (dto.priceWaveCoin !== undefined) after.priceWaveCoin = dto.priceWaveCoin;
    if (dto.tagline !== undefined) after.tagline = dto.tagline.trim();
    if (dto.description !== undefined) after.description = dto.description.trim();
    if (dto.features !== undefined) after.features = dto.features.map((f) => f.trim()).filter(Boolean);
    if (dto.active !== undefined) after.active = dto.active;
    const before = Object.fromEntries(Object.keys(after).map((k) => [k, (pkg as unknown as Record<string, unknown>)[k]]));
    if (Object.keys(after).length) await this.packages.update(id, after);
    return { before, after };
  }
}
