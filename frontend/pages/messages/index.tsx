import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { PublicConversationSummary, PublicMessage } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'

const POLL_MS = 5000

function initials(username: string) {
  return username.slice(0, 2).toUpperCase()
}

// Direct (non-order) messaging — LAUNCH_PLAN.md §4. Reuses messages.html's real
// `.direct-messages-shell` two-pane markup (contacts + thread in one page, not route-per-
// conversation, matching the prototype's own single-page design). A conversation only exists if
// the backend already found a real order/coaching session linking the two users — this page never
// lets you start one with an arbitrary user; that happens from an order/session detail page's
// "Message" button (`api.startDirectConversation`), which lands here via `?conversation=<id>`.
export default function Messages() {
  const router = useRouter()
  const { user: me, checked } = useAuth()
  const meId = me?.id
  const [conversations, setConversations] = useState<PublicConversationSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [thread, setThread] = useState<PublicMessage[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const historyRef = useRef<HTMLDivElement | null>(null)
  const requestedConversation = typeof router.query.conversation === 'string' ? router.query.conversation : undefined

  // Kept in a ref so the list refresh below doesn't need `selectedId` as a dependency (which would
  // re-fetch the whole list on every conversation switch).
  const selectedIdRef = useRef<string | null>(null)
  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  const loadConversations = useCallback(
    (preferId?: string) =>
      api
        .listDirectConversations()
        .then((rows) => {
          setConversations(rows)
          const wanted = preferId ?? requestedConversation
          if (wanted && rows.some((r) => r.id === wanted)) {
            setSelectedId(wanted)
          } else if (!selectedIdRef.current && rows.length > 0) {
            setSelectedId(rows[0].id)
          }
        })
        .catch((err) => setError(errorMessage(err, 'საუბრების ჩატვირთვა ვერ მოხერხდა.')))
        .finally(() => setLoadingList(false)),
    [requestedConversation],
  )

  useEffect(() => {
    if (!router.isReady || !meId) return
    void loadConversations()
  }, [router.isReady, meId, loadConversations])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingThread(true)
    const load = () => {
      api
        .listDirectMessages(selectedId)
        .then((rows) => {
          if (cancelled) return
          setThread(rows)
          setError('')
        })
        .catch((err) => {
          if (!cancelled) setError(errorMessage(err, 'შეტყობინებები ვერ ჩაიტვირთა.'))
        })
        .finally(() => {
          if (!cancelled) setLoadingThread(false)
        })
    }
    load()
    const interval = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [selectedId])

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [thread])

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!selectedId || !draft.trim() || sending) return
    setSending(true)
    setError('')
    try {
      const message = await api.sendDirectMessage(selectedId, draft.trim())
      setThread((prev) => [...prev, message])
      setDraft('')
      void loadConversations(selectedId)
    } catch (err) {
      setError(errorMessage(err, 'გაგზავნა ვერ მოხერხდა.'))
    } finally {
      setSending(false)
    }
  }

  // Enter sends, Shift+Enter inserts a newline (standard chat behavior; the textarea is otherwise a
  // multi-line field with no visible way to submit from the keyboard except tabbing to the button).
  const onDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }

  if (!checked) {
    return (
      <Layout title="შეტყობინებები" noIndex>
        <div className="page">
          <div className="page-inner">
            <div className="empty-state">იტვირთება…</div>
          </div>
        </div>
      </Layout>
    )
  }

  if (!me) {
    return (
      <Layout title="შეტყობინებები" noIndex>
        <div className="page">
          <div className="page-inner">
            <div className="empty-state">
              შეტყობინებების სანახავად გაიარეთ ავტორიზაცია. <Link href="/login?next=/messages">შესვლა</Link>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null

  return (
    <Layout title="შეტყობინებები" noIndex>
      <section className="messages-page">
        <section className="marketplace-head messages-hero" aria-labelledby="messagesTitle">
          <div className="messages-hero-copy">
            <span className="messages-hero-icon" aria-hidden="true">
              <Image className="message-icon-image" src="/assets/message-icon.svg" alt="" width={32} height={32} unoptimized />
            </span>
            <div>
              <p className="section-kicker">თქვენი საუბრები</p>
              <h1 id="messagesTitle">შეტყობინებები</h1>
              <p className="messages-hero-description">
                მიმოწერა მხოლოდ იმ მომხმარებლებთან, ვისთანაც უკვე გქონდათ შეკვეთა ან სესია.
              </p>
            </div>
          </div>
          <div className="marketplace-total" aria-label="საუბრების რაოდენობა">
            <strong>{conversations.length}</strong>
            <span>საუბარი</span>
          </div>
        </section>

        {error && (
          <div className="status-text status-error" role="alert">
            {error}
          </div>
        )}

        <section className="direct-messages-shell" aria-label="პირდაპირი მიმოწერა">
          <aside className="direct-message-contacts">
            <header>
              <p className="section-kicker">შემოსული</p>
              <h2>საუბრები</h2>
            </header>
            <div>
              {loadingList ? (
                <p className="direct-message-empty">იტვირთება…</p>
              ) : conversations.length === 0 ? (
                <p className="direct-message-empty">
                  საუბრები არ არის. შეკვეთის ან სესიის დეტალურ გვერდზე გამოჩნდება &quot;მესიჯის გაგზავნა&quot; ღილაკი.
                </p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`direct-contact${c.id === selectedId ? ' active' : ''}`}
                    aria-current={c.id === selectedId ? 'true' : undefined}
                    onClick={() => {
                      if (c.id === selectedId) return
                      setThread([])
                      setSelectedId(c.id)
                    }}
                  >
                    <span className="message-avatar" aria-hidden="true">
                      {initials(c.otherUser.username)}
                    </span>
                    <span>
                      <strong>@{c.otherUser.username}</strong>
                      <small>{c.lastMessage?.body || 'დაიწყეთ საუბარი'}</small>
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="direct-message-thread" aria-labelledby="directMessageTitle">
            <header>
              <span className="message-avatar" aria-hidden="true">
                {selected ? initials(selected.otherUser.username) : '?'}
              </span>
              <div>
                <h2 id="directMessageTitle">{selected ? `@${selected.otherUser.username}` : 'აირჩიეთ საუბარი'}</h2>
                {!selected && <small>აირჩიეთ მომხმარებელი მარცხნივ</small>}
              </div>
            </header>

            <div className="direct-message-history" ref={historyRef} role="log" aria-live="polite" aria-label="შეტყობინებები">
              {!selected ? (
                <p className="direct-message-empty">თქვენი საუბარი აქ გამოჩნდება.</p>
              ) : loadingThread && thread.length === 0 ? (
                <p className="direct-message-empty">იტვირთება…</p>
              ) : thread.length === 0 ? (
                <p className="direct-message-empty">შეტყობინებები არ არის. დაწერეთ პირველი!</p>
              ) : (
                thread.map((m) => (
                  <article key={m.id} className={`direct-message-bubble ${m.senderId === me.id ? 'mine' : 'theirs'}`}>
                    <p>{m.body}</p>
                    <small>{new Date(m.createdAt).toLocaleString('ka-GE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
                  </article>
                ))
              )}
            </div>

            <form className="direct-message-form" onSubmit={send}>
              <textarea
                maxLength={2000}
                placeholder="დაწერეთ შეტყობინება..."
                aria-label="შეტყობინება"
                required
                disabled={!selected || sending}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onDraftKeyDown}
              />
              <button type="submit" disabled={!selected || sending || !draft.trim()}>
                {sending ? 'იგზავნება…' : 'გაგზავნა'} <span aria-hidden="true">→</span>
              </button>
            </form>

            <p className="seller-status">
              შეკვეთასთან ან გადახდასთან დაკავშირებით დახმარება გჭირდებათ? პირდაპირი მიმოწერა განკუთვნილია მხოლოდ
              კოორდინაციისთვის — ნებისმიერი შეკვეთის/გადახდის საკითხი მხარდაჭერის გუნდთან უნდა გადაწყდეს.{' '}
              <Link href="/support">მხარდაჭერის გახსნა</Link>
            </p>
          </section>
        </section>
      </section>
    </Layout>
  )
}
