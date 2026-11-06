/* eslint-disable @next/next/no-img-element */
// The owner's SOLD banner (2026-11-06) over a product cover. Staff mark a listing sold in
// Admin → Listings; it stays visible with this overlay, can't be bought, and leaves the site 24h
// later. Decorative image + a visually-hidden label so screen readers still hear "Sold".
export default function SoldOverlay({ soldAt, size = 'card' }: { soldAt?: string | null; size?: 'card' | 'hero' }) {
  if (!soldAt) return null
  return (
    <div className={`sold-overlay sold-${size}`}>
      <img src="/assets/sold-overlay.webp" alt="" aria-hidden="true" />
      <span className="sr-only">გაყიდულია</span>
    </div>
  )
}
