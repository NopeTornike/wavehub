import { assertConserved } from './flows';
import { balanceOf, Client, createApp, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

// Promo codes (spendable, never withdrawable credit; once per account; capped; windowed) and
// homepage banners (content roles; image byte-checked; date window; safe links).
describe('marketing: promo codes + banners (e2e)', () => {
  let ctx: E2eApp;
  let superAdmin: TestUser;
  let mainAdmin: TestUser;
  let ops: TestUser;
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

  beforeAll(async () => {
    ctx = await createApp();
    superAdmin = await registerUser(ctx, 'mksuper');
    await makeAdmin(ctx, superAdmin);
    mainAdmin = await registerUser(ctx, 'mkmain');
    await makeAdmin(ctx, mainAdmin, 'main_administrator');
    ops = await registerUser(ctx, 'mkops');
    await makeAdmin(ctx, ops, 'marketplace_coaching_ops_manager');
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('only Super Admin creates codes; codes are validated and unique', async () => {
    expect((await mainAdmin.client.post('/admin/promo-codes', { code: 'WELCOME5', amountWaveCoin: 5, maxRedemptions: 10 })).status).toBe(403);
    expect((await superAdmin.client.post('/admin/promo-codes', { code: 'no spaces!', amountWaveCoin: 5, maxRedemptions: 10 })).status).toBe(400);
    expect((await superAdmin.client.post('/admin/promo-codes', { code: 'BIG', amountWaveCoin: 5000, maxRedemptions: 10 })).status).toBe(400);
    const created = await superAdmin.client.post('/admin/promo-codes', { code: 'welcome5', amountWaveCoin: 5, maxRedemptions: 10, note: 'Launch campaign' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ code: 'WELCOME5', redeemedCount: 0, active: true });
    expect((await superAdmin.client.post('/admin/promo-codes', { code: 'WELCOME5', amountWaveCoin: 1, maxRedemptions: 1 })).status).toBe(409);
    expect(await ctx.dataSource.query(`SELECT 1 FROM audit_logs WHERE action = 'promo_code.create' AND "entityId" = $1`, [created.body.id])).toHaveLength(1);
  });

  it('redeeming credits the balance once per account; the credit is spendable but never withdrawable', async () => {
    const user = await registerUser(ctx, 'mkuser');
    const before = await balanceOf(ctx, user);
    const res = await user.client.post('/promo-codes/redeem', { code: ' welcome5 ' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ code: 'WELCOME5', amountWaveCoin: 5, balanceAfter: before + 5 });
    expect((await user.client.post('/promo-codes/redeem', { code: 'WELCOME5' })).status).toBe(409);
    expect((await user.client.post('/promo-codes/redeem', { code: 'NOPE123' })).status).toBe(404);
    expect((await user.client.get('/wallet/balance')).body.availableToWithdraw).toBe(0);
    expect((await user.client.post('/withdrawals', { amountWaveCoin: 5 })).status).toBeGreaterThanOrEqual(400);

    // Unverified accounts can't redeem.
    const fresh = new Client(ctx.baseUrl);
    const name = `mkunv${Date.now().toString(36)}`;
    await fresh.post('/auth/register', { username: name, email: `${name}@example.com`, firstName: 'U', lastName: 'V', password: 'E2ePassw0rd!' });
    expect((await fresh.post('/promo-codes/redeem', { code: 'WELCOME5' })).status).toBe(403);
  });

  it('the cap holds under a burst; deactivated / expired / not-yet-started codes all read "not valid"', async () => {
    const code = (await superAdmin.client.post('/admin/promo-codes', { code: 'ONLY2', amountWaveCoin: 3, maxRedemptions: 2 })).body;
    const users = await Promise.all([1, 2, 3, 4, 5].map((i) => registerUser(ctx, `mkburst${i}`)));
    const results = await Promise.all(users.map((u) => u.client.post('/promo-codes/redeem', { code: 'ONLY2' })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(2);
    expect((await ctx.dataSource.query(`SELECT "redeemedCount" FROM promo_codes WHERE id = $1`, [code.id]))[0].redeemedCount).toBe(2);
    expect((await superAdmin.client.request('PATCH', `/admin/promo-codes/${code.id}`, { maxRedemptions: 1 })).status).toBe(400);

    const late = (await superAdmin.client.post('/admin/promo-codes', { code: 'LATER', amountWaveCoin: 3, maxRedemptions: 5, startsAt: new Date(Date.now() + 86400_000).toISOString() })).body;
    const gone = (await superAdmin.client.post('/admin/promo-codes', { code: 'GONE', amountWaveCoin: 3, maxRedemptions: 5 })).body;
    await superAdmin.client.request('PATCH', `/admin/promo-codes/${gone.id}`, { active: false });
    const u = await registerUser(ctx, 'mkwindow');
    for (const c of ['LATER', 'GONE']) {
      const r = await u.client.post('/promo-codes/redeem', { code: c });
      expect(r.status).toBe(404);
      expect(r.body.message).toBe('This code is not valid');
    }
    expect((await superAdmin.client.request('PATCH', `/admin/promo-codes/${late.id}`, { startsAt: null })).status).toBe(200);
    expect((await u.client.post('/promo-codes/redeem', { code: 'LATER' })).status).toBe(200);
  });

  it('banners: content roles manage them; only published, in-window banners with an image are public', async () => {
    expect((await ops.client.post('/admin/banners', { title: 'Nope' })).status).toBe(403);
    expect((await mainAdmin.client.post('/admin/banners', { title: 'Bad link', linkUrl: 'javascript:alert(1)' })).status).toBe(400);
    expect((await mainAdmin.client.post('/admin/banners', { title: 'Bad link', linkUrl: '//evil.example' })).status).toBe(400);
    const b = (await mainAdmin.client.post('/admin/banners', { title: 'Coaching week', subtitle: 'Book a coach', linkUrl: '/coaching', buttonLabel: 'Book now' })).body;
    expect(b.active).toBe(false);
    expect((await mainAdmin.client.request('PATCH', `/admin/banners/${b.id}`, { active: true })).status).toBe(400); // no image yet
    expect((await mainAdmin.client.upload(`/admin/banners/${b.id}/image`, Buffer.from('<svg onload=alert(1)>'), 'x.png', 'image/png')).status).toBe(415);
    const withImage = await mainAdmin.client.upload(`/admin/banners/${b.id}/image`, PNG, 'banner.png', 'image/png');
    expect(withImage.status).toBe(200);
    expect(withImage.body.imageUrl).toMatch(/\/uploads\/[0-9a-f-]{36}\.png$/);

    const anon = new Client(ctx.baseUrl);
    expect((await anon.get('/banners')).body.find((x: { id: string }) => x.id === b.id)).toBeUndefined();
    await mainAdmin.client.request('PATCH', `/admin/banners/${b.id}`, { active: true });
    const pub = (await anon.get('/banners')).body.find((x: { id: string }) => x.id === b.id);
    expect(pub).toEqual({ id: b.id, placement: 'home_strip', title: 'Coaching week', subtitle: 'Book a coach', imageUrl: withImage.body.imageUrl, linkUrl: '/coaching', buttonLabel: 'Book now' });

    await mainAdmin.client.request('PATCH', `/admin/banners/${b.id}`, { endsAt: new Date(Date.now() - 1000).toISOString(), startsAt: new Date(Date.now() - 86400_000).toISOString() });
    expect((await anon.get('/banners')).body.find((x: { id: string }) => x.id === b.id)).toBeUndefined();
    expect((await mainAdmin.client.request('DELETE', `/admin/banners/${b.id}`)).status).toBe(200);
    expect(await ctx.dataSource.query(`SELECT 1 FROM audit_logs WHERE "entityType" = 'banner' AND "entityId" = $1`, [b.id])).toHaveLength(5);
  });
});
