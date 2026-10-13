import { createApp, E2eApp, registerUser } from './helpers';

// GET users/search (feature 11): public, active accounts only, ranked, capped, public fields only.
describe('user search (e2e)', () => {
  let ctx: E2eApp;
  const stamp = Date.now().toString(36).slice(-5);

  beforeAll(async () => {
    ctx = await createApp();
  });
  afterAll(async () => ctx.close());

  const search = (q: string) => fetch(`${ctx.baseUrl}/users/search?q=${encodeURIComponent(q)}`).then(async (r) => ({ status: r.status, body: await r.json() }));

  it('finds active accounts by username (case-insensitive, prefix first) with only public fields', async () => {
    const a = await registerUser(ctx, `zfind${stamp}`);
    const b = await registerUser(ctx, `xzfind${stamp}`);
    const res = await search(`ZFIND${stamp}`);
    expect(res.status).toBe(200);
    const names = res.body.map((u: { username: string }) => u.username);
    expect(names).toEqual(expect.arrayContaining([a.username, b.username]));
    expect(names.indexOf(a.username)).toBeLessThan(names.indexOf(b.username)); // prefix match ranks first
    for (const u of res.body) expect(Object.keys(u).sort()).toEqual(['avatarUrl', 'id', 'username']);
    // A leading @ is ignored.
    expect((await search(`@${a.username}`)).body[0].username).toBe(a.username);
  });

  it('skips suspended, banned and unverified accounts', async () => {
    const hidden = await registerUser(ctx, `zhide${stamp}`);
    const banned = await registerUser(ctx, `zban${stamp}`);
    await ctx.dataSource.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [hidden.id]);
    await ctx.dataSource.query(`UPDATE users SET status = 'banned' WHERE id = $1`, [banned.id]);
    expect((await search(`zhide${stamp}`)).body).toEqual([]);
    expect((await search(`zban${stamp}`)).body).toEqual([]);
    const unverified = await fetch(`${ctx.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.9.9' },
      body: JSON.stringify({ username: `znover${stamp}`, email: `znover${stamp}@example.com`, firstName: 'N', lastName: 'V', password: 'E2ePassw0rd!' }),
    });
    expect(unverified.status).toBeLessThan(300);
    expect((await search(`znover${stamp}`)).body).toEqual([]);
  });

  it('validates the query, caps results at 8 and treats LIKE wildcards literally', async () => {
    expect((await search('a')).status).toBe(400);
    expect((await search('x'.repeat(41))).status).toBe(400);
    expect((await fetch(`${ctx.baseUrl}/users/search`)).status).toBe(400);
    for (let i = 0; i < 9; i++) await registerUser(ctx, `zcap${stamp}`);
    expect((await search(`zcap${stamp}`)).body).toHaveLength(8);
    expect((await search('%%')).body).toEqual([]);
    expect((await search('__')).body).toEqual([]);
    // `search` is not swallowed by GET users/:username.
    expect((await fetch(`${ctx.baseUrl}/users/search?q=zz`)).status).toBe(200);
  });
});
