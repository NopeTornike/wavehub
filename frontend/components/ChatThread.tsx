import Link from 'next/link'
import { useEffect, useRef, type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
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
  // An attached file (support tickets / live chat, 2026-10-24): images show inline.
  file?: { url: string; type: string | null; name: string | null } | null
  // A centred automatic line (the live chat's greeting, "operator joined"…), not a person's bubble.
  system?: boolean
  // With `system`: shows a small spinner (e.g. "connecting you to an operator…").
  pending?: boolean
}

// Files a support thread accepts (StorageService byte-checks them): photos, PDF, Word .docx, ZIP.
export const CHAT_FILE_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf,.docx,.zip,application/zip'
export const CHAT_FILE_MAX_BYTES = 10 * 1024 * 1024

// The paperclip button beside a chat composer.
export function AttachButton({ onFile, disabled }: { onFile: (file: File) => void; disabled?: boolean }) {
  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onFile(file)
  }
  return (
    <label className={`chat-attach${disabled ? ' disabled' : ''}`} title="ფაილის მიმაგრება" aria-label="ფაილის მიმაგრება">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/ui/paperclip.png" alt="" aria-hidden="true" />
      <input type="file" accept={CHAT_FILE_ACCEPT} className="sr-only" disabled={disabled} onChange={pick} />
    </label>
  )
}

function ChatFile({ file }: { file: NonNullable<ChatThreadMessage['file']> }) {
  if (file.type?.startsWith('image/')) {
    return (
      <a className="chat-file-image" href={file.url} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={file.url} alt={file.name ?? 'ფოტო'} loading="lazy" />
      </a>
    )
  }
  return (
    <a className="chat-file" href={file.url} target="_blank" rel="noopener noreferrer" download={file.name ?? undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/ui/paperclip.png" alt="" aria-hidden="true" />
      <span>{file.name || 'ფაილი'}</span>
    </a>
  )
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
  onAttach,
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
  // Shows a paperclip in the default composer.
  onAttach?: (file: File) => void
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
          messages.map((m) =>
            m.system ? (
              <p key={m.id} className={`chat-system${m.pending ? ' is-pending' : ''}`}>
                {m.pending && <span className="chat-spinner" aria-hidden="true" />}
                <span>{m.body}</span>
              </p>
            ) : (
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
                {m.body && m.body.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                {m.file && <ChatFile file={m.file} />}
              </article>
            </div>
            ),
          )
        )}
      </div>

      {composer ?? (
        <form className={`direct-message-form${onAttach ? ' has-attach' : ''}`} onSubmit={submit}>
          {onAttach && <AttachButton onFile={onAttach} disabled={disabled || sending} />}
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
