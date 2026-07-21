import Link from 'next/link'
import { useAuth } from '../lib/auth'
import NotificationBell from './NotificationBell'

export default function Header() {
  const { user, checked, logout } = useAuth()

  return (
    <header className="site-header">
      <Link href="/" className="brand">
        WaveHub
      </Link>
      <nav className="site-nav">
        <Link href="/marketplace">Marketplace</Link>
        <Link href="/coaching">კოუჩინგი</Link>
        {!checked ? null : user ? (
          <>
            <Link href="/orders">შეკვეთები</Link>
            <Link href="/support">დახმარება</Link>
            <Link href="/wallet">{user.wavecoinBalance} WC</Link>
            <NotificationBell />
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
