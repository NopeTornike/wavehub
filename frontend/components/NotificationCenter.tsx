import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { NotificationType, type PublicNotification } from '@wavehub/shared-types'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useShell } from '../lib/shell'

// useLayoutEffect warns during server rendering; the panel only ever positions itself in the browser.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

// The prototype's `.notification-center` panel (profile-nav.js#renderNotificationCenter /
// setNotificationCenterOpen), fed by the real notifications API. Portaled to <body> like the
// prototype's (a position:fixed panel inside the blurred topbar would be clipped to it), and placed
// with the same anchor math under the bell.

// Deep-links based on `notification.metadata` — what each backend hook attaches.
function targetFor(notification: PublicNotification): string {
  const metadata = notification.metadata ?? {}
  if (metadata.conversationId) return `/messages?conversation=${metadata.conversationId}`
  if (metadata.orderId) return `/orders/${metadata.orderId}`
  if (metadata.sessionId) return `/coaching-sessions/${metadata.sessionId}`
  if (metadata.ticketId) return `/support/${metadata.ticketId}`
  if (metadata.withdrawRequestId) return '/wallet'
  if (notification.type.startsWith('subscription_')) return '/plans'
  return '/orders'
}

// The prototype's four visual kinds (icon letter + accent colour).
function kindOf(type: NotificationType): { kind: string; letter: string } {
  if (type === NotificationType.NewMessage || type === NotificationType.TicketReplied) return { kind: 'message', letter: 'M' }
  if (type === NotificationType.WithdrawalStatusChanged || type.startsWith('subscription_')) return { kind: 'offer', letter: '₾' }
  if (type === NotificationType.OrderPaid || type === NotificationType.ReviewPosted) return { kind: 'sale', letter: 'S' }
  return { kind: 'order', letter: 'O' }
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function NotificationCenter({
  open,
  anchor,
  onClose,
}: {
  open: boolean
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
}) {
  const { user } = useAuth()
  const { refreshBadges } = useShell()
  const panelRef = useRef<HTMLElement>(null)
  const [items, setItems] = useState<PublicNotification[] | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Portals need document; render nothing during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || !user) return
    // Fetch fresh on every open (not cached) — same as the previous bell dropdown.
    api
      .listNotifications(12)
      .then(setItems)
      .catch(() => setItems([]))
  }, [open, user])

  useIsomorphicLayoutEffect(() => {
    const panel = panelRef.current
    const button = anchor.current
    if (!open || !panel || !button) return
    const rect = button.getBoundingClientRect()
    if (window.innerWidth <= 600) {
      panel.style.inset = 'auto 8px auto 8px'
      panel.style.width = 'auto'
      panel.style.maxHeight = 'calc(100dvh - 16px)'
      const height = Math.min(panel.scrollHeight, window.innerHeight - 16)
      const preferred = rect.bottom + 8
      panel.style.top = `${preferred + height <= window.innerHeight - 8 ? preferred : Math.max(8, window.innerHeight - height - 8)}px`
    } else {
      panel.style.inset = 'auto'
      panel.style.width = ''
      panel.style.maxHeight = ''
      const height = Math.min(panel.scrollHeight || 520, window.innerHeight - 24)
      panel.style.top = `${Math.max(12, Math.min(window.innerHeight - height - 12, rect.bottom + 10))}px`
      panel.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`
    }
  }, [open, items, anchor])

  useEffect(() => {
    if (!open) return
    const onDocumentClick = (event: MouseEvent) => {
      if (panelRef.current?.contains(event.target as Node) || anchor.current?.contains(event.target as Node)) return
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('click', onDocumentClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose, anchor])

  const markRead = (notification: PublicNotification) => {
    if (notification.readAt) return
    api
      .markNotificationRead(notification.id)
      .then(refreshBadges)
      .catch(() => undefined)
  }

  if (!mounted) return null

  return createPortal(
    <aside className="notification-center" hidden={!open} ref={panelRef} aria-label="შეტყობინებები">
      <header>
        <div>
          <span>განახლებები</span>
          <h2>შეტყობინებები</h2>
        </div>
        <button type="button" aria-label="შეტყობინებების დახურვა" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="notification-center-list">
        {!user ? (
          <p className="notification-center-empty">შედით შეტყობინებების სანახავად.</p>
        ) : items === null ? (
          <p className="notification-center-empty">იტვირთება…</p>
        ) : items.length === 0 ? (
          <p className="notification-center-empty">შეტყობინებები ჯერ არ არის.</p>
        ) : (
          items.map((item) => {
            const { kind, letter } = kindOf(item.type)
            return (
              <Link
                key={item.id}
                className={`notification-center-item ${kind}${item.readAt ? '' : ' unread'}`}
                href={targetFor(item)}
                onClick={() => {
                  markRead(item)
                  onClose()
                }}
              >
                <span className="notification-center-icon">{letter}</span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.body}</small>
                  <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
                </span>
              </Link>
            )
          })
        )}
      </div>
      {user && items && items.some((item) => !item.readAt) ? (
        <button
          type="button"
          className="notification-center-footer"
          onClick={() =>
            api
              .markAllNotificationsRead()
              .then(() => {
                setItems((current) => current?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null)
                refreshBadges()
              })
              .catch(() => undefined)
          }
        >
          ყველას წაკითხულად მონიშვნა
        </button>
      ) : (
        <Link className="notification-center-footer" href={user ? '/messages' : '/login'} onClick={onClose}>
          შეტყობინებების გახსნა
        </Link>
      )}
    </aside>,
    document.body,
  )
}
