import { useRouter } from 'next/router'
import { useEffect } from 'react'
import Layout from '../../../components/Layout'
import ListingEditor from '../../../components/ListingEditor'
import { useAuth } from '../../../lib/auth'

// The seller's full editor for their own item listing (title, price, description, game details,
// photos). Services and Steam keys have their own manage pages; the editor links there.
export default function EditMyItem() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const id = typeof router.query.id === 'string' ? router.query.id : ''

  useEffect(() => {
    if (checked && !user && id) router.replace(`/login?next=/sell/items/${id}`)
  }, [checked, user, id, router])

  return (
    <Layout title="განცხადების რედაქტირება" noIndex>
      <div className="detail-page">{user && id ? <ListingEditor listingId={id} mode="owner" /> : <div className="marketplace-empty">იტვირთება…</div>}</div>
    </Layout>
  )
}
