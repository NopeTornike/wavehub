import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { FaqEntry, PublicCategory, PublicGame, RequirementField } from '@wavehub/shared-types'
import { ListingType } from '@wavehub/shared-types'
import Layout from '../../../components/Layout'
import { FaqEditor, RequirementsEditor, cleanFaq, cleanRequirements, validateServiceExtras } from '../../../components/ServiceEditors'
import { api, errorMessage, type MyListing } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { gameCover } from '../../../lib/games'
import { LISTING_STATUS_LABELS } from '../../../lib/labels'

// Sell a service (rank push, duo play, coaching-style help, account setup…). Step 1 here: category,
// game, title, description, the questions the buyer answers and an FAQ. Step 2 on
// /sell/services/[id]: packages (what the buyer actually pays for), photos, submit for review.
// Bounds mirror CreateListingDto (title 5–100, description 50–5000).

const STARTER_QUESTIONS: RequirementField[] = [{ key: 'q_ingame', label: 'თამაშის სახელი / ID', type: 'text', required: true }]

export default function SellServices() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const userId = user?.id
  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [games, setGames] = useState<PublicGame[]>([])
  const [mine, setMine] = useState<MyListing[] | null>(null)
  const [form, setForm] = useState({ categoryId: '', gameId: '', title: '', description: '' })
  const [questions, setQuestions] = useState<RequirementField[]>(STARTER_QUESTIONS)
  const [faq, setFaq] = useState<FaqEntry[]>([])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (checked && !user) router.replace('/login?next=/sell/services')
  }, [checked, user, router])

  useEffect(() => {
    api.listCategories().then((rows) => setCategories(rows.filter((c) => c.type === 'service' || c.type === 'both'))).catch(() => undefined)
    api.listGames().then(setGames).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!userId) return
    api
      .listMyListings()
      .then((rows) => setMine(rows.filter((row) => row.type === ListingType.Service)))
      .catch(() => setMine([]))
  }, [userId])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const title = form.title.trim()
    const description = form.description.trim()
    if (!form.categoryId) return setError('აირჩიეთ სერვისის კატეგორია.')
    if (title.length < 5 || title.length > 100) return setError('სათაური უნდა იყოს 5–100 სიმბოლო.')
    if (description.length < 50 || description.length > 5000) return setError('აღწერა უნდა იყოს 50–5000 სიმბოლო.')
    const invalid = validateServiceExtras(questions, faq)
    if (invalid) return setError(invalid)
    setCreating(true)
    try {
      const listing = await api.createServiceListing({
        categoryId: form.categoryId,
        gameId: form.gameId || undefined,
        title,
        description,
        requirementsSchema: cleanRequirements(questions),
        faq: cleanFaq(faq),
      })
      router.push(`/sell/services/${listing.id}?created=1`)
    } catch (err) {
      setError(errorMessage(err, 'სერვისის შექმნა ვერ მოხერხდა.'))
      setCreating(false)
    }
  }

  return (
    <Layout title="სერვისის გაყიდვა" noIndex>
      <div className="sp-page sv-page">
        <header className="sp-head">
          <div>
            <p className="sp-kicker">გამყიდველის პანელი</p>
            <h1>სერვისის გაყიდვა</h1>
            <p>რანკის აწევა, დუო თამაში, ანგარიშის მოწყობა და სხვა — შექმენით სერვისი, დაამატეთ პაკეტები და გაგზავნეთ შესამოწმებლად.</p>
          </div>
        </header>

        <ol className="sv-steps" aria-label="ნაბიჯები">
          <li className="active">1. აღწერა და კითხვები</li>
          <li>2. პაკეტები და ფოტოები</li>
          <li>3. შემოწმება და გამოქვეყნება</li>
        </ol>

        <form className="sp-card sp-form" onSubmit={create}>
          <h2>ახალი სერვისი</h2>
          <fieldset className="sp-field">
            <legend>კატეგორია</legend>
            <div className="sv-chips" role="radiogroup">
              {categories.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={form.categoryId === c.id} className={form.categoryId === c.id ? 'active' : undefined} onClick={() => setForm((f) => ({ ...f, categoryId: c.id }))}>
                  {c.name}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="sv-grid-2">
            <label className="sp-field">
              <span>თამაში</span>
              <select value={form.gameId} onChange={(e) => setForm((f) => ({ ...f, gameId: e.target.value }))}>
                <option value="">ზოგადი (ყველა თამაში)</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="sp-field">
              <span>სათაური</span>
              <input maxLength={100} value={form.title} placeholder="მაგ. რანკის აწევა Ace-მდე 3 დღეში" onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </label>
          </div>
          <label className="sp-field">
            <span>
              აღწერა <small className="sv-count">{form.description.trim().length}/50+</small>
            </span>
            <textarea rows={6} maxLength={5000} value={form.description} placeholder="რას აკეთებთ, როგორ, რა გარანტიებით…" onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </label>
          <fieldset className="sp-field">
            <legend>კითხვები მყიდველისთვის</legend>
            <p className="sv-muted">მყიდველი ამ კითხვებს შეკვეთისას პასუხობს (მაგ. რანგი, სერვერი, თამაშის ID).</p>
            <RequirementsEditor value={questions} onChange={setQuestions} />
          </fieldset>
          <fieldset className="sp-field">
            <legend>ხშირად დასმული კითხვები (არასავალდებულო)</legend>
            <FaqEditor value={faq} onChange={setFaq} />
          </fieldset>
          {error && (
            <p className="sp-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="sp-primary" disabled={creating}>
            {creating ? 'იქმნება…' : 'გაგრძელება — პაკეტები'}
          </button>
        </form>

        <section className="sp-card sp-tickets">
          <header>
            <h2>ჩემი სერვისები</h2>
          </header>
          {mine === null ? (
            <p className="sp-empty">იტვირთება…</p>
          ) : mine.length === 0 ? (
            <p className="sp-empty">სერვისები ჯერ არ გაქვთ.</p>
          ) : (
            <ul className="sp-ticket-list">
              {mine.map((listing) => {
                const image = listing.images?.[0]?.url ?? gameCover(listing.game?.slug)
                return (
                  <li key={listing.id}>
                    <Link href={`/sell/services/${listing.id}`} className="sp-ticket">
                      <span className="sp-ticket-icon sv-thumb" style={image ? { backgroundImage: `url("${image}")` } : undefined} />
                      <span className="sp-ticket-copy">
                        <strong>{listing.title}</strong>
                        <small>{listing.game?.name ?? 'ზოგადი'}</small>
                      </span>
                      <em className={`sp-status sv-status-${listing.status}`}>{LISTING_STATUS_LABELS[listing.status] ?? listing.status}</em>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  )
}
