import Link from 'next/link'
import { useId } from 'react'
import { useAuth } from '../../lib/auth'
import { useAuthModal } from '../../lib/auth-modal'
import { useFeatures } from '../../lib/features'

// Home: the "Rewards Center" strip under the hero banner (owner 2026-11-12,
// docs/design-mockups/round-6/12). A tap opens the User Hub; signed-out visitors get the login
// window first and land on /hub after it. Hidden while Super Admin has the rewards hub switched off.
export default function RewardsCenterCard() {
  const features = useFeatures()
  const { user, checked } = useAuth()
  const { openLogin } = useAuthModal()
  if (!features?.rewardsHub || !checked) return null

  const body = (
    <>
      <GiftBox />
      <span className="rc-copy">
        <strong>Rewards Center</strong>
        <small>შეასრულე დავალებები, დააგროვე XP და მიიღე ექსკლუზიური ჯილდოები!</small>
      </span>
      <svg className="rc-arrow" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m9 5 7 7-7 7" />
      </svg>
    </>
  )

  return user ? (
    <Link className="rc-card" href="/hub" aria-label="Rewards Center — User Hub">
      {body}
    </Link>
  ) : (
    <Link
      className="rc-card"
      href="/login?next=/hub"
      aria-label="Rewards Center — User Hub"
      onClick={(event) => {
        event.preventDefault()
        openLogin('/hub')
      }}
    >
      {body}
    </Link>
  )
}

// A drawn pink gift box with the WaveHubX "W" on its front (no stock art).
function GiftBox() {
  const id = useId().replace(/:/g, '')
  return (
    <svg className="rc-gift" viewBox="0 0 120 110" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7be0" />
          <stop offset="1" stopColor="#b02cff" />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c43cf0" />
          <stop offset="1" stopColor="#6d18b8" />
        </linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffa3ee" />
          <stop offset="1" stopColor="#e04cff" />
        </linearGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffe0fa" />
          <stop offset="1" stopColor="#ff6ad5" />
        </linearGradient>
        <radialGradient id={`${id}g`} cx=".5" cy=".6" r=".5">
          <stop offset="0" stopColor="#e04cff" stopOpacity=".65" />
          <stop offset="1" stopColor="#e04cff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="72" rx="58" ry="38" fill={`url(#${id}g)`} />
      {/* box: front, side, lid */}
      <path d="M22 48h52v52H22z" fill={`url(#${id}f)`} />
      <path d="M74 48l22-9v52l-22 9z" fill={`url(#${id}s)`} />
      <path d="M17 36h60v14H17z" fill={`url(#${id}l)`} />
      <path d="M77 36l23-9v14l-23 9z" fill="#c43cf0" />
      <path d="M17 36l23-9h60l-23 9z" fill="#ffb8f2" />
      {/* ribbon */}
      <path d="M43 36h10v14H43z" fill={`url(#${id}r)`} />
      <path d="M86 31.6v51.4l-6 2.4V34z" fill="#ff8ae2" opacity=".75" />
      {/* bow */}
      <path d="M48 30c-14-14-30-8-22 2 5 6 16 2 22-2Z" fill="#ff7be0" stroke="#fff" strokeWidth="2" />
      <path d="M50 30c10-17 28-14 22-3-4 7-15 5-22 3Z" fill="#ff4fd8" stroke="#fff" strokeWidth="2" />
      <circle cx="49" cy="30" r="4.5" fill="#ffd0f6" />
      {/* W on the front */}
      <path d="M27 66l5 18 5-12 5 12 5-18" fill="none" stroke="#3a0d6e" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" opacity=".5" transform="translate(9 2)" />
      <path d="M27 66l5 18 5-12 5 12 5-18" fill="none" stroke="#fff" strokeWidth="4.2" strokeLinejoin="round" strokeLinecap="round" transform="translate(9 0)" />
      {/* sparkles */}
      <path d="M104 14l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z" fill="#fff" opacity=".9" />
      <path d="M12 22l1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1z" fill="#ffb8f2" />
    </svg>
  )
}
