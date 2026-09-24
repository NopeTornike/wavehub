import { MigrationInterface, QueryRunner } from 'typeorm';

// Two things the 1:1 port of the static prototype's site shell needs from real data:
//
// 1. `users.lastSeenAt` — backs the sidebar's "N online" pill (the prototype randomises it; here
//    AuthGuard stamps it at most once a minute per account, see UsersService#touchLastSeen, and
//    backend/src/community/ counts accounts seen in the last few minutes).
//
// 2. The prototype's full game catalogue. The original schema seeded only the spec's 5 mobile games
//    with no artwork; the prototype's marketplace/home/sidebar sell 14 games, each with a title icon
//    under frontend/public/assets/. Existing rows keep their ids (listings reference them) and just
//    gain an iconUrl; new rows are inserted idempotently on slug. `sortOrder` follows the order the
//    prototype's home-page game grid shows them in.
const GAMES: Array<{ name: string; slug: string; iconUrl: string; sortOrder: number }> = [
  { name: 'CS2', slug: 'cs2', iconUrl: '/assets/cs2-title-icon.png', sortOrder: 0 },
  { name: 'Dota 2', slug: 'dota-2', iconUrl: '/assets/dota-2-title-icon.png', sortOrder: 1 },
  { name: 'PUBG Mobile', slug: 'pubg-mobile', iconUrl: '/assets/pubg-mobile-title-icon.png', sortOrder: 2 },
  { name: 'Mobile Legends', slug: 'mobile-legends', iconUrl: '/assets/mobile-legends-title-icon.png', sortOrder: 3 },
  { name: 'Call of Duty Mobile', slug: 'cod-mobile', iconUrl: '/assets/call-of-duty-title-icon.png', sortOrder: 4 },
  { name: 'Fortnite', slug: 'fortnite', iconUrl: '/assets/fortnite-title-icon.png', sortOrder: 5 },
  { name: 'Roblox', slug: 'roblox', iconUrl: '/assets/roblox-title-icon.png', sortOrder: 6 },
  { name: 'Standoff 2', slug: 'standoff-2', iconUrl: '/assets/home-game-standoff2.png', sortOrder: 7 },
  { name: 'Free Fire', slug: 'free-fire', iconUrl: '/assets/freefire-photo.jpeg', sortOrder: 8 },
  { name: 'Clash of Clans', slug: 'clash-of-clans', iconUrl: '/assets/clash-of-clans-title-icon.png', sortOrder: 9 },
  { name: 'League of Legends', slug: 'league-of-legends', iconUrl: '/assets/league-of-legends-title-icon.png', sortOrder: 10 },
  { name: 'Minecraft', slug: 'minecraft', iconUrl: '/assets/minecraft-title-icon.png', sortOrder: 11 },
  { name: 'GTA 5', slug: 'gta-5', iconUrl: '/assets/gta-5-title-icon.png', sortOrder: 12 },
  { name: 'Valorant', slug: 'valorant', iconUrl: '/assets/valorant-title-icon.png', sortOrder: 13 },
];

const ORIGINAL_SLUGS = ['pubg-mobile', 'cod-mobile', 'free-fire', 'mobile-legends', 'roblox'];

export class CommunityShellAndGameCatalogue1784349000000 implements MigrationInterface {
  name = 'CommunityShellAndGameCatalogue1784349000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "lastSeenAt" TIMESTAMPTZ`);
    await queryRunner.query(`CREATE INDEX "IDX_users_lastSeenAt" ON "users" ("lastSeenAt")`);

    for (const game of GAMES) {
      await queryRunner.query(
        `INSERT INTO "games" ("name", "slug", "iconUrl", "isActive", "sortOrder")
         VALUES ($1, $2, $3, true, $4)
         ON CONFLICT ("slug") DO UPDATE SET "iconUrl" = EXCLUDED."iconUrl", "sortOrder" = EXCLUDED."sortOrder"`,
        [game.name, game.slug, game.iconUrl, game.sortOrder],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only remove the added games that nothing references yet — deleting one a listing points at
    // would orphan real data.
    const added = GAMES.map((g) => g.slug).filter((slug) => !ORIGINAL_SLUGS.includes(slug));
    await queryRunner.query(
      `DELETE FROM "games" g WHERE g."slug" = ANY($1) AND NOT EXISTS (SELECT 1 FROM "listings" l WHERE l."gameId" = g."id")`,
      [added],
    );
    await queryRunner.query(`UPDATE "games" SET "iconUrl" = NULL WHERE "slug" = ANY($1)`, [ORIGINAL_SLUGS]);
    await queryRunner.query(`DROP INDEX "IDX_users_lastSeenAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastSeenAt"`);
  }
}
