import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import type { PublicConversationSummary, PublicMessage } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, ApiError } from '../../lib/api'
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
  const { user: me } = useAuth()
  const [conversations, setConversations] = useState<PublicConversationSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [thread, setThread] = useState<PublicMessage[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const historyRef = useRef<HTMLDivElement | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadConversations = (preferId?: string) => {
    api
      .listDirectConversations()
      .then((rows) => {
        setConversations(rows)
        const wanted = preferId ?? (router.query.conversation as string | undefined)
        if (wanted && rows.some((r) => r.id === wanted)) {
          setSelectedId(wanted)
        } else if (!selectedId && rows.length > 0) {
          setSelectedId(rows[0].id)
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'საუბრების ჩატვირთვა ვერ მოხერხდა.'))
      .finally(() => setLoadingList(false))
  }

  useEffect(() => {
    if (!me) return
    loadConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, router.query.conversation])

  useEffect(() => {
    if (!selectedId) {
      return
    }
    const load = () => {
      api
        .listDirectMessages(selectedId)
        .then(setThread)
        .catch((err) => setError(err instanceof ApiError ? err.message : 'შეტყობინებები ვერ ჩაიტვირთა.'))
    }
    load()
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(load, POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [selectedId])

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [thread])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId || !draft.trim()) return
    setSending(true)
    setError('')
    try {
      const message = await api.sendDirectMessage(selectedId, draft.trim())
      setThread((prev) => [...prev, message])
      setDraft('')
      loadConversations(selectedId)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'გაგზავნა ვერ მოხერხდა.')
    } finally {
      setSending(false)
    }
  }

  if (!me) {
    return (
      <Layout>
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
    <Layout>
      <section className="messages-page">
        <section className="marketplace-head messages-hero" aria-labelledby="messagesTitle">
          <div className="messages-hero-copy">
            <span className="messages-hero-icon" aria-hidden="true">
              <img className="message-icon-image" src="/assets/message-icon.svg" alt="" />
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

        {error && <div className="status-text status-error">{error}</div>}

        <section className="direct-messages-shell" aria-label="Direct messages">
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
                    onClick={() => {
                      setThread([])
                      setSelectedId(c.id)
                    }}
                  >
                    <span className="message-avatar">{initials(c.otherUser.username)}</span>
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
              <span className="message-avatar">{selected ? initials(selected.otherUser.username) : '?'}</span>
              <div>
                <h2 id="directMessageTitle">{selected ? `@${selected.otherUser.username}` : 'აირჩიეთ საუბარი'}</h2>
                <small>{selected ? `@${selected.otherUser.username}` : 'აირჩიეთ მომხმარებელი მარცხნივ'}</small>
              </div>
            </header>

            <div className="direct-message-history" ref={historyRef} aria-live="polite">
              {!selected ? (
                <p className="direct-message-empty">თქვენი საუბარი აქ გამოჩნდება.</p>
              ) : thread.length === 0 ? (
                <p className="direct-message-empty">შეტყობინებები არ არის. დაწერეთ პირველი!</p>
              ) : (
                thread.map((m) => (
                  <article key={m.id} className={`direct-message-bubble ${m.senderId === me.id ? 'mine' : 'theirs'}`}>
                    <p>{m.body}</p>
                    <small>{new Date(m.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
                  </article>
                ))
              )}
            </div>

            <form className="direct-message-form" onSubmit={send}>
              <textarea
                maxLength={2000}
                placeholder="დაწერეთ შეტყობინება..."
                aria-label="Message"
                required
                disabled={!selected || sending}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" disabled={!selected || sending || !draft.trim()}>
                გაგზავნა <span aria-hidden="true">→</span>
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
