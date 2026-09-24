import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PublicTournamentSummary } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import TournamentBoard from '../../components/TournamentBoard'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'

// Every tournament, in the docs/design-mockups/02 board layout. Signed-in users get shortcuts to
// their own tournaments and the hub.
export default function Tournaments() {
  const { user } = useAuth()
  const [items, setItems] = useState<PublicTournamentSummary[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .browseTournaments({ limit: 100 })
      .then((res) => setItems(res.items))
      .catch((err) => {
        setItems([])
        setError(errorMessage(err, 'ტურნირების ჩატვირთვა ვერ მოხერხდა.'))
      })
  }, [])

  return (
    <Layout title="ტურნირები" description="WaveHubX-ის აქტიური და დასრულებული ტურნირები — დარეგისტრირდი და იასპარეზე პრიზებისთვის.">
      {error && (
        <p className="seller-status error" role="alert">
          {error}
        </p>
      )}
      <TournamentBoard
        title="ტურნირები"
        subtitle="ნახე ყველა აქტიური და დასრულებული ტურნირი."
        tournaments={items}
        actions={
          user && (
            <>
              <Link className="wt-head-link" href="/tournaments/mine">
                ჩემი ტურნირები
              </Link>
              <Link className="wt-head-link" href="/tournaments/hub">
                ტურნირის ჰაბი
              </Link>
            </>
          )
        }
        emptyTitle="ტურნირი ჯერ არ არის"
        emptyText="ადმინისტრაციის მიერ დამატებული ახალი ჩემპიონატები აქ გამოჩნდება."
      />
    </Layout>
  )
}
