/* eslint-disable @next/next/no-img-element */
import { useState } from 'react'

// A person's photo, or their initials when they have none (client feedback #9/#13, 2026-10-04:
// people are shown by name + photo everywhere). Optional role marker (no online dot — owner 2026-11-14).
export function displayName(p: { firstName?: string | null; lastName?: string | null; username: string }): string {
  return [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.username
}

export default function Avatar({
  name,
  src,
  size = 44,
  ring = true,
  className = '',
}: {
  name: string
  src?: string | null
  size?: number
  // Ignored: no online indicators on the site (owner 2026-11-14). Kept so callers still compile.
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
  // Remembers which URL failed, so a new photo gets a fresh try without resetting state in an effect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = !!src && failedSrc === src
  return (
    <span className={`wh-avatar${ring ? ' has-ring' : ''} ${className}`.trim()} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden="true">
      {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} /> : <span>{initials || '?'}</span>}
    </span>
  )
}
