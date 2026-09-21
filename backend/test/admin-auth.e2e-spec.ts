import { Client, createApp, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

const ROLES = [
  'super_admin', 'operation_lead', 'main_administrator', 'marketplace_coaching_ops_manager', 'trust_safety_officer', 'support_specialist',
] as const;
type Role = (typeof ROLES)[number];
const ZERO = '00000000-0000-4000-8000-000000000000';

// [method, path, body, roles allowed besides the always-allowed super_admin]. The ids are all
// nonexistent, so an allowed role gets 400/404 from the handler while a denied one gets 403 from
// the guard — the guard always runs first, so no state is ever mutated.
const MATRIX: [string, string, unknown, Role[]][] = [
  ['GET', '/admin/users', undefined, ['operation_lead', 'main_administrator', 'trust_safety_officer', 'support_specialist']],
  ['POST', `/admin/users/${ZERO}/suspend`, { reason: 'x' }, ['operation_lead', 'main_administrator']],
  ['POST', `/admin/users/${ZERO}/ban`, { reason: 'x' }, []],
  ['POST', `/admin/users/${ZERO}/unban`, {}, []],
  ['GET', '/admin/tickets', undefined, ['operation_lead', 'main_administrator', 'support_specialist']],
  ['POST', `/admin/tickets/${ZERO}/reply`, { body: 'x' }, ['main_administrator', 'support_specialist']],
  ['GET', '/admin/saved-replies', undefined, ['operation_lead', 'main_administrator', 'support_specialist']],
  ['GET', '/coaches/pending-verification', undefined, ['operation_lead', 'main_administrator', 'marketplace_coaching_ops_manager']],
  ['POST', `/coaches/${ZERO}/suspend`, {}, ['operation_lead', 'main_administrator', 'marketplace_coaching_ops_manager']],
  ['GET', '/listings/pending-review', undefined, ['marketplace_coaching_ops_manager']],
  ['POST', `/listings/${ZERO}/approve`, {}, ['marketplace_coaching_ops_manager']],
  ['GET', '/reviews/reported', undefined, ['operation_lead', 'marketplace_coaching_ops_manager', 'trust_safety_officer']],
  ['POST', `/reviews/${ZERO}/hide`, {}, ['operation_lead', 'marketplace_coaching_ops_manager', 'trust_safety_officer']],
  ['POST', `/reviews/${ZERO}/remove`, {}, []],
  ['GET', '/disputes', undefined, []],
  ['POST', `/orders/${ZERO}/dispute/resolve`, { resolution: 'refund_buyer', note: 'x' }, []],
  ['GET', '/withdrawals/pending', undefined, []],
  ['POST', `/withdrawals/${ZERO}/process`, { status: 'completed' }, []],
  ['GET', '/admin/platform-settings', undefined, []],
  ['GET', '/admin/subscription-plans', undefined, []],
  ['GET', '/admin/content', undefined, ['main_administrator']],
  ['POST', '/admin/tournaments', {}, ['operation_lead', 'main_administrator', 'marketplace_coaching_ops_manager']],
];

describe('admin role guard matrix + account security (e2e)', () => {
  let ctx: E2eApp;
  const staff = {} as Record<Role, TestUser>;
  let plain: TestUser;

  beforeAll(async () => {
    ctx = await createApp();
    for (const role of ROLES) {
      staff[role] = await registerUser(ctx, `m${role.slice(0, 6)}`);
      await makeAdmin(ctx, staff[role], role);
    }
    plain = await registerUser(ctx, 'plain');
  });
  afterAll(async () => ctx.close());

  it.each(MATRIX)('%s %s allows exactly the documented roles', async (method, path, body, allowed) => {
    const anon = new Client(ctx.baseUrl);
    expect((await anon.request(method, path, body)).status).toBe(401);
    expect((await plain.client.request(method, path, body)).status).toBe(403);
    for (const role of ROLES) {
      const status = (await staff[role].client.request(method, path, body)).status;
      const shouldPass = role === 'super_admin' || allowed.includes(role);
      if (shouldPass) expect({ role, status: status === 403 || status === 401 ? status : 'passed-guard' }).toEqual({ role, status: 'passed-guard' });
      else expect({ role, status }).toEqual({ role, status: 403 });
    }
  });

  it('revoking a role takes effect on the very next request (guard reads the live row)', async () => {
    const temp = await registerUser(ctx, 'temp');
    await makeAdmin(ctx, temp, 'super_admin');
    expect((await temp.client.get('/admin/platform-settings')).status).toBe(200);
    await ctx.dataSource.query(`UPDATE users SET "adminRole" = NULL WHERE id = $1`, [temp.id]);
    expect((await temp.client.get('/admin/platform-settings')).status).toBe(403);
  });

  it('a role cannot be self-assigned through the API', async () => {
    const res = await plain.client.post('/auth/register', { username: 'x', adminRole: 'super_admin' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await plain.client.get('/admin/platform-settings')).status).toBe(403);
  });

  describe('password reset', () => {
    const reset = async (user: TestUser) => {
      await new Client(ctx.baseUrl).post('/auth/request-password-reset', { email: `${user.username}@example.com` });
      const mail = [...ctx.sentEmails].reverse().find((e) => e.to === `${user.username}@example.com` && e.subject.includes('Reset'));
      return mail?.body.match(/token=([a-f0-9]+)/)?.[1];
    };

    it('does not reveal whether an email is registered', async () => {
      const before = ctx.sentEmails.length;
      const res = await new Client(ctx.baseUrl).post('/auth/request-password-reset', { email: 'nobody-here@example.com' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(ctx.sentEmails.length).toBe(before);
    });

    it('resets the password once: old password dies, new works, token is single-use, weak passwords refused', async () => {
      const user = await registerUser(ctx, 'reset');
      const token = await reset(user);
      expect(token).toBeDefined();
      const anon = { post: (path: string, body: unknown) => new Client(ctx.baseUrl).post(path, body) }; // fresh IP per call (5/min throttle)
      expect((await anon.post('/auth/reset-password', { token, newPassword: 'short' })).status).toBe(400);
      expect((await anon.post('/auth/reset-password', { token, newPassword: 'onlyletters' })).status).toBe(400);
      expect((await anon.post('/auth/reset-password', { token: 'f'.repeat(64), newPassword: 'NewPassw0rd!' })).status).toBe(400);

      expect((await anon.post('/auth/reset-password', { token, newPassword: 'NewPassw0rd!' })).status).toBe(200);
      expect((await anon.post('/auth/reset-password', { token, newPassword: 'Another1Pass!' })).status).toBe(400);
      expect((await anon.post('/auth/login', { username: user.username, password: 'E2ePassw0rd!' })).status).toBe(401);
      expect((await anon.post('/auth/login', { username: user.username, password: 'NewPassw0rd!' })).status).toBe(200);
      const [row] = await ctx.dataSource.query(`SELECT "passwordHash" h FROM users WHERE id = $1`, [user.id]);
      expect(row.h).not.toContain('NewPassw0rd!');
    });

    it('an expired reset token is refused', async () => {
      const user = await registerUser(ctx, 'resetexp');
      const token = await reset(user);
      await ctx.dataSource.query(`UPDATE password_reset_tokens SET "expiresAt" = now() - interval '1 minute' WHERE "userId" = $1`, [user.id]);
      expect((await new Client(ctx.baseUrl).post('/auth/reset-password', { token, newPassword: 'NewPassw0rd!' })).status).toBe(400);
      expect((await new Client(ctx.baseUrl).post('/auth/login', { username: user.username, password: 'E2ePassw0rd!' })).status).toBe(200);
    });
  });

  describe('suspended / banned accounts', () => {
    it('a suspension kills the existing session and blocks login; restore brings it back', async () => {
      const victim = await registerUser(ctx, 'victim');
      expect((await victim.client.get('/auth/me')).status).toBe(200);
      const lead = staff.operation_lead;
      expect((await lead.client.post(`/admin/users/${victim.id}/suspend`, { reason: 'spam' })).status).toBe(200);

      expect((await victim.client.get('/auth/me')).status).toBe(403); // old cookie, rejected immediately
      expect((await victim.client.get('/orders/as-buyer')).status).toBe(403);
      const relog = await new Client(ctx.baseUrl).post('/auth/login', { username: victim.username, password: 'E2ePassw0rd!' });
      expect(relog.status).toBe(403);
      expect((await new Client(ctx.baseUrl).post('/auth/login', { username: victim.username, password: 'WrongPass1!' })).status).toBe(401); // no status probing
      const view = await lead.client.get(`/admin/users/${victim.id}`);
      expect(JSON.stringify(view.body)).toContain('suspended');

      expect((await lead.client.post(`/admin/users/${victim.id}/restore`)).status).toBe(200);
      expect((await victim.client.get('/auth/me')).status).toBe(200);
    });

    it('a ban is Super-Admin-only, kills sessions, and unban restores access', async () => {
      const victim = await registerUser(ctx, 'banned');
      expect((await staff.operation_lead.client.post(`/admin/users/${victim.id}/ban`, { reason: 'fraud' })).status).toBe(403);
      expect((await staff.trust_safety_officer.client.post(`/admin/users/${victim.id}/ban`, { reason: 'fraud' })).status).toBe(403);
      expect((await victim.client.get('/auth/me')).status).toBe(200);
      expect((await staff.super_admin.client.post(`/admin/users/${victim.id}/ban`, { reason: 'fraud' })).status).toBe(200);
      expect((await victim.client.get('/auth/me')).status).toBe(403);
      expect((await victim.client.post('/orders', { listingId: ZERO })).status).toBe(403);
      expect((await new Client(ctx.baseUrl).post('/auth/login', { username: victim.username, password: 'E2ePassw0rd!' })).status).toBe(403);
      expect((await staff.operation_lead.client.post(`/admin/users/${victim.id}/suspend`, { reason: 'x' })).status).toBe(400); // banned → unban first
      expect((await staff.super_admin.client.post(`/admin/users/${victim.id}/unban`)).status).toBe(200);
      expect((await victim.client.get('/auth/me')).status).toBe(200);
      const audit = await ctx.dataSource.query(`SELECT action FROM audit_logs WHERE "entityId" = $1 ORDER BY "createdAt"`, [victim.id]);
      expect(audit.map((a: any) => a.action)).toEqual(['user.ban', 'user.unban']);
    });

    it('lifting a suspension never grants active status to an account that never verified its email', async () => {
      const client = new Client(ctx.baseUrl);
      const username = `unver${Date.now().toString(36)}`;
      const reg = await client.post('/auth/register', { username, email: `${username}@example.com`, firstName: 'U', lastName: 'V', password: 'E2ePassw0rd!' });
      const id = reg.body.user.id;
      await staff.super_admin.client.post(`/admin/users/${id}/suspend`, { reason: 'x' });
      await staff.super_admin.client.post(`/admin/users/${id}/restore`);
      const [row] = await ctx.dataSource.query(`SELECT status FROM users WHERE id = $1`, [id]);
      expect(row.status).toBe('pending_verification');
      expect((await client.post('/orders', { listingId: ZERO })).status).toBe(403); // still gated by VerifiedEmailGuard
      expect(JSON.stringify((await client.post('/orders', { listingId: ZERO })).body)).toContain('verify your email');
    });
  });
});
