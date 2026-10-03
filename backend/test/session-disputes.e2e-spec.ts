import { assertConserved, startSession } from './flows';
import { balanceOf, createApp, credit, E2eApp, makeAdmin, openAllHours, registerUser, TestUser } from './helpers';
import { CoachingSessionsService } from '../src/coaching/coaching-sessions.service';

// Coaching session disputes: open (participants, in progress / awaiting confirmation only) →
// frozen (no auto-confirm, no cancel) → thread + evidence → Super Admin refunds or pays, once.
describe('coaching session disputes (e2e)', () => {
  let ctx: E2eApp;
  let superAdmin: TestUser;
  let ops: TestUser;
  let coachUser: TestUser;
  let buyer: TestUser;
  let coachId: string;
  let sweep: CoachingSessionsService['sweep'];
  let hours = 300;
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
  const step3 = { goal: 'Fix my rotations in ranked.', discord: 'sd.buyer' };
  const book = async () =>
    (await buyer.client.post(`/coaches/${coachId}/bookings`, { durationMinutes: 60, slots: [new Date(Date.now() + (hours += 3) * 3600_000).toISOString()], ...step3 })).body[0];
  const row = async (id: string) => (await ctx.dataSource.query(`SELECT * FROM coaching_sessions WHERE id = $1`, [id]))[0];

  beforeAll(async () => {
    ctx = await createApp();
    sweep = ctx.app.get(CoachingSessionsService).sweep.bind(ctx.app.get(CoachingSessionsService));
    superAdmin = await registerUser(ctx, 'sdsuper');
    await makeAdmin(ctx, superAdmin);
    ops = await registerUser(ctx, 'sdops');
    await makeAdmin(ctx, ops, 'marketplace_coaching_ops_manager');
    coachUser = await registerUser(ctx, 'sdcoach');
    buyer = await registerUser(ctx, 'sdbuyer');
    await credit(ctx, buyer, 500);
    coachId = (await ops.client.post('/admin/coaches', { username: coachUser.username, specialty: 'Macro play', bio: 'Ten years of competitive experience across several titles.', hourlyRateWaveCoin: 30 })).body.id;
    await openAllHours(ctx, coachId);
    await ctx.dataSource.query(`UPDATE platform_settings SET "platformFeePercent" = 10`);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('only participants of a started session can open one; it freezes the session', async () => {
    const s = await book();
    expect((await buyer.client.post(`/coaching-sessions/${s.id}/dispute`, { reason: 'The coach never showed up.' })).status).toBe(409); // still scheduled
    await startSession(ctx, coachUser, buyer, s.id);
    const stranger = await registerUser(ctx, 'sdstranger');
    expect((await stranger.client.post(`/coaching-sessions/${s.id}/dispute`, { reason: 'Not my session at all.' })).status).toBe(403);
    expect((await buyer.client.post(`/coaching-sessions/${s.id}/dispute`, { reason: 'short' })).status).toBe(400);
    expect((await buyer.client.get(`/coaching-sessions/${s.id}/dispute`)).body).toEqual({ dispute: null });

    const opened = await buyer.client.post(`/coaching-sessions/${s.id}/dispute`, { reason: 'The coach left after ten minutes.' });
    expect(opened.status).toBe(201);
    expect(opened.body).toMatchObject({ status: 'open', openedByUsername: buyer.username });
    expect((await coachUser.client.post(`/coaching-sessions/${s.id}/dispute`, { reason: 'Opening a second one here.' })).status).toBe(409);
    expect((await row(s.id)).status).toBe('disputed');

    // Frozen: no completing, cancelling or auto-ending.
    expect((await coachUser.client.post(`/coaching-sessions/${s.id}/complete`)).status).toBe(409);
    expect((await coachUser.client.post(`/coaching-sessions/${s.id}/cancel`)).status).toBeGreaterThanOrEqual(400);
    await sweep(new Date(Date.now() + 72 * 3600_000));
    expect((await row(s.id)).status).toBe('disputed');

    const notes = (await coachUser.client.get('/notifications')).body as Array<{ type: string; metadata: Record<string, string> }>;
    expect(notes.find((n) => n.type === 'dispute_opened')?.metadata).toEqual({ sessionId: s.id, disputeId: opened.body.id });
  });

  it('thread + evidence for both sides; Super Admin decides — refund the student, exactly once', async () => {
    const s = await book();
    await startSession(ctx, coachUser, buyer, s.id);
    const before = await balanceOf(ctx, buyer);
    const dispute = (await coachUser.client.post(`/coaching-sessions/${s.id}/dispute`, { reason: 'Student left halfway and refuses to confirm.' })).body;
    expect((await buyer.client.post(`/coaching-sessions/${s.id}/dispute/messages`, { body: 'He was 40 minutes late.' })).status).toBe(200);
    expect((await buyer.client.upload(`/coaching-sessions/${s.id}/dispute/evidence`, Buffer.from('<html>no</html>'), 'x.png', 'image/png')).status).toBeGreaterThanOrEqual(400);
    const withFile = await buyer.client.upload(`/coaching-sessions/${s.id}/dispute/evidence`, PNG, 'screenshot.png', 'image/png');
    expect(withFile.status).toBe(200);
    expect(withFile.body.messages.map((m: { body: string | null; fileUrl: string | null }) => [m.body, !!m.fileUrl])).toEqual([
      ['He was 40 minutes late.', false],
      [null, true],
    ]);

    // Staff only: ops can't see or decide; Super Admin lists, messages, resolves.
    expect((await ops.client.get('/admin/session-disputes')).status).toBe(403);
    expect((await ops.client.post(`/admin/session-disputes/${dispute.id}/resolve`, { resolution: 'refund_student', note: 'x' })).status).toBe(403);
    const list = (await superAdmin.client.get('/admin/session-disputes')).body;
    expect(list.find((d: { id: string }) => d.id === dispute.id)).toMatchObject({ coachUsername: coachUser.username, buyerUsername: buyer.username, status: 'open' });
    expect((await superAdmin.client.get(`/admin/session-disputes/${dispute.id}`)).body.session.id).toBe(s.id);
    expect((await superAdmin.client.post(`/admin/session-disputes/${dispute.id}/messages`, { body: 'Please both send screenshots.' })).status).toBe(200);
    expect((await buyer.client.get(`/coaching-sessions/${s.id}/dispute`)).body.dispute.messages.at(-1)).toMatchObject({ senderUsername: 'WaveHub', isStaff: true });

    const results = await Promise.all([1, 2, 3].map(() => superAdmin.client.post(`/admin/session-disputes/${dispute.id}/resolve`, { resolution: 'refund_student', note: 'Coach was late.' })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await balanceOf(ctx, buyer)).toBe(before + s.priceWaveCoin);
    expect((await row(s.id)).status).toBe('cancelled');
    expect((await buyer.client.post(`/coaching-sessions/${s.id}/dispute/messages`, { body: 'One more thing.' })).status).toBe(409);
    expect(await ctx.dataSource.query(`SELECT 1 FROM audit_logs WHERE action = 'session_dispute.resolve' AND "entityId" = $1`, [dispute.id])).toHaveLength(1);
  });

  it('…or pays the coach (fee kept), with notifications to both', async () => {
    const s = await book();
    await startSession(ctx, coachUser, buyer, s.id);
    await coachUser.client.post(`/coaching-sessions/${s.id}/complete`); // awaiting confirmation
    const coachBefore = await balanceOf(ctx, coachUser);
    const dispute = (await buyer.client.post(`/coaching-sessions/${s.id}/dispute`, { reason: 'The session was much shorter than booked.' })).body;
    expect((await superAdmin.client.post(`/admin/session-disputes/${dispute.id}/resolve`, { resolution: 'pay_coach', note: 'Recording shows the full hour.' })).status).toBe(200);
    expect((await row(s.id)).status).toBe('completed');
    expect(await balanceOf(ctx, coachUser)).toBe(coachBefore + s.coachPayoutWaveCoin);
    const types = ((await buyer.client.get('/notifications')).body as Array<{ type: string }>).map((n) => n.type);
    expect(types).toContain('dispute_resolved');
  });
});
