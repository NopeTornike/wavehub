import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PublicTicket } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import ChatThread, { CHAT_FILE_MAX_BYTES, type ChatThreadMessage } from '../../components/ChatThread'
import { displayName } from '../../components/Avatar'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'

// Live support chat (owner 2026-10-24: "Contact support" opens a chat straight with support; tickets
// stay at /support). Backed by a ticket on the 'chat' channel (backend/src/support/CLAUDE.md).
// The automatic lines describe the chat's real state and are not stored:
//   - a greeting, always;
//   - after the first message: request received + a "connecting you to an operator…" spinner;
//   - 75 seconds later with nobody joined: the owner's "thanks for waiting" line;
//   - when a staff member joins: "<first name> joined the conversation", at the time they joined.
const POLL_MS = 5000
const WAIT_NOTICE_MS = 75_000

export default function SupportLiveChat() {
  const router = useRouter()
  const { user: me, checked } = useAuth()
  const [chat, setChat] = useState<PublicTicket | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (checked && !me) router.push('/login?next=/support/chat')
  }, [checked, me, router])

  const reload = useCallback(async () => {
    try {
      setChat(await api.getLiveChat())
    } catch (err) {
      setError(errorMessage(err, 'ჩატის ჩატვირთვა ვერ მოხერხდა.'))
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!me) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
    const timer = window.setInterval(() => {
      setNow(Date.now())
      if (document.visibilityState === 'visible') void reload()
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [me, reload])

  const send = async () => {
    const body = draft.trim()
    if (!body) return
    setSending(true)
    setError('')
    try {
      setChat(await api.sendLiveChat(body))
      setDraft('')
      setNow(Date.now())
    } catch (err) {
      setError(errorMessage(err, 'შეტყობინების გაგზავნა ვერ მოხერხდა.'))
    } finally {
      setSending(false)
    }
  }

  const attach = async (file: File) => {
    if (file.size > CHAT_FILE_MAX_BYTES) {
      setError('ფაილი 10MB-ზე დიდი არ უნდა იყოს.')
      return
    }
    setSending(true)
    setError('')
    try {
      // A file can't open a chat by itself: the first line opens it.
      const target = chat ?? (await api.sendLiveChat('📎 ფაილი'))
      setChat(await api.attachToTicket(target.id, file))
    } catch (err) {
      setError(errorMessage(err, 'ფაილის ატვირთვა ვერ მოხერხდა.'))
    } finally {
      setSending(false)
    }
  }

  const messages = useMemo<ChatThreadMessage[]>(() => {
    const support = (id: string, body: string, at: string): ChatThreadMessage => ({
      id,
      mine: false,
      name: 'WaveHubX Support',
      avatarUrl: null,
      avatarFallback: '/assets/whx-icon-192.png',
      body,
      createdAt: at,
    })
    // The owner's exact wording (round 4, 01.jpg). Each line is a separate paragraph so each has its
    // own English entry.
    const greeting = support(
      'greeting',
      '👋 გამარჯობა! კეთილი იყოს შენი მობრძანება WaveHubX-ის მხარდაჭერის ცენტრში.\nმოგვწერე, რაში გჭირდება დახმარება. ჩვენი გუნდი მზადაა დაგეხმაროს! 💜',
      chat?.createdAt ?? new Date(now).toISOString(),
    )
    if (!chat) return [greeting]
    const items: ChatThreadMessage[] = chat.messages.map((m) => ({
      id: m.id,
      mine: m.senderId === me?.id,
      name: m.senderId === me?.id ? 'თქვენ' : `Support — ${displayName({ firstName: m.senderFirstName, lastName: m.senderLastName, username: m.senderUsername })}`,
      avatarUrl: m.senderAvatarUrl,
      avatarFallback: m.fromSupport ? '/assets/whx-icon-192.png' : undefined,
      body: m.body,
      createdAt: m.createdAt,
      file: m.fileUrl ? { url: m.fileUrl, type: m.fileType, name: m.fileName } : null,
    }))
    const first = chat.messages.find((m) => !m.fromSupport)
    const system: ChatThreadMessage[] = []
    const sys = (id: string, body: string, at: string, pending = false): ChatThreadMessage => ({ id, mine: false, name: '', avatarUrl: null, body, createdAt: at, system: true, pending })
    if (first) {
      const firstAt = new Date(first.createdAt).getTime()
      system.push(support('received', '✅ შენი მოთხოვნა მიღებულია. ამჟამად ვეძებთ თავისუფალ ოპერატორს. გთხოვ, დაელოდო მის ჩართვას.', new Date(firstAt + 1).toISOString()))
      if (chat.operator) {
        system.push(sys('joined', `🟢 WaveHubX-ის საფორთი ${chat.operator.firstName} შემოუერთდა საუბარს.`, chat.operator.joinedAt))
      } else if (now - firstAt >= WAIT_NOTICE_MS) {
        system.push(
          sys(
            'waiting',
            '⏳ მადლობა მოთმინებისთვის! ჩვენი გუნდი მალე დაგიკავშირდება. შეგიძლია წინასწარ მოგვწერო პრობლემის დეტალები, რათა უფრო სწრაფად დაგეხმაროთ.',
            new Date(firstAt + WAIT_NOTICE_MS).toISOString(),
          ),
        )
      }
    }
    const sorted = [...items, ...system].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    // While nobody has joined, the spinner stays last.
    if (first && !chat.operator) sorted.push(sys('connecting', 'ოპერატორთან დაკავშირება...', new Date(now).toISOString(), true))
    return [greeting, ...sorted]
  }, [chat, me, now])

  return (
    <Layout title="Support ჩატი" noIndex>
      <div className="sp-page sp-live">
        <div className="sp-live-head">
          <Link className="sp-back" href="/support">
            <span aria-hidden="true">&lt;</span> ჩემი ბილეთები
          </Link>
        </div>
        {!loaded ? (
          <p className="sp-card sp-empty">იტვირთება…</p>
        ) : (
          <ChatThread
            title={chat?.operator ? `Support — ${chat.operator.firstName}` : 'WaveHubX Support'}
            subtitle={chat?.operator ? 'ონლაინ ჩატი' : 'ჩვეულებრივ ვპასუხობთ რამდენიმე წუთში'}
            headAvatarUrl={chat?.operator?.avatarUrl ?? null}
            headAvatarFallback="/assets/whx-icon-192.png"
            messages={messages}
            draft={draft}
            onDraft={setDraft}
            onSend={() => void send()}
            onAttach={(file) => void attach(file)}
            sending={sending}
            placeholder="დაწერე შეტყობინება…"
            footer={
              error ? (
                <p className="sp-error" role="alert">
                  {error}
                </p>
              ) : null
            }
          />
        )}
      </div>
    </Layout>
  )
}
