import { JwtService } from '@nestjs/jwt';
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

  it('verifies with the 6-digit code from the email (links are dead in Gmail spam); 5 wrong codes burn it', async () => {
    const register = async (name: string) => {
      const client = new Client(ctx.baseUrl);
      const username = `${name}${Date.now().toString(36)}`;
      const reg = await client.post('/auth/register', { username, email: `${username}@example.com`, firstName: 'C', lastName: 'D', password: 'E2ePassw0rd!' });
      expect(reg.status).toBeLessThan(300);
      const mail = [...ctx.sentEmails].reverse().find((e) => e.to === `${username}@example.com`)!;
      const code = mail.subject.match(/^(\d{6})/)![1];
      expect(mail.body).toContain(code);
      expect(mail.html).toContain(code);
      return { client, code };
    };
    const a = await register('code');
    expect((await new Client(ctx.baseUrl).post('/auth/verify-email-code', { code: a.code })).status).toBe(401); // signed-in only
    expect((await a.client.post('/auth/verify-email-code', { code: '12a456' })).status).toBe(400);
    const wrong = a.code === '000000' ? '000001' : '000000';
    expect((await a.client.post('/auth/verify-email-code', { code: wrong })).status).toBe(400);
    expect((await a.client.post('/auth/verify-email-code', { code: a.code })).status).toBe(200);
    expect((await a.client.get('/auth/me')).body.user.status).toBe('active');
    expect((await a.client.post('/auth/verify-email-code', { code: a.code })).status).toBe(400); // single use

    // Five wrong tries burn the code: even the right one no longer works. Each try comes from its own
    // throttle bucket here so the lock, not the per-IP limit, is what's being tested.
    const b = await register('codelock');
    const wrongB = b.code === '000000' ? '000001' : '000000';
    let last: { status: number; body: unknown } = { status: 0, body: null };
    for (let i = 0; i < 5; i++) {
      b.client.ip = `10.77.0.${i + 1}`;
      last = await b.client.post('/auth/verify-email-code', { code: wrongB });
      expect(last.status).toBe(400);
    }
    expect(JSON.stringify(last.body)).toContain('request a new email');
    b.client.ip = '10.77.0.99';
    expect((await b.client.post('/auth/verify-email-code', { code: b.code })).status).toBe(400);
    expect((await b.client.get('/auth/me')).body.user.status).toBe('pending_verification');
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

  // Owner 2026-11-01: a seller's 7-day session ran out with the tab open and every "publish" got a 401.
  // GET /auth/me now re-issues an aged (still valid) token with a full lifetime; never a bad one.
  it('renews an aged session on /auth/me, keeps the remember choice, never renews a bad token', async () => {
    const user = await registerUser(ctx, 'slide');
    const me = (await user.client.get('/auth/me')).body.user as { id: string };
    const jwt = ctx.app.get(JwtService);
    const now = Math.floor(Date.now() / 1000);
    const call = (token: string) => fetch(`${ctx.baseUrl}/auth/me`, { headers: { cookie: `wavehub_session=${token}`, 'x-forwarded-for': `10.77.${now % 250}.9` } });
    const issued = (res: Response) => res.headers.getSetCookie().find((c) => c.startsWith('wavehub_session='));

    // A fresh token is left alone.
    const fresh = await call(jwt.sign({ sub: me.id }, { expiresIn: 7 * 86400 }));
    expect(fresh.status).toBe(200);
    expect(issued(fresh)).toBeUndefined();

    // Six days into a 7-day "remember me" session: renewed for another 7 days, persistent cookie.
    const aged = await call(jwt.sign({ sub: me.id, iat: now - 6 * 86400, exp: now + 86400 }));
    expect(aged.status).toBe(200);
    const renewed = issued(aged)!;
    expect(renewed).toMatch(/Max-Age=604800/i);
    expect(renewed).toMatch(/HttpOnly/i);
    const payload = jwt.decode(renewed.split(';')[0].split('=')[1]) as { sub: string; iat: number; exp: number };
    expect(payload.sub).toBe(me.id);
    expect(payload.exp - payload.iat).toBe(7 * 86400);

    // A "don't remember me" session stays a browser-session cookie with a one-day token.
    const short = await call(jwt.sign({ sub: me.id, iat: now - 5 * 3600, exp: now + 19 * 3600 }));
    const shortCookie = issued(short)!;
    expect(shortCookie).not.toMatch(/Max-Age/i);
    const shortPayload = jwt.decode(shortCookie.split(';')[0].split('=')[1]) as { iat: number; exp: number };
    expect(shortPayload.exp - shortPayload.iat).toBe(86400);

    // Expired or forged tokens get a 401 and nothing new.
    const expired = await call(jwt.sign({ sub: me.id, iat: now - 8 * 86400, exp: now - 86400 }));
    expect(expired.status).toBe(401);
    expect(issued(expired)).toBeUndefined();
    const forged = await call(new JwtService({ secret: 'not-the-server-secret' }).sign({ sub: me.id, iat: now - 6 * 86400, exp: now + 86400 }));
    expect(forged.status).toBe(401);
    expect(issued(forged)).toBeUndefined();
  });
});
