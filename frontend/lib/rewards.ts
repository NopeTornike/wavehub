import { useEffect } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import { loadFeatures } from './features'

// User Hub rewards: the pages report a visit (and the shell a daily check-in) at most once per
// Tbilisi day per browser; the server ignores repeats anyway.
const tbilisiDay = () => new Date(Date.now() + 4 * 3_600_000).toISOString().slice(0, 10)

function oncePerDay(userId: string, what: string, send: () => Promise<unknown>) {
  const key = `wavehub.rewards.${what}.${userId}`
  const day = tbilisiDay()
  try {
    if (localStorage.getItem(key) === day) return
  } catch {
    /* storage blocked: just send */
  }
  void loadFeatures().then((f) => {
    if (!f.rewardsHub) return
    send()
      .then(() => {
        try {
          localStorage.setItem(key, day)
        } catch {
          /* ignore */
        }
      })
      .catch(() => undefined)
  })
}

export function useRewardCheckIn() {
  const { user } = useAuth()
  const userId = user?.id
  useEffect(() => {
    if (userId) oncePerDay(userId, 'checkin', () => api.rewardCheckIn())
  }, [userId])
}

export type RewardVisitPage = 'marketplace' | 'services' | 'steam' | 'tournaments' | 'coaching'

export function useRewardVisit(page: RewardVisitPage) {
  const { user } = useAuth()
  const userId = user?.id
  useEffect(() => {
    if (userId) oncePerDay(userId, `visit-${page}`, () => api.rewardVisit(page))
  }, [userId, page])
}

// Mounted once in _app: the daily "Log in to WaveHubX" check-in (also the streak).
export function RewardCheckIn() {
  useRewardCheckIn()
  return null
}
