import { ListingBadgesService } from '../src/listings/listing-badges.service';
import { Client, createApp, E2eApp, makeAdmin, publishItemListing, registerUser, TestUser } from './helpers';

// Owner round 5 (2026-10-28): the tournament dashboard's game room — per-team details staff open,
// visible only to that team's players while the team is verified — and the per-game launch link.
describe('client round 5 (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let gameId: string;
  const startDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'r5admin');
    await makeAdmin(ctx, admin);
    gameId = (await admin.client.get('/games')).body.find((g: { slug: string }) => g.slug === 'pubg-mobile')?.id ?? (await admin.client.get('/games')).body[0].id;
  });
  afterAll(async () => ctx.close());

  const roster = (name: string, users: TestUser[]) => ({
    name,
    discord: 'https://discord.gg/teamwave',
    players: users.map((u, i) => ({ player: u.username, inGameName: `${name.slice(0, 3)}${i}`, inGameId: `5${i}00000${i}` })),
  });

  it('game room: locked until staff open a side, details only for that side, gone for rejected teams', async () => {
    const t = await admin.client.post('/admin/tournaments', {
      gameId, name: `Room Cup ${Date.now() % 100000}`, description: 'A squad tournament for the game room test.',
      prize: '100 GEL', status: 'open', startDate, maxPlayers: 8, teamSize: 2,
    });
    expect(t.status).toBeLessThan(300);
    const id = t.body.id as string;
    const [a1, a2, b1, b2, stranger] = await Promise.all(['ra1', 'ra2', 'rb1', 'rb2', 'rx'].map((p) => registerUser(ctx, p)));
    const ta = (await a1.client.post(`/tournaments/${id}/teams`, roster('Alpha', [a1, a2]))).body.id;
    const tb = (await b1.client.post(`/tournaments/${id}/teams`, roster('Bravo', [b1, b2]))).body.id;
    for (const team of [ta, tb]) await admin.client.post(`/admin/tournaments/${id}/teams/${team}/status`, { status: 'verified' });
    const match = (await admin.client.post(`/admin/tournaments/${id}/matches`, { teamAId: ta, teamBId: tb, bestOf: 1 })).body;

    // Before anything is opened: players see "locked" with no details; strangers get nothing.
    const locked = await a2.client.get(`/me/tournament-matches/${match.id}/room`);
    expect(locked.status).toBe(200);
    expect(locked.body).toMatchObject({ status: 'locked', side: 'a', room: null });
    expect((await stranger.client.get(`/me/tournament-matches/${match.id}/room`)).status).toBe(403);

    // Bad links are refused; only staff can set the room.
    expect((await admin.client.post(`/admin/tournaments/${id}/matches/${match.id}/room`, { a: { open: true, serverUrl: 'javascript:alert(1)' } })).status).toBe(400);
    expect((await a1.client.post(`/admin/tournaments/${id}/matches/${match.id}/room`, { a: { open: true, roomId: '1' } })).status).toBe(403);
    const set = await admin.client.post(`/admin/tournaments/${id}/matches/${match.id}/room`, {
      a: { open: true, roomId: '58392741', password: 'WHX2026', slot: '#4' },
      b: { open: false, roomId: '58392741', password: 'WHX2026', slot: '#7' },
    });
    expect(set.status).toBe(200);
    expect(set.body.room.a).toMatchObject({ open: true, roomId: '58392741', slot: '#4' });

    const roomA = (await a1.client.get(`/me/tournament-matches/${match.id}/room`)).body;
    expect(roomA).toMatchObject({ status: 'available', side: 'a', room: { roomId: '58392741', password: 'WHX2026', slot: '#4', serverUrl: null } });
    expect(roomA.launchUrl === null || roomA.launchUrl.startsWith('https://')).toBe(true);
    // Side B stays locked (its details exist but aren't opened) and never sees side A's slot.
    const roomB = (await b2.client.get(`/me/tournament-matches/${match.id}/room`)).body;
    expect(roomB).toMatchObject({ status: 'locked', side: 'b', room: null });

    // The room never appears on public or player match lists.
    const publicMatch = JSON.stringify((await stranger.client.get(`/tournaments/${id}/matches/${match.id}`)).body);
    const mine = JSON.stringify((await a1.client.get('/me/tournament-matches')).body);
    for (const body of [publicMatch, mine]) expect(body).not.toMatch(/WHX2026|58392741/);

    // A CS2-style server link.
    await admin.client.post(`/admin/tournaments/${id}/matches/${match.id}/room`, { b: { open: true, serverUrl: 'steam://connect/123.45.67.89:27015' } });
    expect((await b1.client.get(`/me/tournament-matches/${match.id}/room`)).body).toMatchObject({ status: 'available', room: { serverUrl: 'steam://connect/123.45.67.89:27015' } });

    // A rejected team loses access entirely.
    await admin.client.post(`/admin/tournaments/${id}/teams/${ta}/status`, { status: 'rejected' });
    expect((await a1.client.get(`/me/tournament-matches/${match.id}/room`)).status).toBe(403);

    const audit = await ctx.dataSource.query(`SELECT metadata FROM audit_logs WHERE action = 'tournament.match_room' AND "entityId" = $1`, [match.id]);
    expect(audit.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(audit)).not.toMatch(/WHX2026/);
  });

  it('game launch link: https only, staff only, public on GET /games', async () => {
    const games = (await admin.client.get('/admin/games')).body as Array<{ id: string; slug: string; launchUrl: string | null }>;
    const pubg = games.find((g) => g.slug === 'pubg-mobile');
    if (pubg) expect(pubg.launchUrl).toMatch(/^https:\/\/www\.pubgmobile\.com\//);
    const g = games[0];
    expect((await admin.client.post(`/admin/games/${g.id}`, { launchUrl: 'javascript:alert(1)' })).status).toBe(400);
    const user = await registerUser(ctx, 'r5user');
    expect((await user.client.post(`/admin/games/${g.id}`, { launchUrl: 'https://example.com/play' })).status).toBe(403);
    const ok = await admin.client.post(`/admin/games/${g.id}`, { launchUrl: 'https://example.com/play' });
    expect(ok.status).toBe(200);
    expect((await admin.client.post(`/admin/games/${g.id}`, { launchUrl: g.launchUrl })).status).toBe(200);
  });

  it('listing badges come from real data: views (deduped per visitor), price cuts, edits, staff verification', async () => {
    const seller = await registerUser(ctx, 'r5seller');
    const id = await publishItemListing(ctx, seller, admin, 100);
    const badges = async () => (await new Client(ctx.baseUrl).get(`/listings/${id}`)).body.badges as string[];
    expect(await badges()).toEqual([]);

    // Refreshing doesn't inflate views: one visitor counts once per hour.
    const one = new Client(ctx.baseUrl);
    for (let i = 0; i < 5; i++) await one.get(`/listings/${id}`);
    const [{ n }] = await ctx.dataSource.query(`SELECT coalesce(sum("views"), 0)::int AS n FROM "listing_view_hours" WHERE "listingId" = $1`, [id]);
    expect(n).toBe(2); // the badges() visitor above + this one

    // 20+ different visitors in 24h with nothing before → TRENDING (and in the 30-day top lists).
    for (let i = 0; i < 20; i++) await new Client(ctx.baseUrl).get(`/listings/${id}`);
    const after = await badges();
    expect(after).toContain('trending');

    // HOT needs 100 views and 5 new favourites in 48h.
    await ctx.dataSource.query(`UPDATE "listing_view_hours" SET "views" = "views" + 100 WHERE "listingId" = $1`, [id]);
    for (let i = 0; i < 5; i++) {
      const fan = await registerUser(ctx, `r5fan${i}`);
      expect((await fan.client.post(`/listings/${id}/favorite`)).status).toBeLessThan(300);
    }
    // The top-10 lists are cached for 5 minutes; drop the cache like a later request would see it.
    (ctx.app.get(ListingBadgesService) as ListingBadgesService).resetCache();
    expect(await badges()).toEqual(expect.arrayContaining(['hot', 'trending', 'most_viewed', 'most_popular']));

    // A cut of 10%+ → PRICE DROP; a text edit → JUST UPDATED (after re-approval).
    expect((await seller.client.request('PATCH', `/listings/${id}`, { priceWaveCoin: 85, title: `Cheaper item ${Date.now()}` })).status).toBe(200);
    await admin.client.post(`/listings/${id}/approve`);
    expect(await badges()).toEqual(expect.arrayContaining(['price_drop', 'just_updated']));
    // A 5% cut alone wouldn't count, and raising the price back clears it.
    expect((await seller.client.request('PATCH', `/listings/${id}`, { priceWaveCoin: 120 })).status).toBe(200);
    await admin.client.post(`/listings/${id}/approve`);
    expect(await badges()).not.toContain('price_drop');

    // VERIFIED is staff-only and audited.
    expect((await seller.client.post(`/admin/listings/${id}/verified`, { verified: true })).status).toBe(403);
    expect((await admin.client.post(`/admin/listings/${id}/verified`, { verified: true })).status).toBe(200);
    expect(await badges()).toContain('verified');
    const browse = (await new Client(ctx.baseUrl).get('/listings?limit=50')).body.items.find((x: { id: string }) => x.id === id);
    expect(browse.badges).toContain('verified');
    const audit = await ctx.dataSource.query(`SELECT 1 FROM audit_logs WHERE action = 'listing.verify' AND "entityId" = $1`, [id]);
    expect(audit).toHaveLength(1);
  });

  it('UI translations: content staff edit English / Georgian, public map, clearing restores, audited', async () => {
    const anon = new Client(ctx.baseUrl);
    const user = await registerUser(ctx, 'r5tr');
    const key = `ჩემი შეკვეთები ${Date.now()}`;
    expect((await user.client.post('/admin/translations', { key, en: 'My orders' })).status).toBe(403);
    expect((await admin.client.post('/admin/translations', { key: '', en: 'x' })).status).toBe(400);
    expect((await admin.client.post('/admin/translations', { key, en: 'x', extra: 1 })).status).toBe(400);
    const saved = await admin.client.post('/admin/translations', { key, en: 'My Orders', ka: 'შეკვეთები' });
    expect(saved.status).toBe(200);
    expect((await anon.get('/translations')).body[key]).toEqual({ en: 'My Orders', ka: 'შეკვეთები' });
    // Text is stored as plain text (the site writes it as text, never as HTML).
    await admin.client.post('/admin/translations', { key, en: '<img src=x onerror=alert(1)>' });
    expect((await anon.get('/translations')).body[key]).toEqual({ en: '<img src=x onerror=alert(1)>' });
    const list = (await admin.client.get('/admin/translations')).body as Array<{ id: string; key: string }>;
    expect(list.find((r) => r.key === key)).toBeTruthy();
    // Both empty = back to the built-in text.
    expect((await admin.client.post('/admin/translations', { key, en: '', ka: null })).status).toBe(200);
    expect((await anon.get('/translations')).body[key]).toBeUndefined();
    const audit = await ctx.dataSource.query(`SELECT 1 FROM audit_logs WHERE action = 'translation.upsert'`);
    expect(audit.length).toBeGreaterThanOrEqual(3);
  });
});
