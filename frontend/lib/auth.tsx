import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PublicUser } from '@wavehub/shared-types'
import { api } from './api'

type AuthState = {
  user: PublicUser | null
  // False until the initial api.me() call resolves — distinguishes "haven't checked yet" from
  // "checked, and there's no session," which matters for any page that redirects when logged out
  // (redirecting before the check finishes would bounce every visitor, logged in or not).
  checked: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// Wraps the whole app in _app.tsx — the single place that calls api.me() on load. Pages read
// identity via useAuth() instead of each calling api.me() themselves; see frontend/CLAUDE.md for
// the duplication this replaced.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [checked, setChecked] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await api.me()
      setUser(res.user)
    } catch {
      setUser(null)
    } finally {
      setChecked(true)
    }
  }, [])

  useEffect(() => {
    // Same "fetch on mount" pattern as the per-page effects this provider replaces — see
    // frontend/pages/marketplace.tsx for why react-hooks/set-state-in-effect is disabled here too.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined)
    setUser(null)
  }, [])

  return <AuthContext.Provider value={{ user, checked, refresh, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
