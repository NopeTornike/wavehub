import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { MyTournamentEntry } from '@wavehub/shared-types'
import { TournamentTeamStatus } from '@wavehub/shared-types'
import Layout from '../../../components/Layout'
import { api, errorMessage } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { tournamentDates } from '../../../lib/tournaments'

// WaveHubX's community Discord (same link as the site footer).
const SITE_DISCORD = 'https://discord.gg/4nqVTBA4d'

// Shown right after registering for a tournament (client feedback #6): success, the start time,
// the community Discord, the team's details and a button to the tournament hub.
export default function TournamentRegistered() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const id = typeof router.query.id === 'string' ? router.query.id : ''
  const [entry, setEntry] = useState<MyTournamentEntry | null | undefined>(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    if (checked && !user) router.replace(`/login?next=/tournaments/${id}/registered`)
  }, [checked, user, router, id])

  useEffect(() => {
    if (!id || !user) return
    let cancelled = false
    api
      .listMyTournaments()
      .then((rows) => {
        if (!cancelled) setEntry(rows.find((r) => r.tournament.id === id) ?? null)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.'))
      })
    return () => {
      cancelled = true
    }
  }, [id, user])

  if (entry === undefined && !error) {
    return (
      <Layout title="რეგისტრაცია" noIndex>
        <div className="marketplace-empty">იტვირთება…</div>
      </Layout>
    )
  }

  if (!entry) {
    return (
      <Layout title="რეგისტრაცია" noIndex>
        <div className="marketplace-empty">
          {error || 'ამ ტურნირზე რეგისტრაცია ვერ მოიძებნა.'} <Link href={`/tournaments/${id}`}>ტურნირზე დაბრუნება</Link>
        </div>
      </Layout>
    )
  }

  const { tournament: t, team } = entry
  const squad = t.teamSize > 1
  const pending = team.status === TournamentTeamStatus.Pending
  // startDate is a plain date; staff enter the clock time separately (details.startTime). Going
  // through Date/toLocaleString printed "October 15, 2026 at 4:00 AM" (English, UTC midnight).
  const startTime = t.details?.startTime
  const checkIn = t.details?.checkInTime
  const solo = team.players[0]

  return (
    <Layout title={`რეგისტრაცია — ${t.name}`} noIndex>
      <section className="tr-done">
        <div className="tr-done-hero">
          <span className="tr-done-check" aria-hidden="true">✓</span>
          <p className="section-kicker">{t.gameName}</p>
          <h1>წარმატებით დარეგისტრირდი!</h1>
          <p>
            {pending
              ? 'გუნდი ელოდება ადმინისტრაციის დადასტურებას — დადასტურებისას შეტყობინებას მიიღებ.'
              : 'რეგისტრაცია დადასტურებულია — შეხვედრამდე ტურნირში!'}
          </p>
        </div>

        <dl className="tr-done-facts">
          <div>
            <dt>ტურნირი</dt>
            <dd>{t.name}</dd>
          </div>
          <div>
            <dt>დაწყება</dt>
            <dd>{startTime ? `${tournamentDates(t)} · ${startTime}` : tournamentDates(t)}</dd>
          </div>
          {checkIn && (
            <div>
              <dt>Check-in</dt>
              <dd>{checkIn}</dd>
            </div>
          )}
          <div>
            <dt>{squad ? 'გუნდი' : 'მოთამაშე'}</dt>
            <dd>{squad ? `${team.name}${team.tag ? ` [${team.tag}]` : ''} · ${team.members.length} მოთამაშე` : solo?.inGameName || team.members[0] || team.name}</dd>
          </div>
          <div>
            <dt>სტატუსი</dt>
            <dd className={pending ? 'pending' : 'ok'}>{pending ? 'დადასტურების მოლოდინში' : 'დადასტურებული'}</dd>
          </div>
          {team.discord && (
            <div>
              <dt>შენი Discord</dt>
              <dd>{team.discord}</dd>
            </div>
          )}
        </dl>

        <a className="tr-done-discord" href={SITE_DISCORD} target="_blank" rel="noopener noreferrer">
          <span aria-hidden="true">💬</span>
          <span>
            <strong>შემოუერთდი WaveHubX-ის Discord-ს</strong>
            <small>ტურნირის განცხადებები, მატჩების დრო და კომუნიკაცია ორგანიზატორებთან.</small>
          </span>
          <b aria-hidden="true">→</b>
        </a>

        <div className="tr-done-actions">
          <Link className="tr-done-primary" href="/tournaments/hub">
            ტურნირის დაფაზე გადასვლა <span aria-hidden="true">→</span>
          </Link>
          <Link className="tr-done-secondary" href={`/tournaments/${t.id}`}>
            ტურნირის გვერდი
          </Link>
        </div>
      </section>
    </Layout>
  )
}
