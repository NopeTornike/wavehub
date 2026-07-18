import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

// Called explicitly at the end of every admin-guarded controller action — not automatically via a
// decorator/interceptor yet (the original build plan's intended end state, `@Audited(action)`, is
// a documented future refinement, see admin/CLAUDE.md). Explicit calls are easy to forget on a new
// route, but there's no interceptor infrastructure to hang that on yet, and guessing at one before
// there are several more admin routes to generalize from would be premature.
@Injectable()
export class AdminAuditService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async log(entry: {
    adminId: string;
    adminRole: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.repo.save(
      this.repo.create({
        adminId: entry.adminId,
        adminRole: entry.adminRole,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata ?? null,
      }),
    );
  }
}
