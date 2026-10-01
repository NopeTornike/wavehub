import { assertConserved } from './flows';
import { balanceOf, createApp, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

// Super-Admin-controlled Support permissions (settings/CLAUDE.md, 2026-10-01): WaveCoin adjust
// (capped) and suspend/restore, both off by default, never on self or staff.
describe('support permissions (e2e)', () => {
  let ctx: E2eApp;
  let superAdmin: TestUser;
  let support: TestUser;
  let lead: TestUser;
  let customer: TestUser;
  const off = { walletAdjust: false, walletAdjustMax: 100, suspendUsers: false };

  beforeAll(async () => {
    ctx = await createApp();
    superAdmin = await registerUser(ctx, 'spsa');
    await makeAdmin(ctx, superAdmin, 'super_admin');
    support = await registerUser(ctx, 'spsupport');
    await makeAdmin(ctx, support, 'support_specialist');
    lead = await registerUser(ctx, 'splead');
    await makeAdmin(ctx, lead, 'operation_lead');
    customer = await registerUser(ctx, 'spcustomer');
  });
  afterAll(async () => {
    // Leave the shared database's settings as other specs expect them.
    await superAdmin.client.post('/admin/platform-settings', { supportPermissions: off });
    await assertConserved(ctx);
    await ctx.close();
  });

  const adjust = (u: TestUser, target: TestUser, amountWaveCoin: number) =>
    u.client.post(`/admin/users/${target.id}/wallet-adjustment`, { amountWaveCoin, reason: 'Goodwill credit for a support case' });
  const setPerms = (u: TestUser, supportPermissions: Record<string, unknown>) => u.client.post('/admin/platform-settings', { supportPermissions });

  it('both powers are off by default and the defaults are reported', async () => {
    await setPerms(superAdmin, off);
    expect((await support.client.get('/admin/platform-settings/my-permissions')).body).toEqual({ walletAdjust: false, walletAdjustMax: 100, suspendUsers: false });
    expect((await superAdmin.client.get('/admin/platform-settings/my-permissions')).body).toEqual({ walletAdjust: true, walletAdjustMax: null, suspendUsers: true });
    expect((await customer.client.get('/admin/platform-settings/my-permissions')).status).toBe(403);
    expect((await adjust(support, customer, 10)).status).toBe(403);
    expect((await support.client.post(`/admin/users/${customer.id}/suspend`, { reason: 'test' })).status).toBe(403);
  });

  it('only Super Admin can change them (validated, audit-logged)', async () => {
    expect((await setPerms(support, { ...off, walletAdjust: true })).status).toBe(403);
    expect((await setPerms(lead, { ...off, walletAdjust: true })).status).toBe(403);
    expect((await setPerms(superAdmin, { walletAdjust: true })).status).toBe(400); // whole set required
    expect((await setPerms(superAdmin, { ...off, walletAdjustMax: 0 })).status).toBe(400);
    const res = await setPerms(superAdmin, { walletAdjust: true, walletAdjustMax: 50, suspendUsers: true });
    expect(res.status).toBe(200);
    expect(res.body.supportPermissions).toEqual({ walletAdjust: true, walletAdjustMax: 50, suspendUsers: true });
    const audit = await ctx.dataSource.query(`SELECT metadata FROM audit_logs WHERE action = 'platform_settings.update' ORDER BY "createdAt" DESC LIMIT 1`);
    expect(JSON.stringify(audit[0].metadata)).toContain('supportPermissions');
  });

  it('when enabled: Support adjusts within the cap, never on self or staff, and it is audit-logged', async () => {
    await setPerms(superAdmin, { walletAdjust: true, walletAdjustMax: 50, suspendUsers: true });
    const before = await balanceOf(ctx, customer);
    expect((await adjust(support, customer, 51)).status).toBe(403);
    expect((await adjust(support, customer, 30)).status).toBe(200);
    expect(await balanceOf(ctx, customer)).toBe(before + 30);
    expect((await adjust(support, customer, -30)).status).toBe(200);
    expect(await balanceOf(ctx, customer)).toBe(before);
    expect((await adjust(support, support, 10)).status).toBe(403);
    expect((await adjust(support, lead, 10)).status).toBe(403);
    // Super Admin has no cap.
    expect((await adjust(superAdmin, customer, 500)).status).toBe(200);
    expect((await adjust(superAdmin, customer, -500)).status).toBe(200);
    const audit = await ctx.dataSource.query(`SELECT "adminRole" FROM audit_logs WHERE action = 'user.wallet_adjust' AND "entityId" = $1`, [customer.id]);
    expect(audit.map((a: { adminRole: string }) => a.adminRole)).toContain('support_specialist');
  });

  it('when enabled: Support suspends/restores customers but not staff or themselves; ban stays off-limits', async () => {
    await setPerms(superAdmin, { walletAdjust: true, walletAdjustMax: 50, suspendUsers: true });
    expect((await support.client.post(`/admin/users/${customer.id}/suspend`, { reason: 'Chargeback investigation' })).status).toBe(200);
    expect((await support.client.post(`/admin/users/${customer.id}/restore`)).status).toBe(200);
    expect((await support.client.post(`/admin/users/${lead.id}/suspend`, { reason: 'x' })).status).toBe(403);
    expect((await support.client.post(`/admin/users/${support.id}/suspend`, { reason: 'x' })).status).toBe(403);
    expect((await support.client.post(`/admin/users/${customer.id}/ban`, { reason: 'x' })).status).toBe(403);

    // Switching it off takes effect immediately.
    await setPerms(superAdmin, off);
    expect((await support.client.post(`/admin/users/${customer.id}/suspend`, { reason: 'x' })).status).toBe(403);
    expect((await adjust(support, customer, 10)).status).toBe(403);
  });
});
