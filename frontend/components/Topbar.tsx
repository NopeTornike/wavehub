import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '../lib/auth'
import NotificationBell from './NotificationBell'

// Matches index.html's <header class="topbar">. The search box is currently decorative (no
// site-wide search endpoint exists yet — see backend build plan's Phase 12) and the cart icon is
// a non-functional placeholder for the same reason noted in Sidebar.tsx.
export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, checked, logout } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <header className="topbar">
      <button className="menu-toggle" type="button" aria-label="Open menu" aria-expanded={false} onClick={onMenuClick}>
        <span></span>
        <span></span>
        <span></span>
      </button>

      <label className="search-box" aria-label="Search">
        <span className="search-icon" aria-hidden="true">/</span>
        <input type="search" placeholder="Search for games, services or players..." autoComplete="off" disabled />
      </label>

      <div className="top-actions">
        {checked && user && <NotificationBell />}
        {!checked ? null : user ? (
          <div className="profile-menu">
            <button
              className="profile-chip"
              type="button"
              aria-haspopup="true"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((v) => !v)}
            >
              <span className="avatar avatar-hot">{user.firstName?.[0]?.toUpperCase() ?? '?'}</span>
              <span>
                <strong>{user.firstName}</strong>
                <small>{user.wavecoinBalance} WC</small>
              </span>
            </button>

            {profileOpen && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-head">
                  <span className="avatar avatar-hot">{user.firstName?.[0]?.toUpperCase() ?? '?'}</span>
                  <div>
                    <strong>
                      {user.firstName} {user.lastName}
                    </strong>
                    <small>@{user.username}</small>
                  </div>
                </div>
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
                <button className="logout-button" type="button" onClick={logout}>
                  Log out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link className="auth-open-button" href="/login">
              Log in
            </Link>
            <Link className="auth-open-button primary" href="/register">
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
