import Link from 'next/link'
import { useLanguage, type Language } from '../lib/i18n'

// site-footer.js's footer, markup-for-markup. Policy links point at the admin-editable CMS pages
// (backend/src/content/ — /pages/[slug]), including the payment and wallet policies (the prototype
// links those to about.html anchors that don't exist; here they're real CMS pages). The language
// select drives the same LanguageProvider as the topbar switcher.
/* eslint-disable @next/next/no-img-element */

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {children}
  </svg>
)

export default function Footer() {
  const { language, setLanguage } = useLanguage()
  return (
    <footer className="site-footer" aria-label="WaveHubX footer">
      <div className="site-footer-main">
        <section className="site-footer-brand" aria-labelledby="footerBrandTitle">
          <Link href="/" className="site-footer-logo" aria-label="WaveHubX home">
            <img src="/assets/logo-wavehubx-main.png" alt="WaveHubX" />
            <span id="footerBrandTitle">ითამაშე. დაუკავშირდი. გამოიმუშავე.</span>
          </Link>
          <p>WaveHubX არის გეიმინგ მარკეტფლეისი. იყიდეთ, გაყიდეთ და გაიუმჯობესეთ უნარები სანდო ქოუჩებთან ერთად — ყველაფერი ერთ სივრცეში.</p>
          <ul className="site-footer-trust">
            <li>
              <Svg><path d="M12 3 20 6v6c0 5-3.2 8.2-8 10-4.8-1.8-8-5-8-10V6l8-3Z" /></Svg>
              <span><strong>უსაფრთხო ტრანზაქციები</strong><small>თქვენი უსაფრთხოება ჩვენი პრიორიტეტია.</small></span>
            </li>
            <li>
              <Svg><path d="M4 14v-3a8 8 0 0 1 16 0v3M4 13H2v6h4v-6H4Zm16 0h2v6h-4v-6h2ZM18 20c0 1.2-1.4 2-3.5 2" /></Svg>
              <span><strong>24/7 მხარდაჭერა</strong><small>ყოველთვის მზად ვართ დასახმარებლად.</small></span>
            </li>
            <li>
              <Svg><circle cx="12" cy="10" r="6" /><path d="m8 16-1 5 5-2 5 2-1-5M9.5 10.2l1.7 1.7 3.4-3.6" /></Svg>
              <span><strong>სანდო პლატფორმა</strong><small>სამართლიანი თამაში და გამჭვირვალობა.</small></span>
            </li>
            <li>
              <Svg><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M15 14a5 5 0 0 1 6 5v1" /></Svg>
              <span><strong>მზარდი საზოგადოება</strong><small>შემოუერთდით ათასობით გეიმერს.</small></span>
            </li>
          </ul>
        </section>

        <nav className="site-footer-column" aria-labelledby="footerCompanyTitle">
          <h2 id="footerCompanyTitle">
            <Svg><path d="M4 21V5h10v16M14 9h6v12M7 9h2M7 13h2M7 17h2M11 9h1M11 13h1M11 17h1M17 13h1M17 17h1M2 21h20" /></Svg>
            <span>კომპანია</span>
          </h2>
          <Link href="/pages/about">ჩვენ შესახებ</Link>
          <Link href="/pages/contact">საკონტაქტო ინფორმაცია</Link>
        </nav>

        <nav className="site-footer-column site-footer-legal" aria-labelledby="footerLegalTitle">
          <h2 id="footerLegalTitle">
            <Svg><path d="M12 3 20 6v6c0 5-3.2 8.2-8 10-4.8-1.8-8-5-8-10V6l8-3Z" /><path d="M9 11a3 3 0 0 0 6 0V9M12 8v3" /></Svg>
            <span>სამართლებრივი</span>
          </h2>
          <Link href="/pages/terms-of-service">მომსახურების პირობები</Link>
          <Link href="/pages/privacy-policy">კონფიდენციალურობის პოლიტიკა</Link>
          <Link href="/pages/refund-policy">დაბრუნებისა და გაუქმების პოლიტიკა</Link>
          <Link href="/pages/delivery-policy">მიწოდების პოლიტიკა</Link>
          <Link href="/pages/payment-policy">გადახდისა და ფასების პოლიტიკა</Link>
          <Link href="/pages/wallet-policy">საფულის პოლიტიკა</Link>
          <Link href="/pages/dispute-resolution">დავების გადაწყვეტის პოლიტიკა</Link>
        </nav>

        <nav className="site-footer-column" aria-labelledby="footerCommunityTitle">
          <h2 id="footerCommunityTitle">
            <Svg><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 20v-2a6 6 0 0 1 12 0v2M14 14a5 5 0 0 1 7 4.5V20" /></Svg>
            <span>საზოგადოება</span>
          </h2>
          <Link href="/pages/community-guidelines">საზოგადოების წესები</Link>
          <Link href="/pages/seller-standards">გამყიდველის სტანდარტები და ქცევის კოდექსი</Link>
          <Link href="/pages/coach-standards">ქოუჩის სტანდარტები და ქცევის კოდექსი</Link>
        </nav>
      </div>

      <div className="site-footer-bottom">
        <p>
          © {new Date().getFullYear()} <strong>WaveHubX.</strong> ყველა უფლება დაცულია.
        </p>
        <div className="site-footer-socials" aria-label="Social media">
          <b>გამოგვყევით</b>
          <span aria-hidden="true"></span>
          <a className="facebook" href="https://www.facebook.com/profile.php?id=61592006158520" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
            <Svg><path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v5h4v-5h3l1-4h-4V9c0-.7.3-1 1-1Z" /></Svg>
          </a>
          <a className="instagram" href="https://www.instagram.com/wavehubx/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <Svg><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></Svg>
          </a>
          <a className="tiktok" href="https://www.tiktok.com/@wavehubx" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
            <Svg><path d="M14 4v11.2a4.2 4.2 0 1 1-3.6-4.2M14 4c.5 3 2.2 4.5 5 4.8" /></Svg>
          </a>
          <a className="discord" href="https://discord.gg/4nqVTBA4d" target="_blank" rel="noopener noreferrer" aria-label="Discord">
            <Svg>
              <path className="discord-mark" d="M18.8 5.7A16 16 0 0 0 15 4.5l-.5 1a13.5 13.5 0 0 0-5 0l-.5-1a16 16 0 0 0-3.8 1.2C3.6 8.1 2.8 10.8 2.6 14c1.8 2 3.6 3.1 5.4 3.8l1.3-1.7a11 11 0 0 1-2-1c3 1.4 6.4 1.4 9.4 0-.6.4-1.3.7-2 1l1.3 1.7c1.8-.7 3.6-1.8 5.4-3.8-.2-3.2-1-5.9-2.6-8.3Z" />
              <ellipse className="discord-eye" cx="9" cy="11.8" rx="1.25" ry="1.55" />
              <ellipse className="discord-eye" cx="15" cy="11.8" rx="1.25" ry="1.55" />
            </Svg>
          </a>
        </div>
        <label className="site-footer-language">
          <Svg><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></Svg>
          <select data-language-select="" aria-label="ენა" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
            <option value="en">EN</option>
            <option value="ka">ქა</option>
          </select>
        </label>
      </div>
    </footer>
  )
}
