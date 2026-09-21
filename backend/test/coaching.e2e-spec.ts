import { assertConserved, clearHold } from './flows';
import { balanceOf, createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

describe('coaching sessions (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let coachUser: TestUser;
  let buyer: TestUser;
  let coachId: string;
  const inOneDay = () => new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'cadmin');
    await makeAdmin(ctx, admin);
    coachUser = await registerUser(ctx, 'coach');
    buyer = await registerUser(ctx, 'cbuyer');
    await credit(ctx, buyer, 2000);

    const applied = await coachUser.client.post('/coaches/apply', {
      specialty: 'Rank pushing', bio: 'Ten years of competitive experience across several titles.', hourlyRateWaveCoin: 100,
    });
    expect(applied.status).toBeLessThan(300);
    coachId = applied.body.id;
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  const book = (u: TestUser, body: Record<string, unknown> = {}) =>
    u.client.post(`/coaches/${coachId}/sessions`, { scheduledAt: inOneDay(), durationMinutes: 90, ...body });
  const sessionRow = async (id: string) => (await ctx.dataSource.query(`SELECT * FROM coaching_sessions WHERE id = $1`, [id]))[0];

  it('an unverified coach cannot be booked and only verification staff may approve', async () => {
    const before = await balanceOf(ctx, buyer);
    expect((await book(buyer)).status).toBe(403);
    expect(await balanceOf(ctx, buyer)).toBe(before);

    const support = await registerUser(ctx, 'csupport');
    await makeAdmin(ctx, support, 'support_specialist');
    expect((await support.client.post(`/coaches/${coachId}/approve`)).status).toBe(403);
    expect((await buyer.client.post(`/coaches/${coachId}/approve`)).status).toBe(403);
    const lead = await registerUser(ctx, 'clead');
    await makeAdmin(ctx, lead, 'operation_lead');
    expect((await lead.client.post(`/coaches/${coachId}/approve`)).status).toBe(200);
    const dir = (await buyer.client.get('/coaches')).body;
    expect((dir.items ?? dir).map((c: any) => c.id)).toContain(coachId);
  });

  it('books a session: prices by duration, escrows the debit, snapshots the fee', async () => {
    const before = await balanceOf(ctx, buyer);
    const res = await book(buyer, { buyerMessage: 'Focus on aim please' });
    expect(res.status).toBeLessThan(300);
    expect(res.body.priceWaveCoin).toBe(150); // 100/h * 90min
    expect(res.body.status).toBe('scheduled');
    expect(await balanceOf(ctx, buyer)).toBe(before - 150);
    const row = await sessionRow(res.body.id);
    expect([row.platformFeePercentSnapshot, row.platformFeeWaveCoin, row.coachPayoutWaveCoin]).toEqual([10, 15, 135]);
    expect(JSON.stringify((await coachUser.client.get('/notifications')).body)).toContain('session_booked');
    await assertConserved(ctx);
  });

  it('rejects bad bookings without touching balances', async () => {
    const before = await balanceOf(ctx, buyer);
    expect((await book(buyer, { scheduledAt: new Date(Date.now() - 3600_000).toISOString() })).status).toBe(403);
    expect((await book(buyer, { durationMinutes: 45 })).status).toBe(400);
    expect((await book(coachUser)).status).toBe(403); // self-booking
    const broke = await registerUser(ctx, 'cbroke');
    expect((await book(broke)).status).toBe(403);
    expect(await balanceOf(ctx, broke)).toBe(0);
    expect(await ctx.dataSource.query(`SELECT 1 FROM coaching_sessions WHERE "buyerId" = $1`, [broke.id])).toHaveLength(0);
    expect(await balanceOf(ctx, buyer)).toBe(before);
  });

  it('only the coach completes; payout is escrow minus the snapshotted fee, under the 7-day hold, paid once', async () => {
    const sess = (await book(buyer)).body;
    expect((await buyer.client.post(`/coaching-sessions/${sess.id}/complete`)).status).toBe(403);
    const stranger = await registerUser(ctx, 'cstranger');
    expect((await stranger.client.post(`/coaching-sessions/${sess.id}/complete`)).status).toBe(403);
    expect((await stranger.client.get(`/coaching-sessions/${sess.id}`)).status).toBe(403);

    // A later fee change must not alter this session's already-snapshotted fee.
    await admin.client.post('/admin/platform-settings', { platformFeePercent: 30 });
    const coachBefore = await balanceOf(ctx, coachUser);
    expect((await coachUser.client.post(`/coaching-sessions/${sess.id}/complete`)).status).toBe(200);
    expect(await balanceOf(ctx, coachUser)).toBe(coachBefore + 135);
    const wallet = (await coachUser.client.get('/wallet/balance')).body;
    expect(wallet.pendingClearance).toBeGreaterThanOrEqual(135);

    expect((await coachUser.client.post(`/coaching-sessions/${sess.id}/complete`)).status).toBe(409);
    expect((await buyer.client.post(`/coaching-sessions/${sess.id}/cancel`)).status).toBe(409);
    expect(await balanceOf(ctx, coachUser)).toBe(coachBefore + 135);

    // New bookings pick up the new 30% fee.
    const next = (await book(buyer)).body;
    expect((await sessionRow(next.id)).platformFeePercentSnapshot).toBe(30);
    await admin.client.post('/admin/platform-settings', { platformFeePercent: 10 });
    await clearHold(ctx, coachUser);
    expect((await coachUser.client.get('/wallet/balance')).body.availableToWithdraw).toBeGreaterThanOrEqual(135);
    await assertConserved(ctx);
  });

  it('either participant can cancel a scheduled session for a full refund, exactly once', async () => {
    const before = await balanceOf(ctx, buyer);
    const byBuyer = (await book(buyer)).body;
    expect((await buyer.client.post(`/coaching-sessions/${byBuyer.id}/cancel`)).status).toBe(200);
    expect(await balanceOf(ctx, buyer)).toBe(before);
    expect((await buyer.client.post(`/coaching-sessions/${byBuyer.id}/cancel`)).status).toBe(409);
    expect((await coachUser.client.post(`/coaching-sessions/${byBuyer.id}/complete`)).status).toBe(409);
    expect(await balanceOf(ctx, buyer)).toBe(before);

    const byCoach = (await book(buyer, { durationMinutes: 30 })).body;
    expect(byCoach.priceWaveCoin).toBe(50);
    expect((await coachUser.client.post(`/coaching-sessions/${byCoach.id}/cancel`)).status).toBe(200);
    expect(await balanceOf(ctx, buyer)).toBe(before);
    const stranger = await registerUser(ctx, 'cstranger2');
    const live = (await book(buyer)).body;
    expect((await stranger.client.post(`/coaching-sessions/${live.id}/cancel`)).status).toBe(403);
    expect((await buyer.client.get('/coaching-sessions/mine-as-buyer')).body.length).toBeGreaterThan(3);
    expect((await coachUser.client.get('/coaching-sessions/mine-as-coach')).body.length).toBeGreaterThan(3);
    await buyer.client.post(`/coaching-sessions/${live.id}/cancel`);
  });

  it('concurrent cancels of one session refund exactly once', async () => {
    const before = await balanceOf(ctx, buyer);
    const sess = (await book(buyer)).body;
    const results = await Promise.all(Array.from({ length: 4 }, () => buyer.client.post(`/coaching-sessions/${sess.id}/cancel`)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await balanceOf(ctx, buyer)).toBe(before);
  });

  it('a concurrent complete + cancel pays out or refunds, never both', async () => {
    const buyerBefore = await balanceOf(ctx, buyer);
    const coachBefore = await balanceOf(ctx, coachUser);
    const sess = (await book(buyer)).body;
    const [c, x] = await Promise.all([
      coachUser.client.post(`/coaching-sessions/${sess.id}/complete`),
      buyer.client.post(`/coaching-sessions/${sess.id}/cancel`),
    ]);
    expect([c.status, x.status].filter((s) => s === 200)).toHaveLength(1);
    const paid = c.status === 200;
    expect(await balanceOf(ctx, coachUser)).toBe(coachBefore + (paid ? 135 : 0));
    expect(await balanceOf(ctx, buyer)).toBe(buyerBefore - (paid ? 150 : 0));
  });

  it('a suspended coach cannot be booked; restoring re-opens booking', async () => {
    const lead = await registerUser(ctx, 'clead2');
    await makeAdmin(ctx, lead, 'marketplace_coaching_ops_manager');
    expect((await lead.client.post(`/coaches/${coachId}/suspend`)).status).toBe(200);
    expect((await book(buyer)).status).toBe(403);
    expect((await lead.client.post(`/coaches/${coachId}/restore`)).status).toBe(200);
    const again = await book(buyer);
    expect(again.status).toBeLessThan(300);
    await buyer.client.post(`/coaching-sessions/${again.body.id}/cancel`);
  });
});
