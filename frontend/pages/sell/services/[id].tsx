import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { FaqEntry, ListingForEdit, RequirementField } from '@wavehub/shared-types'
import { ListingStatus } from '@wavehub/shared-types'
import Layout from '../../../components/Layout'
import { FaqEditor, RequirementsEditor, cleanFaq, cleanRequirements, validateServiceExtras } from '../../../components/ServiceEditors'
import { api, errorMessage } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { LISTING_STATUS_LABELS } from '../../../lib/labels'

// Manage one service listing: packages (1–5; what the buyer pays for), photos, details, buyer
// questions, FAQ, and the review lifecycle. Any change to a live (active/paused) service sends it
// back to review server-side; while a service is in review nothing can be changed.
// Package bounds mirror CreatePackageDto: price 1–100000, delivery 1–90 days, ≤8 features, ≤20 revisions.

const MAX_PACKAGES = 5
const MAX_PHOTOS = 6
const EMPTY_PACKAGE = { name: '', price: '', days: '', revisions: '1', features: '' }

type Status = { kind: '' | 'error' | 'success'; text: string }

export default function ManageService() {
  const router = useRouter()
  const { id, created } = router.query as { id?: string; created?: string }
  const { user, checked } = useAuth()
  const userId = user?.id
  const [listing, setListing] = useState<ListingForEdit | null>(null)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState<Status>({ kind: '', text: '' })
  const [busy, setBusy] = useState('')
  const [details, setDetails] = useState({ title: '', description: '' })
  const [questions, setQuestions] = useState<RequirementField[]>([])
  const [faq, setFaq] = useState<FaqEntry[]>([])
  const [pkg, setPkg] = useState(EMPTY_PACKAGE)

  useEffect(() => {
    if (checked && !user) router.replace(`/login?next=/sell/services/${id ?? ''}`)
  }, [checked, user, router, id])

  const reload = useCallback(() => {
    if (!id) return Promise.resolve()
    return api
      .getMyListing(id)
      .then((data) => {
        setListing(data)
        setDetails({ title: data.title, description: data.description })
        setQuestions(data.requirementsSchema)
        setFaq(data.faq)
        setLoadError('')
      })
      .catch((err) => setLoadError(errorMessage(err, 'სერვისის ჩატვირთვა ვერ მოხერხდა.')))
  }, [id])

  useEffect(() => {
    if (userId && id) void reload()
  }, [userId, id, reload])

  const live = listing?.status === ListingStatus.Active || listing?.status === ListingStatus.Paused
  const locked = listing?.status === ListingStatus.PendingReview
  const reviewNote = live ? ' განცხადება ხელახლა გადის შემოწმებას.' : ''

  const run = async (key: string, action: () => Promise<unknown>, done: string) => {
    setBusy(key)
    setStatus({ kind: '', text: '' })
    try {
      await action()
      await reload()
      setStatus({ kind: 'success', text: done })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'მოქმედება ვერ შესრულდა.') })
    } finally {
      setBusy('')
    }
  }

  const addPackage = (event: FormEvent) => {
    event.preventDefault()
    if (!id) return
    const price = Number(pkg.price)
    const days = Number(pkg.days)
    const revisions = Number(pkg.revisions || 0)
    const features = pkg.features
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)
    if (!pkg.name.trim() || pkg.name.trim().length > 100) return setStatus({ kind: 'error', text: 'პაკეტის სახელი: 1–100 სიმბოლო.' })
    if (!Number.isInteger(price) || price < 1 || price > 100000) return setStatus({ kind: 'error', text: 'ფასი: მთელი რიცხვი, 1–100000 GEL.' })
    if (!Number.isInteger(days) || days < 1 || days > 90) return setStatus({ kind: 'error', text: 'მიწოდების ვადა: 1–90 დღე.' })
    if (!Number.isInteger(revisions) || revisions < 0 || revisions > 20) return setStatus({ kind: 'error', text: 'რევიზიები: 0–20.' })
    if (features.length > 8 || features.some((f) => f.length > 100)) return setStatus({ kind: 'error', text: 'მახასიათებლები: მაქს. 8, თითო 100 სიმბოლომდე.' })
    void run(
      'package',
      async () => {
        await api.addListingPackage(id, { name: pkg.name.trim(), priceWaveCoin: price, deliveryTimeDays: days, features, revisionsIncluded: revisions })
        setPkg(EMPTY_PACKAGE)
      },
      `პაკეტი დაემატა.${reviewNote}`,
    )
  }

  const saveDetails = () => {
    if (!id || !listing) return
    const title = details.title.trim()
    const description = details.description.trim()
    if (title.length < 5 || title.length > 100) return setStatus({ kind: 'error', text: 'სათაური უნდა იყოს 5–100 სიმბოლო.' })
    if (description.length < 50 || description.length > 5000) return setStatus({ kind: 'error', text: 'აღწერა უნდა იყოს 50–5000 სიმბოლო.' })
    const invalid = validateServiceExtras(questions, faq)
    if (invalid) return setStatus({ kind: 'error', text: invalid })
    void run('details', () => api.updateListing(id, { title, description, requirementsSchema: cleanRequirements(questions), faq: cleanFaq(faq) }), `ცვლილებები შენახულია.${reviewNote}`)
  }

  const addPhotos = (files: FileList | null) => {
    if (!id || !listing || !files?.length) return
    const room = MAX_PHOTOS - listing.images.length
    const picked = Array.from(files).slice(0, Math.max(0, room))
    if (picked.some((f) => !['image/png', 'image/jpeg', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024)) {
      return setStatus({ kind: 'error', text: 'მხოლოდ JPG, PNG ან WEBP სურათი, მაქსიმუმ 5MB.' })
    }
    void run(
      'photos',
      async () => {
        for (const file of picked) await api.uploadListingImage(id, file)
      },
      'ფოტოები დაემატა.',
    )
  }

  if (loadError) {
    return (
      <Layout title="სერვისი" noIndex>
        <div className="sp-page">
          <Link className="sp-back" href="/sell/services">
            <span aria-hidden="true">&lt;</span> ჩემი სერვისები
          </Link>
          <p className="sp-card sp-empty">{loadError}</p>
        </div>
      </Layout>
    )
  }
  if (!listing) {
    return (
      <Layout title="სერვისი" noIndex>
        <div className="sp-page">
          <p className="sp-card sp-empty">იტვირთება…</p>
        </div>
      </Layout>
    )
  }

  const canSubmit = listing.status === ListingStatus.Draft || listing.status === ListingStatus.Rejected

  return (
    <Layout title={listing.title} noIndex>
      <div className="sp-page sv-page">
        <Link className="sp-back" href="/sell/services">
          <span aria-hidden="true">&lt;</span> ჩემი სერვისები
        </Link>

        <header className="sp-card sv-hero">
          <div>
            <p className="sp-kicker">
              {listing.category.name}
              {listing.game ? ` · ${listing.game.name}` : ''}
            </p>
            <h1>{listing.title}</h1>
            <p className="sv-muted">
              {listing.packages.length > 0 ? (
                <>
                  <span>დან</span> {Math.min(...listing.packages.map((p) => p.priceWaveCoin))} GEL · {listing.packages.length}/{MAX_PACKAGES} <span>პაკეტი</span>
                </>
              ) : (
                <span>პაკეტები ჯერ არ არის</span>
              )}
            </p>
          </div>
          <div className="sv-hero-side">
            <em className={`sp-status sv-status-${listing.status}`}>{LISTING_STATUS_LABELS[listing.status] ?? listing.status}</em>
            {canSubmit && (
              <button type="button" className="sp-primary" disabled={busy === 'submit' || listing.packages.length === 0} onClick={() => void run('submit', () => api.submitListingForReview(listing.id), 'გაიგზავნა შესამოწმებლად — დამტკიცების შემდეგ გამოჩნდება მარკეტში.')}>
                გაგზავნა შესამოწმებლად
              </button>
            )}
            {listing.status === ListingStatus.Active && (
              <>
                <Link className="sv-outline" href={`/listings/${listing.id}`}>
                  საჯარო გვერდის ნახვა
                </Link>
                <button type="button" className="sv-outline" disabled={busy === 'pause'} onClick={() => void run('pause', () => api.pauseListing(listing.id), 'განცხადება შეჩერდა.')}>
                  შეჩერება
                </button>
              </>
            )}
            {listing.status === ListingStatus.Paused && (
              <button type="button" className="sp-primary" disabled={busy === 'pause'} onClick={() => void run('pause', () => api.unpauseListing(listing.id), 'განცხადება კვლავ აქტიურია.')}>
                გააქტიურება
              </button>
            )}
          </div>
        </header>

        {created && listing.packages.length === 0 && <p className="sv-banner">სერვისი შეიქმნა. ახლა დაამატეთ მინიმუმ ერთი პაკეტი და გაგზავნეთ შესამოწმებლად.</p>}
        {listing.status === ListingStatus.Rejected && listing.rejectionReason && (
          <p className="sp-error">
            <span>უარყოფილია:</span> {listing.rejectionReason}
          </p>
        )}
        {locked && <p className="sv-banner">სერვისი შემოწმებაზეა — ცვლილებები შესაძლებელია გადაწყვეტილების შემდეგ.</p>}
        {live && <p className="sv-muted">ნებისმიერი ცვლილება სერვისს ხელახლა აგზავნის შესამოწმებლად.</p>}
        {status.text && (
          <p className={status.kind === 'error' ? 'sp-error' : 'sv-banner'} role={status.kind === 'error' ? 'alert' : 'status'}>
            {status.text}
          </p>
        )}

        <section className="sp-card">
          <h2>პაკეტები</h2>
          <p className="sv-muted">მყიდველი ირჩევს ერთ პაკეტს — მაგ. Basic / Standard / Premium.</p>
          <div className="sv-packages">
            {listing.packages.map((p) => (
              <article key={p.id} className="sv-package">
                <header>
                  <strong>{p.name}</strong>
                  <b>{p.priceWaveCoin} GEL</b>
                </header>
                <small>
                  {p.deliveryTimeDays} <span>დღე</span> · {p.revisionsIncluded} <span>რევიზია</span>
                </small>
                {p.features.length > 0 && (
                  <ul>
                    {p.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                )}
                {!locked && (
                  <button type="button" className="sv-remove-text" disabled={busy === p.id} onClick={() => window.confirm('წავშალოთ ეს პაკეტი?') && void run(p.id, () => api.removeListingPackage(listing.id, p.id), `პაკეტი წაიშალა.${reviewNote}`)}>
                    წაშლა
                  </button>
                )}
              </article>
            ))}
          </div>
          {!locked && listing.packages.length < MAX_PACKAGES && (
            <form className="sv-package-form" onSubmit={addPackage}>
              <h3>ახალი პაკეტი</h3>
              <div className="sv-grid-4">
                <label className="sp-field">
                  <span>სახელი</span>
                  <input maxLength={100} value={pkg.name} placeholder="Basic" onChange={(e) => setPkg((v) => ({ ...v, name: e.target.value }))} />
                </label>
                <label className="sp-field">
                  <span>ფასი (GEL)</span>
                  <input type="number" min={1} max={100000} step={1} value={pkg.price} onChange={(e) => setPkg((v) => ({ ...v, price: e.target.value }))} />
                </label>
                <label className="sp-field">
                  <span>მიწოდება (დღე)</span>
                  <input type="number" min={1} max={90} step={1} value={pkg.days} onChange={(e) => setPkg((v) => ({ ...v, days: e.target.value }))} />
                </label>
                <label className="sp-field">
                  <span>რევიზიები</span>
                  <input type="number" min={0} max={20} step={1} value={pkg.revisions} onChange={(e) => setPkg((v) => ({ ...v, revisions: e.target.value }))} />
                </label>
              </div>
              <label className="sp-field">
                <span>რა შედის (თითო ხაზზე, მაქს. 8)</span>
                <textarea rows={3} value={pkg.features} placeholder={'+1 რანგი\nსტრიმი მოთხოვნით'} onChange={(e) => setPkg((v) => ({ ...v, features: e.target.value }))} />
              </label>
              <button type="submit" className="sp-primary" disabled={busy === 'package'}>
                {busy === 'package' ? 'ემატება…' : '+ პაკეტის დამატება'}
              </button>
            </form>
          )}
        </section>

        <section className="sp-card">
          <h2>ფოტოები</h2>
          <p className="sv-muted">პირველი ფოტო ქავერია. თუ ფოტოს არ დაამატებთ, გამოჩნდება თამაშის სურათი (მაქს. {MAX_PHOTOS}).</p>
          <div className="sv-photos">
            {listing.images.map((img) => (
              <figure key={img.id} className="sv-photo" style={{ backgroundImage: `url("${img.url}")` }}>
                {!locked && (
                  <button type="button" aria-label="ფოტოს წაშლა" onClick={() => void run(img.id, () => api.removeListingImage(listing.id, img.id), 'ფოტო წაიშალა.')}>
                    ×
                  </button>
                )}
              </figure>
            ))}
            {!locked && listing.images.length < MAX_PHOTOS && (
              <label className="sv-photo sv-photo-add">
                {busy === 'photos' ? '…' : '+ ფოტო'}
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => addPhotos(e.currentTarget.files)} />
              </label>
            )}
          </div>
        </section>

        <section className="sp-card sp-form">
          <h2>დეტალები</h2>
          <label className="sp-field">
            <span>სათაური</span>
            <input maxLength={100} value={details.title} disabled={locked} onChange={(e) => setDetails((d) => ({ ...d, title: e.target.value }))} />
          </label>
          <label className="sp-field">
            <span>აღწერა</span>
            <textarea rows={6} maxLength={5000} value={details.description} disabled={locked} onChange={(e) => setDetails((d) => ({ ...d, description: e.target.value }))} />
          </label>
          <fieldset className="sp-field" disabled={locked}>
            <legend>კითხვები მყიდველისთვის</legend>
            <RequirementsEditor value={questions} onChange={setQuestions} />
          </fieldset>
          <fieldset className="sp-field" disabled={locked}>
            <legend>ხშირად დასმული კითხვები</legend>
            <FaqEditor value={faq} onChange={setFaq} />
          </fieldset>
          {!locked && (
            <button type="button" className="sp-primary" disabled={busy === 'details'} onClick={saveDetails}>
              {busy === 'details' ? 'ინახება…' : 'ცვლილებების შენახვა'}
            </button>
          )}
        </section>
      </div>
    </Layout>
  )
}
