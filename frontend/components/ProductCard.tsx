import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { ListingType, type PublicListingSummary } from '@wavehub/shared-types'
import { useCart } from '../lib/cart'
import { useFavorites } from '../lib/favorites'
import { gameCover } from '../lib/games'

// The prototype's marketplace cards (marketplace.js#createProductShowcaseCard for accounts/skins,
// #createMarketplaceCard for everything else), on real listing data:
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

export function listingKind(listing: PublicListingSummary): 'account' | 'skin' | 'service' | 'key' {
  if (listing.type === ListingType.Service) return 'service'
  if (listing.type === ListingType.DigitalKey) return 'key'
  if (listing.itemAttributes?.kind === 'skin' || listing.category?.slug === 'skins') return 'skin'
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

export default function ProductCard({ listing, sellerRank }: { listing: PublicListingSummary; sellerRank?: number }) {
  const router = useRouter()
  const cart = useCart()
  const [favoriteCount, setFavoriteCount] = useState(listing.favoriteCount)
  const kind = listingKind(listing)
  const attrs = listing.itemAttributes ?? {}
  const href = `/listings/${listing.id}`
  const gameName = listing.game?.name ?? 'Marketplace'
  const image = gameCover(listing.game?.slug, listing.images[0]?.url ?? null)
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

  if (kind === 'account' || kind === 'skin') {
    const status = normalizeAccountStatus(attrs.accountStatus)
    const level = Number(attrs.accountLevel) || 0
    const rating = listing.ratingAvg ? Number(listing.ratingAvg) : null
    return (
      <article className={`marketplace-card product-showcase-card ${kind}-showcase-card${kind === 'account' ? ` account-status-${status}` : ''}`} data-listing-id={listing.id}>
        <div className={`product-showcase-cover${image ? ' has-image' : ''}`} data-game={initials(gameName)} style={image ? { backgroundImage: `url("${image}")` } : undefined}>
          <div className="product-showcase-badges">
            <span className="showcase-badge showcase-game-badge">{gameName}</span>
            <span className="showcase-badge showcase-badge-gold">{kind === 'account' ? accountStatusLabel(status) : 'სკინი'}</span>
          </div>
          <SaveButton listing={listing} className="save-button product-showcase-save" onCount={setFavoriteCount} />
          <div className="product-showcase-cover-info">
            <h3>
              <Link href={href}>{listing.title}</Link>
            </h3>
            <span className="product-showcase-level">{level ? `✪ Level ${count(level)}` : kind === 'account' ? 'ანგარიში' : 'სკინი'}</span>
          </div>
        </div>

        <div className="product-showcase-body">
          <Link className="product-showcase-seller" href={`/u/${listing.seller.username}`} aria-label={`${sellerName} — public profile`}>
            <span className="product-showcase-avatar">{initials(sellerName)}</span>
            <span>
              <strong>{sellerName}</strong>
              <small className="product-showcase-seller-rank">{sellerRank ? `Wave Rank #${sellerRank}` : 'Wave Rank: Unranked'}</small>
              <small className="product-showcase-seller-rating">
                {rating === null ? '★ No product reviews' : `★ ${rating.toFixed(1)} · ${count(listing.ratingCount)} reviews`}
              </small>
            </span>
          </Link>
        </div>

        <div className="product-showcase-footer">
          <strong className="product-showcase-price">{count(price)} WC</strong>
          <span className="product-showcase-social">
            <span>◉ {count(listing.viewsCount)}</span>
            <span>♡ {count(favoriteCount)}</span>
          </span>
          <span className="product-showcase-delivery">⚡ Delivery — {String(attrs.deliveryTime || 'მყისიერი')}</span>
          <div className="product-showcase-icon-actions">
            <button
              className={`product-showcase-cart${inCart ? ' in-cart' : ''}`}
              type="button"
              aria-label="Add product to cart"
              aria-pressed={inCart}
              onClick={(event) => {
                event.preventDefault()
                addToCart()
              }}
            >
              <img className="cart-icon-image" src="/assets/cart-icon.png" alt="" aria-hidden="true" />
            </button>
          </div>
          <button className="product-showcase-details" type="button" onClick={() => router.push(href)}>
            დეტალების ნახვა
          </button>
        </div>
      </article>
    )
  }

  // Services and digital keys: the prototype's plain marketplace card.
  const cover = listing.images[0]?.url ?? image
  return (
    <article className="marketplace-card" data-listing-id={listing.id}>
      {cover && (
        <Link href={href} className="marketplace-card-cover" aria-label={listing.title} style={{ backgroundImage: `linear-gradient(180deg, rgba(5, 8, 19, 0.02), rgba(5, 8, 19, 0.32)), url("${cover}")` }} />
      )}
      <div className="marketplace-card-top">
        <span className={`service-tag ${kind === 'service' ? 'hot' : 'event'}`}>{kind === 'service' ? listing.category?.name ?? 'სერვისი' : 'გასაღები'}</span>
        <div className="marketplace-card-actions">
          <strong>
            {kind === 'service' ? 'დან ' : ''}
            {count(price)} WC
          </strong>
          <SaveButton listing={listing} className="save-button" onCount={setFavoriteCount} />
        </div>
      </div>
      <h3>
        <Link href={href}>{listing.title}</Link>
      </h3>
      <p>
        ◉ {count(listing.viewsCount)} · ♡ {count(favoriteCount)}
        {listing.ratingCount > 0 && listing.ratingAvg ? ` · ★ ${Number(listing.ratingAvg).toFixed(1)}` : ''}
      </p>
      <div className="marketplace-card-meta">
        <span className="avatar avatar-blue">{initials(gameName)}</span>
        <Link href={`/u/${listing.seller.username}`}>
          {gameName} / {sellerName}
        </Link>
        <button type="button" onClick={addToCart}>
          {kind === 'service' ? 'შეკვეთა' : inCart ? 'კალათაშია' : 'ყიდვა'}
        </button>
      </div>
    </article>
  )
}
