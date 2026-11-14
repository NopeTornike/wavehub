import { brMatchPoints } from '@wavehub/shared-types';
import { TournamentNotifier } from '../src/tournaments/tournament-notifier.service';
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
  it('notifications: schedule, room, reminders and results reach every team in the lobby, once', async () => {
    const games = (await admin.client.get('/games')).body as Array<{ id: string; slug: string }>;
    const pubg = games.find((g) => g.slug === 'pubg-mobile') ?? games[0];
    const t = await admin.client.post('/admin/tournaments', {
      gameId: pubg.id, name: `BR Notify ${Date.now() % 100000}`, description: 'Battle royale notifications e2e.',
      prize: '10 GEL', status: 'open', startDate, maxPlayers: 8, teamSize: 1, format: 'battle_royale', groupAdvance: 1, semifinalAdvance: 1,
    });
    const id = t.body.id as string;
    const players = await Promise.all(['bn1', 'bn2', 'bn3', 'bn4'].map((p) => registerUser(ctx, p)));
    for (const [i, p] of players.entries()) {
      await p.client.post(`/tournaments/${id}/register`, { inGameName: `BN${i}`, inGameId: `8000${i}`, discord: 'brplayer' });
    }
    const teams = (await admin.client.get(`/admin/tournaments/${id}/teams`)).body as Array<{ id: string; players: Array<{ username: string }> }>;
    for (const team of teams) await admin.client.post(`/admin/tournaments/${id}/teams/${team.id}/status`, { status: 'verified' });
    await admin.client.post(`/admin/tournaments/${id}/groups/auto`, { groups: 2 });
    const grouped = (await admin.client.get(`/admin/tournaments/${id}/teams`)).body as Array<{ id: string; groupName: string; players: Array<{ username: string }> }>;
    const userOf = (teamId: string) => players.find((p) => grouped.find((g) => g.id === teamId)!.players.some((x) => x.username === p.username))!;
    const inA = grouped.filter((g) => g.groupName === 'A').map((g) => g.id);
    const inB = grouped.filter((g) => g.groupName === 'B').map((g) => g.id);
    const notes = async (user: TestUser, type: string) =>
      (await ctx.dataSource.query(
        `SELECT n.title, n.body, n.metadata FROM notifications n JOIN users u ON u.id = n."userId" WHERE u.username = $1 AND n.type = $2 AND n.metadata->>'tournamentId' = $3 ORDER BY n."createdAt"`,
        [user.username, type, id],
      )) as Array<{ title: string; body: string; metadata: Record<string, string> }>;

    // Scheduling group A's lobby notifies group A only, with "Group A · Match 1/2".
    const at = new Date(Date.now() + 30 * 60_000).toISOString();
    await admin.client.post(`/admin/tournaments/${id}/matches/battle-royale`, { stage: 'group', groupName: 'A', count: 2, startAt: at, intervalMinutes: 600 });
    const a0 = userOf(inA[0]);
    const b0 = userOf(inB[0]);
    const scheduled = await notes(a0, 'tournament_match_scheduled');
    expect(scheduled).toHaveLength(2);
    expect(scheduled[0].body).toContain('Group A · Match 1/2');
    expect(await notes(b0, 'tournament_match_scheduled')).toHaveLength(0);

    // A semifinal lobby nobody has qualified for yet notifies no one, and its reminder waits.
    await admin.client.post(`/admin/tournaments/${id}/matches/battle-royale`, { stage: 'semifinal', count: 1, startAt: at, intervalMinutes: 0 });
    for (const p of players) expect((await notes(p, 'tournament_match_scheduled')).every((n) => !n.body.includes('Semifinal'))).toBe(true);

    // Reminders: group A's first lobby (30 min out) → the 1-hour reminder, once; the semifinal's stamp
    // is given back because nobody plays it yet.
    const notifier = ctx.app.get(TournamentNotifier);
    await notifier.sweepReminders();
    await notifier.sweepReminders();
    const reminders = await notes(a0, 'tournament_match_reminder');
    // Match 1/2 (30 min out) → the 1-hour reminder; Match 2/2 (10 h out) → the 24-hour one.
    expect(reminders.map((r) => r.title)).toEqual([expect.stringContaining('1 საათში'), expect.stringContaining('24 საათი')]);
    expect(await notes(b0, 'tournament_match_reminder')).toHaveLength(0);
    const matches = (await admin.client.get(`/tournaments/${id}/matches`)).body as Array<{ id: string; stage: string; roundLabel: string }>;
    const semi = matches.find((m) => m.stage === 'semifinal')!;
    const [semiRow] = await ctx.dataSource.query(`SELECT "remindedHourAt" FROM tournament_matches WHERE id = $1`, [semi.id]);
    expect(semiRow.remindedHourAt).toBeNull();

    // Opening the lobby room tells group A, never the room details.
    const first = matches.find((m) => m.roundLabel === 'Match 1/2' && m.stage === 'group')!;
    await admin.client.post(`/admin/tournaments/${id}/matches/${first.id}/room`, { a: { open: true, roomId: '5544', password: 'secretpw', slot: '' } });
    const room = await notes(a0, 'tournament_room_open');
    expect(room).toHaveLength(1);
    expect(JSON.stringify(room)).not.toContain('secretpw');

    // Results: 1st place = won, the other = its place / kills / points; once, even if saved again.
    const results = { results: [{ teamId: inA[0], placement: 1, kills: 6 }, { teamId: inA[1], placement: 3, kills: 2 }], complete: true };
    await admin.client.post(`/admin/tournaments/${id}/matches/${first.id}/results`, results);
    await admin.client.post(`/admin/tournaments/${id}/matches/${first.id}/results`, results);
    const won = await notes(a0, 'tournament_match_won');
    expect(won).toHaveLength(1);
    expect(won[0].body).toContain('1st ადგილი · 6 kills · +16 ქულა');
    const other = await notes(userOf(inA[1]), 'tournament_match_result');
    expect(other).toHaveLength(1);
    expect(other[0].title).toContain('3rd ადგილი');
    expect(other[0].body).toContain('+7 ქულა');
    expect(other[0].metadata.link).toBe(`/tournaments/${id}/matches/${first.id}`);
    expect(await notes(b0, 'tournament_match_result')).toHaveLength(0);
  });
});
