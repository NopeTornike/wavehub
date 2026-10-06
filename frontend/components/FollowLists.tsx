import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PublicFollowEntry } from '@wavehub/shared-types'
import { api, errorMessage } from '../lib/api'
import Avatar, { displayName } from './Avatar'

// The viewer's own follow lists (client feedback #15): who I follow — with Unfollow — and who
// follows me. Newest first.
export default function FollowLists() {
  const [tab, setTab] = useState<'following' | 'followers'>('following')
  const [rows, setRows] = useState<PublicFollowEntry[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // Reload when the tab changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(null)
    ;(tab === 'following' ? api.listMyFollowing() : api.listMyFollowers())
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.'))
      })
    return () => {
      cancelled = true
    }
  }, [tab])

  const unfollow = async (entry: PublicFollowEntry) => {
    setBusy(entry.id)
    try {
      await api.unfollowUser(entry.username)
      setRows((list) => list?.filter((r) => r.id !== entry.id) ?? null)
    } catch (err) {
      setError(errorMessage(err, 'გამოწერის გაუქმება ვერ მოხერხდა.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="profile-record-section follow-lists" aria-labelledby="followListsTitle">
      <div className="section-heading">
        <div>
          <p className="section-kicker">საზოგადოება</p>
          <h2 id="followListsTitle">გამოწერილები და გამომწერები</h2>
        </div>
      </div>
      <div className="follow-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'following'} className={tab === 'following' ? 'active' : ''} onClick={() => setTab('following')}>
          ვისაც გამოვიწერე
        </button>
        <button type="button" role="tab" aria-selected={tab === 'followers'} className={tab === 'followers' ? 'active' : ''} onClick={() => setTab('followers')}>
          ჩემი გამომწერები
        </button>
      </div>
      {error && <p className="seller-status error">{error}</p>}
      {rows === null ? (
        <p className="note">იტვირთება…</p>
      ) : rows.length === 0 ? (
        <div className="marketplace-empty">{tab === 'following' ? 'ჯერ არავინ გამოგიწერია.' : 'გამომწერები ჯერ არ გყავს.'}</div>
      ) : (
        <ul className="follow-list">
          {rows.map((entry) => (
            <li key={entry.id}>
              <Link href={`/u/${entry.username}`} className="follow-person">
                <Avatar name={displayName(entry)} src={entry.avatarUrl} size={42} />
                <span>
                  <strong>{displayName(entry)}</strong>
                  <small>@{entry.username}</small>
                </span>
              </Link>
              {tab === 'following' && (
                <button type="button" className="button ghost" disabled={busy === entry.id} onClick={() => void unfollow(entry)}>
                  გამოწერის გაუქმება
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
