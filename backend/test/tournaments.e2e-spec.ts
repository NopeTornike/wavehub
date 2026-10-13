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

  const SOLO = { inGameName: 'Player', inGameId: '51234567', discord: 'player_disc' };
  // A squad registration body: players by WaveHub username, each with an in-game name and id.
  function roster(name: string, users: TestUser[], inGame: string[], extra: Record<string, unknown> = {}) {
    return { name, discord: 'https://discord.gg/teamwave', ...extra, players: users.map((u, i) => ({ player: u.username, inGameName: inGame[i] ?? `p${i}`, inGameId: `5${i}00000${i}` })) };
  }

  async function squadTournament(maxPlayers: number) {
    const t = await admin.client.post('/admin/tournaments', {
      gameId, name: `Squad Cup ${Date.now() % 100000}`, description: 'A squad e2e tournament with teams.',
      prize: '1,000 GEL', status: 'open', startDate, maxPlayers, teamSize: 2,
      prizes: { places: [{ place: '1st Place', amount: '500 GEL', rewards: ['Gaming Gear'] }], specialRewards: ['MVP Reward'], note: 'Paid by the organizer.' },
    });
    expect(t.status).toBeLessThan(300);
    return t.body.id as string;
  }

  it('squad registration: linked accounts, exact roster size, capacity, verification, public teams list', async () => {
    const id = await squadTournament(4); // 2 teams of 2
    const [a, a2, b, b2, c, c2] = await Promise.all(['capa', 'mata', 'capb', 'matb', 'capc', 'matc'].map((p) => registerUser(ctx, p)));

    // Solo endpoint is refused on a squad tournament; wrong roster sizes / duplicates are refused.
    expect((await a.client.post(`/tournaments/${id}/register`, SOLO)).status).toBe(400);
    expect((await a.client.post(`/tournaments/${id}/teams`, roster('Alpha', [a], ['a1']))).status).toBe(400);
    expect((await a.client.post(`/tournaments/${id}/teams`, roster('Alpha', [a, a2], ['a1', 'A1']))).status).toBe(400);
    expect((await a.client.post(`/tournaments/${id}/teams`, roster('Alpha', [a, a], ['a1', 'a2']))).status).toBe(400);
    // Unknown accounts, a roster without the captain, and missing in-game ids are refused.
    const ghost = { name: 'Alpha', discord: 'alpha_team', players: [{ player: a.username, inGameName: 'a1', inGameId: '5000001' }, { player: 'nobody_here_x', inGameName: 'a2', inGameId: '5000002' }] };
    expect((await a.client.post(`/tournaments/${id}/teams`, ghost)).status).toBe(400);
    expect((await a.client.post(`/tournaments/${id}/teams`, roster('Alpha', [b, a2], ['a1', 'a2']))).status).toBe(400);
    expect((await a.client.post(`/tournaments/${id}/teams`, { name: 'Alpha', players: [{ player: a.username, inGameName: 'a1' }, { player: a2.username, inGameName: 'a2' }] })).status).toBe(400);
    // Unknown fields are rejected (no mass assignment of status).
    expect((await a.client.post(`/tournaments/${id}/teams`, roster('Alpha', [a, a2], ['a1', 'a2'], { status: 'verified' }))).status).toBe(400);

    // Teammates can be added by username (any case, with @) or by account id.
    const body = roster('Alpha', [a, a2], ['a1', 'a2'], { tag: 'alp' });
    body.players[1].player = a2.id;
    const teamA = await a.client.post(`/tournaments/${id}/teams`, body);
    expect(teamA.status).toBe(201);
    expect(teamA.body).toMatchObject({ status: 'pending', tag: 'ALP', members: ['a1', 'a2'] });
    expect(teamA.body.players.map((p: { username: string; isCaptain: boolean }) => [p.username, p.isCaptain])).toEqual([
      [a.username, true],
      [a2.username, false],
    ]);
    // The teammate is notified and sees the team in My Tournaments.
    const notes = (await a2.client.get('/notifications')).body;
    expect(JSON.stringify(notes)).toContain('tournament_team_added');
    expect((await a2.client.get('/me/tournaments')).body.map((e: { team: { name: string } }) => e.team.name)).toEqual(['Alpha']);
    expect((await a2.client.get('/tournaments/mine')).body).toContain(id);
    // A teammate can't register again (solo or as another captain); a player can't be on two teams.
    expect((await a2.client.post(`/tournaments/${id}/teams`, roster('Mate Team', [a2, c], ['m1', 'm2']))).status).toBe(403);
    expect((await b.client.post(`/tournaments/${id}/teams`, roster('Bravo', [b, a2], ['b1', 'b2']))).status).toBe(409);

    // Duplicate team name (case-insensitive) and double registration.
    expect((await b.client.post(`/tournaments/${id}/teams`, roster('alpha', [b, b2], ['b1', 'b2']))).status).toBe(409);
    expect((await a.client.post(`/tournaments/${id}/teams`, roster('Other', [a, c2], ['x', 'y']))).status).toBe(403);
    const bravoBody = roster('Bravo', [b, b2], ['b1', 'b2']);
    bravoBody.players[1].player = `@${b2.username.toUpperCase()}`;
    expect((await b.client.post(`/tournaments/${id}/teams`, bravoBody)).status).toBe(201);
    // Full: 4 players registered.
    expect((await c.client.post(`/tournaments/${id}/teams`, roster('Charlie', [c, c2], ['c1', 'c2']))).status).toBe(403);

    const detail = await a.client.get(`/tournaments/${id}`);
    expect(detail.body).toMatchObject({ registeredCount: 4, teamCount: 2, maxTeams: 2, teamSize: 2 });
    expect(detail.body.prizes.places[0]).toEqual({ place: '1st Place', amount: '500 GEL', rewards: ['Gaming Gear'] });

    // Staff verify/reject; a rejected team frees its places and disappears from the public list.
    expect((await a.client.post(`/admin/tournaments/${id}/teams/${teamA.body.id}/status`, { status: 'verified' })).status).toBe(403);
    expect((await admin.client.post(`/admin/tournaments/${id}/teams/${teamA.body.id}/status`, { status: 'verified' })).body.status).toBe('verified');
    const adminTeams = (await admin.client.get(`/admin/tournaments/${id}/teams`)).body;
    const bravo = adminTeams.find((t: { name: string }) => t.name === 'Bravo');
    expect(bravo.players[1]).toMatchObject({ username: b2.username, inGameName: 'b2', inGameId: '51000001' });
    await admin.client.post(`/admin/tournaments/${id}/teams/${bravo.id}/status`, { status: 'rejected' });
    const publicTeams = (await c.client.get(`/tournaments/${id}/teams`)).body;
    expect(publicTeams.map((t: { name: string }) => t.name)).toEqual(['Alpha']);
    expect(publicTeams[0]).not.toHaveProperty('captainUserId');
    // In-game ids are for staff and the team only.
    expect(publicTeams[0].players[0]).not.toHaveProperty('inGameId');
    expect(publicTeams[0].players[0]).toMatchObject({ username: a.username, inGameName: 'a1' });
    expect((await c.client.post(`/tournaments/${id}/teams`, roster('Charlie', [c, c2], ['c1', 'c2']))).status).toBe(201);

    // My tournaments + withdraw (the captain's withdrawal frees the teammate too).
    const mine = (await a.client.get('/me/tournaments')).body;
    expect(mine).toHaveLength(1);
    expect(mine[0].team.name).toBe('Alpha');
    expect(mine[0].team.players[1].inGameId).toBe('51000001');
    expect((await c.client.post(`/tournaments/${id}/withdraw`)).status).toBe(200);
    expect((await c.client.get('/me/tournaments')).body).toHaveLength(0);
    expect((await c2.client.get('/me/tournaments')).body).toHaveLength(0);
  });

  it('player lookup finds active accounts by username or id, signed-in only', async () => {
    const [u, asker] = await Promise.all([registerUser(ctx, 'look'), registerUser(ctx, 'asker')]);
    const byName = await asker.client.get(`/tournaments/player-lookup?q=${encodeURIComponent('@' + u.username.toUpperCase())}`);
    expect(byName.status).toBe(200);
    expect(byName.body).toEqual({ id: u.id, username: u.username, avatarUrl: null });
    expect((await asker.client.get(`/tournaments/player-lookup?q=${u.id}`)).body.username).toBe(u.username);
    expect((await asker.client.get('/tournaments/player-lookup?q=nobody_here_x')).status).toBe(404);
    expect((await asker.client.get('/tournaments/player-lookup')).status).toBe(400);
    const anon = await fetch(`${ctx.baseUrl}/tournaments/player-lookup?q=${u.username}`);
    expect(anon.status).toBe(401);
  });

  it('matches: teams must belong to the tournament; scores and stats are public; hub sees own matches', async () => {
    const id = await squadTournament(8);
    const other = await squadTournament(8);
    const [a, b, x, a2, b2, x2] = await Promise.all(['ma', 'mb', 'mx', 'ma2', 'mb2', 'mx2'].map((p) => registerUser(ctx, p)));
    const ta = (await a.client.post(`/tournaments/${id}/teams`, roster('Wave Riders', [a, a2], ['GG', 'Zero']))).body.id;
    const tb = (await b.client.post(`/tournaments/${id}/teams`, roster('Silent Storm', [b, b2], ['Storm', 'Blaze']))).body.id;
    const tx = (await x.client.post(`/tournaments/${other}/teams`, roster('Outsiders', [x, x2], ['o1', 'o2']))).body.id;

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
    // Teammates see their team's matches in the hub too.
    expect((await a2.client.get('/me/tournament-matches')).body.map((m: { id: string }) => m.id)).toEqual([matchId]);
    expect((await x.client.get('/me/tournament-matches')).body).toEqual([]);

    // Deleting a team keeps the match, with that side empty.
    await admin.client.post(`/admin/tournaments/${id}`, { status: 'upcoming' });
    expect((await b.client.post(`/tournaments/${id}/withdraw`)).status).toBe(200);
    expect((await x.client.get(`/tournaments/${id}/matches/${matchId}`)).body.teamB).toBeNull();
    expect((await admin.client.request("DELETE", `/admin/tournaments/${id}/matches/${matchId}`)).status).toBe(200);
  });

  it('team size cannot change once teams exist; withdraw is refused once in progress', async () => {
    const id = await squadTournament(8);
    const [a, a2] = await Promise.all([registerUser(ctx, 'sz'), registerUser(ctx, 'sz2')]);
    expect((await a.client.post(`/tournaments/${id}/teams`, roster('Sizers', [a, a2], ['s1', 's2']))).status).toBe(201);
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
    // Solo registration needs the in-game fields.
    expect((await players[0].client.post(`/tournaments/${t.body.id}/register`)).status).toBe(400);
    const results = await Promise.all(players.map((p) => p.client.post(`/tournaments/${t.body.id}/register`, SOLO)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(2);
    expect(results.every((r) => r.status === 200 || r.status === 403)).toBe(true);
    expect((await admin.client.get(`/tournaments/${t.body.id}`)).body.registeredCount).toBe(2);
  });

  it('draft tournaments are hidden from every public endpoint but visible to staff', async () => {
    const visitor = await registerUser(ctx, 'tdraftv');
    const created = await admin.client.post('/admin/tournaments', {
      gameId, name: `Hidden Cup ${Date.now() % 100000}`, description: 'A draft tournament nobody should see yet.',
      prize: '100 GEL', status: 'draft', startDate, maxPlayers: 8, teamSize: 1,
    });
    expect(created.status).toBeLessThan(300);
    const id = created.body.id as string;

    const publicIds = (await visitor.client.get('/tournaments?limit=100')).body.items.map((t: { id: string }) => t.id);
    expect(publicIds).not.toContain(id);
    expect((await visitor.client.get('/tournaments?status=draft')).body.items).toHaveLength(0);
    expect((await visitor.client.get(`/tournaments/${id}`)).status).toBe(404);
    expect((await visitor.client.get(`/tournaments/${id}/teams`)).status).toBe(404);
    expect((await visitor.client.get(`/tournaments/${id}/matches`)).status).toBe(404);
    expect((await visitor.client.post(`/tournaments/${id}/register`, SOLO)).status).toBe(403);

    // Staff still see and manage it.
    expect((await visitor.client.get('/admin/tournaments')).status).toBe(403);
    const adminIds = (await admin.client.get('/admin/tournaments?limit=100')).body.items.map((t: { id: string }) => t.id);
    expect(adminIds).toContain(id);
    expect((await admin.client.get(`/admin/tournaments/${id}/matches`)).status).toBe(200);

    // Publishing makes it public again.
    expect((await admin.client.post(`/admin/tournaments/${id}`, { status: 'open' })).status).toBe(200);
    expect((await visitor.client.get(`/tournaments/${id}`)).status).toBe(200);
  });
});
