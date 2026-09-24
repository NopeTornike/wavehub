import { MigrationInterface, QueryRunner } from 'typeorm';

// Two CMS pages the prototype's site footer links to ("Payment & pricing policy", "Wallet policy")
// but that the prototype itself never wrote (its links point at about.html#payments / #wallet,
// which don't exist). The copy below describes how the platform ACTUALLY works — 1:1 GEL→WaveCoin
// top-ups through Bank of Georgia, escrow until delivery is accepted, the admin-configured platform
// fee and minimum withdrawal, the 7-day hold on earnings — so the links aren't dead and nothing on
// them is invented. Admin-editable afterwards like every other content page (backend/src/content/);
// like the other policy pages it should get the owner's legal review before launch.
// Inserted idempotently (ON CONFLICT DO NOTHING) so an admin's edits are never overwritten.
const PAGES: Array<[string, string, string]> = [
  [
    'payment-policy',
    'WaveHubX — გადახდისა და ფასების პოლიტიკა',
    [
      'WAVEHUBX — გადახდისა და ფასების პოლიტიკა',
      '',
      'WaveHubX-ზე ყველა შეძენა ხდება WaveCoin-ით (WC) — პლატფორმის შიდა ბალანსით.',
      '',
      'WaveCoin-ის შეძენა',
      'WaveCoin-ის შეძენა შესაძლებელია საფულის გვერდიდან, საქართველოს ბანკის (BOG) დაცული გადახდის გვერდის მეშვეობით. კურსი ფიქსირებულია: 1 ლარი = 1 WaveCoin.',
      'ბარათის მონაცემები არასდროს ინახება WaveHubX-ის სერვერებზე — გადახდას სრულად ამუშავებს საქართველოს ბანკი.',
      'ბალანსი ირიცხება მხოლოდ მას შემდეგ, რაც ბანკი გადახდას დაადასტურებს.',
      '',
      'ფასები',
      'თითოეული განცხადების ფასი მითითებულია WaveCoin-ში და მას ადგენს გამყიდველი. სერვისების შემთხვევაში ფასი დამოკიდებულია არჩეულ პაკეტზე.',
      'ფასი, რომელსაც შეკვეთისას იხდით, არის განცხადების იმ მომენტისთვის მოქმედი ფასი.',
      '',
      'ესქროუ დაცვა',
      'შეკვეთისას თანხა იბლოკება ესქროუში და გამყიდველს ერიცხება მხოლოდ მიწოდების დადასტურების (ან დადასტურების ვადის ამოწურვის) შემდეგ.',
      'შეკვეთის გაუქმების ან დავის მყიდველის სასარგებლოდ გადაწყვეტის შემთხვევაში თანხა ბრუნდება თქვენს WaveCoin ბალანსზე.',
      '',
      'საკომისიო',
      'პლატფორმის საკომისიო იკავება გამყიდველის შემოსავლიდან დასრულებულ შეკვეთაზე; მისი პროცენტი ფიქსირდება შეკვეთის შექმნის მომენტში. მყიდველი საკომისიოს დამატებით არ იხდის.',
    ].join('\n'),
  ],
  [
    'wallet-policy',
    'WaveHubX — საფულის პოლიტიკა',
    [
      'WAVEHUBX — საფულის პოლიტიკა',
      '',
      'WaveHubX-ის საფულე აჩვენებს თქვენს WaveCoin ბალანსს და ყველა ოპერაციის ისტორიას.',
      '',
      'ბალანსის სახეები',
      'ხელმისაწვდომი — თანხა, რომლითაც შეგიძლიათ შეძენა ან გატანა.',
      'მოლოდინში — დასრულებული შეკვეთებიდან მიღებული შემოსავალი, რომელიც 7 დღის განმავლობაში იბლოკება გატანამდე (დავებისა და თაღლითობისგან დასაცავად).',
      'გამომუშავებული და გატანილი — თქვენი შემოსავლისა და უკვე გატანილი თანხის ჯამები.',
      '',
      'გატანა',
      'გამყიდველებსა და ქოუჩებს შეუძლიათ ხელმისაწვდომი შემოსავლის გატანის მოთხოვნა საფულის გვერდიდან (საბანკო გადარიცხვა, PayPal ან Wise).',
      'არსებობს გატანის მინიმალური თანხა, რომელიც მითითებულია საფულის გვერდზე. გატანა შეუძლებელია, სანამ თქვენს შეკვეთაზე აქტიური დავა მიმდინარეობს.',
      'თითოეულ მოთხოვნას ამოწმებს WaveHubX-ის გუნდი; სანამ მოთხოვნა დამუშავდება, შეგიძლიათ მისი გაუქმება.',
      '',
      'უსაფრთხოება',
      'ყოველი ოპერაცია აღირიცხება საფულის ისტორიაში. თუ ოპერაცია არ გეცნობათ, დაუყოვნებლივ დაუკავშირდით მხარდაჭერას.',
    ].join('\n'),
  ],
];

export class PaymentAndWalletPolicyPages1784351000000 implements MigrationInterface {
  name = 'PaymentAndWalletPolicyPages1784351000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [slug, title, body] of PAGES) {
      await queryRunner.query(
        `INSERT INTO "content_pages" ("slug", "title", "body", "status") VALUES ($1, $2, $3, 'published')
         ON CONFLICT ("slug") DO NOTHING`,
        [slug, title, body],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "content_pages" WHERE "slug" IN ('payment-policy', 'wallet-policy')`);
  }
}
