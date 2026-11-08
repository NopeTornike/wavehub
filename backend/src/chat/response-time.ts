import type { DataSource } from 'typeorm';

// Answered turns needed before a response time is shown (fewer is noise, not a real number).
export const MIN_RESPONSE_SAMPLES = 3;

// Median minutes each user took to answer a new message from the other party (order and direct
// chats, last 90 days): a "turn" is the other party's first message after the user last spoke; its
// answer is the user's next message in that conversation. Real data only — users with fewer than
// MIN_RESPONSE_SAMPLES answered turns are left out. Shared by coach profiles and listing pages.
export async function medianResponseMinutes(db: DataSource, userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows: Array<{ uid: string; median: number; n: number }> = await db.query(
    `WITH u AS (SELECT unnest($1::uuid[]) AS uid),
     m AS (
       SELECT u.uid, msg."conversationId", msg."senderId", msg."createdAt",
              lag(msg."senderId") OVER (PARTITION BY u.uid, msg."conversationId" ORDER BY msg."createdAt") AS prev
       FROM u
       JOIN "conversations" c ON c."buyerId" = u.uid OR c."sellerId" = u.uid
       JOIN "messages" msg ON msg."conversationId" = c."id" AND msg."senderId" IS NOT NULL
       WHERE msg."createdAt" > now() - interval '90 days'
     ),
     turns AS (SELECT uid, "conversationId", "createdAt" FROM m WHERE "senderId" <> uid AND (prev IS NULL OR prev = uid)),
     answered AS (
       SELECT t.uid, extract(epoch FROM (r.at - t."createdAt")) / 60 AS mins
       FROM turns t
       CROSS JOIN LATERAL (
         SELECT min(x."createdAt") AS at FROM "messages" x
         WHERE x."conversationId" = t."conversationId" AND x."senderId" = t.uid AND x."createdAt" > t."createdAt"
       ) r
       WHERE r.at IS NOT NULL
     )
     SELECT uid, percentile_cont(0.5) WITHIN GROUP (ORDER BY mins) AS median, count(*)::int AS n FROM answered GROUP BY uid`,
    [userIds],
  );
  return new Map(rows.filter((r) => r.n >= MIN_RESPONSE_SAMPLES).map((r) => [r.uid, Math.max(1, Math.ceil(Number(r.median)))]));
}
