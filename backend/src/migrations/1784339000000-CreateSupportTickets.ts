import { MigrationInterface, QueryRunner } from 'typeorm';

// Seeds the seven Saved Reply starter categories SPECIFICATION.md §5.13.6 lists verbatim as
// examples ("payment problem, order status, refund process, verification, marketplace, coaching,
// technical problem") — same "seed the fixed taxonomy inline with the migration that creates the
// table" precedent as CreateListingsSchema's categories/games. Placeholder bodies in Georgian
// (matching the rest of this app's copy) — real staff-authored wording should replace these once
// there's an actual support team using this.
const SAVED_REPLIES: Array<{ category: string; title: string; body: string }> = [
  {
    category: 'payment',
    title: 'გადახდის პრობლემა — გამოძიება მიმდინარეობს',
    body: 'გამარჯობა! თქვენი გადახდის საკითხს ვამოწმებთ და მალე დაგიბრუნდებით პასუხით.',
  },
  {
    category: 'order_status',
    title: 'შეკვეთის სტატუსის განახლება',
    body: 'თქვენი შეკვეთის სტატუსი განახლდა — დეტალები იხილეთ შეკვეთის გვერდზე.',
  },
  {
    category: 'refund',
    title: 'თანხის დაბრუნების პროცესი',
    body: 'თანხის დაბრუნების მოთხოვნა მიღებულია და განიხილება ჩვენი გუნდის მიერ.',
  },
  {
    category: 'verification',
    title: 'ვერიფიკაციის სტატუსი',
    body: 'თქვენი ვერიფიკაციის მოთხოვნა განხილვის პროცესშია — დამატებითი ინფორმაცია დაგჭირდებათ, თუ საჭირო გახდება, დაგიკავშირდებით.',
  },
  {
    category: 'marketplace',
    title: 'მარკეტფლეისთან დაკავშირებული საკითხი',
    body: 'თქვენი განცხადება/ლისტინგი განიხილება ჩვენი მარკეტფლეისის გუნდის მიერ.',
  },
  {
    category: 'coaching',
    title: 'კოუჩინგთან დაკავშირებული საკითხი',
    body: 'თქვენი კოუჩინგ სესიის საკითხი გადაეცა შესაბამის გუნდს.',
  },
  {
    category: 'technical',
    title: 'ტექნიკური პრობლემა',
    body: 'ტექნიკურ პრობლემას ვიკვლევთ — მადლობთ მოთმინებისთვის.',
  },
];

export class CreateSupportTickets1784339000000 implements MigrationInterface {
  name = 'CreateSupportTickets1784339000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "support_tickets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "requesterId" uuid NOT NULL,
        "subject" character varying NOT NULL,
        "category" character varying NOT NULL DEFAULT 'other',
        "priority" character varying NOT NULL DEFAULT 'medium',
        "status" character varying NOT NULL DEFAULT 'open',
        "orderId" uuid,
        "assignedToId" uuid,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "closedAt" TIMESTAMPTZ,
        CONSTRAINT "PK_support_tickets_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_support_tickets_requester" FOREIGN KEY ("requesterId") REFERENCES "users"("id"),
        CONSTRAINT "FK_support_tickets_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id"),
        CONSTRAINT "FK_support_tickets_assigned_to" FOREIGN KEY ("assignedToId") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_support_tickets_requester" ON "support_tickets" ("requesterId")`);
    await queryRunner.query(`CREATE INDEX "IDX_support_tickets_status" ON "support_tickets" ("status")`);

    await queryRunner.query(`
      CREATE TABLE "support_ticket_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ticketId" uuid NOT NULL,
        "senderId" uuid NOT NULL,
        "body" text NOT NULL,
        "isInternalNote" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_support_ticket_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_support_ticket_messages_ticket" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_support_ticket_messages_sender" FOREIGN KEY ("senderId") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_support_ticket_messages_ticket" ON "support_ticket_messages" ("ticketId")`);

    await queryRunner.query(`
      CREATE TABLE "saved_replies" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "category" character varying NOT NULL,
        "title" character varying NOT NULL,
        "body" text NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_replies_id" PRIMARY KEY ("id")
      )
    `);

    for (const reply of SAVED_REPLIES) {
      await queryRunner.query(
        `INSERT INTO "saved_replies" ("category", "title", "body") VALUES ($1, $2, $3)`,
        [reply.category, reply.title, reply.body],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "saved_replies"`);
    await queryRunner.query(`DROP INDEX "IDX_support_ticket_messages_ticket"`);
    await queryRunner.query(`DROP TABLE "support_ticket_messages"`);
    await queryRunner.query(`DROP INDEX "IDX_support_tickets_status"`);
    await queryRunner.query(`DROP INDEX "IDX_support_tickets_requester"`);
    await queryRunner.query(`DROP TABLE "support_tickets"`);
  }
}
