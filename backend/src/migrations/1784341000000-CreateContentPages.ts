import { MigrationInterface, QueryRunner } from 'typeorm';

// Seeds the 5 pages Footer.tsx already links to (previously all "#" placeholders — see that
// file's own comment) so the footer has real destinations from the moment this migration runs.
// Copy is genuine starter content an admin is expected to edit via the new /admin/content page,
// not filler meant to look like real legal text — see content/CLAUDE.md.
export class CreateContentPages1784341000000 implements MigrationInterface {
  name = 'CreateContentPages1784341000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "content_pages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug" character varying(80) NOT NULL,
        "title" character varying(160) NOT NULL,
        "body" text NOT NULL DEFAULT '',
        "status" character varying NOT NULL DEFAULT 'draft',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_content_pages_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_content_pages_slug" UNIQUE ("slug")
      )
    `);

    const pages: Array<[string, string, string]> = [
      ['about', 'About WaveHub', 'WaveHub is a marketplace and coaching platform for gamers. This page is managed from the admin Content section — edit it to tell your story.'],
      ['contact', 'Contact Us', 'Need help? Reach the WaveHub team through the Support section of your account, or edit this page from the admin Content section to add a direct contact channel.'],
      ['terms-of-service', 'Terms of Service', 'These are WaveHub\'s Terms of Service. Replace this placeholder with your actual terms from the admin Content section before launch.'],
      ['privacy-policy', 'Privacy Policy', 'This is WaveHub\'s Privacy Policy. Replace this placeholder with your actual privacy policy from the admin Content section before launch.'],
      ['refund-policy', 'Refund Policy', 'This is WaveHub\'s Refund Policy. Replace this placeholder with your actual refund policy from the admin Content section before launch.'],
    ];

    for (const [slug, title, body] of pages) {
      await queryRunner.query(
        `INSERT INTO "content_pages" ("slug", "title", "body", "status") VALUES ($1, $2, $3, 'published')`,
        [slug, title, body],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "content_pages"`);
  }
}
