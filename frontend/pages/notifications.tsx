import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PublicNotification } from '@wavehub/shared-types'
import Layout from '../components/Layout'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useShell } from '../lib/shell'
import { formatNotificationTime, notificationKind, notificationTarget } from '../lib/notifications'

// Every notification, newest first, 20 per page (the bell panel only shows the latest 12).
const PAGE = 20

export default function NotificationsPage() {
  const { user, checked } = useAuth()
  const { refreshBadges } = useShell()
  const userId = user?.id
  const [items, setItems] = useState<PublicNotification[] | null>(null)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    api
      .listNotifications(PAGE, 0)
      .then((rows) => {
        if (cancelled) return
        setItems(rows)
        setMore(rows.length === PAGE)
      })
      .catch((err) => {
        if (cancelled) return
        setItems([])
        setError(errorMessage(err, 'შეტყობინებების ჩატვირთვა ვერ მოხერხდა.'))
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const loadMore = () => {
    if (!items) return
    setLoading(true)
    api
      .listNotifications(PAGE, items.length)
      .then((rows) => {
        setItems((list) => [...(list ?? []), ...rows.filter((r) => !(list ?? []).some((x) => x.id === r.id))])
        setMore(rows.length === PAGE)
      })
      .catch((err) => setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.')))
      .finally(() => setLoading(false))
  }

  const markRead = (n: PublicNotification) => {
    if (n.readAt) return
    setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) ?? null)
    api
      .markNotificationRead(n.id)
      .then(refreshBadges)
      .catch(() => undefined)
  }

  const markAll = () =>
    api
      .markAllNotificationsRead()
      .then(() => {
        setItems((list) => list?.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) ?? null)
        refreshBadges()
      })
      .catch((err) => setError(errorMessage(err, 'ვერ მოინიშნა.')))

  const unread = items?.filter((n) => !n.readAt).length ?? 0
  const shown = (items ?? []).filter((n) => filter === 'all' || !n.readAt)

  return (
    <Layout title="შეტყობინებები" noIndex>
      <section className="orders-page-head">
        <div>
          <p className="section-kicker">განახლებები</p>
          <h1>შეტყობინებები</h1>
          <p>შეკვეთები, ქოუჩინგი, ბალანსი, განცხადებები და შეტყობინებები — ყველაფერი ერთ ადგილას.</p>
        </div>
      </section>

      {checked && !user && (
        <section className="orders-login">
          <h2>შედით შეტყობინებების სანახავად</h2>
          <Link href="/login?next=/notifications">შესვლა</Link>
        </section>
      )}

      {user && (
        <section className="notif-page">
          <div className="notif-toolbar">
            <div className="orders-tabs" role="tablist">
              {(
                [
                  ['all', 'ყველა'],
                  ['unread', `წაუკითხავი${unread ? ` (${unread})` : ''}`],
                ] as const
              ).map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'active' : undefined} onClick={() => setFilter(key)}>
                  {label}
                </button>
              ))}
            </div>
            {unread > 0 && (
              <button type="button" className="notif-mark-all" onClick={() => void markAll()}>
                ყველას წაკითხულად მონიშვნა
              </button>
            )}
          </div>

          {error && (
            <div className="status-text status-error" role="alert">
              {error}
            </div>
          )}

          {items === null ? (
            <p className="notif-empty">იტვირთება…</p>
          ) : shown.length === 0 ? (
            <p className="notif-empty">{filter === 'unread' ? 'წაუკითხავი შეტყობინება არ გაქვს.' : 'შეტყობინებები ჯერ არ არის.'}</p>
          ) : (
            <ul className="notif-list">
              {shown.map((n) => {
                const { kind, letter } = notificationKind(n.type)
                return (
                  <li key={n.id}>
                    <Link href={notificationTarget(n)} className={`notif-item ${kind}${n.readAt ? '' : ' unread'}`} onClick={() => markRead(n)}>
                      <span className="notification-center-icon">{letter}</span>
                      <span className="notif-text">
                        <strong>{n.title}</strong>
                        <span>{n.body}</span>
                      </span>
                      <time dateTime={n.createdAt}>{formatNotificationTime(n.createdAt)}</time>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          {more && filter === 'all' && (
            <button type="button" className="notif-more" disabled={loading} onClick={loadMore}>
              {loading ? 'იტვირთება…' : 'მეტის ჩატვირთვა'}
            </button>
          )}
        </section>
      )}
    </Layout>
  )
}
