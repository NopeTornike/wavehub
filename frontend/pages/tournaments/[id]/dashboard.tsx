import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PublicTournamentMatch, PublicTournamentSummary, PublicTournamentTeam } from '@wavehub/shared-types'
import { TournamentMatchStage, TournamentMatchStatus } from '@wavehub/shared-types'
import Layout from '../../../components/Layout'
import {
  dayMonth,
  FinalistCard,
  InfoNote,
  Laurel,
  StageStepper,
  StandingsTable,
  StatusPill,
  tbilisiTime,
  TournamentBanner,
  TrophyArt,
} from '../../../components/tournaments/TournamentStages'
import type { StageKey, StepInfo } from '../../../components/tournaments/TournamentStages'
import { api, errorMessage } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { useShell } from '../../../lib/shell'
import { buildDashboard, ordinal } from '../../../lib/tournament-dashboard'
import type { Dashboard, DashStage } from '../../../lib/tournament-dashboard'
import { pollWhileVisible } from '../../../lib/visible-poll'
import { STAGE_LABEL, TeamMark, TIcon, tournamentCover } from '../../../lib/tournaments'

// Tournament Dashboard (owner 2026-11-14, Gio; docs/design-mockups/round-7/31, 34-38): the whole
// bracket of one tournament, moved here from the hub. Group Stage » Semifinals » Final stepper;
// group tables with the top N green; the semifinal table (battle royale) or knockout matches
// (versus / CS2); the final with its finalists and match time; the champion with the final
// standings once it's decided. Everything comes from recorded matches and results — empty stages
// show "TBD" or a note, never sample teams.

function stagePill(stage: DashStage) {
  if (stage.live) return <StatusPill kind="live" />
  if (stage.done) return <StatusPill kind="done" />
  return <StatusPill kind="upcoming" />
}

// "Match 3/3": the one being played while live, else how many are done.
function matchCount(stage: DashStage) {
  if (!stage.total) return null
  return `Match ${Math.min(stage.total, stage.played + (stage.live ? 1 : 0))}/${stage.total}`
}

export default function TournamentDashboard() {
  const router = useRouter()
  const id = typeof router.query.id === 'string' ? router.query.id : undefined
  const { user } = useAuth()
  const { games } = useShell()
  const userId = user?.id
  const [tournament, setTournament] = useState<PublicTournamentSummary | null>(null)
  const [matches, setMatches] = useState<PublicTournamentMatch[]>([])
  const [teams, setTeams] = useState<PublicTournamentTeam[]>([])
  const [mine, setMine] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [view, setView] = useState<StageKey | null>(null)
  const [groupPick, setGroupPick] = useState<number | null>(null)

  const load = useCallback(() => {
    if (!id) return
    Promise.all([api.getTournament(id), api.listTournamentMatches(id), api.listTournamentTeams(id).catch(() => [] as PublicTournamentTeam[])])
      .then(([t, m, teamRows]) => {
        setTournament(t)
        setMatches(m)
        setTeams(teamRows)
        setError('')
      })
      .catch((err) => setError(errorMessage(err, 'ტურნირი ვერ ჩაიტვირთა.')))
  }, [id])

  useEffect(() => {
    load()
    return pollWhileVisible(load, 60_000)
  }, [load])

  useEffect(() => {
    if (!userId) return
    api
      .listMyTournaments()
      .then((rows) => setMine(new Set(rows.map((r) => r.team.id))))
      .catch(() => undefined)
  }, [userId])

  const slugById = useMemo(() => new Map(games.map((g) => [g.gameId, g.slug])), [games])
  const dash = useMemo(() => (tournament ? buildDashboard(tournament, matches, teams) : null), [tournament, matches, teams])

  // Open on the stage being played; the group tab on the viewer's own group.
  const defaultView: StageKey = !dash ? 'group' : dash.phase === 'group' ? 'group' : dash.phase === 'semifinal' ? 'semifinal' : 'final'
  const active = view ?? defaultView
  const myGroup = dash ? dash.groups.findIndex((g) => g.rows.some((r) => mine.has(r.team.id))) : -1
  const groupIndex = groupPick ?? Math.max(0, myGroup)

  if (!tournament || !dash) {
    return (
      <Layout title="Tournament Dashboard">
        <section className="wt-page td-page">
          {error ? (
            <div className="wt-empty">
              <strong>{error}</strong>
              <p>
                <Link href="/tournaments">ტურნირები</Link>
              </p>
            </div>
          ) : (
            <div className="marketplace-empty">იტვირთება…</div>
          )}
        </section>
      </Layout>
    )
  }

  const versus = dash.format === 'versus'
  const semiLabel = versus && dash.knockouts.some((k) => k.stage !== TournamentMatchStage.SemiFinal) ? 'Playoffs' : 'Semifinals'
  const steps: StepInfo[] = [
    { key: 'group', label: 'Group Stage', icon: 'users', done: dash.groupDone },
    { key: 'semifinal', label: semiLabel, icon: 'trophy', done: versus ? dash.knockouts.length > 0 && dash.knockouts.every((k) => k.done) : dash.semifinal.done },
    { key: 'final', label: 'Final', icon: 'crown', done: !!dash.champion },
  ]
  const cover = tournamentCover(tournament, slugById)
  const select = (key: StageKey) => setView(key)

  return (
    <Layout title={`${tournament.name} — Tournament Dashboard`}>
      <section className="wt-page td-page">
        <Link className="wt-back" href={`/tournaments/${tournament.id}`}>
          <TIcon name="back" /> ტურნირზე დაბრუნება
        </Link>
        <TournamentBanner tournament={tournament} cover={cover} stats={{ teams: dash.teamCount, groups: dash.groups.length }} />
        <StageStepper steps={steps} active={active} onSelect={select} />

        {active === 'group' && (
          <>
            <GroupStage dash={dash} tournament={tournament} mine={mine} index={Math.min(groupIndex, Math.max(0, dash.groups.length - 1))} onIndex={setGroupPick} />
            <button type="button" className="td-link-card" onClick={() => select('semifinal')}>
              <TIcon name="trophy" className="td-link-icon" />
              <span>
                <strong>{semiLabel}</strong>
                <small>
                  {versus
                    ? `Top ${dash.groupAdvance} from each group — knockout matches`
                    : dash.groups.length
                      ? `${dash.groupAdvance * dash.groups.length} Teams (${dash.groupAdvance} from each group)`
                      : `Top ${dash.groupAdvance} from each group`}
                </small>
              </span>
              {stagePill(versus ? (dash.knockouts[dash.knockouts.length - 1] ?? dash.semifinal) : dash.semifinal)}
              <TIcon name="chevron" className="td-link-arrow" />
            </button>
            <button type="button" className="td-link-card" onClick={() => select('final')}>
              <TIcon name="crown" className="td-link-icon" />
              <span>
                <strong>Final</strong>
                <small>Championship Match</small>
              </span>
              {dash.final.live ? (
                <StatusPill kind="live" />
              ) : dash.champion ? (
                <StatusPill kind="done" />
              ) : dash.final.next ? (
                <span className="td-pill plain">
                  <TIcon name="calendar" />
                  {dayMonth(dash.final.next)}
                </span>
              ) : (
                <StatusPill kind="upcoming" />
              )}
              <TIcon name="chevron" className="td-link-arrow" />
            </button>
            <FormatCard dash={dash} />
          </>
        )}

        {active === 'semifinal' && (versus ? <Knockouts dash={dash} mine={mine} /> : <Semifinal dash={dash} mine={mine} />)}

        {active === 'final' && (dash.champion ? <Champion dash={dash} tournamentId={tournament.id} mine={mine} /> : <Final dash={dash} />)}
      </section>
    </Layout>
  )
}

function GroupStage({ dash, tournament, mine, index, onIndex }: { dash: Dashboard; tournament: PublicTournamentSummary; mine: Set<string>; index: number; onIndex: (i: number) => void }) {
  const group = dash.groups[index] ?? null
  const qualify = dash.format === 'versus' && tournament.qualifyPoints ? ` (${tournament.qualifyPoints}+ Pts)` : ''
  const count = matchCount(group ?? { rows: [], played: 0, total: 0, live: false, done: false, next: null })
  return (
    <section className="td-card td-groups">
      <header className="td-card-head">
        <TIcon name="users" className="td-head-icon" />
        <span>
          <h2>Group Stage</h2>
          <small>
            Top {dash.groupAdvance}
            {qualify} advance <TIcon name="info" />
          </small>
        </span>
        <span className="td-head-meta">
          {dash.groups.length} {dash.groups.length === 1 ? 'Group' : 'Groups'} <i aria-hidden="true">•</i> {dash.teamCount} Teams
        </span>
      </header>

      {!group ? (
        <p className="td-empty">ჯგუფები გამოჩნდება, როცა ადმინისტრაცია გუნდებს ჯგუფებში გაანაწილებს.</p>
      ) : (
        <>
          <div className="td-tabs" role="tablist" aria-label="ჯგუფები">
            {dash.groups.map((g, i) => (
              <button key={g.name} type="button" role="tab" aria-selected={i === index} className={i === index ? 'active' : undefined} onClick={() => onIndex(i)}>
                Group {g.name}
              </button>
            ))}
          </div>
          <div className="td-group">
            <header>
              <h3>
                Group {group.name}
                {!group.live && <span> — Standings</span>}
              </h3>
              {group.live && <StatusPill kind="live" />}
              {count && <span className="td-pill plain end">{count}</span>}
            </header>
            {group.rows.length ? (
              <StandingsTable rows={group.rows} advance={dash.groupAdvance} mine={mine} label={`Group ${group.name}`} />
            ) : (
              <p className="td-empty">ამ ჯგუფში გუნდები ჯერ არ არის.</p>
            )}
          </div>
          <InfoNote>
            Top {dash.groupAdvance} teams{qualify} advance to the {dash.format === 'versus' ? 'Playoffs' : 'Semifinals'}.
          </InfoNote>
          {dash.groups.length > 1 && (
            <div className="td-pager">
              <button type="button" aria-label="წინა ჯგუფი" disabled={index === 0} onClick={() => onIndex(index - 1)}>
                <TIcon name="chevronLeft" />
              </button>
              <span className="td-dots" aria-hidden="true">
                {dash.groups.map((g, i) => (
                  <i key={g.name} className={i === index ? 'on' : undefined}></i>
                ))}
              </span>
              <button type="button" aria-label="შემდეგი ჯგუფი" disabled={index >= dash.groups.length - 1} onClick={() => onIndex(index + 1)}>
                <TIcon name="chevron" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function FormatCard({ dash }: { dash: Dashboard }) {
  const sizes = dash.groups.map((g) => g.rows.length)
  const even = sizes.length > 0 && sizes.every((n) => n === sizes[0])
  const groupsText = dash.groups.length ? (even ? `${dash.groups.length} groups × ${sizes[0]} teams.` : `${dash.groups.length} groups, ${dash.teamCount} teams.`) : 'Groups are drawn after registration.'
  const text =
    dash.format === 'versus'
      ? `${groupsText} Top ${dash.groupAdvance} from each group advance to the knockout Playoffs; the winner of the Final is the Champion.`
      : `${groupsText} Top ${dash.groupAdvance} from each group${dash.groups.length ? ` (${dash.groupAdvance * dash.groups.length} teams)` : ''} advance to the Semifinals, then the top ${dash.semifinalAdvance} play the Final. Points: placement + 1 per kill.`
  return (
    <section className="td-format">
      <TIcon name="info" />
      <span>
        <strong>Tournament Format</strong>
        <small>{text}</small>
      </span>
    </section>
  )
}

function TitleWithLaurels({ title, sub }: { title: string; sub: string }) {
  return (
    <span className="td-laurel-title">
      <Laurel />
      <span>
        <h2>{title}</h2>
        <small>
          {sub} <TIcon name="info" />
        </small>
      </span>
      <Laurel flip />
    </span>
  )
}

function Semifinal({ dash, mine }: { dash: Dashboard; mine: Set<string> }) {
  const s = dash.semifinal
  const count = matchCount(s)
  return (
    <section className="td-card td-semi">
      <header className="td-stage-head">
        <TitleWithLaurels title="Semifinals" sub={`${s.rows.length || dash.groupAdvance * dash.groups.length} Teams (Top ${dash.semifinalAdvance} Advance)`} />
        <span className="td-stage-pills">
          {stagePill(s)}
          {count && <span className="td-pill plain">{count}</span>}
        </span>
      </header>
      {s.rows.length ? (
        <StandingsTable rows={s.rows} advance={dash.semifinalAdvance} mine={mine} label="Semifinals" />
      ) : (
        <p className="td-empty">ნახევარფინალის გუნდები გამოჩნდება ჯგუფური ეტაპის დასრულების შემდეგ.</p>
      )}
      <InfoNote strong>Top {dash.semifinalAdvance} teams advance to the Final.</InfoNote>
    </section>
  )
}

// Versus playoffs: the knockout matches as they are (CS2 keeps its own match cards — round-7/39).
function Knockouts({ dash, mine }: { dash: Dashboard; mine: Set<string> }) {
  if (!dash.knockouts.length) {
    return (
      <section className="td-card">
        <TitleWithLaurels title="Playoffs" sub={`Top ${dash.groupAdvance} from each group`} />
        <p className="td-empty">პლეიოფის მატჩები გამოჩნდება ჯგუფური ეტაპის დასრულების შემდეგ.</p>
      </section>
    )
  }
  return (
    <>
      {dash.knockouts.map((k) => (
        <section key={k.stage} className="td-card td-semi">
          <header className="td-stage-head">
            <TitleWithLaurels title={k.stage === TournamentMatchStage.SemiFinal ? 'Semifinals' : STAGE_LABEL[k.stage]} sub={`${k.matches.length} ${k.matches.length === 1 ? 'Match' : 'Matches'} (Winners Advance)`} />
            <span className="td-stage-pills">
              {stagePill(k)}
              {matchCount(k) && <span className="td-pill plain">{matchCount(k)}</span>}
            </span>
          </header>
          <div className="td-ko">
            {k.matches.map((m) => (
              <KnockoutMatch key={m.id} m={m} mine={mine} />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

function KnockoutMatch({ m, mine }: { m: PublicTournamentMatch; mine: Set<string> }) {
  const started = m.status !== TournamentMatchStatus.Scheduled && m.scoreA !== null && m.scoreB !== null
  const won = (side: 'a' | 'b') => m.status === TournamentMatchStatus.Completed && started && (side === 'a' ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!)
  return (
    <Link className="td-ko-match" href={`/tournaments/${m.tournamentId}/matches/${m.id}`}>
      {(['a', 'b'] as const).map((side) => {
        const team = side === 'a' ? m.teamA : m.teamB
        return (
          <span key={side} className={`td-ko-team${won(side) ? ' won' : ''}${team && mine.has(team.id) ? ' mine' : ''}`}>
            <TeamMark team={team} />
            <strong>{team?.name ?? 'TBD'}</strong>
            <b>{started ? (side === 'a' ? m.scoreA : m.scoreB) : ''}</b>
          </span>
        )
      })}
      <small>
        {m.status === TournamentMatchStatus.Live ? <StatusPill kind="live" /> : m.scheduledAt ? `${dayMonth(m.scheduledAt)} • ${tbilisiTime(m.scheduledAt)}` : 'TBA'}
      </small>
    </Link>
  )
}

function Final({ dash }: { dash: Dashboard }) {
  const f = dash.final
  const versus = dash.format === 'versus'
  const slots = Array.from({ length: Math.max(f.slots, f.teams.length) }, (_, i) => f.teams[i] ?? null)
  const sub = (teamId: string | undefined) => {
    const p = teamId ? dash.groupPlace[teamId] : undefined
    return p ? `Group ${p.group} – ${ordinal(p.place)}` : null
  }
  const when = f.match?.scheduledAt ?? f.next
  return (
    <>
      <section className="td-card td-final">
        <header className="td-final-head">
          <TIcon name="crown" className="td-final-crown" />
          <TitleWithLaurels title="Final" sub={`${slots.length} Teams (Championship)`} />
        </header>
        <InfoNote strong>{versus ? 'The winners of the Semifinals play the Final.' : `Top ${dash.semifinalAdvance} teams from the Semifinals advance to the Final.`}</InfoNote>
        <div className="td-trophy-scene" aria-hidden="true">
          <Laurel className="big" />
          <TrophyArt />
          <Laurel className="big" flip />
        </div>
        <div className={`td-finalists n${Math.min(slots.length, 4)}`}>
          {slots.map((team, i) => (
            <FinalistCard key={team?.id ?? `tbd-${i}`} team={team} sub={team ? sub(team.id) : 'TBD'} />
          ))}
        </div>
        <h3 className="td-divider">
          <TIcon name="crown" /> Final Match
        </h3>
        <div className="td-when">
          <span>
            <TIcon name="calendar" />
            {when ? dayMonth(when) : 'TBA'}
          </span>
          <span>
            <TIcon name="clock" />
            {when ? tbilisiTime(when) : 'TBA'}
          </span>
          {f.live ? <StatusPill kind="live" /> : <StatusPill kind="upcoming" />}
        </div>
        {!versus && f.played > 0 && <StandingsTable rows={f.rows} advance={0} label="Final" />}
      </section>
      <section className="td-card td-path">
        <h3>
          <TIcon name="path" /> Tournament Path
        </h3>
        <div className="td-path-row">
          <span className={`td-path-step${dash.groupDone ? ' done' : ''}`}>
            <span>
              Group Stage
              <small>({dash.teamCount} Teams)</small>
            </span>
            {dash.groupDone && <TIcon name="checkCircle" />}
          </span>
          <TIcon name="doubleChevron" className="td-path-sep" />
          <span className={`td-path-step${dash.semifinal.done ? ' done' : ''}`}>
            <span>
              {versus ? 'Playoffs' : 'Semifinals'}
              <small>({versus ? dash.knockouts.reduce((n, k) => n + k.matches.length, 0) + ' Matches' : `${dash.semifinal.rows.length} Teams`})</small>
            </span>
            {dash.semifinal.done && <TIcon name="checkCircle" />}
          </span>
          <TIcon name="doubleChevron" className="td-path-sep" />
          <span className="td-path-step active">
            <span>
              Final
              <small>({slots.length} Teams)</small>
            </span>
            <TIcon name="crown" />
          </span>
        </div>
      </section>
    </>
  )
}

function Champion({ dash, tournamentId, mine }: { dash: Dashboard; tournamentId: string; mine: Set<string> }) {
  const champ = dash.champion!
  return (
    <>
      <section className="td-champion" aria-label={`Champion: ${champ.name}`}>
        <span className="td-spot l" aria-hidden="true"></span>
        <span className="td-spot r" aria-hidden="true"></span>
        <TIcon name="crown" className="td-champ-crown" />
        <span className="td-champ-title">
          <Laurel className="gold" />
          <strong>CHAMPION</strong>
          <Laurel className="gold" flip />
        </span>
        <span className="td-champ-stage">
          <TrophyArt />
          <span className="td-plaque">
            <TeamMark team={champ} className="lg" />
            <strong>{champ.name}</strong>
          </span>
        </span>
      </section>
      <section className="td-card td-standings">
        <header className="td-card-head">
          <TIcon name="trophy" className="td-head-icon" />
          <span>
            <h2>Final Standings</h2>
          </span>
          <span className="td-pill plain end">
            <TIcon name="clock" /> Final Match
          </span>
        </header>
        <StandingsTable rows={dash.standings} variant="final" mine={mine} label="Final Standings" />
      </section>
      <Link className="td-results-btn" href={`/tournaments/${tournamentId}/matches`}>
        <TIcon name="bars" />
        <span>Tournament Results</span>
        <TIcon name="chevron" />
      </Link>
    </>
  )
}
