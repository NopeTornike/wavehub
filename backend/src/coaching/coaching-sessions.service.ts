import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Brackets, DataSource, EntityManager, In, Repository } from 'typeorm';
import { CoachStatus, CoachingSessionStatus, DEFAULT_COACH_AVAILABILITY, NotificationType, VerificationStatus, coachAvailabilityProblem } from '@wavehub/shared-types';
import type { PublicCoachReview, PublicCoachingSession } from '@wavehub/shared-types';
import { CoachingSession } from './coaching-session.entity';
import { Coach } from './coach.entity';
import { RequestSessionDto } from './dto/request-session.dto';
import { BookSessionsDto } from './dto/book-sessions.dto';
import { ReviewSessionDto } from './dto/review-session.dto';
import { CoachingSessionReview } from './coaching-session-review.entity';
import { assertValidSessionTransition } from './coaching-session-lifecycle';
import { WalletService } from '../wallet/wallet.service';
import { calculatePlatformFee } from '../wallet/fee.util';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { withTransactionRetry } from '../wallet/transaction-retry.util';
import { CoachingPackage } from './coaching-package.entity';
import { CoachingPackagesService } from './coaching-packages.service';
import { validateBookingAnswers } from './booking-questions';
import { personName } from '../common/person-name';

const DEFAULT_HOLD_DAYS = 7;
// Lifecycle v2 timings (coaching/CLAUDE.md "Lifecycle v2").
export const START_EARLY_MINUTES = 15; // the start can be confirmed this early
export const START_GRACE_MINUTES = 60; // …and until this long after the scheduled time
export const REMINDER_EVERY_MINUTES = 10;
// Fallback window for sessions marked done before autoConfirmAt was stored; the live value is
// `sessionAutoConfirmHours` in Admin → Settings.
export const AUTO_CONFIRM_HOURS = 48;
// An in-progress session is marked done automatically this long after its booked end time (client,
// 2026-10-02: "when the time is over the end isn't confirmed").
export const END_GRACE_MINUTES = 15;
const MINUTE = 60_000;
// Sessions that hold a coach's time (no overlapping bookings).
const OCCUPYING = [CoachingSessionStatus.Scheduled, CoachingSessionStatus.InProgress, CoachingSessionStatus.AwaitingConfirmation];

// "02.10 20:00" in Tbilisi time — language-neutral, so the EN translator leaves it as is.
export function formatSessionTime(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tbilisi', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.day}.${parts.month} ${parts.hour}:${parts.minute}`;
}

function startDeadline(session: CoachingSession): Date {
  return new Date(session.scheduledAt.getTime() + START_GRACE_MINUTES * MINUTE);
}

@Injectable()
export class CoachingSessionsService {
  private readonly logger = new Logger(CoachingSessionsService.name);

  constructor(
    @InjectRepository(CoachingSession) private readonly sessions: Repository<CoachingSession>,
    @InjectRepository(Coach) private readonly coaches: Repository<Coach>,
    @InjectRepository(CoachingSessionReview) private readonly reviews: Repository<CoachingSessionReview>,
    private readonly dataSource: DataSource,
    private readonly wallet: WalletService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly notifications: NotificationsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly packages: CoachingPackagesService,
  ) {}

  // Best-effort: a failed notification never undoes the action that triggered it.
  private async notify(userId: string, type: NotificationType, title: string, body: string, sessionId: string): Promise<void> {
    try {
      await this.notifications.emit(userId, type, title, body, { sessionId });
    } catch (err) {
      this.logger.error(`Failed to notify user ${userId} for session ${sessionId}`, err as Error);
    }
  }

  // For the staff dispute view.
  toPublicSession(session: CoachingSession): PublicCoachingSession {
    return this.toPublic(session);
  }

  private toPublic(session: CoachingSession): PublicCoachingSession {
    const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
    return {
      id: session.id,
      coachId: session.coachId,
      coachUserId: session.coach.userId,
      coachUsername: session.coach.user.username,
      coachFirstName: session.coach.user.firstName,
      coachLastName: session.coach.user.lastName,
      coachAvatarUrl: session.coach.user.avatarUrl ?? null,
      coachVerified: session.coach.verificationStatus === VerificationStatus.Verified,
      buyerId: session.buyerId,
      buyerUsername: session.buyer.username,
      buyerFirstName: session.buyer.firstName,
      buyerLastName: session.buyer.lastName,
      buyerAvatarUrl: session.buyer.avatarUrl ?? null,
      scheduledAt: session.scheduledAt.toISOString(),
      durationMinutes: session.durationMinutes,
      priceWaveCoin: session.priceWaveCoin,
      buyerMessage: session.buyerMessage,
      packageName: session.packageName ?? null,
      answers: session.answers ?? null,
      bookingGroupId: session.bookingGroupId ?? null,
      goal: session.goal ?? null,
      challenges: session.challenges ?? null,
      discord: session.discord ?? null,
      coachStartConfirmedAt: iso(session.coachStartConfirmedAt),
      buyerStartConfirmedAt: iso(session.buyerStartConfirmedAt),
      startedAt: iso(session.startedAt),
      coachCompletedAt: iso(session.coachCompletedAt),
      completedAt: iso(session.completedAt),
      startDeadline: startDeadline(session).toISOString(),
      autoConfirmAt: session.autoConfirmAt
        ? session.autoConfirmAt.toISOString()
        : session.coachCompletedAt
          ? new Date(session.coachCompletedAt.getTime() + AUTO_CONFIRM_HOURS * 3600_000).toISOString()
          : null,
      platformFeePercent: session.platformFeePercentSnapshot,
      platformFeeWaveCoin: session.platformFeeWaveCoin,
      coachPayoutWaveCoin: session.coachPayoutWaveCoin,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      serverNow: new Date().toISOString(),
    };
  }

  async getJoinedOrThrow(id: string): Promise<CoachingSession> {
    const session = await this.sessions.findOne({
      where: { id },
      relations: { coach: { user: true }, buyer: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  // --- Booking ---

  // The legacy single-session form (POST coaches/:id/sessions) — one slot, goal/Discord optional.
  async request(buyerId: string, coachId: string, dto: RequestSessionDto): Promise<PublicCoachingSession> {
    const [first] = await this.bookInternal(buyerId, coachId, {
      packageId: dto.packageId,
      durationMinutes: dto.durationMinutes,
      slots: [dto.scheduledAt],
      answers: dto.answers,
      buyerMessage: dto.buyerMessage,
    });
    return first;
  }

  // The 6-step booking flow (POST coaches/:id/bookings): a single hourly session or one of the
  // coach's packages (its sessionsCount slots), paid from the student's WaveCoin balance into
  // escrow — one escrow entry per session, so each can be completed or refunded on its own.
  async book(buyerId: string, coachId: string, dto: BookSessionsDto): Promise<PublicCoachingSession[]> {
    return this.bookInternal(buyerId, coachId, dto);
  }

  private async bookInternal(
    buyerId: string,
    coachId: string,
    dto: { packageId?: string; durationMinutes?: number; slots: string[]; answers?: Record<string, unknown>; buyerMessage?: string; goal?: string; challenges?: string; discord?: string },
  ): Promise<PublicCoachingSession[]> {
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

    // A package fixes the number of sessions, their length and the total price; otherwise one
    // session of the chosen length at the hourly rate.
    // Packages are the platform's (the same for every coach — coaching-packages.service.ts).
    let pkg: CoachingPackage | null = null;
    if (dto.packageId) {
      pkg = await this.packages.getActive(dto.packageId);
    } else if (!dto.durationMinutes) {
      throw new BadRequestException('Choose a duration or a package');
    }
    const count = pkg ? pkg.sessionsCount ?? 1 : 1;
    const durationMinutes = pkg ? pkg.durationMinutes : (dto.durationMinutes as number);
    if (dto.slots.length !== count) {
      throw new BadRequestException(`Choose exactly ${count} time slot${count === 1 ? '' : 's'}`);
    }
    const starts = dto.slots.map((s) => new Date(s));
    if (starts.some((d) => Number.isNaN(d.getTime()))) throw new BadRequestException('Invalid date');
    const now = Date.now();
    if (starts.some((d) => d.getTime() <= now)) {
      throw new ForbiddenException('scheduledAt must be in the future');
    }
    // Every slot must fall inside the coach's working hours (coachAvailabilityProblem is the same
    // check the booking calendar uses to offer slots).
    const availability = coach.availability ?? DEFAULT_COACH_AVAILABILITY;
    for (const start of starts) {
      const problem = coachAvailabilityProblem(availability, start.getTime(), durationMinutes, now);
      if (problem === 'notice') throw new BadRequestException(`This coach needs at least ${availability.noticeHours} hour(s) notice`);
      if (problem === 'horizon') throw new BadRequestException('Sessions can be booked at most 60 days ahead');
      if (problem) throw new BadRequestException("One of the chosen times is outside the coach's working hours");
    }
    starts.sort((a, b) => a.getTime() - b.getTime());
    for (let i = 1; i < starts.length; i++) {
      if (starts[i].getTime() < starts[i - 1].getTime() + durationMinutes * MINUTE) {
        throw new BadRequestException('Your chosen times overlap');
      }
    }
    const answers = validateBookingAnswers(coach.bookingQuestions ?? [], dto.answers);

    const total = pkg ? pkg.priceWaveCoin : Math.round((coach.hourlyRateWaveCoin * durationMinutes) / 60);
    // Split a package's total over its sessions (the first carries any remainder).
    const prices = Array.from({ length: count }, (_, i) => Math.floor(total / count) + (i === 0 ? total % count : 0));
    const platformFeePercent = await this.subscriptions.effectiveFeePercent(coach.userId, await this.platformSettings.getCoachingFeePercent());
    const bookingGroupId = randomUUID();

    const ids = await withTransactionRetry(() =>
      this.dataSource.transaction(async (manager) => {
        // Lock order: the buyer's account (WalletService.lockAccount — prevents same-buyer 40P01
        // deadlocks), then the coach row, so concurrent bookings of this coach can't double-book a slot.
        await this.wallet.lockAccount(buyerId, manager);
        await manager.findOne(Coach, { where: { id: coach.id }, lock: { mode: 'pessimistic_write' } });
        const busy = await manager.find(CoachingSession, { where: { coachId: coach.id, status: In(OCCUPYING) } });
        for (const start of starts) {
          const end = start.getTime() + durationMinutes * MINUTE;
          const clash = busy.find((b) => start.getTime() < b.scheduledAt.getTime() + b.durationMinutes * MINUTE && b.scheduledAt.getTime() < end);
          if (clash) throw new ConflictException('One of the chosen times is no longer available');
        }
        const created: string[] = [];
        for (const [i, start] of starts.entries()) {
          const { feeWaveCoin, sellerReceivesWaveCoin } = calculatePlatformFee(prices[i], platformFeePercent);
          const row = await manager.save(
            manager.create(CoachingSession, {
              coachId: coach.id,
              buyerId,
              scheduledAt: start,
              durationMinutes,
              priceWaveCoin: prices[i],
              platformFeePercentSnapshot: platformFeePercent,
              platformFeeWaveCoin: feeWaveCoin,
              coachPayoutWaveCoin: sellerReceivesWaveCoin,
              buyerMessage: dto.buyerMessage?.trim() || null,
              packageId: pkg?.id ?? null,
              packageName: pkg?.name ?? null,
              answers,
              bookingGroupId,
              goal: dto.goal?.trim() || null,
              challenges: dto.challenges?.trim() || null,
              discord: dto.discord?.trim() || null,
              status: CoachingSessionStatus.Scheduled,
            }),
          );
          // Throws INSUFFICIENT_BALANCE (translated below) — the whole booking rolls back.
          await this.wallet.debitForSession(buyerId, row.id, prices[i], manager);
          created.push(row.id);
        }
        return created;
      }),
    ).catch((err) => {
      if (err instanceof Error && err.message === 'INSUFFICIENT_BALANCE') {
        throw new ForbiddenException('Insufficient WaveCoin balance for this session');
      }
      throw err;
    });

    const rows = await this.sessions.find({ where: { id: In(ids) }, relations: { coach: { user: true }, buyer: true }, order: { scheduledAt: 'ASC' } });
    const first = rows[0];
    const when = rows.map((r) => formatSessionTime(r.scheduledAt)).join(', ');
    const what = pkg ? `„${pkg.name}“ (${count} სესია)` : `${durationMinutes}-წუთიანი სესია`;
    await this.notify(
      buyerId,
      NotificationType.SessionBooked,
      'სესია წარმატებით დაიჯავშნა',
      `შენ დაჯავშნე ${what} ${personName(coach.user)}-თან: ${when}. თანხა (${total} GEL) დაცულია და ქოუჩს ჩაერიცხება მხოლოდ სესიის დასრულების შემდეგ.`,
      first.id,
    );
    await this.notify(
      coach.userId,
      NotificationType.SessionBooked,
      'ახალი ჯავშანი',
      `${personName(first.buyer)}-მა დაჯავშნა ${what}: ${when}.`,
      first.id,
    );
    return rows.map((r) => this.toPublic(r));
  }

  // When the coach is already booked (next 60 days) — the booking calendar greys these out.
  // Times only; nothing about who booked them.
  async busy(coachId: string): Promise<Array<{ start: string; end: string }>> {
    const now = new Date();
    const rows = await this.sessions
      .createQueryBuilder('s')
      .select(['s.scheduledAt', 's.durationMinutes'])
      .where('s.coachId = :coachId', { coachId })
      .andWhere('s.status IN (:...statuses)', { statuses: OCCUPYING })
      .andWhere('s.scheduledAt > :from', { from: new Date(now.getTime() - 8 * 3600_000) })
      .andWhere('s.scheduledAt < :to', { to: new Date(now.getTime() + 60 * 86400_000) })
      .orderBy('s.scheduledAt', 'ASC')
      .getMany();
    return rows.map((r) => ({ start: r.scheduledAt.toISOString(), end: new Date(r.scheduledAt.getTime() + r.durationMinutes * MINUTE).toISOString() }));
  }

  // --- Reads ---

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

  // The buyer's review of a completed session — once per session (unique sessionId). Recomputes the
  // coach's rating aggregate in the same transaction, with the coach row locked so two reviews
  // landing together can't both write a stale average.
  async review(sessionId: string, buyerId: string, dto: ReviewSessionDto): Promise<PublicCoachReview> {
    const session = await this.getJoinedOrThrow(sessionId);
    if (session.buyerId !== buyerId) throw new ForbiddenException('Only the buyer can review this session');
    if (session.status !== CoachingSessionStatus.Completed) throw new ConflictException('Only a completed session can be reviewed');
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        await manager.findOne(Coach, { where: { id: session.coachId }, lock: { mode: 'pessimistic_write' } });
        const row = await manager.save(
          manager.create(CoachingSessionReview, { sessionId, coachId: session.coachId, buyerId, rating: dto.rating, body: dto.body?.trim() || null }),
        );
        const [agg] = await manager.query(
          `SELECT round(avg("rating")::numeric, 2) AS avg, count(*)::int AS n FROM "coaching_session_reviews" WHERE "coachId" = $1`,
          [session.coachId],
        );
        await manager.update(Coach, { id: session.coachId }, { ratingAvg: agg.avg, ratingCount: agg.n });
        return row;
      });
      return { id: saved.id, rating: saved.rating, body: saved.body, buyerUsername: session.buyer.username, createdAt: saved.createdAt.toISOString() };
    } catch (err) {
      if ((err as { code?: string }).code === '23505') throw new ConflictException('You already reviewed this session');
      throw err;
    }
  }

  // `{ review: null }` rather than a bare null — an empty response body read as "already reviewed"
  // on the frontend and hid the review form (client bug #3, 2026-10-02).
  async getReview(sessionId: string, userId: string): Promise<{ review: PublicCoachReview | null }> {
    const session = await this.getJoinedOrThrow(sessionId);
    if (session.buyerId !== userId && session.coach.userId !== userId) throw new ForbiddenException('Not a participant in this session');
    const row = await this.reviews.findOne({ where: { sessionId } });
    return { review: row ? { id: row.id, rating: row.rating, body: row.body, buyerUsername: session.buyer.username, createdAt: row.createdAt.toISOString() } : null };
  }

  // Re-checks the transition under a row lock — the status read before the transaction may already
  // be stale (two actions racing, or the sweep), which used to double-pay/refund.
  // `from` narrows the allowed starting statuses beyond the transition graph (e.g. a participant's
  // cancel must never consume a session that became Disputed a moment ago).
  private async lockAndRevalidate(manager: EntityManager, sessionId: string, target: CoachingSessionStatus, from?: CoachingSessionStatus[]): Promise<CoachingSession> {
    const locked = await manager.findOne(CoachingSession, { where: { id: sessionId }, lock: { mode: 'pessimistic_write' } });
    if (!locked) {
      throw new NotFoundException('Session not found');
    }
    if (from && !from.includes(locked.status)) {
      throw new ConflictException('This session was just updated — reload and try again');
    }
    assertValidSessionTransition(locked.status, target);
    return locked;
  }

  // --- Lifecycle v2 ---

  // Either participant confirms the session started (from 15 minutes before until 60 minutes after
  // the scheduled time). Once both have, it's InProgress.
  async confirmStart(sessionId: string, callerUserId: string): Promise<PublicCoachingSession> {
    const session = await this.getJoinedOrThrow(sessionId);
    const isBuyer = session.buyerId === callerUserId;
    const isCoach = session.coach.userId === callerUserId;
    if (!isBuyer && !isCoach) throw new ForbiddenException('Not a participant in this session');
    if (session.status !== CoachingSessionStatus.Scheduled) throw new ConflictException('This session is not waiting to start');
    const now = Date.now();
    if (now < session.scheduledAt.getTime() - START_EARLY_MINUTES * MINUTE) {
      throw new ConflictException(`You can confirm the start from ${START_EARLY_MINUTES} minutes before the session`);
    }
    if (now > startDeadline(session).getTime()) throw new ConflictException('The time to confirm the start has passed');

    let startedNow = false;
    await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(CoachingSession, { where: { id: session.id }, lock: { mode: 'pessimistic_write' } });
      if (!locked || locked.status !== CoachingSessionStatus.Scheduled) throw new ConflictException('This session is not waiting to start');
      const patch: Partial<CoachingSession> = {};
      if (isCoach && !locked.coachStartConfirmedAt) patch.coachStartConfirmedAt = new Date();
      if (isBuyer && !locked.buyerStartConfirmedAt) patch.buyerStartConfirmedAt = new Date();
      const coachDone = locked.coachStartConfirmedAt || patch.coachStartConfirmedAt;
      const buyerDone = locked.buyerStartConfirmedAt || patch.buyerStartConfirmedAt;
      if (coachDone && buyerDone) {
        assertValidSessionTransition(locked.status, CoachingSessionStatus.InProgress);
        patch.status = CoachingSessionStatus.InProgress;
        patch.startedAt = new Date();
        startedNow = true;
      }
      if (Object.keys(patch).length) await manager.update(CoachingSession, session.id, patch);
    });

    const full = await this.getJoinedOrThrow(session.id);
    if (startedNow) {
      for (const userId of [full.buyerId, full.coach.userId]) {
        await this.notify(userId, NotificationType.SessionStarted, 'სესია დაიწყო', 'ორივე მხარემ დაადასტურა — სესია დაწყებულია. წარმატებებს გისურვებთ!', full.id);
      }
    } else {
      const otherId = isCoach ? full.buyerId : full.coach.userId;
      const who = isCoach ? `ქოუჩმა ${personName(full.coach.user)}-მა` : `${personName(full.buyer)}-მა`;
      await this.notify(otherId, NotificationType.SessionStarting, 'დაადასტურე სესიის დაწყება', `${who} დაადასტურა, რომ სესია დაიწყო. ახლა შენი დადასტურებაა საჭირო.`, full.id);
    }
    return this.toPublic(full);
  }

  // Coach-only, InProgress only: marks the session done. The coach is paid when the student
  // confirms (or after the session's autoConfirmAt) — never on the coach's word alone.
  async complete(sessionId: string, callerUserId: string): Promise<PublicCoachingSession> {
    const session = await this.getJoinedOrThrow(sessionId);
    if (session.coach.userId !== callerUserId) {
      throw new ForbiddenException('Only the coach can mark a session completed');
    }
    if (session.status === CoachingSessionStatus.Scheduled) {
      throw new ConflictException('Both sides must confirm the session started before it can be completed');
    }
    assertValidSessionTransition(session.status, CoachingSessionStatus.AwaitingConfirmation);
    await this.markDone(session.id, false);
    return this.toPublic(await this.getJoinedOrThrow(session.id));
  }

  // InProgress → AwaitingConfirmation, by the coach or (auto) by the sweep after the booked end.
  private async markDone(sessionId: string, auto: boolean): Promise<void> {
    // The window is fixed for this session now; a later settings change doesn't move it.
    const hours = await this.platformSettings.getSessionAutoConfirmHours();
    await this.dataSource.transaction(async (manager) => {
      await this.lockAndRevalidate(manager, sessionId, CoachingSessionStatus.AwaitingConfirmation);
      const now = new Date();
      await manager.update(CoachingSession, sessionId, {
        status: CoachingSessionStatus.AwaitingConfirmation,
        coachCompletedAt: now,
        autoConfirmAt: new Date(now.getTime() + hours * 3600_000),
      });
    });
    const full = await this.getJoinedOrThrow(sessionId);
    await this.notify(
      full.buyerId,
      NotificationType.SessionAwaitingConfirmation,
      'დაადასტურე სესიის დასრულება',
      `${auto ? 'სესიის დრო დასრულდა.' : `ქოუჩმა ${personName(full.coach.user)}-მა სესია დასრულებულად მონიშნა.`} დაადასტურე, რომ სესია შედგა — თუ ${hours} საათში არ უპასუხებ, ავტომატურად დადასტურდება.`,
      full.id,
    );
    await this.notify(
      full.coach.userId,
      NotificationType.SessionAwaitingConfirmation,
      auto ? 'სესიის დრო დასრულდა' : 'სესია დასრულებულად მოინიშნა',
      `ველოდებით ${personName(full.buyer)}-ის დადასტურებას. ${full.coachPayoutWaveCoin} GEL ჩაგერიცხება დადასტურებისთანავე (არაუგვიანეს ${hours} საათისა).`,
      full.id,
    );
  }

  // Student-only, AwaitingConfirmation only: confirms the session happened → escrow released.
  async confirmComplete(sessionId: string, callerUserId: string): Promise<PublicCoachingSession> {
    const session = await this.getJoinedOrThrow(sessionId);
    if (session.buyerId !== callerUserId) throw new ForbiddenException('Only the student can confirm the session');
    assertValidSessionTransition(session.status, CoachingSessionStatus.Completed);
    await this.finish(session.id, false);
    return this.toPublic(await this.getJoinedOrThrow(session.id));
  }

  // Completed: release the coach's payout (same 7-day withdrawal hold as an order) and tell both.
  private async finish(sessionId: string, automatic: boolean): Promise<void> {
    await this.dataSource.transaction((manager) => this.payCoachIn(manager, sessionId));
    await this.notifyFinished(sessionId, automatic ? 'სესია ავტომატურად დადასტურდა. ' : null);
  }

  // Escrow → coach (7-day hold), inside the caller's transaction. Re-validates the status under
  // the row lock, so a concurrent confirm / dispute decision can't pay twice.
  async payCoachIn(manager: EntityManager, sessionId: string, from: CoachingSessionStatus[] = [CoachingSessionStatus.AwaitingConfirmation]): Promise<void> {
    const locked = await this.lockAndRevalidate(manager, sessionId, CoachingSessionStatus.Completed, from);
    const coach = await manager.findOneOrFail(Coach, { where: { id: locked.coachId } });
    await manager.update(CoachingSession, sessionId, { status: CoachingSessionStatus.Completed, completedAt: new Date() });
    await this.wallet.releaseCoachEarnings(coach.userId, sessionId, locked.coachPayoutWaveCoin, DEFAULT_HOLD_DAYS, manager);
  }

  // Escrow → student, inside the caller's transaction (same lock re-validation).
  async refundStudentIn(manager: EntityManager, sessionId: string, from: CoachingSessionStatus[] = [CoachingSessionStatus.Scheduled, CoachingSessionStatus.InProgress]): Promise<void> {
    const locked = await this.lockAndRevalidate(manager, sessionId, CoachingSessionStatus.Cancelled, from);
    await manager.update(CoachingSession, sessionId, { status: CoachingSessionStatus.Cancelled });
    await this.wallet.refundBuyerForSession(locked.buyerId, sessionId, locked.priceWaveCoin, manager);
  }

  // `lead` replaces the default "@student confirmed the session." opening (auto-confirm, dispute).
  async notifyFinished(sessionId: string, lead: string | null): Promise<void> {
    const full = await this.getJoinedOrThrow(sessionId);
    await this.notify(
      full.coach.userId,
      NotificationType.SessionCompleted,
      'სესია წარმატებით დასრულდა',
      `${lead ?? `${personName(full.buyer)}-მა დაადასტურა სესია. `}დაგერიცხა ${full.coachPayoutWaveCoin} GEL (ფასი ${full.priceWaveCoin} GEL, პლატფორმის საკომისიო ${full.platformFeePercentSnapshot}% — ${full.platformFeeWaveCoin} GEL). თანხა გასატანად ხელმისაწვდომი იქნება ${DEFAULT_HOLD_DAYS} დღეში.`,
      full.id,
    );
    await this.notify(
      full.buyerId,
      NotificationType.SessionReviewRequest,
      'შეაფასე სესია',
      `როგორ ჩაიარა სესიამ ${personName(full.coach.user)}-თან? დაწერე შეფასება — ის სხვა მოსწავლეებს დაეხმარება.`,
      full.id,
    );
  }

  // The student can cancel only before the session starts; the coach until it's marked done.
  // Either way the student is refunded in full.
  async cancel(sessionId: string, callerUserId: string): Promise<PublicCoachingSession> {
    const session = await this.getJoinedOrThrow(sessionId);
    const isBuyer = session.buyerId === callerUserId;
    const isCoach = session.coach.userId === callerUserId;
    if (!isBuyer && !isCoach) {
      throw new ForbiddenException('Not a participant in this session');
    }
    if (isBuyer && session.status !== CoachingSessionStatus.Scheduled) {
      throw new ConflictException('The session has started — contact support if something went wrong');
    }
    if (session.status === CoachingSessionStatus.Disputed) {
      throw new ConflictException('This session is under dispute — WaveHub staff will decide');
    }
    assertValidSessionTransition(session.status, CoachingSessionStatus.Cancelled);
    await this.refund(session.id);
    const full = await this.getJoinedOrThrow(session.id);
    const notifyUserId = isBuyer ? full.coach.userId : full.buyerId;
    const who = isBuyer ? `${personName(full.buyer)}-მა` : `ქოუჩმა ${personName(full.coach.user)}-მა`;
    await this.notify(
      notifyUserId,
      NotificationType.SessionCancelled,
      'სესია გაუქმდა',
      `${who} გააუქმა სესია (${formatSessionTime(full.scheduledAt)}). ${full.priceWaveCoin} GEL დაუბრუნდა სტუდენტის ბალანსს.`,
      full.id,
    );
    return this.toPublic(full);
  }

  private async refund(sessionId: string): Promise<void> {
    await this.dataSource.transaction((manager) => this.refundStudentIn(manager, sessionId));
  }

  // --- The reminder / timeout sweep (every 2 minutes) ---

  @Cron('*/2 * * * *')
  async sweepCron(): Promise<void> {
    try {
      await this.sweep();
    } catch (err) {
      this.logger.error('Coaching session sweep failed', err as Error);
    }
  }

  // 1. Starting soon / started: remind whoever hasn't confirmed the start, every 10 minutes.
  // 2. Start window over without both confirmations: cancel and refund the student.
  // 3. In progress past the booked end + END_GRACE_MINUTES: mark done (the student confirms).
  // 4. "Done" unanswered for 48h: confirm automatically and pay the coach.
  // Public so the e2e suite can run it deterministically.
  async sweep(now = new Date()): Promise<{ reminded: number; cancelled: number; autoEnded: number; autoCompleted: number }> {
    const result = { reminded: 0, cancelled: 0, autoEnded: 0, autoCompleted: 0 };
    const t = now.getTime();

    const waiting = await this.sessions
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.coach', 'coach')
      .leftJoinAndSelect('coach.user', 'coachUser')
      .leftJoinAndSelect('s.buyer', 'buyer')
      .where('s.status = :scheduled', { scheduled: CoachingSessionStatus.Scheduled })
      .andWhere('s.scheduledAt <= :soon', { soon: new Date(t + START_EARLY_MINUTES * MINUTE) })
      .getMany();
    for (const s of waiting) {
      const deadline = startDeadline(s).getTime();
      if (t >= deadline) {
        try {
          await this.refund(s.id);
        } catch {
          continue; // someone acted at the same moment — the next sweep re-reads it
        }
        result.cancelled++;
        const body = `სესიის (${formatSessionTime(s.scheduledAt)}) დაწყება ორივე მხარემ დროულად ვერ დაადასტურა, ამიტომ ის გაუქმდა. ${s.priceWaveCoin} GEL დაუბრუნდა სტუდენტის ბალანსს.`;
        for (const userId of [s.buyerId, s.coach.userId]) await this.notify(userId, NotificationType.SessionCancelled, 'სესია გაუქმდა', body, s.id);
        continue;
      }
      if (s.lastReminderAt && t - s.lastReminderAt.getTime() < REMINDER_EVERY_MINUTES * MINUTE) continue;
      const pending = [
        ...(s.coachStartConfirmedAt ? [] : [s.coach.userId]),
        ...(s.buyerStartConfirmedAt ? [] : [s.buyerId]),
      ];
      const before = t < s.scheduledAt.getTime();
      const title = before ? 'სესია მალე იწყება' : s.remindersSent <= 1 ? 'სესია იწყება — დაადასტურე' : 'შეხსენება: დაადასტურე სესიის დაწყება';
      const body = before
        ? `სესია იწყება ${formatSessionTime(s.scheduledAt)}-ზე. როცა დაიწყებთ, ორივემ დაადასტურეთ დაწყება სესიის გვერდზე.`
        : `სესიის დრო (${formatSessionTime(s.scheduledAt)}) დადგა. დაადასტურე, რომ სესია დაიწყო — თუ ${formatSessionTime(new Date(deadline))}-მდე ორივე მხარე არ დაადასტურებს, სესია გაუქმდება და თანხა სტუდენტს დაუბრუნდება.`;
      for (const userId of pending) await this.notify(userId, NotificationType.SessionStarting, title, body, s.id);
      await this.sessions.update(s.id, { lastReminderAt: now, remindersSent: (s.remindersSent ?? 0) + 1 });
      result.reminded += pending.length;
    }

    // 3. In progress past the booked end (+ grace): mark done so the student can confirm.
    const ended = await this.sessions
      .createQueryBuilder('s')
      .select(['s.id'])
      .where('s.status = :inProgress', { inProgress: CoachingSessionStatus.InProgress })
      .andWhere(`s.scheduledAt + make_interval(mins => s.durationMinutes + :grace) <= :now`, { grace: END_GRACE_MINUTES, now })
      .getMany();
    for (const s of ended) {
      try {
        await this.markDone(s.id, true);
        result.autoEnded++;
      } catch {
        // the coach marked it or cancelled a moment ago
      }
    }

    const overdue = await this.sessions
      .createQueryBuilder('s')
      .select(['s.id'])
      .where('s.status = :awaiting', { awaiting: CoachingSessionStatus.AwaitingConfirmation })
      .andWhere(
        new Brackets((q) =>
          q
            .where('s.autoConfirmAt <= :now', { now: new Date(t) })
            .orWhere('s.autoConfirmAt IS NULL AND s.coachCompletedAt <= :cutoff', { cutoff: new Date(t - AUTO_CONFIRM_HOURS * 3600_000) }),
        ),
      )
      .getMany();
    for (const s of overdue) {
      try {
        await this.finish(s.id, true);
        result.autoCompleted++;
      } catch {
        // already confirmed by the student a moment ago
      }
    }
    return result;
  }
}
