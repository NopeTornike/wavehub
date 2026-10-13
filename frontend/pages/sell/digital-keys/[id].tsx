import { useRouter } from 'next/router'
import { useEffect } from 'react'
import Layout from '../../../components/Layout'

// Forwards the old per-game address to Admin → Steam → game (2026-10-07).
export default function SellDigitalKeyRedirect() {
  const router = useRouter()
  const id = typeof router.query.id === 'string' ? router.query.id : ''
  useEffect(() => {
    if (id) void router.replace(`/admin/steam/${id}`)
  }, [id, router])
  return (
    <Layout title="Steam თამაში" noIndex>
      <div className="detail-page">
        <div className="marketplace-empty">იტვირთება…</div>
      </div>
    </Layout>
  )
}
