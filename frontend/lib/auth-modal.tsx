import { useRouter } from 'next/router'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import LoginModal from '../components/auth/LoginModal'
import { SESSION_LOST_EVENT } from './api'
import { useAuth } from './auth'

// Owner design 2026-10-15: "Log in" opens over the current page — a side drawer on desktop, a card
// on phones — instead of leaving it. The /login page stays for links that carry `?next=`.
type AuthModalValue = { openLogin: (next?: string) => void; closeLogin: () => void }
const AuthModalContext = createContext<AuthModalValue>({ openLogin: () => undefined, closeLogin: () => undefined })

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { user, sessionLost } = useAuth()
  const [state, setState] = useState<{ open: boolean; next?: string; expired?: boolean }>({ open: false })
  const openLogin = useCallback((next?: string) => setState({ open: true, next }), [])
  const closeLogin = useCallback(() => setState({ open: false }), [])

  // Navigating away closes it.
  useEffect(() => {
    const onRoute = () => setState({ open: false })
    router.events.on('routeChangeStart', onRoute)
    return () => router.events.off('routeChangeStart', onRoute)
  }, [router.events])

  // Session expired mid-visit: sign the user out locally and open sign-in over the same page (no
  // `next`, no navigation), so a half-filled sell form is still there after signing back in.
  useEffect(() => {
    if (!user) return
    const onLost = () => {
      sessionLost()
      setState({ open: true, expired: true })
    }
    window.addEventListener(SESSION_LOST_EVENT, onLost)
    return () => window.removeEventListener(SESSION_LOST_EVENT, onLost)
  }, [user, sessionLost])

  const value = useMemo(() => ({ openLogin, closeLogin }), [openLogin, closeLogin])
  return (
    <AuthModalContext.Provider value={value}>
      {children}
      {state.open && <LoginModal next={state.next} expired={state.expired} onClose={closeLogin} />}
    </AuthModalContext.Provider>
  )
}

export function useAuthModal() {
  return useContext(AuthModalContext)
}
