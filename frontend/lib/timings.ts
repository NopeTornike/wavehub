import { useEffect, useState } from 'react'
import type { PlatformTimings } from '@wavehub/shared-types'
import { api } from './api'

// The staff-set auto-accept windows (Admin → Settings → GET platform/timings), fetched once per
// page load and shared. `null` until loaded — callers render their hour-specific text only then,
// so a stale default never shows.
let cached: PlatformTimings | null = null
let pending: Promise<PlatformTimings | null> | null = null

export function usePlatformTimings(): PlatformTimings | null {
  const [timings, setTimings] = useState<PlatformTimings | null>(cached)
  useEffect(() => {
    if (cached) return
    pending ??= api
      .getPlatformTimings()
      .then((t) => (cached = t))
      .catch(() => {
        pending = null
        return null
      })
    let alive = true
    void pending.then((t) => {
      if (alive && t) setTimings(t)
    })
    return () => {
      alive = false
    }
  }, [])
  return timings
}
