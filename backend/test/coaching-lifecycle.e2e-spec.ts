import { assertConserved, startSession } from './flows';
import { balanceOf, createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';
import { CoachingSessionsService } from '../src/coaching/coaching-sessions.service';

// The 6-step booking flow + coaching lifecycle v2 (client feedback 2026-10-02): booking
// notifications, start confirmation with 10-minute reminders and auto-cancel + refund, coach "done"
// → student confirms (or 48h auto-confirm) → coach paid, review request, fee visibility, welcome.
describe('coaching booking + lifecycle v2 (e2e)', () => {
  let ctx: E2eApp;
  let coachUser: TestUser;
  let buyer: TestUser;
  let coachId: string;
  let sweep: CoachingSessionsService['sweep'];
  const at = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString();
  const row = async (id: string) => (await ctx.dataSource.query(`SELECT * FROM coaching_sessions WHERE id = $1`, [id]))[0];
  const notes = async (u: TestUser) => (await u.client.get('/notifications')).body as Array<{ type: string; title: string; body: string }>;
  const step3 = { goal: 'Reach Conqueror and fix my close-range fights.', discord: 'gio.wavehub' };

  beforeAll(async () => {
    ctx = await createApp();
    const service = ctx.app.get(CoachingSessionsService);
    sweep = service.sweep.bind(service);
    const ops = await registerUser(ctx, 'lcops');
    await makeAdmin(ctx, ops, 'marketplace_coaching_ops_manager');
    coachUser = await registerUser(ctx, 'lccoach');
    buyer = await registerUser(ctx, 'lcbuyer');
    await credit(ctx, buyer, 1000);
    const created = await ops.client.post('/admin/coaches', {
      username: coachUser.username, specialty: 'Rank pushing', bio: 'Ten years of competitive experience across several titles.', hourlyRateWaveCoin: 40,
    });
    coachId = created.body.id;
    await ctx.dataSource.query(`UPDATE platform_settings SET "platformFeePercent" = 10`);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('a new account gets a welcome notification', async () => {
    const fresh = await registerUser(ctx, 'lcwelcome');
    expect((await notes(fresh)).map((n) => n.type)).toContain('welcome');
  });

  it('6-step booking: a 3-session package books three sessions with one total price, goal and Discord, and notifies both sides', async () => {
    const pkgs = await coachUser.client.request('PUT', '/coaches/mine/packages', {
      packages: [{ name: 'Growth', description: 'Three sessions with homework.', sessionsCount: 3, durationMinutes: 60, priceWaveCoin: 100 }],
    });
    expect(pkgs.status).toBe(200);
    expect(pkgs.body[0].sessionsCount).toBe(3);
    const pkgId = pkgs.body[0].id;
    const before = await balanceOf(ctx, buyer);

    // Wrong slot count, overlapping slots, missing goal/Discord.
    const book = (body: Record<string, unknown>) => buyer.client.post(`/coaches/${coachId}/bookings`, body);
    expect((await book({ packageId: pkgId, slots: [at(30), at(31)], ...step3 })).status).toBe(400);
    expect((await book({ packageId: pkgId, slots: [at(30), at(30.5), at(33)], ...step3 })).status).toBe(400);
    expect((await book({ packageId: pkgId, slots: [at(30), at(32), at(34)], discord: 'gio' })).status).toBe(400);
    expect((await book({ packageId: pkgId, slots: [at(30), at(32), at(34)], goal: step3.goal })).status).toBe(400);

    const res = await book({ packageId: pkgId, slots: [at(34), at(30), at(32)], ...step3, challenges: 'Panic in final circles' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(3);
    expect(res.body.map((s: { priceWaveCoin: number }) => s.priceWaveCoin)).toEqual([34, 33, 33]); // sorted by time, remainder first
    expect(new Set(res.body.map((s: { bookingGroupId: string }) => s.bookingGroupId)).size).toBe(1);
    expect(res.body[0]).toMatchObject({ packageName: 'Growth', goal: step3.goal, discord: 'gio.wavehub', challenges: 'Panic in final circles', status: 'scheduled' });
    expect(res.body[0]).toMatchObject({ platformFeePercent: 10, platformFeeWaveCoin: 3, coachPayoutWaveCoin: 31 });
    expect(await balanceOf(ctx, buyer)).toBe(before - 100);

    // Booked times are busy; booking over them is refused.
    const busy = (await buyer.client.get(`/coaches/${coachId}/busy`)).body;
    expect(busy.length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(busy[0]).sort()).toEqual(['end', 'start']);
    const clash = await buyer.client.post(`/coaches/${coachId}/bookings`, { durationMinutes: 60, slots: [new Date(new Date(res.body[0].scheduledAt).getTime() + 30 * 60_000).toISOString()], ...step3 });
    expect(clash.status).toBe(409);

    expect((await notes(buyer)).find((n) => n.title === 'სესია წარმატებით დაიჯავშნა')?.body).toContain('100 GEL');
    expect((await notes(coachUser)).map((n) => n.title)).toContain('ახალი ჯავშანი');
    // Discord/goal stay private: not in the coach's public profile.
    expect(JSON.stringify((await buyer.client.get(`/coaches/${coachId}`)).body)).not.toContain('gio.wavehub');
  });

  it('start: reminders every 10 minutes to whoever has not confirmed, then auto-cancel with a full refund', async () => {
    const before = await balanceOf(ctx, buyer);
    const s = (await buyer.client.post(`/coaches/${coachId}/bookings`, { durationMinutes: 60, slots: [at(50)], ...step3 })).body[0];
    expect(await balanceOf(ctx, buyer)).toBe(before - 40);
    const scheduled = new Date(Date.now() + 10 * 60_000);
    await ctx.dataSource.query(`UPDATE coaching_sessions SET "scheduledAt" = $2 WHERE id = $1`, [s.id, scheduled]);

    // Too early to confirm yet? 10 minutes before is inside the 15-minute window.
    expect((await coachUser.client.post(`/coaching-sessions/${s.id}/confirm-start`)).status).toBe(200);
    const t0 = new Date();
    let r = await sweep(t0); // "starting soon" — only the student still needs to confirm
    expect(r.reminded).toBeGreaterThanOrEqual(1);
    expect((await row(s.id)).remindersSent).toBe(1);
    r = await sweep(new Date(t0.getTime() + 5 * 60_000)); // < 10 minutes later: nothing
    expect((await row(s.id)).remindersSent).toBe(1);
    await sweep(new Date(scheduled.getTime() + 60_000)); // at start: reminder
    await sweep(new Date(scheduled.getTime() + 12 * 60_000)); // 10+ minutes later: another
    expect((await row(s.id)).remindersSent).toBe(3);
    const buyerNotes = (await notes(buyer)).filter((n) => n.type === 'session_starting');
    expect(buyerNotes.length).toBeGreaterThanOrEqual(3);
    expect((await notes(coachUser)).filter((n) => n.type === 'session_starting' && n.title !== 'დაადასტურე სესიის დაწყება').length).toBe(0); // the coach already confirmed

    // The coach can't complete (and take the money) without a started session.
    expect((await coachUser.client.post(`/coaching-sessions/${s.id}/complete`)).status).toBe(409);

    // Window over → cancelled, refunded, both told.
    r = await sweep(new Date(scheduled.getTime() + 61 * 60_000));
    expect(r.cancelled).toBeGreaterThanOrEqual(1);
    expect((await row(s.id)).status).toBe('cancelled');
    expect(await balanceOf(ctx, buyer)).toBe(before);
    expect((await notes(coachUser)).some((n) => n.title === 'სესია გაუქმდა' && n.body.includes('ვერ დაადასტურა'))).toBe(true);
    expect((await buyer.client.post(`/coaching-sessions/${s.id}/confirm-start`)).status).toBe(409);
  });

  it('finish: coach marks done → student confirms → coach paid with the fee shown → review requested and accepted', async () => {
    const coachBefore = await balanceOf(ctx, coachUser);
    const s = (await buyer.client.post(`/coaches/${coachId}/bookings`, { durationMinutes: 60, slots: [at(70)], ...step3 })).body[0];
    const started = await startSession(ctx, coachUser, buyer, s.id);
    expect(started.status).toBe('in_progress');
    expect((await notes(buyer)).some((n) => n.type === 'session_started')).toBe(true);
    expect((await buyer.client.post(`/coaching-sessions/${s.id}/cancel`)).status).toBe(409); // student can't cancel after start

    const done = await coachUser.client.post(`/coaching-sessions/${s.id}/complete`);
    expect(done.body).toMatchObject({ status: 'awaiting_confirmation' });
    expect(done.body.autoConfirmAt).toBeTruthy();
    expect(await balanceOf(ctx, coachUser)).toBe(coachBefore);
    expect((await notes(buyer)).some((n) => n.type === 'session_awaiting_confirmation')).toBe(true);

    const confirmed = await buyer.client.post(`/coaching-sessions/${s.id}/confirm-complete`);
    expect(confirmed.body).toMatchObject({ status: 'completed', coachPayoutWaveCoin: 36, platformFeeWaveCoin: 4 });
    expect(await balanceOf(ctx, coachUser)).toBe(coachBefore + 36);
    const coachNote = (await notes(coachUser)).find((n) => n.type === 'session_completed');
    expect(coachNote?.body).toContain('36 GEL');
    expect(coachNote?.body).toContain('10%');
    expect((await notes(buyer)).some((n) => n.type === 'session_review_request')).toBe(true);

    // Review: GET answers {review: null} first (an empty body used to hide the form), then the review.
    expect((await buyer.client.get(`/coaching-sessions/${s.id}/review`)).body).toEqual({ review: null });
    expect((await buyer.client.post(`/coaching-sessions/${s.id}/review`, { rating: 5, body: 'Super helpful.' })).status).toBe(201);
    expect((await buyer.client.get(`/coaching-sessions/${s.id}/review`)).body.review.rating).toBe(5);
  });

  it('an unanswered "done" auto-confirms after 48 hours', async () => {
    const coachBefore = await balanceOf(ctx, coachUser);
    const s = (await buyer.client.post(`/coaches/${coachId}/bookings`, { durationMinutes: 60, slots: [at(90)], ...step3 })).body[0];
    await startSession(ctx, coachUser, buyer, s.id);
    await coachUser.client.post(`/coaching-sessions/${s.id}/complete`);
    expect((await sweep(new Date(Date.now() + 47 * 3600_000))).autoCompleted).toBe(0);
    expect((await sweep(new Date(Date.now() + 49 * 3600_000))).autoCompleted).toBeGreaterThanOrEqual(1);
    expect((await row(s.id)).status).toBe('completed');
    expect(await balanceOf(ctx, coachUser)).toBe(coachBefore + 36);
  });
});
