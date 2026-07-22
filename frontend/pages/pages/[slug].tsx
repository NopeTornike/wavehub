import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicContentPage } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, ApiError } from '../../lib/api'

// Renders whatever the admin Content section publishes at this slug — see backend/src/content/.
// No static-prototype page exists for a generic legal/info page, so this reuses the listing
// detail page's .detail-section card styling rather than inventing new classes.
export default function ContentPage() {
  const router = useRouter()
  const { slug } = router.query as { slug?: string }

  const [page, setPage] = useState<PublicContentPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    api
      .getContentPage(slug)
      .then((data) => {
        if (!cancelled) setPage(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'გვერდი ვერ მოიძებნა.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  return (
    <Layout>
      <div className="detail-page">
        {loading ? (
          <div className="marketplace-empty">იტვირთება…</div>
        ) : error || !page ? (
          <div className="marketplace-empty">{error || 'გვერდი ვერ მოიძებნა.'}</div>
        ) : (
          <section className="detail-section detail-summary-card">
            <h1>{page.title}</h1>
            {page.body.split('\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </section>
        )}
      </div>
    </Layout>
  )
}
