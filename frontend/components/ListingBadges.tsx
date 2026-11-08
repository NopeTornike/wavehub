import type { ListingBadge } from '@wavehub/shared-types'

// The automatic listing badges (owner 2026-10-28), labelled and coloured as in the owner's table.
// Each is earned from real data on the server (backend/src/listings/listing-badges.service.ts).
// Labels stay English in both languages, like the owner's list.
export const LISTING_BADGE_LABELS: Record<ListingBadge, string> = {
  hot: 'HOT',
  most_popular: 'MOST POPULAR',
  most_viewed: 'MOST VIEWED',
  trending: 'TRENDING',
  price_drop: 'PRICE DROP',
  just_updated: 'JUST UPDATED',
  verified: 'VERIFIED',
}

// One small line icon per badge (owner 2026-11-08: "the badges design must be beautiful").
const ICONS: Record<ListingBadge, string> = {
  hot: 'M12 2c1 3.5-1.5 5-1.5 7.5A2.5 2.5 0 0 0 13 12c1.6 0 2.5-1.2 2.5-2.8C17.4 10.8 19 13.3 19 15.5A7 7 0 0 1 5 15.5C5 10 10.5 8 12 2Z',
  most_popular: 'm12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z',
  most_viewed: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  trending: 'M3 17l6-6 4 4 7-7M14 8h6v6',
  price_drop: 'M3 12V4h8l10 10-8 8L3 12Zm5-4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  just_updated: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  verified: 'm5 12.5 4.5 4.5L19 7.5',
}
const STROKED = new Set<ListingBadge>(['trending', 'just_updated', 'verified'])

export const LISTING_BADGE_HINTS: Record<ListingBadge, string> = {
  hot: 'ბოლო 48 საათში მინ. 100 ნახვა და 5 რჩეულებში დამატება',
  most_popular: 'ბოლო 30 დღეში ჩართულობის მიხედვით TOP 10',
  most_viewed: 'ბოლო 30 დღეში ნახვებით TOP 10',
  trending: 'ბოლო 24 საათში ნახვების მინ. 50%-იანი ზრდა',
  price_drop: 'ფასის მინ. 10%-ით შემცირება',
  just_updated: 'განცხადების ინფორმაცია ახლახან განახლდა',
  verified: 'აქაუნთის საკუთრება და მონაცემები შემოწმებულია',
}

export default function ListingBadges({ badges, max, className = '' }: { badges?: ListingBadge[]; max?: number; className?: string }) {
  if (!badges?.length) return null
  const shown = max ? badges.slice(0, max) : badges
  return (
    <span className={`lb-row ${className}`.trim()} data-i18n-keep="">
      {shown.map((b) => (
        <em key={b} className={`lb lb-${b}`} title={LISTING_BADGE_HINTS[b]}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className={STROKED.has(b) ? 'is-stroke' : undefined}>
            <path d={ICONS[b]} />
          </svg>
          {LISTING_BADGE_LABELS[b]}
        </em>
      ))}
    </span>
  )
}
