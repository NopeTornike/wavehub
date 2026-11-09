/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react'

// A person's photo, or their initials when they have none (client feedback #9/#13, 2026-10-04:
// people are shown by name + photo everywhere). Optional online dot and role marker.
export function displayName(p: { firstName?: string | null; lastName?: string | null; username: string }): string {
  return [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.username
}

export default function Avatar({
  name,
  src,
  size = 44,
  online,
  ring = true,
  className = '',
}: {
  name: string
  src?: string | null
  size?: number
  online?: boolean
  ring?: boolean
  className?: string
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
  // A photo that fails to load (deleted upload, bad URL) falls back to the initials, never a broken image.
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return (
    <span className={`wh-avatar${ring ? ' has-ring' : ''} ${className}`.trim()} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden="true">
      {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span>{initials || '?'}</span>}
      {online && <i className="wh-avatar-online" />}
    </span>
  )
}
