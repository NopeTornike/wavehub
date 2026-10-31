import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicTournamentSummary } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import TournamentBoard from '../../components/TournamentBoard'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useLanguage } from '../../lib/i18n'

// docs/design-mockups/02-my-tournaments.jpg — the tournaments the signed-in user registered a team for.
export default function MyTournaments() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const { language } = useLanguage()
  const userId = user?.id
  const [items, setItems] = useState<PublicTournamentSummary[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (checked && !user) router.replace('/login?next=/tournaments/mine')
  }, [checked, user, router])

  useEffect(() => {
    if (!userId) return
    api
      .listMyTournaments()
      .then((rows) => setItems(rows.map((row) => row.tournament)))
      .catch((err) => {
        setItems([])
        setError(errorMessage(err, 'ტურნირების ჩატვირთვა ვერ მოხერხდა.'))
      })
  }, [userId])

  return (
    <Layout title="ჩემი ტურნირები" noIndex>
      {error && (
        <p className="seller-status error" role="alert">
          {error}
        </p>
      )}
      <TournamentBoard
        title={language === 'en' ? 'My Tournaments' : 'ჩემი ტურნირები'}
        subtitle={language === 'en' ? 'Only tournaments you have registered for.' : 'მხოლოდ ტურნირები, რომლებზეც დარეგისტრირებული ხარ.'}
        tournaments={items}
        actions={
          <Link className="wt-head-link" href="/tournaments/hub">
            ტურნირის ჰაბი
          </Link>
        }
        emptyTitle={language === 'en' ? 'You are not registered for any tournaments yet.' : 'ჯერ არცერთ ტურნირში არ მონაწილეობ'}
        emptyText={
          <Link href="/tournaments">{language === 'en' ? 'Browse tournaments' : 'აირჩიე ტურნირი'}</Link>
        }
      />
    </Layout>
  )
}
