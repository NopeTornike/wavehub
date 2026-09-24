import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicListingSummary, SellerRanks } from '@wavehub/shared-types'
import Layout from '../components/Layout'
import ProductCard from '../components/ProductCard'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFavorites } from '../lib/favorites'

// The prototype's Favorites view (marketplace.html with body.favorites-view — same head/grid, the
// kicker/title/count relabelled "Your personal collection" / "Favorites" / "saved items"), on the
// real favourites API. Un-saving a card here removes it from the grid immediately, like the
// prototype's view does.
export default function Favorites() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const { ids } = useFavorites()
  const [items, setItems] = useState<PublicListingSummary[] | null>(null)
  const [ranks, setRanks] = useState<SellerRanks>({})
  const [error, setError] = useState('')
  const userId = user?.id

  useEffect(() => {
    if (checked && !userId) router.replace('/login?next=/favorites')
  }, [checked, userId, router])

  useEffect(() => {
    if (!userId) return
    api
      .listFavorites()
      .then(setItems)
      .catch((err) => {
        setItems([])
        setError(errorMessage(err, 'რჩეულების ჩატვირთვა ვერ მოხერხდა.'))
      })
    api.getSellerRanks().then(setRanks).catch(() => undefined)
  }, [userId])

  const visible = (items ?? []).filter((listing) => ids.has(listing.id))

  return (
    <Layout title="რჩეულები" noIndex bodyClass="favorites-view">
      <section className="marketplace-head" aria-labelledby="marketplaceTitle">
        <div>
          <p className="section-kicker">შენი პირადი კოლექცია</p>
          <h1 id="marketplaceTitle">რჩეულები</h1>
        </div>
        <div className="marketplace-total" aria-label="შენახული ნივთები">
          <strong id="marketplaceCount">{visible.length}</strong>
          <span>შენახული ნივთები</span>
        </div>
      </section>

      <section className="marketplace-list-section" aria-labelledby="marketplaceListTitle">
        <div className="section-heading">
          <div>
            <p className="section-kicker">მოგვიანებით შენახული</p>
            <h2 id="marketplaceListTitle">შენი კოლექცია</h2>
          </div>
        </div>
        {error && (
          <p className="status-text status-error" role="alert">
            {error}
          </p>
        )}
        <div className="marketplace-grid" id="marketplaceGrid">
          {visible.map((listing) => (
            <ProductCard key={listing.id} listing={listing} sellerRank={ranks[listing.seller.username]} />
          ))}
        </div>
        <div className="marketplace-empty" id="marketplaceEmpty" hidden={items !== null && visible.length > 0}>
          {items === null ? (
            'იტვირთება…'
          ) : (
            <>
              შენახული პროდუქტები ჯერ არ გაქვს. <Link href="/marketplace">დაათვალიერე მარკეტი</Link> და დააჭირე ♡-ს.
            </>
          )}
        </div>
      </section>
    </Layout>
  )
}
