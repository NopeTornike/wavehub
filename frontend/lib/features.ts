import { useEffect, useState } from 'react'
import type { PlatformFeatures } from '@wavehub/shared-types'
import { api } from './api'

// The Super-Admin show/hide switches (GET platform/features), fetched once per page load and shared.
const DEFAULTS: PlatformFeatures = { tournamentLeaderboard: true, sellerLeaderboard: true, rewardsHub: true }
let cached: PlatformFeatures | null = null
let pending: Promise<PlatformFeatures> | null = null

export function loadFeatures(): Promise<PlatformFeatures> {
  if (cached) return Promise.resolve(cached)
  pending ??= api
    .getPlatformFeatures()
    .then((f) => (cached = { ...DEFAULTS, ...f }))
    .catch(() => {
      pending = null
      return DEFAULTS
    })
  return pending
}

// null until loaded, so callers can avoid flashing a switched-off link.
export function useFeatures(): PlatformFeatures | null {
  const [features, setFeatures] = useState<PlatformFeatures | null>(cached)
  useEffect(() => {
    let alive = true
    loadFeatures().then((f) => alive && setFeatures(f))
    return () => {
      alive = false
    }
  }, [])
  return features
}
