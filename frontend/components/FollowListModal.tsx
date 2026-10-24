import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PublicFollowEntry } from '@wavehub/shared-types'
import { api, errorMessage } from '../lib/api'
import Avatar, { displayName } from './Avatar'

// Instagram-style follower / following list (owner 2026-10-24): opens from the counts on a public
// profile, two tabs, a search box, each row links to that profile. Signed-in viewers only (the API
// requires a session); staff accounts are left out by the server for non-staff viewers.
export default function FollowListModal({
  username,
  initialTab,
  counts,
  onClose,
}: {
  username: string
  initialTab: 'followers' | 'following'
  counts: { followers: number; following: number }
  onClose: () => void
}) {
  const [tab, setTab] = useState(initialTab)
  const [rows, setRows] = useState<PublicFollowEntry[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(null)
    setError('')
    ;(tab === 'followers' ? api.listUserFollowers(username) : api.listUserFollowing(username))
      .then((list) => alive && setRows(list))
      .catch((err) => alive && setError(errorMessage(err, 'სია ვერ ჩაიტვირთა.')))
    return () => {
      alive = false
    }
  }, [tab, username])

  useEffect(() => {
    closeRef.current?.focus()
    document.body.classList.add('modal-open')
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('modal-open')
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!rows || !q) return rows
    return rows.filter((r) => `${r.firstName} ${r.lastName} ${r.username}`.toLowerCase().includes(q))
  }, [rows, query])

  return createPortal(
    <div className="flm-modal" role="presentation">
      <div className="flm-backdrop" onClick={onClose} />
      <section className="flm-dialog" role="dialog" aria-modal="true" aria-label={tab === 'followers' ? 'გამომწერები' : 'გამოწერილები'}>
        <header className="flm-head">
          <div className="flm-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'followers'} className={tab === 'followers' ? 'active' : undefined} onClick={() => setTab('followers')}>
              <strong>{counts.followers}</strong> გამომწერი
            </button>
            <button type="button" role="tab" aria-selected={tab === 'following'} className={tab === 'following' ? 'active' : undefined} onClick={() => setTab('following')}>
              <strong>{counts.following}</strong> გამოწერილი
            </button>
          </div>
          <button ref={closeRef} type="button" className="flm-close" onClick={onClose} aria-label="დახურვა">
            ×
          </button>
        </header>
        <label className="flm-search">
          <span className="sr-only">ძიება</span>
          <input type="search" placeholder="ძიება" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="flm-list">
          {error ? (
            <p className="flm-empty">{error}</p>
          ) : !shown ? (
            <p className="flm-empty">იტვირთება…</p>
          ) : shown.length === 0 ? (
            <p className="flm-empty">{query ? 'ვერაფერი მოიძებნა.' : tab === 'followers' ? 'გამომწერები ჯერ არ არის.' : 'გამოწერილები ჯერ არ არის.'}</p>
          ) : (
            <ul>
              {shown.map((r) => (
                <li key={r.id}>
                  <Link href={`/u/${encodeURIComponent(r.username)}`} onClick={onClose} className="flm-row">
                    <Avatar name={displayName(r)} src={r.avatarUrl} size={44} ring={false} />
                    <span>
                      <strong>{displayName(r)}</strong>
                      <small>@{r.username}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
