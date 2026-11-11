import { TournamentNotifier } from '../src/tournaments/tournament-notifier.service';
import { createApp, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

// Owner 2026-11-10 (docs/design-mockups/round-6): tournament points, every tournament notification
// (verified, scheduled, reminders, room open, win / "lost — winner", started), the round-robin
// generator and the hand-entered leaderboard with its show/hide switch.
describe('owner 2026-11-10 tournaments (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let gameId: string;
  const startDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'tn10admin');
    await makeAdmin(ctx, admin);
    gameId = (await admin.client.get('/games')).body[0].id;
  });
  afterAll(async () => {
    // Leave the shared switch as other specs expect it.
    await admin.client.post('/admin/tournament-leaderboard/visibility', { visible: true });
    await ctx.close();
  });

  const roster = (name: string, users: TestUser[]) => ({
    name,
    discord: 'https://discord.gg/teamwave',
    players: users.map((u, i) => ({ player: u.username, inGameName: `${name.slice(0, 3)}${i}`, inGameId: `7${i}00000${i}` })),
  });
  const notes = async (user: TestUser, type: string) =>
    ctx.dataSource.query(`SELECT title, body, metadata FROM notifications WHERE "userId" = $1 AND type = $2 ORDER BY "createdAt"`, [user.id, type]);

  it('points, notifications for every event, once each', async () => {
    const t = await admin.client.post('/admin/tournaments', {
      gameId, name: `Notify Cup ${Date.now() % 100000}`, description: 'Notification test tournament for squads.',
      prize: '100 GEL', status: 'open', startDate, maxPlayers: 8, teamSize: 2, pointsPerWin: 3, pointsPerLoss: 1, qualifyPoints: 6,
    });
    expect(t.status).toBeLessThan(300);
    const id = t.body.id as string;
    const pub = (await admin.client.get(`/tournaments/${id}`)).body;
    expect(pub).toMatchObject({ pointsPerWin: 3, pointsPerLoss: 1, qualifyPoints: 6 });

    const [a1, a2, b1, b2] = await Promise.all(['tna1', 'tna2', 'tnb1', 'tnb2'].map((p) => registerUser(ctx, p)));
    const ta = (await a1.client.post(`/tournaments/${id}/teams`, roster('Alpha', [a1, a2]))).body.id;
    const tb = (await b1.client.post(`/tournaments/${id}/teams`, roster('Bravo', [b1, b2]))).body.id;
    await admin.client.post(`/admin/tournaments/${id}/teams/${ta}/status`, { status: 'verified' });
    await admin.client.post(`/admin/tournaments/${id}/teams/${tb}/status`, { status: 'rejected' });
    expect(await notes(a2, 'tournament_team_verified')).toHaveLength(1);
    expect(await notes(b2, 'tournament_team_rejected')).toHaveLength(1);
    await admin.client.post(`/admin/tournaments/${id}/teams/${tb}/status`, { status: 'verified' });

    // Scheduled 30 min from now: one "scheduled", then the sweep sends the 1-hour reminder only, once.
    const at = new Date(Date.now() + 30 * 60_000).toISOString();
    const match = (await admin.client.post(`/admin/tournaments/${id}/matches`, { teamAId: ta, teamBId: tb, bestOf: 1, scheduledAt: at, groupName: 'A' })).body;
    expect(await notes(b1, 'tournament_match_scheduled')).toHaveLength(1);
    const notifier = ctx.app.get(TournamentNotifier);
    await notifier.sweepReminders();
    await notifier.sweepReminders();
    const reminders = await notes(a1, 'tournament_match_reminder');
    expect(reminders).toHaveLength(1);
    expect(reminders[0].title).toMatch(/1 საათში/);

    // Room opened for side A only → only team A hears it; re-saving it open doesn't repeat.
    const room = { a: { open: true, roomId: '123456', password: 'PW', slot: '#1' } };
    await admin.client.post(`/admin/tournaments/${id}/matches/${match.id}/room`, room);
    await admin.client.post(`/admin/tournaments/${id}/matches/${match.id}/room`, room);
    expect(await notes(a2, 'tournament_room_open')).toHaveLength(1);
    expect(await notes(b2, 'tournament_room_open')).toHaveLength(0);
    // The room details never ride along in the notification.
    expect(JSON.stringify(await notes(a2, 'tournament_room_open'))).not.toMatch(/PW|123456/);

    // Result: winners "won … +3", losers "lost — winner: Alpha", once even if staff re-save.
    await admin.client.post(`/admin/tournaments/${id}/matches/${match.id}`, { status: 'completed', scoreA: 2, scoreB: 1 });
    await admin.client.post(`/admin/tournaments/${id}/matches/${match.id}`, { status: 'completed', scoreA: 2, scoreB: 1 });
    const won = await notes(a1, 'tournament_match_won');
    expect(won).toHaveLength(1);
    expect(won[0].body).toMatch(/Alpha 2:1 Bravo · \+3/);
    const lost = await notes(b2, 'tournament_match_lost');
    expect(lost).toHaveLength(1);
    expect(lost[0].title).toMatch(/გამარჯვებული: Alpha/);

    // Moving the tournament into play notifies everyone once.
    await admin.client.post(`/admin/tournaments/${id}`, { status: 'in_progress' });
    await admin.client.post(`/admin/tournaments/${id}`, { status: 'in_progress' });
    await new Promise((r) => setTimeout(r, 300));
    expect(await notes(b1, 'tournament_started')).toHaveLength(1);
  });

  it('round-robin creates every pairing once, spaced, and skips existing pairs', async () => {
    const t = await admin.client.post('/admin/tournaments', {
      gameId, name: `RR Cup ${Date.now() % 100000}`, description: 'Round robin generator test tournament.',
      prize: '10 GEL', status: 'open', startDate, maxPlayers: 8, teamSize: 1,
    });
    const id = t.body.id as string;
    const players = await Promise.all(['rr1', 'rr2', 'rr3', 'rr4'].map((p) => registerUser(ctx, p)));
    for (const [i, p] of players.entries()) {
      expect((await p.client.post(`/tournaments/${id}/register`, { inGameName: `RR${i}`, inGameId: `9000${i}`, discord: 'rrplayer' })).status).toBeLessThan(300);
    }
    const teamIds = (await admin.client.get(`/admin/tournaments/${id}/teams`)).body.map((x: { id: string }) => x.id);
    expect(teamIds).toHaveLength(4);
    const body = { teamIds, groupName: 'B', startAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), intervalMinutes: 30, bestOf: 1 };
    expect((await players[0].client.post(`/admin/tournaments/${id}/matches/round-robin`, body)).status).toBe(403);
    const first = await admin.client.post(`/admin/tournaments/${id}/matches/round-robin`, body);
    expect(first.status).toBe(200);
    expect(first.body.created).toBe(6);
    expect((await admin.client.post(`/admin/tournaments/${id}/matches/round-robin`, body)).body.created).toBe(0);
    const matches = (await admin.client.get(`/tournaments/${id}/matches`)).body as Array<{ teamA: { id: string }; teamB: { id: string }; scheduledAt: string; groupName: string }>;
    const pairs = new Set(matches.map((m) => [m.teamA.id, m.teamB.id].sort().join(':')));
    expect(pairs.size).toBe(6);
    expect(new Set(matches.map((m) => m.scheduledAt)).size).toBe(6);
    expect(matches.every((m) => m.groupName === 'B')).toBe(true);
  });

  it('leaderboard: @username players, teams with logos, staff-only edits, show/hide', async () => {
    const star = await registerUser(ctx, 'lbstar');
    expect((await star.client.post('/admin/tournament-leaderboard', { kind: 'team', name: 'X', wins: 1, kills: 1, points: 1 })).status).toBe(403);
    expect((await admin.client.post('/admin/tournament-leaderboard', { kind: 'player', name: '@nobody_here_xyz', wins: 1, kills: 1, points: 1 })).status).toBe(400);
    const player = await admin.client.post('/admin/tournament-leaderboard', { kind: 'player', name: `@${star.username}`, gameId, wins: 24, kills: 512, points: 4320000 });
    expect(player.status).toBe(201);
    expect(player.body).toMatchObject({ kind: 'player', username: star.username, wins: 24 });
    const team = await admin.client.post('/admin/tournament-leaderboard', { kind: 'team', name: 'Titan Esports', gameId, wins: 36, kills: 1428, points: 12960000 });
    expect(team.status).toBe(201);

    const board = (await star.client.get(`/tournaments/leaderboard?gameId=${gameId}`)).body;
    expect(board.visible).toBe(true);
    expect(board.players[0]).toMatchObject({ username: star.username, points: 4320000 });
    expect(board.teams[0]).toMatchObject({ name: 'Titan Esports' });
    expect(JSON.stringify(board)).not.toMatch(/email|passwordHash|wavecoinBalance/);

    expect((await admin.client.post('/admin/tournament-leaderboard/visibility', { visible: false })).status).toBe(200);
    expect((await star.client.get('/tournaments/leaderboard')).body).toEqual({ visible: false, players: [], teams: [] });
    expect((await star.client.get('/platform/features')).body.tournamentLeaderboard).toBe(false);
    await admin.client.post('/admin/tournament-leaderboard/visibility', { visible: true });

    expect((await admin.client.request("DELETE", `/admin/tournament-leaderboard/${team.body.id}`)).status).toBe(200);
    const audit = await ctx.dataSource.query(`SELECT count(*)::int AS n FROM audit_logs WHERE action LIKE 'tournament.leaderboard%'`);
    expect(audit[0].n).toBeGreaterThanOrEqual(4);
  });
});
