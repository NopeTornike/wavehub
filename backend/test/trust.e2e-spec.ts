import { assertConserved } from './flows';
import { Client, createApp, credit, E2eApp, makeAdmin, publishItemListing, registerUser, TestUser } from './helpers';

// Trust & Safety: user reports, staff queue, explained risk score, shared-network + promo-farming
// detection from hashed login history, warnings / notes / watchlist — all staff-only and audited.
describe('trust & safety (e2e)', () => {
  let ctx: E2eApp;
  let officer: TestUser;
  let support: TestUser;
  let superAdmin: TestUser;
  let seller: TestUser;
  let buyer: TestUser;
  let listingId: string;
  let orderId: string;

  beforeAll(async () => {
    ctx = await createApp();
    officer = await registerUser(ctx, 'tsofficer');
    await makeAdmin(ctx, officer, 'trust_safety_officer');
    support = await registerUser(ctx, 'tssupport');
    await makeAdmin(ctx, support, 'support_specialist');
    superAdmin = await registerUser(ctx, 'tssuper');
    await makeAdmin(ctx, superAdmin);
    seller = await registerUser(ctx, 'tsseller');
    buyer = await registerUser(ctx, 'tsbuyer');
    listingId = await publishItemListing(ctx, seller, superAdmin, 10);
    await credit(ctx, buyer, 50);
    orderId = (await buyer.client.post('/orders', { listingId })).body.id;
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('users report listings / users / messages; no self-reports, no duplicates, messages only from your own chats', async () => {
    const r = await buyer.client.post('/reports', { targetType: 'listing', targetId: listingId, reason: 'scam_listing', details: 'Asks to pay outside the site.' });
    expect(r.status).toBe(201);
    expect((await buyer.client.post('/reports', { targetType: 'listing', targetId: listingId, reason: 'fraud' })).status).toBe(409);
    expect((await seller.client.post('/reports', { targetType: 'listing', targetId: listingId, reason: 'spam' })).status).toBe(400); // own listing
    expect((await buyer.client.post('/reports', { targetType: 'user', targetId: buyer.id, reason: 'spam' })).status).toBe(400);
    expect((await buyer.client.post('/reports', { targetType: 'listing', targetId: '00000000-0000-4000-8000-000000000000', reason: 'spam' })).status).toBe(404);
    expect((await buyer.client.post('/reports', { targetType: 'listing', targetId: listingId, reason: 'nope' })).status).toBe(400);

    await seller.client.post(`/orders/${orderId}/messages`, { body: 'Send me the money on my card instead, cheaper.' });
    const msgs = (await buyer.client.get(`/orders/${orderId}/messages`)).body as Array<{ id: string; body: string }>;
    const bad = msgs.find((m) => m.body.startsWith('Send me the money'))!;
    const stranger = await registerUser(ctx, 'tsstranger');
    expect((await stranger.client.post('/reports', { targetType: 'message', targetId: bad.id, reason: 'fraud' })).status).toBe(403);
    expect((await buyer.client.post('/reports', { targetType: 'message', targetId: bad.id, reason: 'fraud' })).status).toBe(201);
    expect((await stranger.client.post('/reports', { targetType: 'user', targetId: seller.id, reason: 'harassment' })).status).toBe(201);

    const unverified = new Client(ctx.baseUrl);
    const name = `tsunv${Date.now().toString(36)}`;
    await unverified.post('/auth/register', { username: name, email: `${name}@example.com`, firstName: 'U', lastName: 'V', password: 'E2ePassw0rd!' });
    expect((await unverified.post('/reports', { targetType: 'user', targetId: seller.id, reason: 'spam' })).status).toBe(403);
  });

  it('staff queue: T&S roles only; the reported message is kept as evidence; handling is audited', async () => {
    expect((await support.client.get('/admin/trust/reports')).status).toBe(403);
    expect((await buyer.client.get('/admin/trust/overview')).status).toBe(403);
    const queue = (await officer.client.get('/admin/trust/reports')).body as Array<{ id: string; targetType: string; targetUsername: string; evidence: string | null; targetLabel: string }>;
    const msg = queue.find((r) => r.targetType === 'message')!;
    expect(msg).toMatchObject({ targetUsername: seller.username, evidence: 'Send me the money on my card instead, cheaper.' });
    expect(queue.find((r) => r.targetType === 'listing')?.targetLabel).toMatch(/^E2E item/);
    const handled = await officer.client.request('PATCH', `/admin/trust/reports/${msg.id}`, { status: 'actioned', staffNote: 'Off-platform payment attempt.' });
    expect(handled.body).toMatchObject({ status: 'actioned', staffNote: 'Off-platform payment attempt.' });
    expect(await ctx.dataSource.query(`SELECT 1 FROM audit_logs WHERE action = 'report.handle' AND "entityId" = $1`, [msg.id])).toHaveLength(1);
  });

  it('risk score explains every point; shared networks and promo farming are detected from hashed logins', async () => {
    const a = await registerUser(ctx, 'tsfarm1');
    const b = await registerUser(ctx, 'tsfarm2');
    a.client.ip = '10.250.250.250';
    b.client.ip = '10.250.250.250';
    expect((await a.client.post('/auth/login', { username: a.username, password: 'E2ePassw0rd!' })).status).toBe(200);
    expect((await b.client.post('/auth/login', { username: b.username, password: 'E2ePassw0rd!' })).status).toBe(200);
    await superAdmin.client.post('/admin/promo-codes', { code: 'TSFARM', amountWaveCoin: 2, maxRedemptions: 10 });
    await a.client.post('/promo-codes/redeem', { code: 'TSFARM' });
    await b.client.post('/promo-codes/redeem', { code: 'TSFARM' });

    // Raw IPs are never stored — only 64-char keyed hashes.
    const events = await ctx.dataSource.query(`SELECT "ipHash", "uaHash" FROM login_events WHERE "userId" = $1`, [a.id]);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.ipHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(e)).not.toContain('10.250');
    }

    const detail = (await officer.client.get(`/admin/trust/users/${a.id}`)).body;
    expect(detail.linkedAccounts.map((l: { username: string }) => l.username)).toContain(b.username);
    expect(detail.risk.factors.map((f: { key: string }) => f.key)).toEqual(expect.arrayContaining(['shared_network', 'promo_farming', 'new_account']));
    expect(detail.risk.score).toBe(detail.risk.factors.reduce((s: number, f: { points: number }) => s + f.points, 0));
    expect(detail.stats.promoRedemptions).toBe(1);
    expect(JSON.stringify(detail)).not.toMatch(/passwordHash|wavecoinBalance|"email"/);

    // The seller has an actioned + open reports → shows up in the overview's top risk list.
    const overview = (await officer.client.get('/admin/trust/overview')).body;
    expect(overview.openReports).toBeGreaterThanOrEqual(2);
    expect(overview.sharedNetworkGroups).toBeGreaterThanOrEqual(0);
    expect(overview.topRisk.map((u: { username: string }) => u.username)).toContain(seller.username);
  });

  it('warnings reach the user (in-app + email); notes and the watchlist are staff-only and audited', async () => {
    const before = ctx.sentEmails.length;
    const warned = await officer.client.post(`/admin/trust/users/${seller.id}/warn`, { message: 'Asking buyers to pay outside WaveHub breaks the rules.' });
    expect(warned.status).toBe(200);
    expect(warned.body.notes[0]).toMatchObject({ kind: 'warning', authorUsername: officer.username });
    const notes = (await seller.client.get('/notifications')).body as Array<{ type: string; body: string }>;
    expect(notes.find((n) => n.type === 'account_warning')?.body).toContain('outside WaveHub');
    for (let i = 0; i < 40 && !ctx.sentEmails.slice(before).some((m) => m.to === `${seller.username}@example.com`); i++) await new Promise((r) => setTimeout(r, 50));
    expect(ctx.sentEmails.slice(before).some((m) => m.to === `${seller.username}@example.com` && m.subject.startsWith('გაფრთხილება'))).toBe(true);

    expect((await officer.client.post(`/admin/trust/users/${seller.id}/notes`, { body: 'Watch next listings.' })).status).toBe(200);
    const flagged = await officer.client.post(`/admin/trust/users/${seller.id}/flag`, { flagged: true, reason: 'Repeat off-platform attempts.' });
    expect(flagged.body.flagged).toBe(true);
    expect(flagged.body.risk.factors.find((f: { key: string }) => f.key === 'flagged')?.points).toBe(25);
    expect(flagged.body.risk.level).toBe('high');
    expect((await support.client.post(`/admin/trust/users/${seller.id}/flag`, { flagged: false, reason: 'No.' })).status).toBe(403);
    // Notes and flags never leak into the public profile.
    expect(JSON.stringify((await buyer.client.get(`/users/${seller.username}`)).body)).not.toMatch(/flagged|Watch next|off-platform/i);
    const actions = (await ctx.dataSource.query(`SELECT action FROM audit_logs WHERE "entityId" = $1 AND action LIKE 'trust.%'`, [seller.id])).map((r: { action: string }) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['trust.warn', 'trust.note', 'trust.flag']));
  });
});
