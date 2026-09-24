import type { ItemAttributes } from '@wavehub/shared-types'
import { STEAM_GENRES } from '@wavehub/shared-types'

// Seller-entered Steam game facts for a digital-key listing (shown on the Steam games list and
// detail pages — docs/design-mockups 04/05). All optional; stored in the listing's attributes.

export type SteamFacts = {
  tagline: string
  genre: string
  region: string
  edition: string
  language: string
  compareAtPrice: string
  trailerUrl: string
}

export const EMPTY_STEAM_FACTS: SteamFacts = { tagline: '', genre: '', region: '', edition: '', language: '', compareAtPrice: '', trailerUrl: '' }

export const TRAILER_URL = /^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\/\S+$/

export function steamFactsFrom(attrs: ItemAttributes | null | undefined): SteamFacts {
  const a = attrs ?? {}
  const str = (key: string) => (a[key] === undefined || a[key] === null ? '' : String(a[key]))
  return {
    tagline: str('tagline'),
    genre: str('genre'),
    region: str('region'),
    edition: str('edition'),
    language: str('language'),
    compareAtPrice: str('compareAtPrice'),
    trailerUrl: str('trailerUrl'),
  }
}

// Returns the attributes object, or an error message (Georgian) for the form to show.
export function steamFactsToAttributes(facts: SteamFacts, price: number): ItemAttributes | string {
  const out: ItemAttributes = {}
  for (const key of ['tagline', 'genre', 'region', 'edition', 'language', 'trailerUrl'] as const) {
    const value = facts[key].trim()
    if (value) out[key] = value.slice(0, 300)
  }
  if (out.trailerUrl && !TRAILER_URL.test(String(out.trailerUrl))) return 'ტრეილერი უნდა იყოს YouTube ან Vimeo ბმული (https://...).'
  const compare = facts.compareAtPrice.trim()
  if (compare) {
    const n = Number(compare)
    if (!Number.isInteger(n) || n <= price) return 'ძველი ფასი უნდა იყოს მთელი რიცხვი და აღემატებოდეს მიმდინარე ფასს.'
    out.compareAtPrice = n
  }
  return out
}

export default function SteamFactsFields({ facts, onChange }: { facts: SteamFacts; onChange: (next: SteamFacts) => void }) {
  const set = (key: keyof SteamFacts) => (e: { target: { value: string } }) => onChange({ ...facts, [key]: e.target.value })
  return (
    <>
      <label className="field">
        მოკლე აღწერა (tagline) <small>მაგ. „A vast world awaits.“</small>
        <input maxLength={80} value={facts.tagline} onChange={set('tagline')} />
      </label>
      <div className="stack-form-grid">
        <label className="field">
          ჟანრი
          <select value={facts.genre} onChange={set('genre')}>
            <option value="">—</option>
            {STEAM_GENRES.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          რეგიონი <small>მაგ. Global</small>
          <input maxLength={40} value={facts.region} onChange={set('region')} />
        </label>
        <label className="field">
          გამოცემა <small>მაგ. Standard Edition</small>
          <input maxLength={40} value={facts.edition} onChange={set('edition')} />
        </label>
        <label className="field">
          ენა <small>მაგ. Multi-Language</small>
          <input maxLength={40} value={facts.language} onChange={set('language')} />
        </label>
        <label className="field">
          ძველი ფასი (WC) <small>არასავალდებულო; მიმდინარეზე მეტი</small>
          <input inputMode="numeric" value={facts.compareAtPrice} onChange={set('compareAtPrice')} />
        </label>
        <label className="field">
          ტრეილერი <small>YouTube / Vimeo ბმული</small>
          <input type="url" maxLength={300} value={facts.trailerUrl} onChange={set('trailerUrl')} />
        </label>
      </div>
    </>
  )
}
