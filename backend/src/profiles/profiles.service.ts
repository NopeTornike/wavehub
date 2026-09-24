import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { PublicUserProfile } from '@wavehub/shared-types';
import { UserFollow } from './user-follow.entity';
import { UsersService } from '../users/users.service';
import { CommunityService, ONLINE_WINDOW_MINUTES } from '../community/community.service';

type Facts = Pick<PublicUserProfile, 'role' | 'followers' | 'following' | 'waveRank' | 'completedDeals' | 'reviews' | 'badges' | 'coachId' | 'online'>;

// Follows and the computed half of the public profile (docs/design-mockups/12). Everything here is
// derived from real rows; nothing is estimated.
@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(UserFollow) private readonly follows: Repository<UserFollow>,
    private readonly users: UsersService,
    private readonly community: CommunityService,
    private readonly db: DataSource,
  ) {}

  private async targetId(username: string): Promise<string> {
    const user = await this.users.findByUsername(username);
    if (!user) throw new NotFoundException('User not found');
    return user.id;
  }

  async follow(followerId: string, username: string): Promise<{ following: boolean; followers: number }> {
    const followeeId = await this.targetId(username);
    if (followeeId === followerId) throw new BadRequestException('You cannot follow yourself');
    await this.follows.createQueryBuilder().insert().values({ followerId, followeeId }).orIgnore().execute();
    return { following: true, followers: await this.follows.count({ where: { followeeId } }) };
  }

  async unfollow(followerId: string, username: string): Promise<{ following: boolean; followers: number }> {
    const followeeId = await this.targetId(username);
    await this.follows.delete({ followerId, followeeId });
    return { following: false, followers: await this.follows.count({ where: { followeeId } }) };
  }

  async status(followerId: string, username: string): Promise<{ following: boolean }> {
    const followeeId = await this.targetId(username);
    return { following: (await this.follows.count({ where: { followerId, followeeId } })) > 0 };
  }

  async facts(userId: string, lastSeenAt: Date | null, activeListingCount: number): Promise<Facts> {
    const [row] = await this.db.query(
      `WITH coach AS (SELECT "id", "verificationStatus" FROM "coaches" WHERE "userId" = $1),
            my_teams AS (SELECT "id" FROM "tournament_teams" WHERE "captainUserId" = $1),
            finals AS (
              SELECT m.* FROM "tournament_matches" m
              WHERE m."stage" = 'final' AND (m."teamAId" IN (SELECT "id" FROM my_teams) OR m."teamBId" IN (SELECT "id" FROM my_teams))
            )
       SELECT
         (SELECT count(*) FROM "user_follows" WHERE "followeeId" = $1)::int AS followers,
         (SELECT count(*) FROM "user_follows" WHERE "followerId" = $1)::int AS following,
         (SELECT "id" FROM coach WHERE "verificationStatus" = 'verified') AS "coachId",
         (
           (SELECT count(*) FROM "orders" WHERE "sellerId" = $1 AND "status" = 'completed')
           + (SELECT count(*) FROM "coaching_sessions" WHERE "coachId" IN (SELECT "id" FROM coach) AND "status" = 'completed')
         )::int AS sold,
         (
           (SELECT count(*) FROM "orders" WHERE "buyerId" = $1 AND "status" = 'completed')
           + (SELECT count(*) FROM "coaching_sessions" WHERE "buyerId" = $1 AND "status" = 'completed')
         )::int AS bought,
         (SELECT count(*) FROM finals)::int AS finals,
         (
           SELECT count(*) FROM finals f WHERE f."status" = 'completed' AND f."scoreA" IS NOT NULL AND f."scoreB" IS NOT NULL AND (
             (f."scoreA" > f."scoreB" AND f."teamAId" IN (SELECT "id" FROM my_teams)) OR
             (f."scoreB" > f."scoreA" AND f."teamBId" IN (SELECT "id" FROM my_teams)))
         )::int AS titles`,
      [userId],
    );
    const reviewRows: Array<{ rating: number; body: string | null; buyerUsername: string; createdAt: Date }> = await this.db.query(
      `SELECT r."rating", r."body", u."username" AS "buyerUsername", r."createdAt" FROM (
         SELECT "rating", "body", "buyerId", "createdAt" FROM "reviews" WHERE "sellerId" = $1 AND "status" = 'published'
         UNION ALL
         SELECT "rating", "body", "buyerId", "createdAt" FROM "coaching_session_reviews"
         WHERE "coachId" IN (SELECT "id" FROM "coaches" WHERE "userId" = $1)
       ) r JOIN "users" u ON u."id" = r."buyerId"
       ORDER BY r."createdAt" DESC`,
      [userId],
    );
    const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const r of reviewRows) distribution[5 - Math.min(5, Math.max(1, Number(r.rating)))] += 1;
    const count = reviewRows.length;
    const average = count ? Math.round((reviewRows.reduce((sum, r) => sum + Number(r.rating), 0) / count) * 10) / 10 : null;
    const waveRank = await this.community.waveRank(userId);
    const sold = row.sold as number;
    const deals = sold + (row.bought as number);

    const badges: Array<{ key: string; label: string }> = [{ key: 'tier', label: waveRank.name }];
    if (row.titles > 0) badges.push({ key: 'champion', label: 'ტურნირის ჩემპიონი' });
    else if (row.finals > 0) badges.push({ key: 'finalist', label: 'ტურნირის ფინალისტი' });
    if (row.coachId) badges.push({ key: 'coach', label: 'ვერიფიცირებული ქოუჩი' });
    if (average !== null && average >= 4.8 && count >= 5) badges.push({ key: 'top-rated', label: 'ტოპ რეიტინგი' });
    if (sold >= 10 && (average ?? 0) >= 4.5) badges.push({ key: 'trusted-seller', label: 'სანდო გამყიდველი' });
    if (deals >= 100) badges.push({ key: 'deals-100', label: '100 გარიგება' });
    else if (deals >= 1) badges.push({ key: 'first-deal', label: 'პირველი გარიგება' });

    return {
      role: row.coachId ? 'coach' : activeListingCount > 0 || sold > 0 ? 'seller' : 'player',
      followers: row.followers,
      following: row.following,
      coachId: row.coachId ?? null,
      online: !!lastSeenAt && Date.now() - lastSeenAt.getTime() < ONLINE_WINDOW_MINUTES * 60_000,
      waveRank,
      completedDeals: deals,
      reviews: {
        count,
        average,
        distribution,
        latest: reviewRows.slice(0, 3).map((r) => ({ rating: Number(r.rating), body: r.body, buyerUsername: r.buyerUsername, createdAt: new Date(r.createdAt).toISOString() })),
      },
      badges,
    };
  }
}
