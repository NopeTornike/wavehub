import Link from 'next/link'
import type { PublicCoachPackage } from '@wavehub/shared-types'

// One coaching package card (owner spec "WaveHubX Coaching Packages", 2026-10-02): the same
// component for Starter / Growth / Elite — only the data and the accent colour differ. Used on the
// coach profile (CTA links to booking) and in booking step 1 (CTA selects the package).
// Colours stay the site's existing booking accents: Starter pink, Growth gold, Elite purple.

const TONES: Record<string, string> = { starter: 'pink', growth: 'gold', elite: 'purple' }

export function packageTone(key: string, index: number): string {
  return TONES[key] ?? ['pink', 'gold', 'purple'][index % 3]
}

export function packageLength(p: Pick<PublicCoachPackage, 'sessionsCount' | 'durationMinutes'>): string {
  return p.sessionsCount > 1 ? `${p.sessionsCount} × ${p.durationMinutes} წუთი` : `${p.durationMinutes} წუთი`
}

export function lari(value: number): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}₾`
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  )
}

export default function PackageCard({
  pkg,
  index,
  selected = false,
  onSelect,
  href,
}: {
  pkg: PublicCoachPackage
  index: number
  selected?: boolean
  onSelect?: () => void
  href?: string
}) {
  const tone = packageTone(pkg.key, index)
  const cta = selected ? 'არჩეულია ✓' : 'პაკეტის არჩევა'
  return (
    <article className={`pkg-card ${tone}${selected ? ' selected' : ''}`}>
      <header>
        <h3>{pkg.name}</h3>
        <p className="pkg-length">{packageLength(pkg)}</p>
        <p className="pkg-price">
          <strong>{lari(pkg.priceWaveCoin)}</strong>
          <span>სრული ფასი</span>
        </p>
      </header>
      <section>
        <h4>პაკეტის აღწერა</h4>
        <p className="pkg-tagline">{pkg.tagline}</p>
        <p>{pkg.description}</p>
      </section>
      {pkg.features.length > 0 && (
        <section>
          <h4>რას მოიცავს</h4>
          <ul>
            {pkg.features.map((f) => (
              <li key={f}>
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {onSelect ? (
        <button type="button" className="pkg-cta" aria-pressed={selected} onClick={onSelect}>
          {cta}
        </button>
      ) : href ? (
        <Link className="pkg-cta" href={href}>
          {cta}
        </Link>
      ) : null}
    </article>
  )
}
