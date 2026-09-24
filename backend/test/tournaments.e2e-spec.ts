import { createApp, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

// Teams, prize breakdown and matches against real Postgres (docs/design-mockups 01, 07, 08, 10, 11).
describe('tournament teams + matches (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let gameId: string;
  const startDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'tadmin');
    await makeAdmin(ctx, admin);
    gameId = (await admin.client.get('/games')).body[0].id;
  });
  afterAll(async () => ctx.close());

  async function squadTournament(maxPlayers: number) {
    const t = await admin.client.post('/admin/tournaments', {
      gameId, name: `Squad Cup ${Date.now() % 100000}`, description: 'A squad e2e tournament with teams.',
      prize: '1,000 GEL', status: 'open', startDate, maxPlayers, teamSize: 2,
      prizes: { places: [{ place: '1st Place', amount: '500 GEL', rewards: ['Gaming Gear'] }], specialRewards: ['MVP Reward'], note: 'Paid by the organizer.' },
    });
    expect(t.status).toBeLessThan(300);
    return t.body.id as string;
  }

  it('squad registration: exact roster size, capacity, verification, public teams list', async () => {
    const id = await squadTournament(4); // 2 teams of 2
    const [a, b, c] = await Promise.all([registerUser(ctx, 'capa'), registerUser(ctx, 'capb'), registerUser(ctx, 'capc')]);

    // Solo endpoint is refused on a squad tournament; wrong roster sizes are refused.
    expect((await a.client.post(`/tournaments/${id}/register`)).status).toBe(400);
    expect((await a.client.post(`/tournaments/${id}/teams`, { name: 'Alpha', members: ['a1'] })).status).toBe(400);
    expect((await a.client.post(`/tournaments/${id}/teams`, { name: 'Alpha', members: ['a1', 'A1'] })).status).toBe(400);
    // Unknown fields are rejected (no mass assignment of status).
    expect((await a.client.post(`/tournaments/${id}/teams`, { name: 'Alpha', members: ['a1', 'a2'], status: 'verified' })).status).toBe(400);

    const teamA = await a.client.post(`/tournaments/${id}/teams`, { name: 'Alpha', tag: 'alp', members: ['a1', 'a2'] });
    expect(teamA.status).toBe(201);
    expect(teamA.body).toMatchObject({ status: 'pending', tag: 'ALP', members: ['a1', 'a2'] });
    // Duplicate team name (case-insensitive) and double registration.
    expect((await b.client.post(`/tournaments/${id}/teams`, { name: 'alpha', members: ['b1', 'b2'] })).status).toBe(409);
    expect((await a.client.post(`/tournaments/${id}/teams`, { name: 'Other', members: ['x', 'y'] })).status).toBe(403);
    expect((await b.client.post(`/tournaments/${id}/teams`, { name: 'Bravo', members: ['b1', 'b2'] })).status).toBe(201);
    // Full: 4 players registered.
    expect((await c.client.post(`/tournaments/${id}/teams`, { name: 'Charlie', members: ['c1', 'c2'] })).status).toBe(403);

    const detail = await a.client.get(`/tournaments/${id}`);
    expect(detail.body).toMatchObject({ registeredCount: 4, teamCount: 2, maxTeams: 2, teamSize: 2 });
    expect(detail.body.prizes.places[0]).toEqual({ place: '1st Place', amount: '500 GEL', rewards: ['Gaming Gear'] });

    // Staff verify/reject; a rejected team frees its places and disappears from the public list.
    expect((await a.client.post(`/admin/tournaments/${id}/teams/${teamA.body.id}/status`, { status: 'verified' })).status).toBe(403);
    expect((await admin.client.post(`/admin/tournaments/${id}/teams/${teamA.body.id}/status`, { status: 'verified' })).body.status).toBe('verified');
    const bravo = (await admin.client.get(`/admin/tournaments/${id}/teams`)).body.find((t: { name: string }) => t.name === 'Bravo');
    await admin.client.post(`/admin/tournaments/${id}/teams/${bravo.id}/status`, { status: 'rejected' });
    const publicTeams = (await c.client.get(`/tournaments/${id}/teams`)).body;
    expect(publicTeams.map((t: { name: string }) => t.name)).toEqual(['Alpha']);
    expect(publicTeams[0]).not.toHaveProperty('captainUserId');
    expect((await c.client.post(`/tournaments/${id}/teams`, { name: 'Charlie', members: ['c1', 'c2'] })).status).toBe(201);

    // My tournaments + withdraw.
    const mine = (await a.client.get('/me/tournaments')).body;
    expect(mine).toHaveLength(1);
    expect(mine[0].team.name).toBe('Alpha');
    expect((await c.client.post(`/tournaments/${id}/withdraw`)).status).toBe(200);
    expect((await c.client.get('/me/tournaments')).body).toHaveLength(0);
  });

  it('matches: teams must belong to the tournament; scores and stats are public; hub sees own matches', async () => {
    const id = await squadTournament(8);
    const other = await squadTournament(8);
    const [a, b, x] = await Promise.all([registerUser(ctx, 'ma'), registerUser(ctx, 'mb'), registerUser(ctx, 'mx')]);
    const ta = (await a.client.post(`/tournaments/${id}/teams`, { name: 'Wave Riders', members: ['GG', 'Zero'] })).body.id;
    const tb = (await b.client.post(`/tournaments/${id}/teams`, { name: 'Silent Storm', members: ['Storm', 'Blaze'] })).body.id;
    const tx = (await x.client.post(`/tournaments/${other}/teams`, { name: 'Outsiders', members: ['o1', 'o2'] })).body.id;

    expect((await admin.client.post(`/admin/tournaments/${id}/matches`, { teamAId: ta, teamBId: tx })).status).toBe(400);
    expect((await admin.client.post(`/admin/tournaments/${id}/matches`, { teamAId: ta, teamBId: ta })).status).toBe(400);
    expect((await a.client.post(`/admin/tournaments/${id}/matches`, { teamAId: ta, teamBId: tb })).status).toBe(403);

    const created = await admin.client.post(`/admin/tournaments/${id}/matches`, {
      stage: 'semifinal', roundLabel: 'Round 1', teamAId: ta, teamBId: tb, map: 'Erangel', bestOf: 3,
      scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(created.status).toBe(201);
    const matchId = created.body.id;

    const updated = await admin.client.post(`/admin/tournaments/${id}/matches/${matchId}`, {
      status: 'completed', scoreA: 2, scoreB: 1,
      stats: { a: { coach: 'Luna', players: [{ name: 'GG', kills: 12, kd: 2.4, damage: 2856, rating: 8.9, mvp: true }, { name: 'Zero', kills: 6 }] } },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.stats.a.players[1]).toEqual({ name: 'Zero', kills: 6, kd: null, damage: null, rating: null, assists: null, mvp: false });
    expect(updated.body.stats.b).toBeNull();
    // Out-of-range stats are rejected.
    expect((await admin.client.post(`/admin/tournaments/${id}/matches/${matchId}`, { scoreA: -1 })).status).toBe(400);

    const publicMatch = (await x.client.get(`/tournaments/${id}/matches/${matchId}`)).body;
    expect(publicMatch).toMatchObject({ scoreA: 2, scoreB: 1, status: 'completed', teamA: { name: 'Wave Riders' }, teamB: { name: 'Silent Storm' }, bestOf: 3 });
    expect((await x.client.get(`/tournaments/${other}/matches/${matchId}`)).status).toBe(404);

    expect((await a.client.get('/me/tournament-matches')).body.map((m: { id: string }) => m.id)).toEqual([matchId]);
    expect((await x.client.get('/me/tournament-matches')).body).toEqual([]);

    // Deleting a team keeps the match, with that side empty.
    await admin.client.post(`/admin/tournaments/${id}`, { status: 'upcoming' });
    expect((await b.client.post(`/tournaments/${id}/withdraw`)).status).toBe(200);
    expect((await x.client.get(`/tournaments/${id}/matches/${matchId}`)).body.teamB).toBeNull();
    expect((await admin.client.request("DELETE", `/admin/tournaments/${id}/matches/${matchId}`)).status).toBe(200);
  });

  it('team size cannot change once teams exist; withdraw is refused once in progress', async () => {
    const id = await squadTournament(8);
    const a = await registerUser(ctx, 'sz');
    await a.client.post(`/tournaments/${id}/teams`, { name: 'Sizers', members: ['s1', 's2'] });
    expect((await admin.client.post(`/admin/tournaments/${id}`, { teamSize: 4 })).status).toBe(409);
    await admin.client.post(`/admin/tournaments/${id}`, { status: 'in_progress' });
    expect((await a.client.post(`/tournaments/${id}/withdraw`)).status).toBe(403);
  });

  it('concurrent solo registrations never overfill a tournament', async () => {
    const t = await admin.client.post('/admin/tournaments', {
      gameId, name: 'Race Cup', description: 'Concurrency check for solo registration.',
      prize: '10 WC', status: 'open', startDate, maxPlayers: 2,
    });
    const players = await Promise.all([1, 2, 3, 4, 5].map((n) => registerUser(ctx, `race${n}`)));
    const results = await Promise.all(players.map((p) => p.client.post(`/tournaments/${t.body.id}/register`)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(2);
    expect(results.every((r) => r.status === 200 || r.status === 403)).toBe(true);
    expect((await admin.client.get(`/tournaments/${t.body.id}`)).body.registeredCount).toBe(2);
  });
});
