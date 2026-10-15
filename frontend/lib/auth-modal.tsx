import { useRouter } from 'next/router'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import LoginModal from '../components/auth/LoginModal'

// Owner design 2026-10-15: "Log in" opens over the current page — a side drawer on desktop, a card
// on phones — instead of leaving it. The /login page stays for links that carry `?next=`.
type AuthModalValue = { openLogin: (next?: string) => void; closeLogin: () => void }
const AuthModalContext = createContext<AuthModalValue>({ openLogin: () => undefined, closeLogin: () => undefined })

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<{ open: boolean; next?: string }>({ open: false })
  const openLogin = useCallback((next?: string) => setState({ open: true, next }), [])
  const closeLogin = useCallback(() => setState({ open: false }), [])

  // Navigating away closes it.
  useEffect(() => {
    const onRoute = () => setState({ open: false })
    router.events.on('routeChangeStart', onRoute)
    return () => router.events.off('routeChangeStart', onRoute)
  }, [router.events])

  const value = useMemo(() => ({ openLogin, closeLogin }), [openLogin, closeLogin])
  return (
    <AuthModalContext.Provider value={value}>
      {children}
      {state.open && <LoginModal next={state.next} onClose={closeLogin} />}
    </AuthModalContext.Provider>
  )
}

export function useAuthModal() {
  return useContext(AuthModalContext)
}
