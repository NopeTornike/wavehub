import { balanceOf, createApp, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';
import { assertConserved } from './flows';

// Super Admin tools on admin/users: WaveCoin balance adjustment and staff-role assignment.
describe('admin user powers (e2e)', () => {
  let ctx: E2eApp;
  let superAdmin: TestUser;
  let support: TestUser;
  let mainAdmin: TestUser;
  let user: TestUser;

  beforeAll(async () => {
    ctx = await createApp();
    [superAdmin, support, mainAdmin, user] = await Promise.all([
      registerUser(ctx, 'pwsuper'),
      registerUser(ctx, 'pwsupport'),
      registerUser(ctx, 'pwmain'),
      registerUser(ctx, 'pwuser'),
    ]);
    await makeAdmin(ctx, superAdmin);
    await makeAdmin(ctx, support, 'support_specialist');
    await makeAdmin(ctx, mainAdmin, 'main_administrator');
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('only a Super Admin adjusts balances; never below zero; ledger + audit; not withdrawable', async () => {
    const path = `/admin/users/${user.id}/wallet-adjustment`;
    const body = { amountWaveCoin: 150, reason: 'Tournament prize' };
    expect((await user.client.post(path, body)).status).toBe(403);
    expect((await support.client.post(path, body)).status).toBe(403);
    expect((await mainAdmin.client.post(path, body)).status).toBe(403);
    expect((await superAdmin.client.post(path, { amountWaveCoin: 0, reason: 'nothing' })).status).toBe(400);
    expect((await superAdmin.client.post(path, { amountWaveCoin: 10, reason: 'x' })).status).toBe(400);
    expect((await superAdmin.client.post(path, { amountWaveCoin: 2.5, reason: 'Fractional' })).status).toBe(400);

    const before = await balanceOf(ctx, user);
    const res = await superAdmin.client.post(path, body);
    expect(res.status).toBe(200);
    expect(res.body.wavecoinBalance).toBe(before + 150);
    expect(await balanceOf(ctx, user)).toBe(before + 150);
    expect((await superAdmin.client.post(path, { amountWaveCoin: -(before + 151), reason: 'Too much' })).status).toBe(400);
    expect((await superAdmin.client.post(path, { amountWaveCoin: -50, reason: 'Correction' })).status).toBe(200);
    expect(await balanceOf(ctx, user)).toBe(before + 100);

    const [entry] = await ctx.dataSource.query(
      `SELECT type, "amountWaveCoin", "createdBy" FROM wallet_ledger_entries WHERE "userId" = $1 AND type = 'admin_adjustment' ORDER BY "createdAt" ASC LIMIT 1`,
      [user.id],
    );
    expect({ ...entry, amountWaveCoin: Number(entry.amountWaveCoin) }).toMatchObject({ type: 'admin_adjustment', amountWaveCoin: 150, createdBy: superAdmin.id });
    const audits = await ctx.dataSource.query(`SELECT metadata FROM audit_logs WHERE action = 'user.wallet_adjust' AND "entityId" = $1`, [user.id]);
    expect(audits).toHaveLength(2);
    expect(audits[0].metadata.reason).toBeDefined();
    // Adjusted coins are spendable, not withdrawable cash.
    expect((await user.client.get('/wallet/balance')).body.availableToWithdraw).toBe(0);
  });

  it('only a Super Admin assigns staff roles, with guards', async () => {
    const path = (id: string) => `/admin/users/${id}/role`;
    expect((await mainAdmin.client.post(path(user.id), { adminRole: 'support_specialist', reason: 'Hiring' })).status).toBe(403);
    expect((await superAdmin.client.post(path(user.id), { adminRole: 'galaxy_brain', reason: 'Nope' })).status).toBe(400);
    expect((await superAdmin.client.post(path(superAdmin.id), { adminRole: null, reason: 'Self' })).status).toBe(400);

    const granted = await superAdmin.client.post(path(user.id), { adminRole: 'support_specialist', reason: 'Hiring support' });
    expect(granted.status).toBe(200);
    expect(granted.body.adminRole).toBe('support_specialist');
    expect((await user.client.get('/admin/users')).status).toBe(200); // the new role takes effect at once

    expect((await superAdmin.client.post(path(user.id), { adminRole: null, reason: 'Left the team' })).body.adminRole).toBeNull();
    expect((await user.client.get('/admin/users')).status).toBe(403);
    const audits = await ctx.dataSource.query(`SELECT metadata FROM audit_logs WHERE action = 'user.set_admin_role' AND "entityId" = $1 ORDER BY "createdAt"`, [user.id]);
    expect(audits.map((a: { metadata: { to: string | null } }) => a.metadata.to)).toEqual(['support_specialist', null]);
  });
});
