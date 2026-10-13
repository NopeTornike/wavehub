import { useRouter } from 'next/router'
import { useEffect, useState, type ReactNode } from 'react'
import type { PublicContentPage } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'

// Renders whatever the admin Content section publishes at this slug (backend/src/content/) in the
// prototype's policy-page design (terms-of-service.html etc.: `.policy-hero` with the kicker, title
// and intro, then numbered `.policy-content` section cards). The CMS body is plain text, so it's
// parsed into that structure: blank-line-separated blocks; the first all-caps line is the document
// title (the page title is used instead); a single short line that doesn't end in sentence
// punctuation is a section heading ("3 Wallet" keeps its number, an unnumbered heading is numbered
// in order); "– " / "- " / "• " lines are list items; a short "Label:" line is bold, as on the
// prototype. Everything before the first heading is the hero intro.

const KICKERS: Record<string, string> = {
  'terms-of-service': 'Terms of Service',
  'privacy-policy': 'Privacy Policy',
  'refund-policy': 'Refund & Cancellation Policy',
  'delivery-policy': 'Delivery Policy',
  'dispute-resolution': 'Dispute Resolution Policy',
  'community-guidelines': 'Community Guidelines',
  contact: 'Contact Information',
  about: 'About WaveHubX',
  'coach-standards': 'Coach Standards & Code of Conduct',
  'seller-standards': 'Seller Standards & Code of Conduct',
  'payment-policy': 'Payment & Pricing Policy',
  'wallet-policy': 'Wallet Policy',
}

type Section = { number: string; heading: string; lines: string[] }

const BULLET = /^[–\-•]\s+/

function isHeading(block: string[]) {
  if (block.length !== 1) return false
  const line = block[0]
  return line.length <= 90 && !/[.:;!?,]$/.test(line) && !BULLET.test(line)
}

function parseBody(body: string): { intro: string[]; sections: Section[] } {
  const blocks = body
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean))
    .filter((block) => block.length > 0)
  // Drop the document's own all-caps title line (e.g. "WAVEHUBX — ᲛᲝᲛᲡᲐᲮᲣᲠᲔᲑᲘᲡ ᲞᲘᲠᲝᲑᲔᲑᲘ").
  if (blocks[0]?.length === 1 && blocks[0][0] === blocks[0][0].toUpperCase() && /^WAVEHUBX/i.test(blocks[0][0])) blocks.shift()
  const intro: string[] = []
  const sections: Section[] = []
  for (const block of blocks) {
    if (isHeading(block)) {
      const match = /^(\d+)[.)]?\s+(.+)$/.exec(block[0])
      sections.push({ number: match ? match[1] : String(sections.length + 1), heading: match ? match[2] : block[0], lines: [] })
    } else if (sections.length === 0) {
      intro.push(...block)
    } else {
      sections[sections.length - 1].lines.push(...block)
    }
  }
  return { intro, sections }
}

function renderLines(lines: string[]): ReactNode[] {
  const out: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) out.push(<ul key={`ul-${out.length}`}>{list.map((item, i) => <li key={i}>{item}</li>)}</ul>)
    list = []
  }
  lines.forEach((line) => {
    if (BULLET.test(line)) {
      list.push(line.replace(BULLET, ''))
      return
    }
    flush()
    out.push(<p key={`p-${out.length}`}>{line.endsWith(':') && line.length <= 20 ? <strong>{line}</strong> : line}</p>)
  })
  flush()
  return out
}
export default function ContentPage() {
  const router = useRouter()
  const { slug } = router.query as { slug?: string }

  const [page, setPage] = useState<PublicContentPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    api
      .getContentPage(slug)
      .then((data) => {
        if (!cancelled) setPage(data)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'გვერდი ვერ მოიძებნა.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const parsed = page ? parseBody(page.body) : null

  return (
    <Layout title={page?.title ?? 'გვერდი'} noIndex={!page} bodyClass="policy-page-body" mainClass="policy-main-panel">
      {loading ? (
        <div className="marketplace-empty">იტვირთება…</div>
      ) : error || !page || !parsed ? (
        <div className="marketplace-empty">{error || 'გვერდი ვერ მოიძებნა.'}</div>
      ) : (
        <article className="policy-page" aria-labelledby="policyTitle">
          <header className="policy-hero">
            <p>
              <span></span>
              <b>{KICKERS[page.slug] ?? 'WaveHubX'}</b>
              <span></span>
            </p>
            <h1 id="policyTitle">{page.title}</h1>
            {parsed.intro.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </header>
          <div className="policy-content">
            {parsed.sections.map((section, index) => (
              <section key={index}>
                <h2>
                  <span>{section.number}</span> {section.heading}
                </h2>
                {renderLines(section.lines)}
              </section>
            ))}
          </div>
        </article>
      )}
    </Layout>
  )
}
