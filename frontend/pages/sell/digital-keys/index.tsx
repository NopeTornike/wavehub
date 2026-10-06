import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import Layout from '../../../components/Layout'
import { useAuth } from '../../../lib/auth'
import { canPublishSteam } from '../../../lib/roles'

// Steam games are managed in Admin → Steam (/admin/steam) since 2026-10-07 — this old address
// forwards staff there (bookmarks, older links) and tells everyone else it's staff-only.
export default function SellDigitalKeysRedirect() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const staff = !!user && canPublishSteam(user)

  useEffect(() => {
    if (!checked) return
    if (!user) void router.replace('/login?next=/admin/steam')
    else if (staff) void router.replace('/admin/steam')
  }, [checked, user, staff, router])

  return (
    <Layout title="Steam თამაშები" noIndex>
      <div className="detail-page">
        <div className="marketplace-empty">
          {!checked || staff ? (
            'იტვირთება…'
          ) : (
            <>
              Steam თამაშებს მხოლოდ WaveHub-ის ადმინისტრაცია ამატებს. <Link href="/steam-keys">Steam თამაშების ნახვა</Link>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
