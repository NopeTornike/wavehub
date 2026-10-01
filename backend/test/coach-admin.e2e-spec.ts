import { assertConserved } from './flows';
import { balanceOf, createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

// Staff add/edit coaches, coach packages + pre-booking questions, uploaded intro videos, and booking
// a package with answers (coaching/CLAUDE.md, 2026-10-01).
describe('coach admin, packages, questions, video (e2e)', () => {
  let ctx: E2eApp;
  let ops: TestUser;
  let coachUser: TestUser;
  let buyer: TestUser;
  let coachId: string;
  const inOneDay = () => new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.alloc(200)]);
  const profile = { specialty: 'Rank pushing', bio: 'Ten years of competitive experience across several titles.', hourlyRateWaveCoin: 40 };

  beforeAll(async () => {
    ctx = await createApp();
    ops = await registerUser(ctx, 'cops');
    await makeAdmin(ctx, ops, 'marketplace_coaching_ops_manager');
    coachUser = await registerUser(ctx, 'addedcoach');
    buyer = await registerUser(ctx, 'pkgbuyer');
    await credit(ctx, buyer, 500);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('staff add an existing account as a verified coach; others cannot', async () => {
    const support = await registerUser(ctx, 'csupp');
    await makeAdmin(ctx, support, 'support_specialist');
    expect((await support.client.post('/admin/coaches', { username: coachUser.username, ...profile })).status).toBe(403);
    expect((await buyer.client.post('/admin/coaches', { username: coachUser.username, ...profile })).status).toBe(403);
    expect((await ops.client.post('/admin/coaches', { username: 'nobody_here_x', ...profile })).status).toBe(404);
    expect((await ops.client.post('/admin/coaches', { username: coachUser.username, ...profile, verificationStatus: 'verified' })).status).toBe(400);

    const created = await ops.client.post('/admin/coaches', { username: `@${coachUser.username.toUpperCase()}`, ...profile, languages: ['ka', 'en'] });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ username: coachUser.username, verificationStatus: 'verified', status: 'active' });
    coachId = created.body.id;
    expect((await ops.client.post('/admin/coaches', { username: coachUser.username, ...profile })).status).toBe(409);
    // Public right away.
    expect((await buyer.client.get(`/coaches/${coachId}`)).status).toBe(200);

    // A pending application is verified with the staff-entered details.
    const applicant = await registerUser(ctx, 'applicant');
    await applicant.client.post('/coaches/apply', profile);
    const verified = await ops.client.post('/admin/coaches', { username: applicant.username, ...profile, specialty: 'Aim training' });
    expect(verified.body).toMatchObject({ verificationStatus: 'verified', specialty: 'Aim training' });

    const audit = await ctx.dataSource.query(`SELECT action FROM audit_logs WHERE "entityId" = $1`, [coachId]);
    expect(audit.map((a: { action: string }) => a.action)).toContain('coach.create');
  });

  it('coach and staff edit packages and booking questions; bounds are enforced', async () => {
    const questions = [
      { key: 'rank', label: 'Current rank', type: 'dropdown', required: true, options: ['Gold', 'Platinum'] },
      { key: 'goal', label: 'Your goal', type: 'textarea', required: false },
    ];
    expect((await coachUser.client.request('PATCH', '/coaches/mine/profile', { bookingQuestions: [questions[0], questions[0]] })).status).toBe(400);
    expect((await coachUser.client.request('PATCH', '/coaches/mine/profile', { bookingQuestions: [{ ...questions[0], options: [] }] })).status).toBe(400);
    expect((await coachUser.client.request('PATCH', '/coaches/mine/profile', { bookingQuestions: questions })).status).toBe(200);

    const pkg = (name: string, priceWaveCoin = 25) => ({ name, description: 'Review of one recorded match.', durationMinutes: 45, priceWaveCoin });
    expect((await coachUser.client.request('PUT', '/coaches/mine/packages', { packages: Array.from({ length: 7 }, (_, i) => pkg(`P${i}`)) })).status).toBe(400);
    expect((await coachUser.client.request('PUT', '/coaches/mine/packages', { packages: [{ ...pkg('Bad'), durationMinutes: 5 }] })).status).toBe(400);
    const saved = await coachUser.client.request('PUT', '/coaches/mine/packages', { packages: [pkg('VOD review'), pkg('Bootcamp', 120)] });
    expect(saved.status).toBe(200);
    expect(saved.body.map((p: { name: string }) => p.name)).toEqual(['VOD review', 'Bootcamp']);

    // Staff edit the same coach (audit-logged); a stranger can't.
    expect((await buyer.client.request('PATCH', `/admin/coaches/${coachId}/profile`, { rank: 'Ace' })).status).toBe(403);
    const edited = await ops.client.request('PATCH', `/admin/coaches/${coachId}/profile`, { rank: 'Conqueror', hourlyRateWaveCoin: 50 });
    expect(edited.body).toMatchObject({ rank: 'Conqueror', hourlyRateWaveCoin: 50 });
    expect((await ops.client.get(`/admin/coaches/${coachId}/profile`)).body.packages).toHaveLength(2);

    const detail = (await buyer.client.get(`/coaches/${coachId}`)).body;
    expect(detail.packages.map((p: { name: string; priceWaveCoin: number }) => [p.name, p.priceWaveCoin])).toEqual([
      ['VOD review', 25],
      ['Bootcamp', 120],
    ]);
    expect(detail.bookingQuestions).toEqual(questions);
    expect(detail.rank).toBe('Conqueror');
  });

  it('intro video: MP4/WebM only, served inline; staff can replace or remove it', async () => {
    expect((await coachUser.client.upload('/coaches/mine/video', Buffer.from('<html><script>alert(1)</script></html>'), 'x.mp4', 'video/mp4')).status).toBe(415);
    expect((await coachUser.client.upload('/coaches/mine/video', Buffer.from('%PDF-1.7\n'), 'x.mp4', 'video/mp4')).status).toBe(415);
    const up = await coachUser.client.upload('/coaches/mine/video', MP4, 'intro.mov', 'video/quicktime');
    expect(up.status).toBe(200);
    expect(up.body.videoFileUrl).toMatch(/\/uploads\/[0-9a-f-]{36}\.mp4$/);
    expect((await buyer.client.get(`/coaches/${coachId}`)).body.videoFileUrl).toBe(up.body.videoFileUrl);

    const served = await fetch(`${ctx.baseUrl}${new URL(up.body.videoFileUrl).pathname}`);
    expect(served.headers.get('content-type')).toBe('video/mp4');
    expect(served.headers.get('content-disposition')).toBeNull();
    expect(served.headers.get('x-content-type-options')).toBe('nosniff');

    expect((await buyer.client.upload(`/admin/coaches/${coachId}/video`, MP4, 'x.mp4', 'video/mp4')).status).toBe(403);
    expect((await ops.client.upload(`/admin/coaches/${coachId}/video`, MP4, 'x.mp4', 'video/mp4')).status).toBe(200);
    expect((await ops.client.request('DELETE', `/admin/coaches/${coachId}/video`)).status).toBe(200);
    expect((await buyer.client.get(`/coaches/${coachId}`)).body.videoFileUrl).toBeNull();
  });

  it('booking a package charges its price and stores the answers for the participants only', async () => {
    const detail = (await buyer.client.get(`/coaches/${coachId}`)).body;
    const vod = detail.packages[0];
    const before = await balanceOf(ctx, buyer);

    expect((await buyer.client.post(`/coaches/${coachId}/sessions`, { scheduledAt: inOneDay(), packageId: vod.id })).status).toBe(400); // rank required
    expect((await buyer.client.post(`/coaches/${coachId}/sessions`, { scheduledAt: inOneDay(), packageId: vod.id, answers: { rank: 'Iron' } })).status).toBe(400);
    expect((await buyer.client.post(`/coaches/${coachId}/sessions`, { scheduledAt: inOneDay(), answers: { rank: 'Gold' } })).status).toBe(400); // no duration/package
    expect(await balanceOf(ctx, buyer)).toBe(before);

    const booked = await buyer.client.post(`/coaches/${coachId}/sessions`, {
      scheduledAt: inOneDay(),
      packageId: vod.id,
      durationMinutes: 120, // ignored: the package fixes the duration
      answers: { rank: 'Gold', goal: 'Reach Platinum' },
    });
    expect(booked.status).toBe(201);
    expect(booked.body).toMatchObject({ priceWaveCoin: 25, durationMinutes: 45, packageName: 'VOD review', answers: { rank: 'Gold', goal: 'Reach Platinum' } });
    expect(await balanceOf(ctx, buyer)).toBe(before - 25);

    // The coach sees the answers; a stranger can't open the session.
    expect((await coachUser.client.get(`/coaching-sessions/${booked.body.id}`)).body.answers).toEqual({ rank: 'Gold', goal: 'Reach Platinum' });
    const stranger = await registerUser(ctx, 'pkgstranger');
    expect((await stranger.client.get(`/coaching-sessions/${booked.body.id}`)).status).toBeGreaterThanOrEqual(403);

    // Removing the package keeps the session's snapshot.
    await coachUser.client.request('PUT', '/coaches/mine/packages', { packages: [] });
    expect((await buyer.client.get(`/coaching-sessions/${booked.body.id}`)).body.packageName).toBe('VOD review');
    expect((await buyer.client.post(`/coaching-sessions/${booked.body.id}/cancel`)).status).toBeLessThan(300);
    expect(await balanceOf(ctx, buyer)).toBe(before);
  });
});
