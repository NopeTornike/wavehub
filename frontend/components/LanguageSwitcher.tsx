import { useLanguage } from '../lib/i18n'

// profile-nav/site-footer.js#addHeaderLanguageSwitcher markup — the EN/ქა pill in the topbar.
// `floating`: pages without a topbar (the auth pages) get it pinned top-right, as the prototype does.
/* eslint-disable @next/next/no-img-element */
export default function LanguageSwitcher({ floating = false }: { floating?: boolean }) {
  const { language, setLanguage } = useLanguage()
  return (
    <div className={`language-switcher${floating ? ' language-switcher-floating' : ''}`} role="group" aria-label="Language selector" data-i18n-keep="">
      <button type="button" aria-label="English" aria-pressed={language === 'en'} className={language === 'en' ? 'is-active' : undefined} onClick={() => setLanguage('en')}>
        <img src="/assets/united-kingdom-flag.png" alt="" aria-hidden="true" />
        <span>EN</span>
      </button>
      <button type="button" aria-label="ქართული" aria-pressed={language === 'ka'} className={language === 'ka' ? 'is-active' : undefined} onClick={() => setLanguage('ka')}>
        <img src="/assets/georgian-flag-icon.png" alt="" aria-hidden="true" />
        <span>ქა</span>
      </button>
    </div>
  )
}
