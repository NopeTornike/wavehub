/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import type { ReactNode } from 'react'
import LanguageSwitcher from '../LanguageSwitcher'

// The auth pages' frame (owner design 2026-10-15): dark page with the big neon "X" and wave lines,
// a slim top bar (logo, language, sign-in / sign-up), and the centred card.
export default function AuthShell({ children, topAction }: { children: ReactNode; topAction?: ReactNode }) {
  return (
    <main className="ax-page">
      <div className="ax-art" aria-hidden="true">
        <span className="ax-x ax-x-left"></span>
        <span className="ax-x ax-x-right"></span>
        <svg className="ax-waves" viewBox="0 0 1440 600" preserveAspectRatio="none">
          <path d="M0 330 C 300 260, 520 470, 860 380 S 1300 250, 1440 330" />
          <path d="M0 380 C 340 300, 560 520, 900 430 S 1280 300, 1440 390" />
          <path d="M0 440 C 360 380, 600 560, 940 480 S 1260 360, 1440 450" />
        </svg>
      </div>
      <header className="ax-top">
        <Link href="/" className="ax-top-brand" aria-label="WaveHubX — მთავარი გვერდი">
          <img src="/assets/logo-wavehubx-main.png" alt="WaveHubX" />
        </Link>
        <div className="ax-top-actions">
          <LanguageSwitcher />
          {topAction}
        </div>
      </header>
      <section className="ax-card">{children}</section>
    </main>
  )
}
