/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PublicNotification } from '@wavehub/shared-types'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useShell } from '../lib/shell'
import { notificationKind, notificationIcon } from '../lib/notifications'

// Pop-up toasts for new notifications (client, 2026-10-02: "should appear … and must show").
// Driven by the shell's unread-count poll: whenever a newer unread one arrives it fetches the newest
// notifications and pops each unread one this browser hasn't shown yet (remembered per user in
// localStorage, so a reload doesn't repeat them). Only recent ones pop — an old unread backlog
// stays in the bell. Clicking opens the target and marks it read.

const MAX_AGE_MS = 6 * 3600_000
const VISIBLE = 3
const HIDE_AFTER_MS = 9000
const REMEMBER = 200

function seenKey(userId: string) {
  return `wavehub.notifications.toasted.${userId}`
}
function readSeen(userId: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(seenKey(userId)) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}
function writeSeen(userId: string, ids: string[]) {
  try {
    localStorage.setItem(seenKey(userId), JSON.stringify(ids.slice(-REMEMBER)))
  } catch {
    // private mode — toasts may repeat after a reload, nothing else breaks
  }
}

export default function NotificationToasts() {
  const router = useRouter()
  const { user } = useAuth()
  const { latestNotificationAt, refreshBadges } = useShell()
  const [toasts, setToasts] = useState<PublicNotification[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const userId = user?.id

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
  }, [])

  useEffect(() => {
    if (!userId || !latestNotificationAt) return
    let cancelled = false
    api
      .listNotifications(10)
      .then((items) => {
        if (cancelled) return
        const seen = readSeen(userId)
        const fresh = items.filter((n) => !n.readAt && !seen.includes(n.id) && Date.now() - new Date(n.createdAt).getTime() < MAX_AGE_MS).reverse()
        if (!fresh.length) return
        writeSeen(userId, [...seen, ...fresh.map((n) => n.id)])
        setToasts((list) => [...list, ...fresh].slice(-VISIBLE))
        for (const n of fresh) {
          timers.current.set(
            n.id,
            setTimeout(() => dismiss(n.id), HIDE_AFTER_MS),
          )
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [userId, latestNotificationAt, dismiss])

  useEffect(() => {
    const all = timers.current
    return () => all.forEach((t) => clearTimeout(t))
  }, [])

  if (!userId || toasts.length === 0) return null

  return (
    <div className="notification-toasts" role="status" aria-live="polite">
      {toasts.map((n) => {
        const { kind } = notificationKind(n.type)
        return (
          <div key={n.id} className={`notification-toast ${kind}`}>
            <button
              type="button"
              className="notification-toast-body"
              onClick={() => {
                dismiss(n.id)
                api
                  .markNotificationRead(n.id)
                  .then(refreshBadges)
                  .catch(() => undefined)
                void router.push(`/notifications?id=${n.id}`)
              }}
            >
              <span className="notification-center-icon has-img">
                <img src={notificationIcon(n.type)} alt="" />
              </span>
              <span>
                <strong>{n.title}</strong>
                <small>{n.body}</small>
              </span>
            </button>
            <button type="button" className="notification-toast-close" aria-label="დახურვა" onClick={() => dismiss(n.id)}>
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
