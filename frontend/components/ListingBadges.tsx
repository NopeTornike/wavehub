import type { ListingBadge } from '@wavehub/shared-types'

// The automatic listing badges (owner 2026-10-28), labelled and coloured as in the owner's table.
// Each is earned from real data on the server (backend/src/listings/listing-badges.service.ts).
// Labels stay English in both languages, like the owner's list.
export const LISTING_BADGE_LABELS: Record<ListingBadge, string> = {
  hot: 'HOT 🔥',
  most_popular: 'MOST POPULAR',
  most_viewed: 'MOST VIEWED',
  trending: 'TRENDING ↗',
  price_drop: 'PRICE DROP',
  just_updated: 'JUST UPDATED',
  verified: 'VERIFIED ✓',
}

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
          {LISTING_BADGE_LABELS[b]}
        </em>
      ))}
    </span>
  )
}
