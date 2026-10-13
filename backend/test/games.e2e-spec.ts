import { createApp, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

// Admin game catalogue (listings/games.service.ts) against real Postgres: roles, validation,
// hide/show reaching every public list, artwork upload/clear, audit trail.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('game-art')]);
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

describe('admin game catalogue (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let ops: TestUser;
  let support: TestUser;
  let user: TestUser;
  const suffix = String(Date.now() % 100000);

  beforeAll(async () => {
    ctx = await createApp();
    [admin, ops, support, user] = await Promise.all([
      registerUser(ctx, 'gadmin'),
      registerUser(ctx, 'gops'),
      registerUser(ctx, 'gsupport'),
      registerUser(ctx, 'guser'),
    ]);
    await makeAdmin(ctx, admin);
    await makeAdmin(ctx, ops, 'marketplace_coaching_ops_manager');
    await makeAdmin(ctx, support, 'support_specialist');
  });
  afterAll(async () => ctx.close());

  it('only catalogue roles can manage games', async () => {
    expect((await user.client.get('/admin/games')).status).toBe(403);
    expect((await support.client.get('/admin/games')).status).toBe(403);
    expect((await support.client.post('/admin/games', { name: `Nope ${suffix}`, slug: `nope-${suffix}` })).status).toBe(403);
    expect((await ops.client.get('/admin/games')).status).toBe(200);
    const list = (await admin.client.get('/admin/games')).body;
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toEqual(expect.objectContaining({ isActive: expect.any(Boolean), listingCount: expect.any(Number) }));
  });

  it('creates, validates, hides/shows, reorders and renames a game', async () => {
    const name = `Apex Legends ${suffix}`;
    const slug = `apex-legends-${suffix}`;
    expect((await admin.client.post('/admin/games', { name, slug: 'Bad Slug!' })).status).toBe(400);
    expect((await admin.client.post('/admin/games', { name, slug, isActive: false })).status).toBe(400); // unknown field
    const created = await ops.client.post('/admin/games', { name, slug });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name, slug, isActive: true });
    const id = created.body.id as string;
    // Duplicate name (case-insensitive) or slug.
    expect((await admin.client.post('/admin/games', { name: name.toUpperCase(), slug: `other-${suffix}` })).status).toBe(409);
    expect((await admin.client.post('/admin/games', { name: `Other ${suffix}`, slug })).status).toBe(409);

    // Public: listed in /games and the home grid counts.
    const inPublic = async () => ({
      games: (await user.client.get('/games')).body.some((g: { id: string }) => g.id === id),
      stats: (await user.client.get('/stats/games')).body.some((g: { gameId: string }) => g.gameId === id),
    });
    expect(await inPublic()).toEqual({ games: true, stats: true });

    // Hide → gone from both; show → back.
    expect((await admin.client.post(`/admin/games/${id}`, { isActive: false })).body.isActive).toBe(false);
    expect(await inPublic()).toEqual({ games: false, stats: false });
    await admin.client.post(`/admin/games/${id}`, { isActive: true });
    expect(await inPublic()).toEqual({ games: true, stats: true });

    // Rename/reorder; the slug is immutable (not in the update DTO).
    expect((await admin.client.post(`/admin/games/${id}`, { slug: 'changed' })).status).toBe(400);
    const renamed = await admin.client.post(`/admin/games/${id}`, { name: `Apex ${suffix}`, sortOrder: 0 });
    expect(renamed.body).toMatchObject({ name: `Apex ${suffix}`, slug, sortOrder: 0 });
    expect((await admin.client.post(`/admin/games/00000000-0000-0000-0000-000000000000`, { isActive: false })).status).toBe(404);
  });

  it('uploads and clears artwork; non-images are refused', async () => {
    const id = (await admin.client.post('/admin/games', { name: `Art Game ${suffix}`, slug: `art-game-${suffix}` })).body.id as string;
    const tile = await admin.client.upload(`/admin/games/${id}/images/tile`, PNG, 'tile.png', 'image/png');
    expect(tile.status).toBe(200);
    expect(tile.body.tileUrl).toMatch(/\/uploads\/[0-9a-f-]+\.png$/);
    expect((await admin.client.upload(`/admin/games/${id}/images/cover`, HTML, 'cover.png', 'image/png')).status).toBe(415);
    expect((await admin.client.upload(`/admin/games/${id}/images/banner`, PNG, 'x.png', 'image/png')).status).toBe(400);
    expect((await support.client.upload(`/admin/games/${id}/images/icon`, PNG, 'x.png', 'image/png')).status).toBe(403);

    const stats = (await user.client.get('/stats/games')).body.find((g: { gameId: string }) => g.gameId === id);
    expect(stats.tileUrl).toBe(tile.body.tileUrl);

    const cleared = await admin.client.request('DELETE', `/admin/games/${id}/images/tile`);
    expect(cleared.body.tileUrl).toBeNull();

    const actions = (await ctx.dataSource.query(`SELECT action FROM audit_logs WHERE "entityId" = $1 ORDER BY "createdAt"`, [id])).map(
      (r: { action: string }) => r.action,
    );
    expect(actions).toEqual(['game.create', 'game.set_image', 'game.clear_image']);
  });
});
