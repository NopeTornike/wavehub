import { MigrationInterface, QueryRunner } from 'typeorm';

// The footer's "ჩვენ შესახებ" opens /pages/about (CMS), which still carried about.html's English
// marketing copy. Tornike's main has a policy-style Georgian About page (about-us.html, same
// layout as the other policy pages) — this puts that copy in the CMS. Only touches the row if it
// still holds the copy SyncRealContentPageCopy wrote, so an admin's own edit is never overwritten.
const OLD_BODY = "◆ WAVEHUBX\n\nEVERYTHING YOU NEED. ONE GAMING ECOSYSTEM.\n\nBuy, sell, learn, compete and grow — all in one secure platform built for gamers, by gamers.\n\nProtected Payments\n\nSecure escrow system keeps your payments safe until the order is completed.\n\nVerified Sellers & Coaches\n\nAll sellers and coaches are carefully verified to ensure a safe and trusted experience.\n\nGaming & Digital Services\n\nMarketplace, coaching, tournaments, game keys and digital services — all in one place.\n\nFast Support\n\nOur support team is always ready to help you, 24/7. Quick answers, real support, real people.";
const OLD_TITLE = "Everything you need. One Gaming Ecosystem.";
const TITLE = "WaveHubX — ჩვენს შესახებ";
const BODY = "WaveHubX არის საქართველოში პირველი ციფრული გეიმინგ პლატფორმა, რომელიც აერთიანებს გეიმერებისთვის საჭირო სერვისებს, ციფრულ პროდუქტებსა და სხვადასხვა გეიმინგ შესაძლებლობას ერთ სივრცეში.\n\nჩვენი მიზანია შევქმნათ უსაფრთხო, გამჭვირვალე და მომხმარებელზე ორიენტირებული პლატფორმა, სადაც მომხმარებლებს შეუძლიათ მარტივად მოიძიონ და შეიძინონ მათთვის საჭირო გეიმინგ მომსახურებები და ციფრული პროდუქტები.\n\n1 პლატფორმის მიმართულებები\n\nWaveHubX-ზე მომხმარებლებს ეტაპობრივად ექნებათ წვდომა სხვადასხვა მიმართულებაზე, მათ შორის:\n\n- გეიმინგ ქოუჩინგზე;\n- ციფრულ პროდუქტებსა და სერვისებზე;\n- Marketplace-ზე;\n- Steam Games მიმართულებაზე;\n- ტურნირებსა და სხვა გეიმინგ აქტივობებზე.\n\n2 უსაფრთხო შეკვეთები\n\nპლატფორმის მუშაობის ერთ-ერთი მთავარი პრინციპია უსაფრთხო და გამჭვირვალე შეკვეთის პროცესი.\n\nWaveHubX-ის ფარგლებში განხორციელებული შეკვეთების გადახდა ხდება მხოლოდ პლატფორმის ოფიციალური გადახდის არხების მეშვეობით. სელერებსა და სერვისის მიმწოდებლებს ეკრძალებათ მომხმარებლებისთვის პლატფორმის გარეთ პირდაპირი გადახდის შეთავაზება.\n\n3 მომხმარებლის დაცვა\n\nWaveHubX განსაკუთრებულ ყურადღებას უთმობს მომხმარებლის უფლებების დაცვას, მომსახურების ხარისხს, მონაცემების კონფიდენციალურობასა და თაღლითობის პრევენციას.\n\nპლატფორმაზე მოქმედებს მომხმარებლების, სელერებისა და ქოუჩების ქცევის წესები, ასევე თანხის დაბრუნების, შეკვეთის გაუქმების, დავების გადაწყვეტისა და კონფიდენციალურობის პოლიტიკები.\n\n4 განვითარება და მიზანი\n\nWaveHubX ვითარდება ეტაპობრივად და ახალი ფუნქციები და სერვისები ემატება პლატფორმის განვითარების შესაბამისად.\n\nჩვენი მიზანია საქართველოში ჩამოვაყალიბოთ სანდო და თანამედროვე გეიმინგ ეკოსისტემა, რომელიც მომხმარებლებს მისცემს შესაძლებლობას ისარგებლონ სხვადასხვა გეიმინგ სერვისით ერთიან და ორგანიზებულ სივრცეში.";

export class AboutUsGeorgianCopy1784369000000 implements MigrationInterface {
  name = 'AboutUsGeorgianCopy1784369000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "content_pages" SET "title" = $1, "body" = $2 WHERE "slug" = 'about' AND "body" = $3`, [TITLE, BODY, OLD_BODY]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "content_pages" SET "title" = $1, "body" = $2 WHERE "slug" = 'about' AND "body" = $3`, [OLD_TITLE, OLD_BODY, BODY]);
  }
}
