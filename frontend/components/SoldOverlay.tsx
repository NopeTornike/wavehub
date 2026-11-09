/* eslint-disable @next/next/no-img-element */
// Staff covers over a product photo:
// - SOLD (owner 2026-11-06): the red banner. The listing can't be bought and leaves the site 24h later.
// - Cover (owner 2026-11-09): the Tournament Gift artwork ('gift') or an image staff uploaded
//   ('custom') fills the photo. The listing stays on the site but can't be bought.
// Decorative images + a visually-hidden label so screen readers still hear what it means.
type Covered = { soldAt?: string | null; coverOverlay?: 'gift' | 'custom' | null; coverOverlayUrl?: string | null }

/** True when staff blocked buying with SOLD or a cover. */
export function purchaseBlocked(listing: Covered): boolean {
  return Boolean(listing.soldAt || listing.coverOverlay)
}

export default function SoldOverlay({ soldAt, coverOverlay, coverOverlayUrl, size = 'card' }: Covered & { size?: 'card' | 'hero' }) {
  if (soldAt)
    return (
      <div className={`sold-overlay sold-${size}`}>
        <img src="/assets/sold-overlay.webp" alt="" aria-hidden="true" />
        <span className="sr-only">გაყიდულია</span>
      </div>
    )
  // The gift badge is a transparent PNG laid over the dimmed photo, exactly like SOLD.
  if (coverOverlay === 'gift')
    return (
      <div className={`sold-overlay sold-${size} gift-overlay`}>
        <img src="/assets/gift-overlay.png" alt="" aria-hidden="true" />
        <span className="sr-only">ტურნირის საჩუქარი — ყიდვა შეჩერებულია</span>
      </div>
    )
  const src = coverOverlay === 'custom' ? coverOverlayUrl : null
  if (!src) return null
  return (
    <div className={`cover-overlay cover-${size}`}>
      <img src={src} alt="" aria-hidden="true" />
      <span className="sr-only">ყიდვა შეჩერებულია</span>
    </div>
  )
}
