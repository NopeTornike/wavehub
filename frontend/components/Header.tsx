import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PublicUser } from '@wavehub/shared-types'
import { api } from '../lib/api'

// No persistent client-side auth store exists yet (see frontend/CLAUDE.md) — every page/component
// that needs to know "is someone logged in" calls api.me() itself. Header is the first place this
// matters visibly (showing Login/Register vs the user's name), so it's the reference example for
// that pattern until a shared AuthProvider is worth building.
export default function Header() {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .me()
      .then((res) => {
        if (!cancelled) setUser(res.user)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const logout = async () => {
    await api.logout().catch(() => undefined)
    setUser(null)
  }

  return (
    <header className="site-header">
      <Link href="/" className="brand">
        WaveHub
      </Link>
      <nav className="site-nav">
        <Link href="/marketplace">Marketplace</Link>
        {!checked ? null : user ? (
          <>
            <Link href="/orders">შეკვეთები</Link>
            <Link href="/wallet">{user.wavecoinBalance} WC</Link>
            <span className="note" style={{ margin: 0 }}>
              {user.firstName}
            </span>
            <button className="button glow-on-hover" type="button" onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link href="/login">Log in</Link>
            <Link href="/register" className="button glow-on-hover">
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}
