import { brMatchPoints } from '@wavehub/shared-types';
import { createApp, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

// Battle-royale tournaments (owner 2026-11-14, Gio; docs/design-mockups/round-7): groups, one match
// for the whole group, placement + kills points, top N per group to the semifinal, top 4 to the final.
describe('battle-royale tournaments (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  const startDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'bradmin');
    await makeAdmin(ctx, admin);
  });
  afterAll(async () => ctx.close());

  it('points table', () => {
    expect(brMatchPoints(1, 5)).toBe(15);
    expect(brMatchPoints(8, 0)).toBe(1);
    expect(brMatchPoints(9, 2)).toBe(2);
    expect(brMatchPoints(null, 3)).toBe(3);
  });

  it('groups → results → semifinal → final → champion; rooms only for the teams in the match', async () => {
    const games = (await admin.client.get('/games')).body as Array<{ id: string; slug: string }>;
    const pubg = games.find((g) => g.slug === 'pubg-mobile') ?? games[0];
    const t = await admin.client.post('/admin/tournaments', {
      gameId: pubg.id, name: `BR Cup ${Date.now() % 100000}`, description: 'Battle royale e2e tournament.',
      prize: '10 GEL', status: 'open', startDate, maxPlayers: 8, teamSize: 1, format: 'battle_royale', groupAdvance: 2, semifinalAdvance: 2,
    });
    expect(t.status).toBe(201);
    const id = t.body.id as string;
    const pub = (await admin.client.get(`/tournaments/${id}`)).body;
    expect(pub).toMatchObject({ format: 'battle_royale', groupAdvance: 2, semifinalAdvance: 2 });

    const players = await Promise.all(['br1', 'br2', 'br3', 'br4', 'br5', 'br6'].map((p) => registerUser(ctx, p)));
    for (const [i, p] of players.entries()) {
      expect((await p.client.post(`/tournaments/${id}/register`, { inGameName: `BR${i}`, inGameId: `7000${i}`, discord: 'brplayer' })).status).toBeLessThan(300);
    }
    const teams = (await admin.client.get(`/admin/tournaments/${id}/teams`)).body as Array<{ id: string; name: string }>;
    for (const team of teams) await admin.client.post(`/admin/tournaments/${id}/teams/${team.id}/status`, { status: 'verified' });

    // Auto groups: 6 teams over 2 groups = 3 + 3; a player can't do it.
    expect((await players[0].client.post(`/admin/tournaments/${id}/groups/auto`, { groups: 2 })).status).toBe(403);
    expect((await admin.client.post(`/admin/tournaments/${id}/groups/auto`, { groups: 2 })).body.assigned).toBe(6);
    const grouped = (await admin.client.get(`/admin/tournaments/${id}/teams`)).body as Array<{ id: string; groupName: string }>;
    const inA = grouped.filter((x) => x.groupName === 'A').map((x) => x.id);
    const inB = grouped.filter((x) => x.groupName === 'B').map((x) => x.id);
    expect([inA.length, inB.length]).toEqual([3, 3]);
    expect((await admin.client.post(`/admin/tournaments/${id}/teams/${inA[0]}/group`, { groupName: 'bad group!' })).status).toBe(400);

    const at = new Date(Date.now() + 3_600_000).toISOString();
    for (const g of ['A', 'B']) {
      expect((await admin.client.post(`/admin/tournaments/${id}/matches/battle-royale`, { stage: 'group', groupName: g, count: 1, startAt: at, intervalMinutes: 30 })).body.created).toBe(1);
    }
    let matches = (await admin.client.get(`/tournaments/${id}/matches`)).body as Array<{ id: string; stage: string; groupName: string; roundLabel: string; results: unknown[] }>;
    const matchA = matches.find((m) => m.groupName === 'A')!;
    const matchB = matches.find((m) => m.groupName === 'B')!;
    expect(matchA.roundLabel).toBe('Match 1/1');

    // The group-A player sees match A (and its room) but not match B.
    const ownerOf = async (teamId: string) => {
      for (const p of players) {
        const mine = (await p.client.get('/me/tournaments')).body as Array<{ team: { id: string } }>;
        if (mine.some((e) => e.team.id === teamId)) return p;
      }
      throw new Error('no owner');
    };
    const aPlayer = await ownerOf(inA[0]);
    const myMatches = (await aPlayer.client.get('/me/tournament-matches')).body as Array<{ id: string }>;
    expect(myMatches.map((m) => m.id)).toContain(matchA.id);
    expect(myMatches.map((m) => m.id)).not.toContain(matchB.id);
    expect((await aPlayer.client.get(`/me/tournament-matches/${matchA.id}/room`)).body).toMatchObject({ status: 'locked', side: 'a' });
    expect((await aPlayer.client.get(`/me/tournament-matches/${matchB.id}/room`)).status).toBe(403);

    // Results: duplicates refused; points computed by the server.
    expect((await admin.client.post(`/admin/tournaments/${id}/matches/${matchA.id}/results`, { results: [{ teamId: inA[0], placement: 1, kills: 0 }, { teamId: inA[1], placement: 1, kills: 0 }] })).status).toBe(400);
    const resA = await admin.client.post(`/admin/tournaments/${id}/matches/${matchA.id}/results`, {
      results: [{ teamId: inA[0], placement: 1, kills: 4 }, { teamId: inA[1], placement: 2, kills: 1 }, { teamId: inA[2], placement: 3, kills: 0 }],
      complete: true,
    });
    expect(resA.status).toBe(200);
    expect(resA.body.status).toBe('completed');
    expect(resA.body.results.map((r: { points: number }) => r.points)).toEqual([14, 7, 5]);
    await admin.client.post(`/admin/tournaments/${id}/matches/${matchB.id}/results`, {
      results: [{ teamId: inB[0], placement: 2, kills: 0 }, { teamId: inB[1], placement: 1, kills: 2 }, { teamId: inB[2], placement: 3, kills: 9 }],
      complete: true,
    });

    // Semifinal: the top 2 of each group (A: inA[0], inA[1]; B: inB[2] 14 pts, inB[1] 12 pts).
    await admin.client.post(`/admin/tournaments/${id}/matches/battle-royale`, { stage: 'semifinal', count: 1, startAt: at, intervalMinutes: 0 });
    matches = (await admin.client.get(`/tournaments/${id}/matches`)).body;
    const semi = matches.find((m) => m.stage === 'semifinal')!;
    const out = await ownerOf(inB[0]);
    expect((await out.client.get(`/me/tournament-matches/${semi.id}/room`)).status).toBe(403);
    expect((await aPlayer.client.get(`/me/tournament-matches/${semi.id}/room`)).status).toBe(200);

    // A versus-format score typed without a status finishes the match (round-7/39).
    const vs = await admin.client.post('/admin/tournaments', {
      gameId: games.find((g) => g.slug === 'cs2')?.id ?? games[0].id, name: `VS Cup ${Date.now() % 100000}`, description: 'Versus e2e tournament.',
      prize: '10 GEL', status: 'open', startDate, maxPlayers: 8, teamSize: 1, format: 'versus',
    });
    const m = await admin.client.post(`/admin/tournaments/${vs.body.id}/matches`, { stage: 'quarterfinal' });
    const scored = await admin.client.post(`/admin/tournaments/${vs.body.id}/matches/${m.body.id}`, { scoreA: 1, scoreB: 0 });
    expect(scored.body.status).toBe('completed');
  });
});
