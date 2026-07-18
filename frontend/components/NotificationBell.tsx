import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import type { PublicNotification } from '@wavehub/shared-types'
import { api } from '../lib/api'

const UNREAD_POLL_MS = 20000

// Deep-links based on `notification.metadata` — matches what each backend hook module attaches
// (orderId/disputeId/withdrawRequestId/reviewId). Falls back to /orders if nothing matches, since
// most notification types are order-adjacent.
function targetForNotification(notification: PublicNotification): string {
  const metadata = notification.metadata ?? {}
  if (metadata.orderId) return `/orders/${metadata.orderId}`
  if (metadata.withdrawRequestId) return '/wallet'
  return '/orders'
}

export default function NotificationBell() {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<PublicNotification[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadCount = () => {
      api.getUnreadNotificationCount().then((res) => setUnreadCount(res.count)).catch(() => undefined)
    }
    loadCount()
    const interval = setInterval(loadCount, UNREAD_POLL_MS)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!open) return
    // Same fetch-on-open pattern as the other polling effects in this codebase — see
    // frontend/pages/marketplace.tsx for why this rule is disabled here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    api
      .listNotifications()
      .then(setNotifications)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open) return
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const openNotification = async (notification: PublicNotification) => {
    if (!notification.readAt) {
      try {
        await api.markNotificationRead(notification.id)
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
        )
        setUnreadCount((count) => Math.max(0, count - 1))
      } catch {
        // best-effort — still navigate even if marking read failed
      }
    }
    setOpen(false)
    router.push(targetForNotification(notification))
  }

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
      setUnreadCount(0)
    } catch {
      // best-effort
    }
  }

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        className="notification-bell-trigger"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="შეტყობინებები"
      >
        🔔
        {unreadCount > 0 && <span className="notification-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <strong style={{ fontSize: '0.9rem' }}>შეტყობინებები</strong>
            <button type="button" onClick={markAllRead}>
              ყველას წაკითხვა
            </button>
          </div>
          {loading ? (
            <div className="empty-state" style={{ padding: 20 }}>
              იტვირთება…
            </div>
          ) : notifications.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>
              შეტყობინებები არ არის.
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={`notification-item${notification.readAt ? '' : ' unread'}`}
                onClick={() => openNotification(notification)}
              >
                <div className="notification-item-title">
                  {!notification.readAt && <span className="notification-item-dot" />}
                  {notification.title}
                </div>
                <div className="notification-item-body">{notification.body}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
