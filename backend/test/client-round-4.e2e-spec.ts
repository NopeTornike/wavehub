import { assertConserved } from './flows';
import { createApp, E2eApp, makeAdmin, publishItemListing, registerUser, TestUser } from './helpers';

// Owner round 2026-10-24: staff get notifications for their queues, and "Contact support" is a
// live chat (operator joins, files both ways).
describe('client round 4 (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let support: TestUser;
  let ops: TestUser;
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'r4admin');
    await makeAdmin(ctx, admin);
    support = await registerUser(ctx, 'r4support');
    await makeAdmin(ctx, support, 'support_specialist');
    ops = await registerUser(ctx, 'r4ops');
    await makeAdmin(ctx, ops, 'marketplace_coaching_ops_manager');
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  const staffTasks = async (user: TestUser, key: string) =>
    ((await user.client.get('/notifications?limit=50')).body as Array<{ type: string; metadata: Record<string, string> | null; readAt: string | null }>).filter(
      (n) => n.type === 'staff_task' && n.metadata?.key === key,
    );

  it('staff hear about their queues; one unread item per entity; users never get staff tasks', async () => {
    const user = await registerUser(ctx, 'r4user');
    const t = await user.client.post('/tickets', { subject: 'Payment stuck', category: 'payment', description: 'My top-up did not arrive.' });
    expect(t.status).toBe(201);
    const key = `ticket:${t.body.id}`;
    expect(await staffTasks(support, key)).toHaveLength(1);
    expect(await staffTasks(admin, key)).toHaveLength(1);
    expect(await staffTasks(ops, key)).toHaveLength(0); // not a support role
    const [task] = await staffTasks(support, key);
    expect(task.metadata?.link).toBe(`/admin/tickets/${t.body.id}`);

    // A reply while the first is still unread doesn't add a second one…
    await user.client.post(`/tickets/mine/${t.body.id}/reply`, { body: 'Any news?' });
    expect(await staffTasks(support, key)).toHaveLength(1);
    // …once read, the next reply notifies again.
    await ctx.dataSource.query(`UPDATE notifications SET "readAt" = now() WHERE "userId" = $1 AND metadata ->> 'key' = $2`, [support.id, key]);
    await user.client.post(`/tickets/mine/${t.body.id}/reply`, { body: 'Still waiting.' });
    expect(await staffTasks(support, key)).toHaveLength(2);

    // A listing waiting for review goes to the listing moderators.
    const seller = await registerUser(ctx, 'r4seller');
    const listingId = await publishItemListing(ctx, seller, admin, 12);
    expect(await staffTasks(ops, `listing:${listingId}`)).toHaveLength(1);
    expect(await staffTasks(support, `listing:${listingId}`)).toHaveLength(0);

    // A coach application goes to coach managers, never back to the applicant.
    const applicant = await registerUser(ctx, 'r4coach');
    const applied = await applicant.client.post('/coaches/apply', { specialty: 'Rank pushing', bio: 'Ten years of competitive experience across several titles.', hourlyRateWaveCoin: 30 });
    expect(applied.status).toBe(201);
    expect(await staffTasks(ops, `coach:${applied.body.id}`)).toHaveLength(1);

    const rows = await ctx.dataSource.query(`SELECT count(*)::int AS n FROM notifications WHERE type = 'staff_task' AND "userId" = ANY($1)`, [[user.id, seller.id, applicant.id]]);
    expect(rows[0].n).toBe(0);
  });

  it('live support chat: opens on the first message, operator joins, files both ways, private to the user', async () => {
    const user = await registerUser(ctx, 'r4chat');
    const stranger = await registerUser(ctx, 'r4stranger');
    expect((await user.client.get('/tickets/live')).body).toBeNull();
    expect((await user.client.post('/tickets/live', { body: '' })).status).toBe(400);

    const first = await user.client.post('/tickets/live', { body: 'Hi, I need help with an order.' });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ channel: 'chat', operator: null, status: 'open' });
    const chatId = first.body.id as string;
    expect(await staffTasks(support, `ticket:${chatId}`)).toHaveLength(1);
    const second = await user.client.post('/tickets/live', { body: 'Order #12' });
    expect(second.body.id).toBe(chatId);
    expect(second.body.messages).toHaveLength(2);

    // Files: byte-checked; only the owner can attach to their chat.
    expect((await user.client.upload(`/tickets/mine/${chatId}/attachment`, Buffer.from('<html><script>alert(1)</script></html>'), 'x.png', 'image/png')).status).toBe(415);
    expect((await stranger.client.upload(`/tickets/mine/${chatId}/attachment`, PNG, 'shot.png', 'image/png')).status).toBe(403);
    const shot = await user.client.upload(`/tickets/mine/${chatId}/attachment`, PNG, 'shot.png', 'image/png');
    expect(shot.status).toBe(200);
    const fileMsg = shot.body.messages.at(-1);
    expect(fileMsg).toMatchObject({ body: '', fileName: 'shot.png', fileType: 'image/png' });
    expect(fileMsg.fileUrl).toMatch(/\/uploads\/[0-9a-f-]{36}\.png$/);

    // Staff join: the user sees the operator's first name only.
    expect((await ops.client.post(`/admin/tickets/${chatId}/join`)).status).toBe(403);
    const joined = await support.client.post(`/admin/tickets/${chatId}/join`);
    expect(joined.status).toBe(200);
    expect(joined.body.status).toBe('in_progress');
    const seen = (await user.client.get('/tickets/live')).body;
    expect(seen.operator).toEqual({ firstName: 'Test', avatarUrl: null, joinedAt: expect.any(String) });
    expect(JSON.stringify(seen)).not.toContain(support.username);

    const staffFile = await support.client.upload(`/admin/tickets/${chatId}/attachment`, PNG, 'answer.png', 'image/png');
    expect(staffFile.status).toBe(200);
    const mine = (await user.client.get(`/tickets/mine/${chatId}`)).body;
    expect(mine.messages.at(-1)).toMatchObject({ fromSupport: true, senderUsername: '', fileName: 'answer.png' });

    // A closed chat stays closed to files; the next message starts a new chat.
    await support.client.post(`/admin/tickets/${chatId}/update`, { status: 'closed' });
    expect((await user.client.upload(`/tickets/mine/${chatId}/attachment`, PNG, 'late.png', 'image/png')).status).toBe(409);
    expect((await user.client.get('/tickets/live')).body).toBeNull();
    const next = await user.client.post('/tickets/live', { body: 'Another question' });
    expect(next.body.id).not.toBe(chatId);

    // Joining a classic ticket is refused; actions are audited.
    const classic = await user.client.post('/tickets', { subject: 'Classic ticket', category: 'other', description: 'Not a chat.' });
    expect((await support.client.post(`/admin/tickets/${classic.body.id}/join`)).status).toBe(400);
    const audit = await ctx.dataSource.query(`SELECT action FROM audit_logs WHERE "entityId" = $1`, [chatId]);
    expect(audit.map((a: { action: string }) => a.action)).toEqual(expect.arrayContaining(['ticket.join_chat', 'ticket.attachment']));
  });

  it('a service listing cannot use the Coaching category', async () => {
    const seller = await registerUser(ctx, 'r4svc');
    const cats = (await seller.client.get('/categories')).body as Array<{ id: string; slug: string }>;
    const games = (await seller.client.get('/games')).body as Array<{ id: string }>;
    const coaching = cats.find((c) => c.slug === 'coaching');
    if (!coaching) return;
    const res = await seller.client.post('/listings', {
      type: 'service', categoryId: coaching.id, gameId: games[0].id, title: `Coaching as a service ${Date.now()}`,
      description: 'A coaching service listing that should be refused, long enough for validation.',
      priceWaveCoin: 20,
    });
    expect(res.status).toBe(403);
  });

  it('profile follower / following lists: signed-in only, staff hidden from non-staff viewers', async () => {
    const star = await registerUser(ctx, 'r4star');
    const fan = await registerUser(ctx, 'r4fan');
    const viewer = await registerUser(ctx, 'r4viewer');
    await fan.client.post(`/users/${star.username}/follow`);
    await support.client.post(`/users/${star.username}/follow`);
    await star.client.post(`/users/${fan.username}/follow`);

    const anon = new (fan.client.constructor as new (base: string) => typeof fan.client)(ctx.baseUrl);
    expect((await anon.get(`/users/${star.username}/followers`)).status).toBe(401);
    const seen = await viewer.client.get(`/users/${star.username}/followers`);
    expect(seen.status).toBe(200);
    expect(seen.body.map((r: { username: string }) => r.username)).toEqual([fan.username]);
    expect(JSON.stringify(seen.body)).not.toMatch(/email|passwordHash|wavecoinBalance|adminRole/);
    const staffView = await admin.client.get(`/users/${star.username}/followers`);
    expect(staffView.body.map((r: { username: string }) => r.username)).toEqual(expect.arrayContaining([fan.username, support.username]));
    expect((await viewer.client.get(`/users/${star.username}/following`)).body.map((r: { username: string }) => r.username)).toEqual([fan.username]);
    expect((await viewer.client.get('/users/nobody-here-xyz/followers')).status).toBe(404);
  });
});
