import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CoachStatus, CoachingSessionStatus, NotificationType, VerificationStatus } from '@wavehub/shared-types';
import type { PublicCoachingSession } from '@wavehub/shared-types';
import { CoachingSession } from './coaching-session.entity';
import { Coach } from './coach.entity';
import { RequestSessionDto } from './dto/request-session.dto';
import { assertValidSessionTransition } from './coaching-session-lifecycle';
import { WalletService } from '../wallet/wallet.service';
import { calculatePlatformFee } from '../wallet/fee.util';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { withTransactionRetry } from '../wallet/transaction-retry.util';

const DEFAULT_HOLD_DAYS = 7;

@Injectable()
export class CoachingSessionsService {
  private readonly logger = new Logger(CoachingSessionsService.name);

  constructor(
    @InjectRepository(CoachingSession) private readonly sessions: Repository<CoachingSession>,
    @InjectRepository(Coach) private readonly coaches: Repository<Coach>,
    private readonly dataSource: DataSource,
    private readonly wallet: WalletService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly notifications: NotificationsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  private async notify(userId: string, type: NotificationType, title: string, body: string, sessionId: string): Promise<void> {
    try {
      await this.notifications.emit(userId, type, title, body, { sessionId });
    } catch (err) {
      this.logger.error(`Failed to notify user ${userId} for session ${sessionId}`, err as Error);
    }
  }

  private toPublic(session: CoachingSession): PublicCoachingSession {
    return {
      id: session.id,
      coachId: session.coachId,
      coachUserId: session.coach.userId,
      coachUsername: session.coach.user.username,
      coachFirstName: session.coach.user.firstName,
      coachLastName: session.coach.user.lastName,
      buyerId: session.buyerId,
      buyerUsername: session.buyer.username,
      scheduledAt: session.scheduledAt.toISOString(),
      durationMinutes: session.durationMinutes,
      priceWaveCoin: session.priceWaveCoin,
      buyerMessage: session.buyerMessage,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
    };
  }

  private async getJoinedOrThrow(id: string): Promise<CoachingSession> {
    const session = await this.sessions.findOne({
      where: { id },
      relations: { coach: { user: true }, buyer: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  // The entire booking flow: validate the coach can actually be booked, compute price/fee
  // snapshots, then atomically create the session row and debit the buyer's WaveCoin balance —
  // same one-transaction principle as OrdersService#purchase, for the same reason (a debit
  // failure must roll back the session insert too, never leave an unpaid session on the books).
  async request(buyerId: string, coachId: string, dto: RequestSessionDto): Promise<PublicCoachingSession> {
    const coach = await this.coaches.findOne({ where: { id: coachId }, relations: { user: true } });
    if (!coach) {
      throw new NotFoundException('Coach not found');
    }
    if (coach.verificationStatus !== VerificationStatus.Verified || coach.status !== CoachStatus.Active) {
      throw new ForbiddenException('This coach is not currently accepting sessions');
    }
    if (coach.userId === buyerId) {
      throw new ForbiddenException("You can't book a session with yourself");
    }
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt.getTime() <= Date.now()) {
      throw new ForbiddenException('scheduledAt must be in the future');
    }

    const priceWaveCoin = Math.round((coach.hourlyRateWaveCoin * dto.durationMinutes) / 60);
    const platformFeePercent = await this.subscriptions.effectiveFeePercent(
      coach.userId,
      await this.platformSettings.getPlatformFeePercent(),
    );
    const { feeWaveCoin, sellerReceivesWaveCoin: coachPayoutWaveCoin } = calculatePlatformFee(
      priceWaveCoin,
      platformFeePercent,
    );

    const saved = await withTransactionRetry(() => this.dataSource.transaction(async (manager) => {
      // Lock the buyer's row before the session insert's FK takes a shared lock on it — see
      // WalletService.lockAccount (prevents same-buyer 40P01 deadlocks).
      await this.wallet.lockAccount(buyerId, manager);
      const session = manager.create(CoachingSession, {
        coachId: coach.id,
        buyerId,
        scheduledAt,
        durationMinutes: dto.durationMinutes,
        priceWaveCoin,
        platformFeePercentSnapshot: platformFeePercent,
        platformFeeWaveCoin: feeWaveCoin,
        coachPayoutWaveCoin,
        buyerMessage: dto.buyerMessage ?? null,
        status: CoachingSessionStatus.Scheduled,
      });
      const insertedSession = await manager.save(session);

      // Throws INSUFFICIENT_BALANCE (translated below) if the buyer can't afford it — the whole
      // transaction, including the session insert above, rolls back.
      await this.wallet.debitForSession(buyerId, insertedSession.id, priceWaveCoin, manager);

      return insertedSession;
    })).catch((err) => {
      if (err instanceof Error && err.message === 'INSUFFICIENT_BALANCE') {
        throw new ForbiddenException('Insufficient WaveCoin balance for this session');
      }
      throw err;
    });

    const full = await this.getJoinedOrThrow(saved.id);
    await this.notify(
      coach.userId,
      NotificationType.SessionBooked,
      'ახალი სესია დაჯავშნილია',
      `${full.buyer.username} დაჯავშნა სესია ${full.durationMinutes} წუთით.`,
      full.id,
    );
    return this.toPublic(full);
  }

  async findMineAsBuyer(buyerId: string): Promise<PublicCoachingSession[]> {
    const rows = await this.sessions.find({
      where: { buyerId },
      relations: { coach: { user: true }, buyer: true },
      order: { scheduledAt: 'DESC' },
    });
    return rows.map((row) => this.toPublic(row));
  }

  async findMineAsCoach(coachUserId: string): Promise<PublicCoachingSession[]> {
    const coach = await this.coaches.findOne({ where: { userId: coachUserId } });
    if (!coach) {
      return [];
    }
    const rows = await this.sessions.find({
      where: { coachId: coach.id },
      relations: { coach: { user: true }, buyer: true },
      order: { scheduledAt: 'DESC' },
    });
    return rows.map((row) => this.toPublic(row));
  }

  async getForParticipant(sessionId: string, userId: string): Promise<PublicCoachingSession> {
    const session = await this.getJoinedOrThrow(sessionId);
    if (session.buyerId !== userId && session.coach.userId !== userId) {
      throw new ForbiddenException('Not a participant in this session');
    }
    return this.toPublic(session);
  }

  // Coach-only — marks the session done and releases escrow to the coach (same 7-day withdrawal
  // hold as an order's seller payout).
  async complete(sessionId: string, callerUserId: string): Promise<PublicCoachingSession> {
    const session = await this.getJoinedOrThrow(sessionId);
    if (session.coach.userId !== callerUserId) {
      throw new ForbiddenException('Only the coach can mark a session completed');
    }
    assertValidSessionTransition(session.status, CoachingSessionStatus.Completed);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(CoachingSession, session.id, { status: CoachingSessionStatus.Completed });
      await this.wallet.releaseCoachEarnings(
        session.coach.userId,
        session.id,
        session.coachPayoutWaveCoin,
        DEFAULT_HOLD_DAYS,
        manager,
      );
    });

    const full = await this.getJoinedOrThrow(session.id);
    await this.notify(
      full.buyerId,
      NotificationType.SessionCompleted,
      'სესია დასრულებულია',
      `თქვენი სესია ${full.coach.user.username}-სთან დასრულებულია.`,
      full.id,
    );
    return this.toPublic(full);
  }

  // Either participant can cancel while still Scheduled — refunds the buyer's original escrow
  // debit in full. No partial-refund/no-show policy modeled yet, same scope cut as everything
  // else in this first booking pass — see CLAUDE.md.
  async cancel(sessionId: string, callerUserId: string): Promise<PublicCoachingSession> {
    const session = await this.getJoinedOrThrow(sessionId);
    const isBuyer = session.buyerId === callerUserId;
    const isCoach = session.coach.userId === callerUserId;
    if (!isBuyer && !isCoach) {
      throw new ForbiddenException('Not a participant in this session');
    }
    assertValidSessionTransition(session.status, CoachingSessionStatus.Cancelled);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(CoachingSession, session.id, { status: CoachingSessionStatus.Cancelled });
      await this.wallet.refundBuyerForSession(session.buyerId, session.id, session.priceWaveCoin, manager);
    });

    const full = await this.getJoinedOrThrow(session.id);
    const notifyUserId = isBuyer ? full.coach.userId : full.buyerId;
    await this.notify(
      notifyUserId,
      NotificationType.SessionCancelled,
      'სესია გაუქმებულია',
      `სესია ${full.scheduledAt.toISOString()} გაუქმდა.`,
      full.id,
    );
    return this.toPublic(full);
  }
}
