import { useRouter } from 'next/router'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { GameListingCount, WaveRank } from '@wavehub/shared-types'
import { api, API_BASE_URL } from './api'
import { registerGameArt } from './games'
import { useAuth } from './auth'
import { pollWhileVisible } from './visible-poll'

// Live numbers the site shell shows on every page — one poller here instead of one per component.
// Everything is real backend data (backend/src/community/, notifications, direct messages); the
// prototype's equivalents were localStorage mocks or Math.random().

// The live stream (GET notifications/stream) brings new notifications at once; the poll is the
// fallback when a proxy or phone drops it.
const BADGE_POLL_MS = 30_000
const ONLINE_POLL_MS = 60_000

type ShellContextValue = {
  unreadNotifications: number
  // createdAt of the newest unread notification — changes whenever a new one arrives.
  latestNotificationAt: string | null
  unreadMessages: number
  onlineCount: number | null
  waveRank: WaveRank | null
  games: GameListingCount[]
  refreshBadges: () => void
}

const ShellContext = createContext<ShellContextValue>({
  unreadNotifications: 0,
  latestNotificationAt: null,
  unreadMessages: 0,
  onlineCount: null,
  waveRank: null,
  games: [],
  refreshBadges: () => undefined,
})

export function ShellProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [latestNotificationAt, setLatestNotificationAt] = useState<string | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [onlineCount, setOnlineCount] = useState<number | null>(null)
  const [waveRank, setWaveRank] = useState<WaveRank | null>(null)
  const [games, setGames] = useState<GameListingCount[]>([])

  const refreshBadges = useCallback(() => {
    if (!userId) return
    api
      .getUnreadNotificationCount()
      .then((r) => {
        setUnreadNotifications(r.count)
        setLatestNotificationAt(r.latestAt ?? null)
      })
      .catch(() => undefined)
    api.getUnreadDirectMessageCount().then((r) => setUnreadMessages(r.count)).catch(() => undefined)
  }, [userId])

  // Also re-check on every page change (an action on the previous page often created one).
  const router = useRouter()
  useEffect(() => {
    router.events.on('routeChangeComplete', refreshBadges)
    return () => router.events.off('routeChangeComplete', refreshBadges)
  }, [router.events, refreshBadges])

  useEffect(() => {
    if (!userId) {
      // Signed out: nothing to count. Resetting here is a response to the auth change, not derived state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadNotifications(0)
      setLatestNotificationAt(null)
      setUnreadMessages(0)
      setWaveRank(null)
      return
    }
    refreshBadges()
    api.getMyWaveRank().then(setWaveRank).catch(() => setWaveRank(null))
    const stopPoll = pollWhileVisible(refreshBadges, BADGE_POLL_MS)
    // Live push (owner 2026-11-08): runs in background tabs too, so the chime and the desktop alert
    // fire while the person is on another tab. EventSource reconnects by itself.
    let source: EventSource | null = null
    if (typeof EventSource !== 'undefined') {
      source = new EventSource(`${API_BASE_URL}/notifications/stream`, { withCredentials: true })
      source.onmessage = (event) => {
        try {
          if ((JSON.parse(event.data) as { type?: string }).type === 'notification') refreshBadges()
        } catch {
          // ignore a malformed frame
        }
      }
    }
    return () => {
      stopPoll()
      source?.close()
    }
  }, [userId, refreshBadges])

  useEffect(() => {
    const loadOnline = () => api.getOnlineStats().then((r) => setOnlineCount(r.count)).catch(() => undefined)
    loadOnline()
    api
      .getGameListingCounts()
      .then((list) => {
        registerGameArt(list)
        setGames(list)
      })
      .catch(() => undefined)
    return pollWhileVisible(loadOnline, ONLINE_POLL_MS)
  }, [])

  const value = useMemo(
    () => ({ unreadNotifications, latestNotificationAt, unreadMessages, onlineCount, waveRank, games, refreshBadges }),
    [unreadNotifications, latestNotificationAt, unreadMessages, onlineCount, waveRank, games, refreshBadges],
  )
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

export function useShell() {
  return useContext(ShellContext)
}
