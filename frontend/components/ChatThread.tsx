import Link from 'next/link'
import { useEffect, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import Avatar from './Avatar'
import { kaDayMonth, kaTime } from '../lib/dates'

export type ChatThreadMessage = {
  id: string
  mine: boolean
  name: string
  avatarUrl: string | null
  // A fixed picture instead of the person's photo (the WHX logo for support without a photo).
  avatarFallback?: string
  body: string
  createdAt: string
  // Visually distinct "internal note" bubbles (staff side only).
  note?: boolean
}

// The direct-message chat look (pages/messages: `.direct-message-*` CSS) as a reusable thread, so
// support tickets look exactly like site messages (client 2026-10-07): a header with the other
// side's photo + name, bubbles with avatars and "name · time", and the composer.
export default function ChatThread({
  title,
  subtitle,
  headAvatarUrl,
  headAvatarFallback,
  headHref,
  messages,
  empty = 'შეტყობინებები ჯერ არ არის.',
  draft,
  onDraft,
  onSend,
  sending,
  disabled,
  placeholder = 'დაწერეთ შეტყობინება...',
  footer,
  composer,
}: {
  title: string
  subtitle?: string
  headAvatarUrl?: string | null
  headAvatarFallback?: string
  headHref?: string
  messages: ChatThreadMessage[]
  empty?: string
  draft: string
  onDraft: (value: string) => void
  onSend: () => void
  sending?: boolean
  disabled?: boolean
  placeholder?: string
  footer?: ReactNode
  // Replaces the default composer (e.g. a staff reply area with extra controls).
  composer?: ReactNode
}) {
  const history = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = history.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (draft.trim() && !sending && !disabled) onSend()
  }
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (draft.trim() && !sending && !disabled) onSend()
    }
  }
  const headPerson = (
    <>
      {headAvatarFallback && !headAvatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="chat-head-logo" src={headAvatarFallback} alt="" aria-hidden="true" />
      ) : (
        <Avatar name={title} src={headAvatarUrl ?? null} size={46} />
      )}
      <div>
        <h2>{title}</h2>
        {subtitle && <small>{subtitle}</small>}
      </div>
    </>
  )

  return (
    <section className="direct-message-thread chat-thread">
      <header>
        {headHref ? (
          <Link href={headHref} className="dm-head-person">
            {headPerson}
          </Link>
        ) : (
          <div className="dm-head-person">{headPerson}</div>
        )}
      </header>

      <div className="direct-message-history" ref={history} role="log" aria-live="polite" aria-label="შეტყობინებები">
        {messages.length === 0 ? (
          <p className="direct-message-empty">{empty}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`direct-message-row ${m.mine ? 'mine' : 'theirs'}`}>
              {m.avatarFallback && !m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="direct-message-avatar chat-logo-avatar" src={m.avatarFallback} alt="" aria-hidden="true" />
              ) : (
                <Avatar name={m.name} src={m.avatarUrl} size={34} ring={false} className="direct-message-avatar" />
              )}
              <article className={`direct-message-bubble ${m.mine ? 'mine' : 'theirs'}${m.note ? ' chat-note' : ''}`}>
                <div className="direct-message-meta">
                  <strong>{m.name}</strong>
                  <small>{`${kaDayMonth(m.createdAt)}, ${kaTime(m.createdAt)}`}</small>
                </div>
                <p>{m.body}</p>
              </article>
            </div>
          ))
        )}
      </div>

      {composer ?? (
        <form className="direct-message-form" onSubmit={submit}>
          <textarea maxLength={5000} placeholder={placeholder} aria-label="შეტყობინება" disabled={disabled || sending} value={draft} onChange={(e) => onDraft(e.target.value)} onKeyDown={onKey} />
          <button type="submit" disabled={disabled || sending || !draft.trim()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="dm-send-icon" src="/assets/ui/send-pink.png" alt="" aria-hidden="true" />
            {sending ? 'იგზავნება…' : 'გაგზავნა'}
          </button>
        </form>
      )}
      {footer}
    </section>
  )
}
