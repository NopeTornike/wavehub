import { useId } from 'react'

// The WaveHubX reward chest (owner 2026-11-10, round-6/02), drawn as SVG so it stays sharp and
// carries the brand "W". `open` lifts the lid (CSS `.rc-lid` transition) and lights the inside.
export default function RewardChest({ open = false, className = '', place }: { open?: boolean; className?: string; place?: number }) {
  // Several chests share a page: keep each one's gradient ids unique.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const tone = place === 1 ? '#ffd54a' : place === 2 ? '#dfe6ff' : place === 3 ? '#ff9a52' : '#d64aff'
  return (
    <svg className={`rc ${open ? 'is-open' : ''} ${className}`} viewBox="0 0 240 190" role="img" aria-label="პრიზის ყუთი">
      <defs>
        <linearGradient id={`rcBody${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b1856" />
          <stop offset="1" stopColor="#14081f" />
        </linearGradient>
        <linearGradient id={`rcLid${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4d2170" />
          <stop offset="1" stopColor="#24103a" />
        </linearGradient>
        <radialGradient id={`rcGlow${uid}`} cx="50%" cy="60%" r="60%">
          <stop offset="0" stopColor={tone} stopOpacity=".95" />
          <stop offset=".55" stopColor="#c03cff" stopOpacity=".35" />
          <stop offset="1" stopColor="#c03cff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`rcW${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7ae0" />
          <stop offset="1" stopColor="#b33cff" />
        </linearGradient>
      </defs>
      {/* floor glow */}
      <ellipse cx="120" cy="176" rx="96" ry="10" fill="#c03cff" opacity=".35" />
      {/* light from inside when open */}
      <g className="rc-light">
        <path d="M70 92 30 0h180l-40 92Z" fill={`url(#rcGlow${uid})`} />
        <ellipse cx="120" cy="96" rx="60" ry="18" fill={tone} opacity=".8" />
      </g>
      {/* body */}
      <path d="M40 96h160l-8 74a6 6 0 0 1-6 5H54a6 6 0 0 1-6-5Z" fill={`url(#rcBody${uid})`} stroke="#b44dff" strokeWidth="2.5" />
      <path d="M40 96h160" stroke="#ff8af0" strokeWidth="3" />
      <path d="M58 104v62M182 104v62" stroke="#7a33b0" strokeWidth="6" strokeLinecap="round" />
      <path d="M44 120h152M47 150h146" stroke="#2a1240" strokeWidth="4" />
      {/* the brand plate */}
      <rect x="92" y="112" width="56" height="44" rx="8" fill="#1a0b29" stroke="#d64aff" strokeWidth="2.5" />
      <path d="M100 124l8 22 7-15 5 0 7 15 8-22" fill="none" stroke={`url(#rcW${uid})`} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      {/* lid */}
      <g className="rc-lid">
        <path d="M36 96V70c0-22 18-38 40-38h88c22 0 40 16 40 38v26Z" fill={`url(#rcLid${uid})`} stroke="#b44dff" strokeWidth="2.5" />
        <path d="M56 96V62M184 96V62" stroke="#7a33b0" strokeWidth="6" strokeLinecap="round" />
        <path d="M44 74h152" stroke="#ff8af0" strokeWidth="2" opacity=".7" />
        <rect x="108" y="84" width="24" height="18" rx="4" fill="#ff8af0" stroke="#3b1856" strokeWidth="2" />
      </g>
      {/* sparkles */}
      <g className="rc-spark" fill="#ffd7ff">
        <path d="M24 60l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />
        <path d="M214 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
        <path d="M200 118l2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" />
      </g>
    </svg>
  )
}
