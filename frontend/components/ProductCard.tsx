import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, type MouseEvent } from 'react'
import { ListingType, type PublicListingSummary } from '@wavehub/shared-types'
import { useCart } from '../lib/cart'
import { useFavorites } from '../lib/favorites'
import { gameCover } from '../lib/games'
import { deliveryTimeLabel } from '../lib/labels'
import SellerPreview from './SellerPreview'

// The prototype's marketplace showcase card (marketplace.js#createProductShowcaseCard), used for
// every listing type, on real listing data:
//   - rarity class/badge = the seller-entered `accountStatus` item attribute
//   - "Level" = the `accountLevel` attribute; ◉ views = viewsCount; ♡ = real favourite count
//   - seller line = real seller, their real marketplace rank (GET /stats/seller-ranks) and the
//     listing's real review average/count
//   - delivery = the `deliveryTime` attribute (the prototype's default "Instant" otherwise)
//   - ♡ toggles a real favourite; the cart button adds the listing to the real cart (items and
//     digital keys only — a service needs its package/requirements chosen on its own page, so its
//     card links there instead).
/* eslint-disable @next/next/no-img-element */

const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  basic: 'საბაზისო ანგარიში',
  'full-collection': 'სრული კოლექციის ანგარიში',
  og: 'OG ანგარიში',
  premium: 'პრემიუმ ანგარიში',
  ranked: 'რეიტინგული ანგარიში',
  rare: 'იშვიათი ანგარიში',
}

export function normalizeAccountStatus(value: unknown): string {
  const status = String(value ?? 'basic').trim().toLowerCase()
  const normalized = status === 'fullcollection' ? 'full-collection' : status
  return ACCOUNT_STATUS_LABEL[normalized] ? normalized : 'basic'
}

export function accountStatusLabel(value: unknown): string {
  return ACCOUNT_STATUS_LABEL[normalizeAccountStatus(value)]
}

export function listingKind(listing: PublicListingSummary): 'account' | 'skin' | 'item' | 'service' | 'key' {
  if (listing.type === ListingType.Service) return 'service'
  if (listing.type === ListingType.DigitalKey) return 'key'
  if (listing.itemAttributes?.kind === 'skin' || listing.category?.slug === 'skins') return 'skin'
  if (listing.itemAttributes?.kind === 'item' || listing.category?.slug === 'items') return 'item'
  return 'account'
}

export function listingPrice(listing: PublicListingSummary): number {
  return listing.startingPriceWaveCoin ?? listing.priceWaveCoin ?? 0
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function count(value: number) {
  return value.toLocaleString('en-US')
}

function SaveButton({ listing, className, onCount }: { listing: PublicListingSummary; className: string; onCount: (n: number) => void }) {
  const { isFavorite, toggle } = useFavorites()
  const saved = isFavorite(listing.id)
  return (
    <button
      className={`${className}${saved ? ' saved' : ''}`}
      type="button"
      aria-label="Save product"
      aria-pressed={saved}
      title="Save product"
      onClick={async (event) => {
        event.preventDefault()
        event.stopPropagation()
        const next = await toggle(listing.id)
        if (next !== null) onCount(next)
      }}
    />
  )
}

export default function ProductCard({ listing, sellerRank, sellerTier }: { listing: PublicListingSummary; sellerRank?: number; sellerTier?: string }) {
  const router = useRouter()
  const cart = useCart()
  const [favoriteCount, setFavoriteCount] = useState(listing.favoriteCount)
  const kind = listingKind(listing)
  const attrs = listing.itemAttributes ?? {}
  const href = `/listings/${listing.id}`
  const gameName = listing.game?.name ?? 'Marketplace'
  // The seller's own photo first (the first one is the cover); the game art only when there is none.
  const image = listing.images[0]?.url ?? gameCover(listing.game?.slug)
  const sellerName = [listing.seller.firstName, listing.seller.lastName].filter(Boolean).join(' ') || listing.seller.username
  const price = listingPrice(listing)
  const canCart = listing.type !== ListingType.Service
  const inCart = cart.has(listing.id)

  const addToCart = () => {
    if (!canCart) {
      router.push(href)
      return
    }
    cart.add({
      listingId: listing.id,
      title: listing.title,
      priceWaveCoin: price,
      imageUrl: image,
      gameName: listing.game?.name ?? null,
      sellerUsername: listing.seller.username,
      type: listing.type === ListingType.DigitalKey ? 'digital_key' : 'item',
    })
  }

  // One card shape for every listing type, so a mixed grid stays symmetrical (the prototype's
  // plain card only ever appeared beside showcase cards on its own mock data). Services and keys
  // carry their type in the badge/level line instead of an account rarity.
  const status = normalizeAccountStatus(attrs.accountStatus)
  const level = Number(attrs.accountLevel) || 0
  const rating = listing.ratingAvg ? Number(listing.ratingAvg) : null
  const kindBadge =
    kind === 'account' ? accountStatusLabel(status) : kind === 'skin' ? 'სკინი' : kind === 'item' ? 'ნივთი' : kind === 'key' ? 'Steam გასაღები' : listing.category?.name ?? 'სერვისი'
  const kindLine = level ? `✪ ლეველი ${count(level)}` : kind === 'account' ? 'ანგარიში' : kind === 'skin' ? 'სკინი' : kind === 'item' ? 'ნივთი' : kind === 'key' ? 'ციფრული გასაღები' : 'სერვისი'
  // Keys are delivered on purchase; a service's delivery time depends on the package chosen.
  const delivery = kind === 'service' ? 'პაკეტის მიხედვით' : kind === 'key' ? 'მყისიერი' : deliveryTimeLabel(String(attrs.deliveryTime || 'მყისიერი'))
  const openDetail = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('a, button')) return
    router.push(href)
  }
  // Design 2026-10-07 (client "secondproblemfix", 1:1): photo on top with the game + rarity badges
  // and the heart; below it the title, level, the seller (photo, name, Wave tier · rating),
  // delivery, price with views / likes, and the cart + "View details" buttons.
  const [preview, setPreview] = useState(false)
  return (
    <article className={`marketplace-card pc-card pc-${kind}${kind === 'account' ? ` pc-rarity-${status}` : ''}`} data-listing-id={listing.id}>
      <div className={`pc-cover${image ? '' : ' is-empty'}`} style={image ? { backgroundImage: `url("${image}")` } : undefined} onClick={openDetail} data-game={initials(gameName)}>
        <div className="pc-badges">
          <span className="pc-badge pc-game">{gameName}</span>
          <span className="pc-badge pc-kind">
            {kind === 'account' && status === 'premium' && <span aria-hidden="true">♛</span>}
            {kindBadge}
          </span>
        </div>
        <SaveButton listing={listing} className="pc-heart" onCount={setFavoriteCount} />
      </div>

      <div className="pc-body">
        <h3 className="pc-title">
          <Link href={href}>{listing.title}</Link>
        </h3>
        <span className="pc-level">
          <img src="/assets/ui/level-bars.png" alt="" aria-hidden="true" />
          {kindLine.replace('✪ ', '')}
        </span>

        <div className="pc-seller">
          <button type="button" className="pc-seller-person" onClick={() => setPreview(true)} aria-label={`${sellerName} — პროფილის ნახვა`}>
            <span className="pc-avatar" style={listing.seller.avatarUrl ? { backgroundImage: `url("${listing.seller.avatarUrl}")` } : undefined}>
              {listing.seller.avatarUrl ? '' : initials(sellerName)}
            </span>
            <span className="pc-seller-copy">
              <strong>{sellerName}</strong>
              <small>{sellerTier ?? (sellerRank ? `Wave რანკი #${sellerRank}` : 'Wave რანკი: ჯერ არ აქვს')}</small>
            </span>
          </button>
          <span className="pc-rating">
            <b aria-hidden="true">★</b>
            {rating === null ? 'ახალი' : `${rating.toFixed(1)} · ${count(listing.ratingCount)} შეფასება`}
          </span>
        </div>

        <span className="pc-delivery">
          <b aria-hidden="true">⚡</b> მიწოდება — {delivery}
        </span>

        <div className="pc-price-row">
          <strong className="pc-price">
            {kind === 'service' && <small>დან </small>}
            {count(price)} GEL
          </strong>
          <span className="pc-social">
            <span title="ნახვები">
              <img src="/assets/ui/eye.png" alt="" aria-hidden="true" />
              {count(listing.viewsCount)}
            </span>
            <i aria-hidden="true" />
            <span title="მოწონებები" className="pc-likes">
              <img src="/assets/ui/heart.png" alt="" aria-hidden="true" />
              {count(favoriteCount)}
            </span>
          </span>
        </div>

        <div className="pc-actions">
          <button
            className={`pc-cart${inCart ? ' in-cart' : ''}`}
            type="button"
            aria-label={canCart ? 'კალათაში დამატება' : 'პაკეტის არჩევა'}
            aria-pressed={canCart ? inCart : undefined}
            onClick={(event) => {
              event.preventDefault()
              addToCart()
            }}
          >
            <img src="/assets/ui/cart-white.png" alt="" aria-hidden="true" />
          </button>
          <Link className="pc-details" href={href}>
            დეტალების ნახვა <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
      {preview && <SellerPreview username={listing.seller.username} onClose={() => setPreview(false)} />}
    </article>
  )
}
