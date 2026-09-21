import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import NotificationBell from './NotificationBell'

// Matches index.html's <header class="topbar">. The search box is currently decorative (no
// site-wide search endpoint exists yet — see backend build plan's Phase 12), so it is disabled and
// says so; the cart icon from the prototype was dropped (see Sidebar.tsx).
export default function Topbar({ onMenuClick, sidebarOpen }: { onMenuClick: () => void; sidebarOpen: boolean }) {
  const { user, checked, logout } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the profile dropdown on outside click / Escape (the bell already does the same).
  useEffect(() => {
    if (!profileOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setProfileOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [profileOpen])

  return (
    <header className="topbar">
      <button
        className="menu-toggle"
        type="button"
        aria-label={sidebarOpen ? 'მენიუს დახურვა' : 'მენიუს გახსნა'}
        aria-expanded={sidebarOpen}
        aria-controls="sidebar"
        onClick={onMenuClick}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <label className="search-box" title="ძებნა მალე დაემატება">
        <span className="search-icon" aria-hidden="true">/</span>
        <input type="search" placeholder="ძებნა მალე დაემატება" aria-label="ძებნა" autoComplete="off" disabled />
      </label>

      <div className="top-actions">
        {checked && user && <NotificationBell />}
        {!checked ? null : user ? (
          <div className="profile-menu" ref={menuRef}>
            <button
              className="profile-chip"
              type="button"
              aria-haspopup="true"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((v) => !v)}
            >
              <span className="avatar avatar-hot" aria-hidden="true">{user.firstName?.[0]?.toUpperCase() ?? '?'}</span>
              <span>
                <strong>{user.firstName}</strong>
                <small>{user.wavecoinBalance} WC</small>
              </span>
            </button>

            {profileOpen && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-head">
                  <span className="avatar avatar-hot" aria-hidden="true">{user.firstName?.[0]?.toUpperCase() ?? '?'}</span>
                  <div>
                    <strong>
                      {user.firstName} {user.lastName}
                    </strong>
                    <small>@{user.username}</small>
                  </div>
                </div>
                <Link href={`/u/${user.username}`} onClick={() => setProfileOpen(false)}>
                  ჩემი პროფილი
                </Link>
                <Link href="/orders" onClick={() => setProfileOpen(false)}>
                  ჩემი შეკვეთები
                </Link>
                <Link href="/wallet" onClick={() => setProfileOpen(false)}>
                  საფულე
                </Link>
                {user.adminRole && (
                  <Link href="/admin" onClick={() => setProfileOpen(false)}>
                    ადმინ პანელი
                  </Link>
                )}
                <button className="logout-button" type="button" onClick={() => {
                    setProfileOpen(false)
                    void logout()
                  }}>
                  გასვლა
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link className="auth-open-button" href="/login">
              შესვლა
            </Link>
            <Link className="auth-open-button primary" href="/register">
              რეგისტრაცია
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
