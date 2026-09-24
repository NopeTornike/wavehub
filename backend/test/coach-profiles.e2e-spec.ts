import { assertConserved } from './flows';
import { createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

// Coach profile content, session reviews → rating aggregate, stats, favourites (docs/design-mockups 06/14).
describe('coach profiles, reviews, favourites (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let coachUser: TestUser;
  let buyer: TestUser;
  let stranger: TestUser;
  let coachId: string;
  const inOneDay = () => new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'cpadmin');
    await makeAdmin(ctx, admin);
    coachUser = await registerUser(ctx, 'cpcoach');
    buyer = await registerUser(ctx, 'cpbuyer');
    stranger = await registerUser(ctx, 'cpstranger');
    await credit(ctx, buyer, 1000);
    const applied = await coachUser.client.post('/coaches/apply', {
      specialty: 'PUBG Mobile Specialist', bio: 'Competitive player and coach with years of experience.', hourlyRateWaveCoin: 40, languages: ['en', 'ka'],
    });
    coachId = applied.body.id;
    expect((await admin.client.post(`/coaches/${coachId}/approve`)).status).toBe(200);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('the coach edits their own profile; bad input is refused', async () => {
    const games = (await coachUser.client.get('/games')).body;
    expect((await stranger.client.request('PATCH', '/coaches/mine/profile', { rank: 'x' })).status).toBe(404);
    expect((await coachUser.client.request('PATCH', '/coaches/mine/profile', { videoUrl: 'https://evil.example/x' })).status).toBe(400);
    expect((await coachUser.client.request('PATCH', '/coaches/mine/profile', { languages: ['english'] })).status).toBe(400);
    expect((await coachUser.client.request('PATCH', '/coaches/mine/profile', { extraGameIds: ['8d0b6c1e-0f3a-4c55-9a1e-2f5f3c1d2b4a'] })).status).toBe(400);
    const ok = await coachUser.client.request('PATCH', '/coaches/mine/profile', {
      rank: 'Conqueror', videoUrl: 'https://www.youtube.com/watch?v=abc123', quote: 'Rise with purpose.',
      coachingStyle: ['Personalized training plan', 'Detailed feedback'], gameId: games[0].id, extraGameIds: [games[1].id, games[0].id],
    });
    expect(ok.status).toBe(200);
    expect(ok.body.extraGameIds).toEqual([games[1].id]); // the main game isn't repeated
    const pub = (await stranger.client.get(`/coaches/${coachId}`)).body;
    expect(pub).toMatchObject({ rank: 'Conqueror', quote: 'Rise with purpose.', coachingStyle: ['Personalized training plan', 'Detailed feedback'] });
    expect(pub.games.map((g: { main: boolean }) => g.main)).toEqual([true, false]);
    expect(pub.stats).toEqual({ students: 0, sessions: 0, successRate: null });
    expect(pub.responseMinutes).toBeNull();
    expect(pub.waveScore.score).toBeGreaterThanOrEqual(0);
  });

  it('only the buyer of a completed session reviews it, once; the rating aggregate follows', async () => {
    const session = (await buyer.client.post(`/coaches/${coachId}/sessions`, { scheduledAt: inOneDay(), durationMinutes: 60 })).body;
    expect((await buyer.client.post(`/coaching-sessions/${session.id}/review`, { rating: 5 })).status).toBe(409); // not completed yet
    expect((await coachUser.client.post(`/coaching-sessions/${session.id}/complete`)).status).toBe(200);
    expect((await stranger.client.post(`/coaching-sessions/${session.id}/review`, { rating: 5 })).status).toBe(403);
    expect((await coachUser.client.post(`/coaching-sessions/${session.id}/review`, { rating: 5 })).status).toBe(403);
    expect((await buyer.client.post(`/coaching-sessions/${session.id}/review`, { rating: 6 })).status).toBe(400);
    const review = await buyer.client.post(`/coaching-sessions/${session.id}/review`, { rating: 4, body: 'Great session, clear tips.' });
    expect(review.status).toBe(201);
    expect((await buyer.client.post(`/coaching-sessions/${session.id}/review`, { rating: 5 })).status).toBe(409);
    expect((await coachUser.client.get(`/coaching-sessions/${session.id}/review`)).body.rating).toBe(4);
    expect((await stranger.client.get(`/coaching-sessions/${session.id}/review`)).status).toBe(403);

    const pub = (await stranger.client.get(`/coaches/${coachId}`)).body;
    expect(pub).toMatchObject({ ratingAvg: '4.00', ratingCount: 1, completedSessions: 1, stats: { students: 1, sessions: 1, successRate: 100 } });
    const reviews = (await stranger.client.get(`/coaches/${coachId}/reviews`)).body;
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ rating: 4, body: 'Great session, clear tips.', buyerUsername: buyer.username });
    expect(JSON.stringify(reviews)).not.toMatch(/buyerId|email/);
  });

  it('favourites are per user and idempotent', async () => {
    expect((await stranger.client.post(`/coaches/${coachId}/favorite`)).status).toBe(200);
    expect((await stranger.client.post(`/coaches/${coachId}/favorite`)).status).toBe(200);
    expect((await stranger.client.get('/me/coach-favorites/ids')).body).toEqual([coachId]);
    expect((await buyer.client.get('/me/coach-favorites/ids')).body).toEqual([]);
    expect((await stranger.client.request('DELETE', `/coaches/${coachId}/favorite`)).status).toBe(200);
    expect((await stranger.client.get('/me/coach-favorites/ids')).body).toEqual([]);
  });
});
