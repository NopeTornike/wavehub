import { useLanguage } from '../lib/i18n'

// Desktop header and footer share the compact globe + select. Phone headers retain the
// original EN/ქა buttons, while the footer keeps the globe selector.
/* eslint-disable @next/next/no-img-element */
export default function LanguageSwitcher({ floating = false, header = false }: { floating?: boolean; header?: boolean }) {
  const { language, setLanguage } = useLanguage()
  return (
    <div className={`language-switcher${header ? ' language-switcher-header' : ''}${floating ? ' language-switcher-floating' : ''}`} role="group" aria-label="Language selector" data-i18n-keep="">
      <span className="language-switcher-select">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
        <select value={language} onChange={(event) => setLanguage(event.target.value as 'ka' | 'en')} aria-label="Language selector">
          <option value="ka">ქა</option>
          <option value="en">EN</option>
        </select>
      </span>
      {header && (
        <span className="language-switcher-options">
          <button type="button" aria-label="English" aria-pressed={language === 'en'} className={language === 'en' ? 'is-active' : undefined} onClick={() => setLanguage('en')}>
            <img src="/assets/united-kingdom-flag.png" alt="" aria-hidden="true" />
            <span>EN</span>
          </button>
          <button type="button" aria-label="ქართული" aria-pressed={language === 'ka'} className={language === 'ka' ? 'is-active' : undefined} onClick={() => setLanguage('ka')}>
            <img src="/assets/georgian-flag-icon.png" alt="" aria-hidden="true" />
            <span>ქა</span>
          </button>
        </span>
      )}
    </div>
  )
}
