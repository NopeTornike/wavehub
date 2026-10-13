import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CoachingSessionStatus, NotificationType } from '@wavehub/shared-types';
import type { AdminSessionDisputeSummary, PublicSessionDispute, SessionDisputeResolution } from '@wavehub/shared-types';
import { CoachingSession } from './coaching-session.entity';
import { CoachingSessionDispute, CoachingSessionDisputeMessage } from './coaching-session-dispute.entity';
import { CoachingSessionsService, formatSessionTime } from './coaching-sessions.service';
import { assertValidSessionTransition } from './coaching-session-lifecycle';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { personName } from '../common/person-name';

const EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/zip', 'application/x-zip-compressed'];
export const MAX_SESSION_EVIDENCE_BYTES = 20 * 1024 * 1024;
const POSTGRES_UNIQUE_VIOLATION = '23505';

// Session disputes (coaching/CLAUDE.md "Session disputes"): a participant opens one while the
// session is in progress or awaiting confirmation, which freezes it (no auto-confirm, no
// payout). Both sides and staff talk in one thread with evidence; a Super Admin refunds the
// student or pays the coach — the money step runs in the same transaction as the decision and
// re-validates the session under its row lock, so it can only happen once.
@Injectable()
export class CoachingSessionDisputesService {
  private readonly logger = new Logger(CoachingSessionDisputesService.name);

  constructor(
    @InjectRepository(CoachingSessionDispute) private readonly disputes: Repository<CoachingSessionDispute>,
    @InjectRepository(CoachingSessionDisputeMessage) private readonly messages: Repository<CoachingSessionDisputeMessage>,
    private readonly sessions: CoachingSessionsService,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  private async notify(userId: string, type: NotificationType, title: string, body: string, sessionId: string, disputeId: string): Promise<void> {
    try {
      await this.notifications.emit(userId, type, title, body, { sessionId, disputeId });
    } catch (err) {
      this.logger.error(`Failed to notify user ${userId} for session dispute ${disputeId}`, err as Error);
    }
  }

  private async participantSession(userId: string, sessionId: string): Promise<CoachingSession> {
    const session = await this.sessions.getJoinedOrThrow(sessionId);
    if (session.buyerId !== userId && session.coach.userId !== userId) throw new ForbiddenException('Not a participant in this session');
    return session;
  }

  private async toPublic(dispute: CoachingSessionDispute): Promise<PublicSessionDispute> {
    const rows = await this.messages.find({ where: { disputeId: dispute.id }, relations: { sender: true }, order: { createdAt: 'ASC' } });
    const opener = dispute.opener ?? (await this.disputes.findOneOrFail({ where: { id: dispute.id }, relations: { opener: true } })).opener;
    return {
      id: dispute.id,
      sessionId: dispute.sessionId,
      openedByUsername: opener.username,
      reason: dispute.reason,
      status: dispute.status,
      resolution: dispute.resolution,
      resolutionNote: dispute.resolutionNote,
      createdAt: dispute.createdAt.toISOString(),
      resolvedAt: dispute.resolvedAt ? dispute.resolvedAt.toISOString() : null,
      messages: rows.map((m) => ({
        id: m.id,
        senderUsername: m.isStaff ? 'WaveHub' : m.sender.username,
        senderFirstName: m.isStaff ? '' : m.sender.firstName,
        senderLastName: m.isStaff ? '' : m.sender.lastName,
        senderAvatarUrl: m.isStaff ? null : (m.sender.avatarUrl ?? null),
        isStaff: m.isStaff,
        body: m.body,
        fileUrl: m.fileUrl,
        fileType: m.fileType,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  // --- Participants ---

  async getForSession(userId: string, sessionId: string): Promise<{ dispute: PublicSessionDispute | null }> {
    await this.participantSession(userId, sessionId);
    const dispute = await this.disputes.findOne({ where: { sessionId }, relations: { opener: true } });
    return { dispute: dispute ? await this.toPublic(dispute) : null };
  }

  async open(userId: string, sessionId: string, reason: string): Promise<PublicSessionDispute> {
    const session = await this.participantSession(userId, sessionId);
    assertOpenable(session.status);
    let id: string;
    try {
      id = await this.dataSource.transaction(async (manager) => {
        const locked = await manager.findOne(CoachingSession, { where: { id: sessionId }, lock: { mode: 'pessimistic_write' } });
        if (!locked) throw new NotFoundException('Session not found');
        assertOpenable(locked.status);
        await manager.update(CoachingSession, sessionId, { status: CoachingSessionStatus.Disputed });
        const saved = await manager.save(manager.create(CoachingSessionDispute, { sessionId, openedBy: userId, reason: reason.trim(), status: 'open' }));
        return saved.id;
      });
    } catch (err) {
      if ((err as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) throw new ConflictException('A dispute already exists for this session');
      throw err;
    }
    const isBuyer = session.buyerId === userId;
    const otherId = isBuyer ? session.coach.userId : session.buyerId;
    const who = isBuyer ? `${personName(session.buyer)}-მა` : `ქოუჩმა ${personName(session.coach.user)}-მა`;
    await this.notify(
      otherId,
      NotificationType.DisputeOpened,
      'სესიაზე დავა გაიხსნა',
      `${who} გახსნა დავა სესიაზე (${formatSessionTime(session.scheduledAt)}). თანხა გაყინულია, სანამ WaveHub-ის გუნდი არ მიიღებს გადაწყვეტილებას — დაწერე შენი მხარე და დაურთე მტკიცებულება.`,
      sessionId,
      id,
    );
    return this.toPublic(await this.disputes.findOneOrFail({ where: { id }, relations: { opener: true } }));
  }

  async addMessage(userId: string, sessionId: string, body: string): Promise<PublicSessionDispute> {
    await this.participantSession(userId, sessionId);
    const dispute = await this.openDisputeForSession(sessionId);
    await this.messages.save(this.messages.create({ disputeId: dispute.id, senderId: userId, isStaff: false, body: body.trim() }));
    return this.toPublic(dispute);
  }

  async addEvidence(userId: string, sessionId: string, file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined): Promise<PublicSessionDispute> {
    await this.participantSession(userId, sessionId);
    const dispute = await this.openDisputeForSession(sessionId);
    await this.saveFile(dispute.id, userId, false, file);
    return this.toPublic(dispute);
  }

  private async openDisputeForSession(sessionId: string): Promise<CoachingSessionDispute> {
    const dispute = await this.disputes.findOne({ where: { sessionId }, relations: { opener: true } });
    if (!dispute) throw new NotFoundException('No dispute exists for this session');
    if (dispute.status !== 'open') throw new ConflictException('This dispute is closed');
    return dispute;
  }

  private async saveFile(disputeId: string, senderId: string, isStaff: boolean, file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined): Promise<void> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!EVIDENCE_TYPES.includes(file.mimetype)) throw new ForbiddenException('File type not allowed (JPG, PNG, WEBP, PDF, ZIP only)');
    if (file.size > MAX_SESSION_EVIDENCE_BYTES) throw new ForbiddenException('File exceeds the 20MB size limit');
    // StorageService sniffs the bytes itself and refuses anything that isn't what it claims.
    const stored = await this.storage.save(file.buffer, file.originalname);
    await this.messages.save(this.messages.create({ disputeId, senderId, isStaff, body: null, fileUrl: stored.url, fileType: stored.contentType ?? file.mimetype }));
  }

  // --- Staff ---

  async listForAdmin(status: 'open' | 'resolved' | 'all' = 'open'): Promise<AdminSessionDisputeSummary[]> {
    const rows = await this.disputes.find({
      where: status === 'all' ? {} : { status },
      relations: { opener: true, session: { coach: { user: true }, buyer: true } },
      order: { createdAt: status === 'open' ? 'ASC' : 'DESC' },
      take: 200,
    });
    return rows.map((d) => ({
      id: d.id,
      sessionId: d.sessionId,
      coachUsername: d.session.coach.user.username,
      buyerUsername: d.session.buyer.username,
      openedByUsername: d.opener.username,
      priceWaveCoin: d.session.priceWaveCoin,
      scheduledAt: d.session.scheduledAt.toISOString(),
      reason: d.reason,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  async getForAdmin(id: string): Promise<PublicSessionDispute & { session: ReturnType<CoachingSessionsService['toPublicSession']> }> {
    const dispute = await this.disputes.findOne({ where: { id }, relations: { opener: true } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    const session = await this.sessions.getJoinedOrThrow(dispute.sessionId);
    return { ...(await this.toPublic(dispute)), session: this.sessions.toPublicSession(session) };
  }

  async addStaffMessage(adminId: string, id: string, body: string): Promise<PublicSessionDispute> {
    const dispute = await this.disputes.findOne({ where: { id }, relations: { opener: true } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (dispute.status !== 'open') throw new ConflictException('This dispute is closed');
    await this.messages.save(this.messages.create({ disputeId: id, senderId: adminId, isStaff: true, body: body.trim() }));
    const session = await this.sessions.getJoinedOrThrow(dispute.sessionId);
    for (const userId of [session.buyerId, session.coach.userId]) {
      await this.notify(userId, NotificationType.DisputeOpened, 'ახალი შეტყობინება დავაში', 'WaveHub-ის გუნდმა დაწერა სესიის დავაში. გახსენი სესიის გვერდი.', session.id, id);
    }
    return this.toPublic(dispute);
  }

  async resolve(adminId: string, id: string, resolution: SessionDisputeResolution, note: string): Promise<PublicSessionDispute> {
    const sessionId = await this.dataSource.transaction(async (manager) => {
      const dispute = await manager.findOne(CoachingSessionDispute, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!dispute) throw new NotFoundException('Dispute not found');
      if (dispute.status !== 'open') throw new ConflictException('This dispute has already been resolved');
      const frozen = [CoachingSessionStatus.Disputed];
      if (resolution === 'pay_coach') await this.sessions.payCoachIn(manager, dispute.sessionId, frozen);
      else await this.sessions.refundStudentIn(manager, dispute.sessionId, frozen);
      await manager.update(CoachingSessionDispute, id, { status: 'resolved', resolution, resolutionNote: note.trim(), resolvedBy: adminId, resolvedAt: new Date() });
      return dispute.sessionId;
    });
    const session = await this.sessions.getJoinedOrThrow(sessionId);
    const outcome =
      resolution === 'pay_coach'
        ? `თანხა (${session.coachPayoutWaveCoin} GEL საკომისიოს გამოკლებით) ჩაერიცხა ქოუჩს.`
        : `${session.priceWaveCoin} GEL სრულად დაუბრუნდა სტუდენტს.`;
    for (const userId of [session.buyerId, session.coach.userId]) {
      await this.notify(userId, NotificationType.DisputeResolved, 'სესიის დავა გადაწყდა', `${outcome} კომენტარი: ${note.trim()}`, sessionId, id);
    }
    if (resolution === 'pay_coach') await this.sessions.notifyFinished(sessionId, 'დავა გადაწყდა შენს სასარგებლოდ. ');
    return this.toPublic(await this.disputes.findOneOrFail({ where: { id }, relations: { opener: true } }));
  }
}

function assertOpenable(status: CoachingSessionStatus): void {
  if (status !== CoachingSessionStatus.InProgress && status !== CoachingSessionStatus.AwaitingConfirmation) {
    throw new ConflictException('A dispute can be opened while the session is in progress or waiting for confirmation');
  }
  assertValidSessionTransition(status, CoachingSessionStatus.Disputed);
}
