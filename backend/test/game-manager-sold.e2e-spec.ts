import { ListingsService } from '../src/listings/listings.service';
import { Client, createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';
import { assertConserved } from './flows';

// Owner 2026-11-06: a per-game "Game Manager" (e.g. PUBG marketplace head) who acts only on its
// games' listings and/or tournaments and sees nothing else; and the staff-set SOLD overlay that
// blocks buying and takes the listing off the site 24h later.
describe('game manager + SOLD (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let seller: TestUser;
  let gm: TestUser;
  let gameA: string;
  let gameB: string;
  let categoryId: string;
  const startDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'gmadmin');
    await makeAdmin(ctx, admin);
    seller = await registerUser(ctx, 'gmseller');
    gm = await registerUser(ctx, 'gmhead');
    const games = (await admin.client.get('/games')).body as Array<{ id: string }>;
    [gameA, gameB] = [games[0].id, games[1].id];
    categoryId = (await admin.client.get('/categories')).body[0].id;
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  const draft = async (gameId: string) => {
    const res = await seller.client.post('/listings', {
      type: 'item', categoryId, gameId,
      title: `GM item ${Math.random().toString(36).slice(2, 8)}`,
      description: 'An end-to-end test item listing, long enough to satisfy the 50 character minimum.',
      priceWaveCoin: 40, stockQuantity: 3, isUnique: false, resaleRightsAttested: true,
    });
    expect(res.status).toBeLessThan(300);
    expect((await seller.client.post(`/listings/${res.body.id}/submit`)).status).toBeLessThan(300);
    return res.body.id as string;
  };

  it('Super Admin assigns a Game Manager with its games; it needs at least one game', async () => {
    expect((await admin.client.post(`/admin/users/${gm.id}/role`, { adminRole: 'game_manager', reason: 'PUBG head' })).status).toBe(400);
    const set = await admin.client.post(`/admin/users/${gm.id}/role`, {
      adminRole: 'game_manager', reason: 'PUBG head',
      staffScopes: { marketplaceGameIds: [gameA], tournamentGameIds: [gameA] },
    });
    expect(set.status).toBe(200);
    expect(set.body.staffScopes).toEqual({ marketplaceGameIds: [gameA], tournamentGameIds: [gameA] });
    expect((await gm.client.get('/auth/me')).body.user.staffScopes).toEqual({ marketplaceGameIds: [gameA], tournamentGameIds: [gameA] });
    // Another user can't do this, and unknown games are refused.
    expect((await gm.client.post(`/admin/users/${seller.id}/role`, { adminRole: 'game_manager', reason: 'nope', staffScopes: { marketplaceGameIds: [gameA], tournamentGameIds: [] } })).status).toBe(403);
    expect((await admin.client.post(`/admin/users/${seller.id}/role`, { adminRole: 'game_manager', reason: 'bad game', staffScopes: { marketplaceGameIds: ['00000000-0000-4000-8000-000000000000'], tournamentGameIds: [] } })).status).toBe(400);
  });

  it('moderates and edits only its own game; everything else in the admin panel is closed', async () => {
    const mine = await draft(gameA);
    const other = await draft(gameB);

    const queue = (await gm.client.get('/listings/pending-review')).body as Array<{ id: string }>;
    expect(queue.some((l) => l.id === mine)).toBe(true);
    expect(queue.some((l) => l.id === other)).toBe(false);

    expect((await gm.client.post(`/listings/${other}/approve`)).status).toBe(403);
    expect((await gm.client.get(`/admin/listings/${other}`)).status).toBe(403);
    expect((await gm.client.post(`/listings/${mine}/approve`)).status).toBe(200);
    expect((await gm.client.patch(`/admin/listings/${mine}`, { title: 'Edited by the game head' })).status).toBe(200);
    expect((await gm.client.patch(`/admin/listings/${other}`, { title: 'Not allowed here' })).status).toBe(403);

    const all = (await gm.client.get('/admin/listings')).body as Array<{ id: string; gameId: string }>;
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((l) => l.gameId === gameA)).toBe(true);

    // No statistics, users, finance, featured picks, deletes or settings.
    for (const path of [
      '/admin/analytics/overview',
      '/admin/users',
      '/withdrawals/pending',
      '/disputes',
      '/admin/platform-settings',
      '/admin/tickets',
    ]) {
      expect([403, 404]).toContain((await gm.client.get(path)).status);
    }
    expect((await gm.client.post(`/admin/listings/${mine}/featured`, { isFeatured: true })).status).toBe(403);
    expect((await gm.client.del(`/admin/listings/${mine}`)).status).toBe(403);

    const audit = await ctx.dataSource.query(`SELECT "adminRole" FROM audit_logs WHERE action = 'listing.approve' AND "entityId" = $1`, [mine]);
    expect(audit[0].adminRole).toBe('game_manager');
    await admin.client.post(`/listings/${other}/approve`);
  });

  it('runs only its own game’s tournaments', async () => {
    const base = { description: 'A tournament for the game manager scope test.', prize: '50 GEL', status: 'open', startDate, maxPlayers: 8, teamSize: 1 };
    expect((await gm.client.post('/admin/tournaments', { ...base, gameId: gameB, name: `GM B ${Date.now() % 1e5}` })).status).toBe(403);
    const created = await gm.client.post('/admin/tournaments', { ...base, gameId: gameA, name: `GM A ${Date.now() % 1e5}` });
    expect(created.status).toBeLessThan(300);
    const foreign = (await admin.client.post('/admin/tournaments', { ...base, gameId: gameB, name: `Admin B ${Date.now() % 1e5}` })).body.id;

    const list = (await gm.client.get('/admin/tournaments?limit=50')).body.items as Array<{ id: string }>;
    expect(list.some((t) => t.id === created.body.id)).toBe(true);
    expect(list.some((t) => t.id === foreign)).toBe(false);
    expect((await gm.client.post(`/admin/tournaments/${foreign}`, { name: 'Hijacked name' })).status).toBe(403);
    expect((await gm.client.get(`/admin/tournaments/${foreign}/teams`)).status).toBe(403);
    expect((await gm.client.post(`/admin/tournaments/${created.body.id}`, { gameId: gameB })).status).toBe(403);
    expect((await gm.client.post(`/admin/tournaments/${created.body.id}`, { name: 'Renamed by the head' })).status).toBe(200);
  });

  it('a marketplace-only manager gets no tournament access', async () => {
    const other = await registerUser(ctx, 'gmmkt');
    await admin.client.post(`/admin/users/${other.id}/role`, { adminRole: 'game_manager', reason: 'market only', staffScopes: { marketplaceGameIds: [gameB], tournamentGameIds: [] } });
    expect((await other.client.get('/admin/tournaments')).body.items).toEqual([]);
    expect((await other.client.post('/admin/tournaments', { gameId: gameB, name: 'Nope cup', description: 'Should not be created by this account.', prize: '1', status: 'open', startDate, maxPlayers: 8, teamSize: 1 })).status).toBe(403);
  });

  it('SOLD: overlay field, no buying, seller locked out, gone from the site after 24h', async () => {
    const id = await draft(gameA);
    await admin.client.post(`/listings/${id}/approve`);
    const buyer = await registerUser(ctx, 'gmbuyer');
    await credit(ctx, buyer, 200);

    // Only staff with access to the game can mark it.
    expect((await seller.client.post(`/admin/listings/${id}/sold`, { sold: true })).status).toBe(403);
    const marked = await gm.client.post(`/admin/listings/${id}/sold`, { sold: true });
    expect(marked.status).toBe(200);
    expect(marked.body.soldAt).toBeTruthy();

    const pub = (await new Client(ctx.baseUrl).get(`/listings/${id}`)).body;
    expect(pub.soldAt).toBeTruthy();
    expect((await new Client(ctx.baseUrl).get('/listings?limit=100')).body.items.find((l: { id: string }) => l.id === id)?.soldAt).toBeTruthy();

    expect((await buyer.client.post('/orders', { listingId: id })).status).toBe(409);
    expect((await new Client(ctx.baseUrl).get(`/order-quote?listingId=${id}`)).status).toBe(409);
    expect((await seller.client.patch(`/listings/${id}`, { title: 'Trying to relist it' })).status).toBe(409);

    // 24h later the sweep takes it off the site; the seller can't put it back live.
    const listings = ctx.app.get(ListingsService);
    expect(await listings.sweepSoldListings(new Date(Date.now() + 23 * 3600_000))).toBe(0);
    expect(await listings.sweepSoldListings(new Date(Date.now() + 25 * 3600_000))).toBeGreaterThanOrEqual(1);
    expect((await new Client(ctx.baseUrl).get(`/listings/${id}`)).status).toBe(404);
    expect((await seller.client.post(`/listings/${id}/unpause`)).status).toBe(409);

    // Unmarking puts it back.
    expect((await admin.client.post(`/admin/listings/${id}/sold`, { sold: false })).body.soldAt).toBeNull();
    expect((await new Client(ctx.baseUrl).get(`/listings/${id}`)).status).toBe(200);
    const audit = await ctx.dataSource.query(`SELECT action FROM audit_logs WHERE "entityId" = $1 AND action LIKE 'listing.%sold'`, [id]);
    expect(audit.map((r: { action: string }) => r.action).sort()).toEqual(['listing.mark_sold', 'listing.unmark_sold']);
  });
});
