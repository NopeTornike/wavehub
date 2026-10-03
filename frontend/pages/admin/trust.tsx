import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { AdminUserReport, ReportReason, ReportStatus, TrustOverview, TrustUserDetail, TrustUserSummary } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, errorMessage } from '../../lib/api'

// Admin → Trust & Safety (backend/src/trust/): overview, the user-reports queue and one account's
// full picture — explained risk score, shared-network accounts (from hashed login history), reports,
// staff notes, official warnings and the watchlist. Trust & Safety Officer, Operation Lead, Main
// Administrator, Super Admin. Every action is audit-logged.

type Tab = 'overview' | 'reports' | 'users'
const REASON_LABELS: Record<ReportReason, string> = {
  fraud: 'თაღლითობა',
  scam_listing: 'ყალბი განცხადება',
  harassment: 'შეურაცხყოფა',
  offensive: 'შეუფერებელი',
  spam: 'სპამი',
  fake_account: 'ყალბი ანგარიში',
  other: 'სხვა',
}
const STATUS_LABELS: Record<ReportStatus, string> = { open: 'ღია', reviewing: 'განხილვაში', actioned: 'მიღებულია ზომა', dismissed: 'უარყოფილი' }
const TARGET_LABELS = { user: 'მომხმარებელი', listing: 'განცხადება', coach: 'ქოუჩი', review: 'შეფასება', message: 'შეტყობინება' } as const
const LEVEL_LABELS = { low: 'დაბალი', medium: 'საშუალო', high: 'მაღალი' } as const

const fmt = (iso: string | null) => {
  if (!iso) return '—'
  const t = new Date(new Date(iso).getTime() + 4 * 3600_000)
  return `${String(t.getUTCDate()).padStart(2, '0')}.${String(t.getUTCMonth() + 1).padStart(2, '0')}.${t.getUTCFullYear()} ${t.toISOString().slice(11, 16)}`
}

function RiskBadge({ score, level }: { score: number; level: 'low' | 'medium' | 'high' }) {
  return (
    <span className={`ts-risk ${level}`}>
      {score} · {LEVEL_LABELS[level]}
    </span>
  )
}

function UserPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [d, setD] = useState<TrustUserDetail | null>(null)
  const [note, setNote] = useState('')
  const [warning, setWarning] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .adminTrustUser(userId)
      .then(setD)
      .catch((err) => setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.')))
  }, [userId])

  const run = async (fn: () => Promise<TrustUserDetail>, after?: () => void) => {
    setBusy(true)
    setError('')
    try {
      setD(await fn())
      after?.()
    } catch (err) {
      setError(errorMessage(err, 'მოქმედება ვერ შესრულდა.'))
    } finally {
      setBusy(false)
    }
  }

  const addNote = (e: FormEvent) => {
    e.preventDefault()
    if (note.trim().length >= 2) void run(() => api.adminTrustNote(userId, note.trim()), () => setNote(''))
  }
  const sendWarning = (e: FormEvent) => {
    e.preventDefault()
    if (warning.trim().length < 10) return setError('გაფრთხილება მინ. 10 სიმბოლო.')
    if (window.confirm('მომხმარებელი მიიღებს ოფიციალურ გაფრთხილებას (საიტზე და ელფოსტაზე). გავაგზავნოთ?')) void run(() => api.adminTrustWarn(userId, warning.trim()), () => setWarning(''))
  }
  const toggleFlag = () => {
    if (!d) return
    const reason = window.prompt(d.flagged ? 'რატომ ხსნი მეთვალყურეობიდან?' : 'რატომ ემატება მეთვალყურეობის სიაში?')
    if (reason && reason.trim().length >= 3) void run(() => api.adminTrustFlag(userId, !d.flagged, reason.trim()))
  }

  return (
    <section className="card ts-user">
      <header className="ts-user-head">
        <div>
          <h2>{d ? `@${d.username}` : 'იტვირთება…'}</h2>
          {d && (
            <p className="note">
              {d.firstName} {d.lastName} · {d.status} · {d.emailVerified ? 'ელფოსტა დადასტურებულია' : 'ელფოსტა დაუდასტურებელია'} · რეგისტრაცია {fmt(d.createdAt)} · ბოლოს {fmt(d.lastSeenAt)}
            </p>
          )}
        </div>
        <button type="button" className="button ghost" onClick={onClose}>
          დახურვა
        </button>
      </header>
      {error && (
        <div className="status-text status-error" role="alert">
          {error}
        </div>
      )}
      {d && (
        <>
          <div className="ts-user-grid">
            <div>
              <h3>
                რისკი <RiskBadge score={d.risk.score} level={d.risk.level} />
              </h3>
              {d.risk.factors.length === 0 ? (
                <p className="note">რისკის ნიშნები არ არის.</p>
              ) : (
                <ul className="ts-factors">
                  {d.risk.factors.map((f) => (
                    <li key={f.key}>
                      <b>+{f.points}</b> {f.label}
                    </li>
                  ))}
                </ul>
              )}
              <h3>სტატისტიკა</h3>
              <p className="note">
                ყიდვები: {d.stats.ordersAsBuyer} · გაყიდვები: {d.stats.ordersAsSeller} (გაუქმებული {d.stats.cancelledAsSeller}) · დავები: {d.stats.disputesAgainst} · პრომო: {d.stats.promoRedemptions} · გაფრთხილება: {d.stats.warnings} · თავად დაასაჩივრა: {d.reportsFiled}
              </p>
              <div className="admin-row-actions">
                <Link className="button ghost" href={`/u/${d.username}`}>
                  საჯარო პროფილი
                </Link>
                <Link className="button ghost" href={`/admin/users?q=${encodeURIComponent(d.username)}`}>
                  ანგარიშის მართვა
                </Link>
                <button type="button" className="button ghost" disabled={busy} onClick={toggleFlag}>
                  {d.flagged ? 'მეთვალყურეობიდან მოხსნა' : 'მეთვალყურეობაში დამატება'}
                </button>
              </div>
            </div>
            <div>
              <h3>დაკავშირებული ანგარიშები (იგივე ქსელი, 30 დღე)</h3>
              {d.linkedAccounts.length === 0 ? (
                <p className="note">არ არის.</p>
              ) : (
                <ul className="ts-list">
                  {d.linkedAccounts.map((l) => (
                    <li key={l.userId}>
                      @{l.username} · {l.status} · {l.sharedLogins} საერთო შესვლა
                    </li>
                  ))}
                </ul>
              )}
              <h3>შესვლების ისტორია</h3>
              <p className="note">ქსელი/მოწყობილობა ნაჩვენებია დაშიფრული ნიშნით — IP მისამართი არ ინახება.</p>
              <ul className="ts-list ts-logins">
                {d.logins.slice(0, 15).map((l, i) => (
                  <li key={i} className={l.success ? undefined : 'fail'}>
                    {fmt(l.at)} · {l.success ? 'წარმატებული' : 'წარუმატებელი'} · ქსელი {l.network} · მოწყობილობა {l.device}
                  </li>
                ))}
                {d.logins.length === 0 && <li>ჩანაწერი არ არის.</li>}
              </ul>
            </div>
          </div>

          <h3>საჩივრები ამ ანგარიშზე ({d.reportsAgainst.length})</h3>
          <ul className="ts-list">
            {d.reportsAgainst.map((r) => (
              <li key={r.id}>
                {fmt(r.createdAt)} · {REASON_LABELS[r.reason]} · {STATUS_LABELS[r.status]} · @{r.reporterUsername}
                {r.details ? ` — ${r.details}` : ''}
              </li>
            ))}
            {d.reportsAgainst.length === 0 && <li>არ არის.</li>}
          </ul>

          <h3>პერსონალის ჩანაწერები</h3>
          <ul className="ts-notes">
            {d.notes.map((n) => (
              <li key={n.id} className={n.kind}>
                <b>{n.kind === 'warning' ? 'გაფრთხილება' : n.kind === 'flag' ? 'მეთვალყურეობა' : n.kind === 'unflag' ? 'მოხსნა' : 'ჩანაწერი'}</b> · @{n.authorUsername} · {fmt(n.createdAt)}
                <p>{n.body}</p>
              </li>
            ))}
            {d.notes.length === 0 && <li>ჩანაწერები არ არის.</li>}
          </ul>
          <div className="ts-forms">
            <form className="stack-form" onSubmit={addNote}>
              <label className="field">
                შიდა ჩანაწერი (მომხმარებელი ვერ ხედავს)
                <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <button type="submit" className="button" disabled={busy || note.trim().length < 2}>
                შენახვა
              </button>
            </form>
            <form className="stack-form" onSubmit={sendWarning}>
              <label className="field">
                ოფიციალური გაფრთხილება (მიიღებს საიტზე და ელფოსტაზე)
                <textarea rows={2} maxLength={1000} value={warning} onChange={(e) => setWarning(e.target.value)} />
              </label>
              <button type="submit" className="button" disabled={busy}>
                გაფრთხილების გაგზავნა
              </button>
            </form>
          </div>
        </>
      )}
    </section>
  )
}

export default function AdminTrust() {
  const [tab, setTab] = useState<Tab>('overview')
  const [overview, setOverview] = useState<TrustOverview | null>(null)
  const [reports, setReports] = useState<AdminUserReport[] | null>(null)
  const [reportFilter, setReportFilter] = useState<ReportStatus | 'all'>('open')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TrustUserSummary[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .adminTrustOverview()
      .then(setOverview)
      .catch((err) => setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.')))
  }, [])

  const loadReports = useCallback(() => {
    api
      .adminTrustReports(reportFilter)
      .then(setReports)
      .catch((err) => setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.')))
  }, [reportFilter])
  useEffect(() => {
    if (tab === 'reports') loadReports()
  }, [tab, loadReports])

  const handle = async (r: AdminUserReport, status: ReportStatus) => {
    const note = status === 'actioned' || status === 'dismissed' ? window.prompt('შენიშვნა (არასავალდებულო)') ?? undefined : undefined
    try {
      const next = await api.adminHandleReport(r.id, status, note)
      setReports((list) => list?.map((x) => (x.id === r.id ? next : x)) ?? null)
    } catch (err) {
      setError(errorMessage(err, 'ცვლილება ვერ მოხერხდა.'))
    }
  }

  const search = async (e: FormEvent) => {
    e.preventDefault()
    if (query.trim().length < 2) return
    try {
      setResults(await api.adminTrustSearch(query.trim()))
    } catch (err) {
      setError(errorMessage(err, 'ძიება ვერ მოხერხდა.'))
    }
  }

  const open = (userId: string | null) => {
    if (!userId) return
    setSelected(userId)
    setTab('users')
  }

  return (
    <AdminLayout title="უსაფრთხოება">
      <h1 className="page-title">Trust & Safety</h1>
      <p className="page-subtitle">საჩივრები, რისკის შეფასება, დაკავშირებული ანგარიშები, გაფრთხილებები და მეთვალყურეობა.</p>

      <div className="al-tabs" role="tablist">
        {(
          [
            ['overview', 'მიმოხილვა'],
            ['reports', `საჩივრები${overview ? ` (${overview.openReports})` : ''}`],
            ['users', 'მომხმარებლები'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : undefined} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="status-text status-error" role="alert">
          {error}
        </div>
      )}

      {tab === 'overview' &&
        (!overview ? (
          <div className="empty-state">იტვირთება…</div>
        ) : (
          <>
            <div className="adm-kpis">
              {(
                [
                  ['ღია საჩივარი', overview.openReports],
                  ['მეთვალყურეობაში', overview.flaggedUsers],
                  ['გაფრთხილება (30 დღე)', overview.warnings30d],
                  ['შეჩერებული / დაბლოკილი', `${overview.suspended} / ${overview.banned}`],
                  ['ახალი ანგარიში (7 დღე)', overview.newAccounts7d],
                  ['საერთო ქსელი (3+ ანგარიში)', overview.sharedNetworkGroups],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="adm-kpi">
                  <span className="adm-kpi-top">{label}</span>
                  <b>{value}</b>
                </div>
              ))}
            </div>
            {overview.reportsByReason.length > 0 && (
              <section className="card">
                <h2>ღია საჩივრები მიზეზის მიხედვით</h2>
                <p className="note">{overview.reportsByReason.map((r) => `${REASON_LABELS[r.reason]}: ${r.count}`).join(' · ')}</p>
              </section>
            )}
            <section className="card">
              <h2>ყველაზე მაღალი რისკი</h2>
              {overview.topRisk.length === 0 ? (
                <p className="note">რისკიანი ანგარიში არ არის.</p>
              ) : (
                <div className="order-list">
                  {overview.topRisk.map((u) => (
                    <button key={u.userId} type="button" className="admin-row ts-row" onClick={() => open(u.userId)}>
                      <span className="admin-row-main">
                        <strong>
                          @{u.username} {u.flagged && <span className="arv-status reported">მეთვალყურეობა</span>}
                        </strong>
                        <span className="note">{u.risk.factors.slice(0, 3).map((f) => f.label).join(' · ')}</span>
                      </span>
                      <RiskBadge score={u.risk.score} level={u.risk.level} />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        ))}

      {tab === 'reports' && (
        <>
          <div className="admin-search-bar">
            <select value={reportFilter} aria-label="სტატუსი" onChange={(e) => setReportFilter(e.target.value as ReportStatus | 'all')}>
              <option value="open">ღია და განხილვაში</option>
              <option value="actioned">მიღებულია ზომა</option>
              <option value="dismissed">უარყოფილი</option>
              <option value="all">ყველა</option>
            </select>
          </div>
          {reports === null ? (
            <div className="empty-state">იტვირთება…</div>
          ) : reports.length === 0 ? (
            <div className="empty-state">საჩივარი არ არის.</div>
          ) : (
            <div className="order-list">
              {reports.map((r) => (
                <div key={r.id} className="admin-row arv-row">
                  <div className="admin-row-main">
                    <strong>
                      {TARGET_LABELS[r.targetType]}: {r.targetHref ? <Link href={r.targetHref}>{r.targetLabel}</Link> : r.targetLabel}
                      <span className={`arv-status ${r.status === 'open' ? 'reported' : ''}`}>{STATUS_LABELS[r.status]}</span>
                    </strong>
                    <span className="note">
                      {REASON_LABELS[r.reason]} · დაასაჩივრა @{r.reporterUsername} · {fmt(r.createdAt)}
                      {r.targetUsername ? ` · ანგარიში @${r.targetUsername}` : ''}
                    </span>
                    {r.details && <span className="arv-body">{r.details}</span>}
                    {r.evidence && <span className="arv-reply">მტკიცებულება: „{r.evidence}“</span>}
                    {r.staffNote && <span className="arv-reply">შენიშვნა: {r.staffNote}</span>}
                  </div>
                  <div className="admin-row-actions">
                    {r.targetUserId && (
                      <button type="button" className="button" onClick={() => open(r.targetUserId)}>
                        ანგარიში
                      </button>
                    )}
                    {r.status === 'open' && (
                      <button type="button" className="button ghost" onClick={() => void handle(r, 'reviewing')}>
                        განხილვაში
                      </button>
                    )}
                    {(r.status === 'open' || r.status === 'reviewing') && (
                      <>
                        <button type="button" className="button ghost" onClick={() => void handle(r, 'actioned')}>
                          ზომა მიღებულია
                        </button>
                        <button type="button" className="button ghost" onClick={() => void handle(r, 'dismissed')}>
                          უარყოფა
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'users' && (
        <>
          <form className="admin-search-bar" onSubmit={search}>
            <input value={query} maxLength={40} placeholder="მომხმარებლის სახელი" onChange={(e) => setQuery(e.target.value)} />
            <button className="button" type="submit">
              ძიება
            </button>
          </form>
          {results && (
            <div className="order-list">
              {results.length === 0 && <div className="empty-state">ვერ მოიძებნა.</div>}
              {results.map((u) => (
                <button key={u.userId} type="button" className="admin-row ts-row" onClick={() => setSelected(u.userId)}>
                  <span className="admin-row-main">
                    <strong>@{u.username}</strong>
                    <span className="note">{u.status}</span>
                  </span>
                  <RiskBadge score={u.risk.score} level={u.risk.level} />
                </button>
              ))}
            </div>
          )}
          {selected && <UserPanel key={selected} userId={selected} onClose={() => setSelected(null)} />}
        </>
      )}
    </AdminLayout>
  )
}
