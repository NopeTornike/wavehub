import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { TournamentStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { TIcon } from '../../lib/tournaments'

// "Tournament Dashboard" from the profile menu (owner 2026-11-19): opens the dashboard of the
// viewer's current tournament (the one the hub picks: the first not completed, else the latest);
// without a registration, the first in-progress / open / upcoming tournament's dashboard.
export default function TournamentDashboardShortcut() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const [none, setNone] = useState(false)

  useEffect(() => {
    if (!checked) return
    let alive = true
    const go = (id: string) => alive && router.replace(`/tournaments/${id}/dashboard`)
    const fallback = async () => {
      for (const status of [TournamentStatus.InProgress, TournamentStatus.Open, TournamentStatus.Upcoming]) {
        const page = await api.browseTournaments({ status, limit: 1 }).catch(() => null)
        const first = page?.items?.[0]
        if (first) return go(first.id)
      }
      if (alive) setNone(true)
    }
    if (!user) {
      void fallback()
    } else {
      api
        .listMyTournaments()
        .then((rows) => {
          const pick = rows.find((r) => r.tournament.status !== TournamentStatus.Completed) ?? rows[0]
          return pick ? go(pick.tournament.id) : fallback()
        })
        .catch(() => fallback())
    }
    return () => {
      alive = false
    }
  }, [checked, user, router])

  return (
    <Layout title="Tournament Dashboard" noIndex>
      <section className="wt-page td-page">
        {none ? (
          <div className="wt-empty">
            <TIcon name="trophy" />
            <strong>აქტიური ტურნირი ჯერ არ არის</strong>
            <p>
              <Link href="/tournaments">ნახე ტურნირები</Link> — დაშბორდი გამოჩნდება, როცა ტურნირი გამოქვეყნდება.
            </p>
          </div>
        ) : (
          <div className="marketplace-empty">იტვირთება…</div>
        )}
      </section>
    </Layout>
  )
}
