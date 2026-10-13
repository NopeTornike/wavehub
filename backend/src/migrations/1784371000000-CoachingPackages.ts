import { MigrationInterface, QueryRunner } from 'typeorm';

// Platform coaching packages (owner spec "WaveHubX Coaching Packages — Developer UI / Content
// Specification", 2026-10-02): Starter / Growth / Elite, the same for every coach and editable by
// staff only. They replace the per-coach `coach_packages` (2026-10-01): booked sessions keep their
// package name snapshot; their packageId is cleared because it pointed at the dropped table.
// Elite: the spec's summary and its bullet list say 6 × 60 min (one title line said 5) — 6 is used.
const PACKAGES: Array<{ key: string; name: string; sessions: number; minutes: number; price: number; sort: number; tagline: string; description: string; features: string[] }> = [
  {
    "key": "starter",
    "name": "STARTER",
    "sessions": 1,
    "minutes": 40,
    "price": 19,
    "sort": 1,
    "tagline": "არ იცი საიდან დაიწყო, ან გინდა გაიგო რა გაკავებს პროგრესში?",
    "description": "Starter პაკეტი დაგეხმარება სწორად განსაზღვრო შენი დონე, მიზანი და შემდეგი ნაბიჯი.",
    "features": [
      "ინდივიდუალური ქოუჩინგ სესია",
      "შენი დონისა და მიზნის შეფასება",
      "თამაშის ძირითადი მექანიკებისა და სწორი მიმართულების გაცნობა",
      "ძლიერი და გასაუმჯობესებელი მხარეების გამოვლენა",
      "პრაქტიკული მუშაობა მთავარ საკითხებზე",
      "პერსონალური რეკომენდაციები და შემდეგი ნაბიჯი"
    ]
  },
  {
    "key": "growth",
    "name": "GROWTH",
    "sessions": 3,
    "minutes": 50,
    "price": 39,
    "sort": 2,
    "tagline": "გინდა არა მხოლოდ გაიგო რა გაქვს გამოსასწორებელი, არამედ რეალურად იმუშაო პროგრესზე?",
    "description": "Growth პაკეტი დაგეხმარება ეტაპობრივად გააუმჯობესო თამაში, იმუშაო მთავარ მიმართულებებზე და თვალსაჩინოდ დაინახო შენი განვითარება.",
    "features": [
      "3 ინდივიდუალური ქოუჩინგ სესია",
      "შენი დონისა და მთავარი მიზნების დეტალური შეფასება",
      "პერსონალური განვითარების გეგმა",
      "ძირითად გასაუმჯობესებელ მიმართულებებზე პრაქტიკული მუშაობა",
      "თითო სესიას შორის კონკრეტული დავალებები",
      "პროგრესის მონიტორინგი და საჭირო კორექციები",
      "საწყისი და საბოლოო პროგრესის შედარება",
      "საბოლოო რეკომენდაციები და შემდეგი განვითარების მიმართულება"
    ]
  },
  {
    "key": "elite",
    "name": "ELITE",
    "sessions": 6,
    "minutes": 60,
    "price": 69,
    "sort": 3,
    "tagline": "გინდა თამაშის არა მხოლოდ გაუმჯობესება, არამედ შენი სტილის, სტრატეგიული აზროვნების, გადაწყვეტილებებისა და საერთო შესრულების სისტემურად განვითარება?",
    "description": "Elite პაკეტი შექმნილია მათთვის, ვისაც სურს ღრმა მუშაობა, მკაფიო პროგრესის დაფიქსირება და ინდივიდუალური განვითარების გეგმა.",
    "features": [
      "6 ინდივიდუალური ქოუჩინგ სესია",
      "შენი დონის, თამაშის სტილისა და მთავარი მიზნების სრული შეფასება",
      "2–3 მთავარი განვითარების პრიორიტეტის განსაზღვრა",
      "ინდივიდუალური განვითარების გეგმა",
      "რამდენიმე მთავარ გასაუმჯობესებელ მიმართულებაზე სიღრმისეული მუშაობა",
      "სტრატეგიული აზროვნებისა და გადაწყვეტილებების განვითარება",
      "თამაშის დროს ემოციების მართვა და კონცენტრაციის გაუმჯობესება",
      "გუნდური კომუნიკაციისა და სწორი რეაგირების განვითარება",
      "რეალური თამაშის / ჩანაწერის დეტალური ანალიზი",
      "თითო სესიას შორის ინდივიდუალური დავალებები",
      "პროგრესის მუდმივი მონიტორინგი და საჭირო კორექციები",
      "თამაშის დროის, კონცენტრაციისა და სწორი სავარჯიშო რეჟიმის რეკომენდაციები",
      "საწყისი და საბოლოო შესრულების დეტალური შედარება",
      "საბოლოო პროგრესის შეფასება",
      "30-დღიანი განვითარების გეგმა",
      "დამატებითი შემაჯამებელი შეფასება პაკეტის დასრულების შემდეგ"
    ]
  }
];

export class CoachingPackages1784371000000 implements MigrationInterface {
  name = 'CoachingPackages1784371000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "coaching_packages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" varchar(30) NOT NULL,
        "name" varchar(60) NOT NULL,
        "sessionsCount" integer NOT NULL,
        "durationMinutes" integer NOT NULL,
        "priceWaveCoin" integer NOT NULL,
        "tagline" varchar(300) NOT NULL,
        "description" varchar(600) NOT NULL,
        "features" jsonb NOT NULL DEFAULT '[]',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coaching_packages" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_coaching_packages_key" UNIQUE ("key"),
        CONSTRAINT "CHK_coaching_packages_sessions" CHECK ("sessionsCount" BETWEEN 1 AND 10),
        CONSTRAINT "CHK_coaching_packages_duration" CHECK ("durationMinutes" BETWEEN 15 AND 480),
        CONSTRAINT "CHK_coaching_packages_price" CHECK ("priceWaveCoin" BETWEEN 1 AND 100000)
      )
    `);
    for (const p of PACKAGES) {
      await queryRunner.query(
        `INSERT INTO "coaching_packages" ("key", "name", "sessionsCount", "durationMinutes", "priceWaveCoin", "tagline", "description", "features", "sortOrder")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [p.key, p.name, p.sessions, p.minutes, p.price, p.tagline, p.description, JSON.stringify(p.features), p.sort],
      );
    }
    await queryRunner.query(`ALTER TABLE "coaching_sessions" DROP CONSTRAINT "FK_coaching_sessions_package"`);
    await queryRunner.query(`UPDATE "coaching_sessions" SET "packageId" = NULL WHERE "packageId" IS NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "coaching_sessions" ADD CONSTRAINT "FK_coaching_sessions_package" FOREIGN KEY ("packageId") REFERENCES "coaching_packages"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(`DROP TABLE "coach_packages"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "coach_packages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "coachId" uuid NOT NULL,
        "name" varchar(60) NOT NULL,
        "description" varchar(300),
        "sessionsCount" integer NOT NULL DEFAULT 1,
        "durationMinutes" integer NOT NULL,
        "priceWaveCoin" integer NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coach_packages" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_coach_packages_price" CHECK ("priceWaveCoin" BETWEEN 1 AND 100000),
        CONSTRAINT "CHK_coach_packages_duration" CHECK ("durationMinutes" BETWEEN 15 AND 480),
        CONSTRAINT "CHK_coach_packages_sessions" CHECK ("sessionsCount" BETWEEN 1 AND 10),
        CONSTRAINT "FK_coach_packages_coach" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_coach_packages_coach" ON "coach_packages" ("coachId")`);
    await queryRunner.query(`ALTER TABLE "coaching_sessions" DROP CONSTRAINT "FK_coaching_sessions_package"`);
    await queryRunner.query(`UPDATE "coaching_sessions" SET "packageId" = NULL WHERE "packageId" IS NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "coaching_sessions" ADD CONSTRAINT "FK_coaching_sessions_package" FOREIGN KEY ("packageId") REFERENCES "coach_packages"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(`DROP TABLE "coaching_packages"`);
  }
}
