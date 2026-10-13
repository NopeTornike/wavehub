import Link from 'next/link'
import type { ReactNode } from 'react'

// The prototype's `.profile-record-card` (profile.html / orders.html record grids): a cover thumb
// (image or initials) linking to the record, a title/meta/footer stack and optional action buttons.
export default function RecordCard(props: {
  href: string
  image?: string | null
  fallback: string
  title: string
  meta: string
  footer: string
  actions?: ReactNode
}) {
  return (
    <article className="profile-record-card">
      <Link
        className="profile-record-thumb"
        href={props.href}
        aria-label={`Open ${props.title}`}
        style={props.image ? { backgroundImage: `linear-gradient(180deg, rgba(5, 8, 19, 0.08), rgba(5, 8, 19, 0.45)), url("${props.image}")` } : undefined}
      >
        {props.image ? '' : props.fallback}
      </Link>
      <div className="profile-record-copy">
        <strong>{props.title}</strong>
        <span>{props.meta}</span>
        <small>{props.footer}</small>
        {props.actions && <div className="profile-record-actions">{props.actions}</div>}
      </div>
    </article>
  )
}
