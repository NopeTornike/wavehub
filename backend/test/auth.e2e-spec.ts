import { Client, createApp, E2eApp, registerUser } from './helpers';

describe('auth (e2e)', () => {
  let ctx: E2eApp;
  beforeAll(async () => {
    ctx = await createApp();
  });
  afterAll(async () => ctx.close());

  it('registers, requires verification, verifies via the emailed link, then logs in', async () => {
    const client = new Client(ctx.baseUrl);
    const username = `auth${Date.now().toString(36)}`;
    const password = 'E2ePassw0rd!';
    const reg = await client.post('/auth/register', {
      username, email: `${username}@example.com`, firstName: 'A', lastName: 'B', password,
    });
    expect(reg.status).toBeLessThan(300);

    // Login itself is allowed pre-verification (registration auto-logs-in), but transacting is not.
    const early = await client.post('/auth/login', { username, password });
    expect(early.status).toBe(200);
    expect((await client.get('/auth/me')).status).toBe(200);
    const blocked = await client.post('/orders', { listingId: '00000000-0000-0000-0000-000000000000' });
    expect(blocked.status).toBe(403);
    expect(JSON.stringify(blocked.body)).toContain('verify your email');
    expect((await client.post('/withdrawals', { amountWaveCoin: 10 })).status).toBe(403);

    const token = ctx.sentEmails[ctx.sentEmails.length - 1].body.match(/token=([a-f0-9]+)/)![1];
    expect((await client.post('/auth/verify-email', { token })).status).toBeLessThan(300);
    expect((await client.post('/auth/verify-email', { token })).status).toBeGreaterThanOrEqual(400); // single use

    const login = await client.post('/auth/login', { username, password });
    expect(login.status).toBeLessThan(300);
    const me = await client.get('/auth/me');
    expect(me.status).toBe(200);
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
  });

  it('rejects a wrong password and unauthenticated access to guarded routes', async () => {
    const user = await registerUser(ctx, 'wrongpw');
    const anon = new Client(ctx.baseUrl);
    expect((await anon.post('/auth/login', { username: user.username, password: 'Nope12345!' })).status).toBe(401);
    expect((await anon.get('/orders/as-buyer')).status).toBe(401);
    expect((await anon.get('/subscriptions/mine')).status).toBe(401);
  });

  it('rejects unknown body fields (mass-assignment guard)', async () => {
    const client = new Client(ctx.baseUrl);
    const res = await client.post('/auth/register', {
      username: `mass${Date.now().toString(36)}`, email: `m${Date.now()}@example.com`, firstName: 'A', lastName: 'B',
      password: 'E2ePassw0rd!', adminRole: 'super_admin',
    });
    expect(res.status).toBe(400);
  });

  it('logout clears the session', async () => {
    const user = await registerUser(ctx, 'logout');
    expect((await user.client.get('/auth/me')).status).toBe(200);
    await user.client.post('/auth/logout');
    expect((await user.client.get('/auth/me')).status).toBe(401);
  });
});
