/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { TournamentLeaderboardEntry } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api } from '../../lib/api'
import { countryLabel, countryName, flagEmoji } from '../../lib/countries'
import { useShell } from '../../lib/shell'
import { TIcon } from '../../lib/tournaments'

// Tournament Ranking — Top 10 (owner 2026-11-19, the "TOURNAMENT RANKING / TOP 10" screen): players
// and teams on separate tabs, each row = place, photo / logo, name, "nickname", country flag + code,
// and the W-L-D record. The layout follows the screen; colours are the site's pink / violet, with
// gold / silver / bronze only for places 1–3. Every number is staff-entered in Admin → Tournaments →
// Leaderboard (the same switch hides this page's rows).

type Kind = 'player' | 'team'
type State = { visible: boolean; entries: TournamentLeaderboardEntry[] } | null

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

export default function TournamentRanking() {
  const router = useRouter()
  const { games } = useShell()
  const kind: Kind = router.query.kind === 'team' ? 'team' : 'player'
  const gameId = typeof router.query.game === 'string' ? router.query.game : ''
  const [data, setData] = useState<{ key: string; value: State }>({ key: '', value: null })
  const key = `${kind}:${gameId}`

  useEffect(() => {
    if (!router.isReady) return
    let alive = true
    api
      .getTournamentRanking(kind, gameId || undefined)
      .then((value) => alive && setData({ key, value }))
      .catch(() => alive && setData({ key, value: { visible: true, entries: [] } }))
    return () => {
      alive = false
    }
  }, [router.isReady, kind, gameId, key])

  const go = (next: { kind?: Kind; game?: string }) => {
    const query: Record<string, string> = {}
    const k = next.kind ?? kind
    const g = next.game ?? gameId
    if (k === 'team') query.kind = 'team'
    if (g) query.game = g
    void router.replace({ pathname: '/tournaments/ranking', query }, undefined, { shallow: true, scroll: false })
  }

  const state = data.key === key ? data.value : null

  return (
    <Layout title="Tournament Ranking" description="WaveHubX Tournament Ranking — Top 10 players and teams.">
      <section className="trk-page">
        <Link className="wt-back" href="/tournaments">
          <TIcon name="back" /> ტურნირები
        </Link>

        <header className="trk-head">
          <span className="trk-brand">
            WAVEHUB<em>X</em>
            <small>ESPORTS</small>
          </span>
          <h1>Tournament Ranking</h1>
          <span className="trk-ribbon">
            <i aria-hidden="true"></i>
            <b>Top 10</b>
            <i aria-hidden="true"></i>
          </span>
        </header>

        <div className="trk-controls">
          <div className="trk-tabs" role="tablist" aria-label="Ranking">
            {(['player', 'team'] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'active' : undefined} onClick={() => go({ kind: k })}>
                <TIcon name={k === 'player' ? 'user' : 'users'} />
                {k === 'player' ? 'Players' : 'Teams'}
              </button>
            ))}
          </div>
          <label className="trk-filter">
            <TIcon name="gamepad" />
            <select value={gameId} onChange={(e) => go({ game: e.target.value })} aria-label="თამაში">
              <option value="">ყველა თამაში</option>
              {games.map((g) => (
                <option key={g.gameId} value={g.gameId}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {state === null ? (
          <div className="trk-empty">იტვირთება…</div>
        ) : !state.visible ? (
          <div className="trk-empty">
            <TIcon name="trophy" />
            <strong>რეიტინგი ჯერ არ არის გამოქვეყნებული</strong>
            <span>როცა ორგანიზატორი გამოაქვეყნებს, Top 10 აქ გამოჩნდება.</span>
          </div>
        ) : state.entries.length === 0 ? (
          <div className="trk-empty">
            <TIcon name="trophy" />
            <strong>{kind === 'player' ? 'მოთამაშეების' : 'გუნდების'} რეიტინგი ჯერ ცარიელია</strong>
            <span>{gameId ? 'ამ თამაშზე მონაცემები ჯერ არ არის.' : 'შედეგები გამოჩნდება ტურნირების შემდეგ.'}</span>
          </div>
        ) : (
          <ol className="trk-list">
            {state.entries.map((e, i) => (
              <RankRow key={e.id} entry={e} place={i + 1} />
            ))}
          </ol>
        )}
      </section>
    </Layout>
  )
}

function RankRow({ entry, place }: { entry: TournamentLeaderboardEntry; place: number }) {
  const name = entry.kind === 'player' ? (entry.fullName ?? entry.name) : entry.name
  const medal = place === 1 ? ' gold' : place === 2 ? ' silver' : place === 3 ? ' bronze' : ''
  const body = (
    <>
      <span className="trk-place">{place}</span>
      <span className={`trk-photo${entry.kind === 'team' ? ' logo' : ''}`}>
        {entry.imageUrl ? <img src={entry.imageUrl} alt="" loading="lazy" /> : <b>{initials(name)}</b>}
      </span>
      <span className="trk-who">
        <strong>{name}</strong>
        {entry.nickname && <em>“{entry.nickname}”</em>}
        <span className="trk-meta">
          {entry.country && (
            <span className="trk-country" title={countryName(entry.country)}>
              <i aria-hidden="true">{flagEmoji(entry.country)}</i>
              {countryLabel(entry.country)}
            </span>
          )}
          {entry.gameName && <small>{entry.gameName}</small>}
        </span>
      </span>
      <span className="trk-record">
        <b>
          {entry.wins}-{entry.losses}-{entry.draws}
        </b>
        <small>{entry.points.toLocaleString('en-US')} PTS</small>
      </span>
    </>
  )
  return (
    <li className={`trk-row${medal}`}>
      {entry.kind === 'player' && entry.username ? (
        <Link href={`/u/${entry.username}`} aria-label={`${place}. ${name}`}>
          {body}
        </Link>
      ) : (
        <div>{body}</div>
      )}
    </li>
  )
}
