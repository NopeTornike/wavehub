import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { ItemAttributes, PublicCategory } from '@wavehub/shared-types'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { canPublishSteam } from '../lib/roles'
import { useShell } from '../lib/shell'
import GAME_DETAILS from '../lib/game-details.json'
import ImageLightbox from './ImageLightbox'
import { PHOTO_SOURCE_MAX_BYTES } from '../lib/image-resize'

// The prototype's "Become a seller" listing builder (marketplace.html #sellerModal +
// marketplace.js), markup-for-markup — including the per-game "Add … Details" sub-forms, whose
// field definitions are extracted verbatim from the prototype into lib/game-details.json.
//
// Unlike the prototype (which writes straight into localStorage and shows the card instantly), this
// creates a real listing: POST /listings (type item, category Accounts/Skins, the form's details as
// validated `attributes`) → upload each photo → submit for review. Like every listing on the real
// platform it appears on the marketplace after staff approval — the success message says so rather
// than pretending it's already live. Prices are WaveCoin (the platform currency), not GEL.
/* eslint-disable @next/next/no-img-element */

type Field = {
  label: string
  optional?: boolean
  tag: 'input' | 'select' | 'textarea'
  id: string
  type?: string
  placeholder?: string
  maxlength?: string
  min?: string
  max?: string
  step?: string
  cls?: string
  options?: Array<{ value: string | null; label: string }>
}
type GameDetailsForm = { title: string; subtitle: string; noteStrong: string; noteSpan: string; gridClass: string; fields: Field[] }
const DETAIL_FORMS = GAME_DETAILS as unknown as Record<string, GameDetailsForm>

const HINTS: Record<string, string> = {
  'cod-mobile': 'Call of Duty selected — add the optional rank, weapon and inventory details.',
  'clash-of-clans': 'Clash of Clans selected — add the optional Town Hall, hero and base details.',
  'dota-2': 'Dota 2 selected — add the optional rank, MMR and item details.',
  fortnite: 'Fortnite selected — add the optional skins, cosmetics and V-Bucks details.',
  'gta-5': 'GTA 5 selected — add the optional rank, money, property and vehicle details.',
  'league-of-legends': 'League of Legends selected — add the optional rank, level, essence and skin details.',
  'mobile-legends': 'Mobile Legends selected — add the optional rank, hero and skin details.',
  'pubg-mobile': 'PUBG Mobile selected — add the optional tier, Royale Pass, UC and skin details.',
  roblox: 'Roblox selected — add the optional Robux, Limiteds, account and item details.',
}

const MAX_IMAGES = 6
const MAX_IMAGE_BYTES = PHOTO_SOURCE_MAX_BYTES
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type Status = { kind: '' | 'error' | 'success' | 'pending'; text: string }

export default function SellerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { user } = useAuth()
  const { games } = useShell()
  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [kind, setKind] = useState<'account' | 'skin' | 'item'>('account')
  const [gameSlug, setGameSlug] = useState('')
  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState('')
  const [region, setRegion] = useState('')
  const [price, setPrice] = useState('')
  const [accountStatus, setAccountStatus] = useState('basic')
  const [accountLevel, setAccountLevel] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [access, setAccess] = useState({ loginMethod: '', emailChangeable: '', linkedAccounts: '', fullAccess: '', originalEmail: '', twoFactor: '', deliveryMethod: '', deliveryTime: '' })
  const [gameDetails, setGameDetails] = useState<Record<string, string>>({})
  const [detailsDraft, setDetailsDraft] = useState<Record<string, string>>({})
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: '', text: '' })
  const [submitting, setSubmitting] = useState(false)
  const [zoom, setZoom] = useState<number | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const firstField = useRef<HTMLSelectElement>(null)
  // A restored draft sets the game too — don't let the "game changed" effect wipe its details.
  const keepDetailsRef = useRef(false)
  const draftKey = user ? `wavehub.sellDraft.${user.id}` : null

  const isAccount = kind === 'account'
  const game = games.find((g) => g.slug === gameSlug)
  const detailForm = gameSlug ? DETAIL_FORMS[gameSlug] : undefined
  const hasDetails = Object.values(gameDetails).some((v) => v.trim() !== '')

  // Latest close handler/details state without re-running the open effect on every render.
  const onCloseRef = useRef(onClose)
  const detailsOpenRef = useRef(detailsOpen)
  useEffect(() => {
    onCloseRef.current = onClose
    detailsOpenRef.current = detailsOpen
  })

  useEffect(() => {
    if (!open) return
    api.listCategories().then(setCategories).catch(() => undefined)
    // Reset the status line each time the builder is opened.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus({ kind: '', text: '' })
    firstField.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (detailsOpenRef.current) setDetailsOpen(false)
      else onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [files])

  // A game change drops the previous game's detail answers (they'd be meaningless keys).
  useEffect(() => {
    if (keepDetailsRef.current) {
      keepDetailsRef.current = false
      return
    }
    setGameDetails({})
  }, [gameSlug])

  // Mobile (owner bug list BUG 04/05): while the builder is open the phone bottom bar is hidden, so
  // a stray tap can't navigate away and it can't cover the Publish button.
  useEffect(() => {
    document.body.classList.toggle('modal-open', open)
    return () => document.body.classList.remove('modal-open')
  }, [open])

  // Draft: everything typed is kept in this browser until the listing is published, so leaving the
  // page or reloading never loses it. Photos can't be stored and need to be added again.
  useEffect(() => {
    if (!draftKey) return
    let saved: Record<string, unknown> | null = null
    try {
      saved = JSON.parse(localStorage.getItem(draftKey) || 'null')
    } catch {
      saved = null
    }
    if (!saved) return
    const str = (k: string) => (typeof saved![k] === 'string' ? (saved![k] as string) : '')
    // Restoring a saved draft from browser storage once the account is known.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (saved.kind === 'account' || saved.kind === 'skin' || saved.kind === 'item') setKind(saved.kind)
    if (str('gameSlug')) {
      keepDetailsRef.current = true
      setGameSlug(str('gameSlug'))
    }
    setTitle(str('title'))
    setPlatform(str('platform'))
    setRegion(str('region'))
    setPrice(str('price'))
    if (str('accountStatus')) setAccountStatus(str('accountStatus'))
    setAccountLevel(str('accountLevel'))
    setDescription(str('description'))
    if (saved.access && typeof saved.access === 'object') setAccess((a) => ({ ...a, ...(saved!.access as Record<string, string>) }))
    if (saved.gameDetails && typeof saved.gameDetails === 'object') setGameDetails(saved.gameDetails as Record<string, string>)
    setDraftRestored(Boolean(str('title') || str('description') || str('gameSlug')))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [draftKey])

  useEffect(() => {
    if (!draftKey) return
    const draft = { kind, gameSlug, title, platform, region, price, accountStatus, accountLevel, description, access, gameDetails }
    const empty = !gameSlug && !title && !price && !description && !accountLevel
    const timer = window.setTimeout(() => {
      try {
        if (empty) localStorage.removeItem(draftKey)
        else localStorage.setItem(draftKey, JSON.stringify(draft))
      } catch {
        // storage unavailable — the form still works, it just won't survive a reload
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [draftKey, kind, gameSlug, title, platform, region, price, accountStatus, accountLevel, description, access, gameDetails])

  const hint = useMemo(() => {
    if (!gameSlug) return 'Game-specific details will appear after selecting a game.'
    return HINTS[gameSlug] ?? `${game?.name ?? ''} selected — add accurate platform, region, level and delivery information.`
  }, [gameSlug, game])

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const incoming = Array.from(list)
    const bad = incoming.find((file) => !IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES)
    if (bad) {
      setStatus({ kind: 'error', text: 'ფოტო: JPG, PNG ან WEBP, მაქსიმუმ 20MB — დიდი ფოტო ავტომატურად მცირდება 2MB-მდე.' })
      return
    }
    setFiles((current) => [...current, ...incoming].slice(0, MAX_IMAGES))
  }

  const reset = () => {
    setKind('account')
    setGameSlug('')
    setTitle('')
    setPlatform('')
    setRegion('')
    setPrice('')
    setAccountStatus('basic')
    setAccountLevel('')
    setFiles([])
    setDescription('')
    setAccess({ loginMethod: '', emailChangeable: '', linkedAccounts: '', fullAccess: '', originalEmail: '', twoFactor: '', deliveryMethod: '', deliveryTime: '' })
    setGameDetails({})
    setDraftRestored(false)
    try {
      if (draftKey) localStorage.removeItem(draftKey)
    } catch {
      // ignore
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(router.asPath)}`)
      return
    }
    const priceValue = Math.floor(Number(price))
    const levelValue = Math.floor(Number(accountLevel))
    if (!game) return setStatus({ kind: 'error', text: 'აირჩიეთ თამაში.' })
    if (title.trim().length < 5) return setStatus({ kind: 'error', text: 'სათაური მინიმუმ 5 სიმბოლო უნდა იყოს.' })
    if (!Number.isFinite(priceValue) || priceValue < 1) return setStatus({ kind: 'error', text: 'მიუთითეთ სწორი ფასი.' })
    if (isAccount && (!Number.isFinite(levelValue) || levelValue < 1)) return setStatus({ kind: 'error', text: 'მიუთითეთ ანგარიშის დონე.' })
    if (description.trim().length < 50) return setStatus({ kind: 'error', text: 'აღწერა მინიმუმ 50 სიმბოლო უნდა იყოს.' })
    if (files.length === 0) return setStatus({ kind: 'error', text: 'ატვირთეთ მინიმუმ ერთი სურათი.' })
    const category = categories.find((c) => c.slug === (kind === 'account' ? 'accounts' : kind === 'skin' ? 'skins' : 'items'))
    if (!category) return setStatus({ kind: 'error', text: 'კატეგორია ვერ მოიძებნა. სცადეთ თავიდან.' })

    const attributes: ItemAttributes = { kind, platform, region }
    if (isAccount) {
      Object.assign(attributes, {
        accountStatus: accountStatus as ItemAttributes['accountStatus'],
        accountLevel: levelValue,
        loginMethod: access.loginMethod,
        emailChangeable: access.emailChangeable === 'yes',
        fullAccess: access.fullAccess === 'yes',
        originalEmail: access.originalEmail === 'yes',
        twoFactor: access.twoFactor,
        deliveryMethod: access.deliveryMethod,
        deliveryTime: access.deliveryTime,
      })
      if (access.linkedAccounts.trim()) attributes.linkedAccounts = access.linkedAccounts.trim()
    }
    if (detailForm) {
      detailForm.fields.forEach((field) => {
        const raw = (gameDetails[field.id] ?? '').trim()
        if (!raw) return
        attributes[field.id] = field.type === 'number' ? Number(raw) : raw
      })
    }

    setSubmitting(true)
    setStatus({ kind: 'pending', text: 'განცხადება იქმნება…' })
    try {
      const listing = await api.createItemListing({
        categoryId: category.id,
        gameId: game.gameId,
        title: title.trim(),
        description: description.trim(),
        priceWaveCoin: priceValue,
        attributes,
      })
      for (const [index, file] of files.entries()) {
        setStatus({ kind: 'pending', text: `სურათების ატვირთვა… ${index + 1} / ${files.length}` })
        await api.uploadListingImage(listing.id, file)
      }
      await api.submitListingForReview(listing.id)
      reset()
      setStatus({ kind: 'success', text: 'განცხადება გაიგზავნა შესამოწმებლად — დამტკიცების შემდეგ გამოჩნდება მარკეტში.' })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'განცხადების შექმნა ვერ მოხერხდა.') })
    } finally {
      setSubmitting(false)
    }
  }

  const accessField = (key: keyof typeof access) => ({
    value: access[key],
    onChange: (event: { target: { value: string } }) => setAccess((current) => ({ ...current, [key]: event.target.value })),
  })

  return (
    <div className="seller-modal" id="sellerModal" role="dialog" aria-modal="true" aria-labelledby="sellerModalTitle" hidden={!open}>
      <div className="seller-modal-panel listing-builder-panel">
        <div className="seller-modal-head">
          <div>
            <p className="section-kicker">განცხადების შექმნა</p>
            <h2 id="sellerModalTitle">Sell Your Game Account, Skin or Item</h2>
            <p className="seller-modal-alt">
              <span>სერვისს ყიდით?</span> <Link href="/sell/services">სერვისის გაყიდვა →</Link>
            </p>
            {canPublishSteam(user) && (
              <p className="seller-modal-alt">
                <span>Steam თამაშს ამატებთ (ადმინისტრაცია)?</span> <Link href="/sell/digital-keys">Steam თამაშის დამატება →</Link>
              </p>
            )}
          </div>
          <button className="seller-close-button" id="sellerCloseButton" type="button" aria-label="Close seller form" onClick={onClose}>
            x
          </button>
        </div>
        <form className="seller-form listing-builder-form" id="sellerForm" onSubmit={submit} noValidate>
          <section className="listing-builder-section">
            <header>
              <b>1</b>
              <div>
                <h3>Basic Information</h3>
                <p>Provide the core details about your game product.</p>
              </div>
            </header>
            <div className="listing-builder-grid">
              <label>
                <span>Listing type *</span>
                <select id="sellerProductType" ref={firstField} value={kind} onChange={(e) => setKind(e.target.value as 'account' | 'skin' | 'item')} required>
                  <option value="account">ანგარიში</option>
                  <option value="skin">სკინი</option>
                  <option value="item">ნივთი</option>
                </select>
              </label>
              <label>
                <span>Game *</span>
                <select id="sellerGame" value={gameSlug} onChange={(e) => setGameSlug(e.target.value)} required>
                  <option value="">აირჩიე თამაში</option>
                  {games.map((g) => (
                    <option key={g.slug} value={g.slug}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <small className={`game-specific-hint${gameSlug ? ' ready' : ''}`} id="sellerGameHint">
                  {hint}
                </small>
                {detailForm && (
                  <button
                    className="game-details-open"
                    type="button"
                    onClick={() => {
                      setDetailsDraft(gameDetails)
                      setDetailsOpen(true)
                    }}
                  >
                    {hasDetails ? detailForm.title.replace(/^Add /, 'Edit ') : detailForm.title}
                  </button>
                )}
              </label>
              <label>
                <span id="sellerTitleLabel">{isAccount ? 'Account title' : kind === 'skin' ? 'Skin name' : 'Item name'}</span>
                <input
                  id="sellerTitle"
                  type="text"
                  maxLength={70}
                  placeholder={isAccount ? 'PUBG Mobile Ace account' : kind === 'skin' ? 'AK-47 Neon Rider skin' : '1000 Gems pack'}
                  autoComplete="off"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                <span>Platform *</span>
                <select id="sellerPlatform" required value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  <option value="">Select platform</option>
                  {['PC', 'PlayStation', 'Xbox', 'Mobile', 'Nintendo Switch', 'Other'].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Region / Server *</span>
                <select id="sellerRegion" required value={region} onChange={(e) => setRegion(e.target.value)}>
                  <option value="">Select region / server</option>
                  {['Local', 'Europe', 'North America', 'South America', 'Asia', 'Middle East', 'Oceania', 'გლობალური'].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Price (GEL) *</span>
                <input id="sellerPrice" type="number" min={1} step={1} placeholder="Enter price" required value={price} onChange={(e) => setPrice(e.target.value)} />
              </label>
              <label className="seller-account-field" hidden={!isAccount}>
                <span>Account type *</span>
                <select id="sellerAccountStatus" disabled={!isAccount} value={accountStatus} onChange={(e) => setAccountStatus(e.target.value)}>
                  <option value="basic">საბაზისო ანგარიში</option>
                  <option value="full-collection">სრული კოლექციის ანგარიში</option>
                  <option value="og">OG ანგარიში</option>
                  <option value="premium">პრემიუმ ანგარიში</option>
                  <option value="ranked">რეიტინგული ანგარიში</option>
                  <option value="rare">იშვიათი ანგარიში</option>
                </select>
              </label>
              <label className="seller-account-field" hidden={!isAccount}>
                <span>Account level *</span>
                <input
                  id="sellerAccountLevel"
                  type="number"
                  min={1}
                  max={9999}
                  step={1}
                  placeholder="Enter real account level"
                  required={isAccount}
                  disabled={!isAccount}
                  value={accountLevel}
                  onChange={(e) => setAccountLevel(e.target.value)}
                />
              </label>
              <div className="seller-image-field">
                <span>Product images *</span>
                <label className="upload-control listing-image-dropzone">
                  <span className="upload-icon" aria-hidden="true"></span>
                  <span className="upload-copy">
                    <strong>Drag &amp; drop images here or click to upload</strong>
                    <small>Upload up to 6 images. First image is the cover. Recommended cover ratio: 16:9.</small>
                  </span>
                  <input
                    id="sellerImage"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => {
                      addFiles(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </label>
                <span className="seller-image-selection">
                  <strong id="sellerImageCount">
                    {files.length} / {MAX_IMAGES} photos
                  </strong>
                  <small>The first photo will be used as the cover.</small>
                </span>
                <span className="seller-image-previews" id="sellerImagePreviews" aria-live="polite">
                  {previews.map((url, index) => (
                    <span key={url} className="seller-image-preview">
                      <img src={url} alt={`Photo ${index + 1}`} className="is-zoomable" onClick={() => setZoom(index)} />
                      <button type="button" aria-label="Remove photo" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}>
                        ×
                      </button>
                    </span>
                  ))}
                </span>
              </div>
              <label className="seller-description-field">
                <span>Description *</span>
                <textarea
                  id="sellerDescription"
                  maxLength={2000}
                  placeholder={isAccount ? 'Rank, skins, level, delivery details...' : 'Rarity, condition, platform and delivery details...'}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <small>Provide as much detail as possible to help buyers make the right decision.</small>
              </label>
            </div>
          </section>

          <section className="listing-builder-section seller-account-field" hidden={!isAccount}>
            <header>
              <b>2</b>
              <div>
                <h3>Access &amp; Delivery</h3>
                <p>Tell buyers how they will receive and access the account.</p>
              </div>
            </header>
            <div className="listing-builder-grid access-delivery-grid">
              <label>
                <span>Login method *</span>
                <select id="sellerLoginMethod" required={isAccount} disabled={!isAccount} {...accessField('loginMethod')}>
                  <option value="">Select login method</option>
                  {['Email & Password', 'Username & Password', 'Social Login', 'Platform Account'].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Email changeable? *</span>
                <select id="sellerEmailChangeable" required={isAccount} disabled={!isAccount} {...accessField('emailChangeable')}>
                  <option value="">Select option</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label>
                <span>
                  Linked accounts <small>(არასავალდებულო)</small>
                </span>
                <input id="sellerLinkedAccounts" type="text" maxLength={120} placeholder="Steam, Facebook, Google..." disabled={!isAccount} {...accessField('linkedAccounts')} />
              </label>
              <label>
                <span>Full access provided? *</span>
                <select id="sellerFullAccess" required={isAccount} disabled={!isAccount} {...accessField('fullAccess')}>
                  <option value="">Select option</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label>
                <span>Original email available? *</span>
                <select id="sellerOriginalEmail" required={isAccount} disabled={!isAccount} {...accessField('originalEmail')}>
                  <option value="">Select option</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label>
                <span>Two-factor authentication *</span>
                <select id="sellerTwoFactor" required={isAccount} disabled={!isAccount} {...accessField('twoFactor')}>
                  <option value="">Select option</option>
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                  <option value="removable">Enabled, removable</option>
                </select>
              </label>
              <label>
                <span>Delivery method *</span>
                <select id="sellerDeliveryMethod" required={isAccount} disabled={!isAccount} {...accessField('deliveryMethod')}>
                  <option value="">Select delivery method</option>
                  {['Automatic', 'Seller message', 'Email delivery', 'Account transfer'].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Delivery time *</span>
                <select id="sellerDeliveryTime" required={isAccount} disabled={!isAccount} {...accessField('deliveryTime')}>
                  <option value="">Select time</option>
                  {['მყისიერი', 'Within 1 hour', 'Within 6 hours', 'Within 24 hours', '1–3 days'].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {draftRestored && (
            <p className="seller-draft-note">
              {files.length === 0 ? 'შენახული მონახაზი აღდგა. ფოტოები თავიდან უნდა დაამატო.' : 'შენახული მონახაზი აღდგა.'}{' '}
              <button type="button" onClick={reset}>
                გასუფთავება
              </button>
            </p>
          )}
          <p className={`seller-status${status.kind ? ` ${status.kind}` : ''}`} id="sellerStatus" aria-live="polite" role={status.kind === 'error' ? 'alert' : undefined}>
            {status.text}
          </p>
          <div className="seller-modal-actions listing-builder-actions">
            <button className="secondary-seller-action" id="sellerCancelButton" type="button" onClick={onClose}>
              გაუქმება
            </button>
            <button className="seller-submit-button" type="submit" disabled={submitting}>
              {submitting ? 'იგზავნება…' : 'განცხადების გამოქვეყნება'}
            </button>
          </div>
        </form>
      </div>

      <ImageLightbox images={previews.map((url, i) => ({ url, alt: `Photo ${i + 1}` }))} index={zoom} onIndex={setZoom} onClose={() => setZoom(null)} />

      {detailForm && (
        <div className="game-details-modal" role="dialog" aria-modal="true" aria-labelledby="gameDetailsTitle" hidden={!detailsOpen}>
          <div className="game-details-panel">
            <header>
              <div>
                <h2 id="gameDetailsTitle">{detailForm.title}</h2>
                <p>{detailForm.subtitle}</p>
              </div>
              <button type="button" aria-label="Close details" onClick={() => setDetailsOpen(false)}>
                ×
              </button>
            </header>
            <div className={detailForm.gridClass}>
              {detailForm.fields.map((field) => {
                const value = detailsDraft[field.id] ?? ''
                const onChange = (next: string) => setDetailsDraft((current) => ({ ...current, [field.id]: next }))
                return (
                  <label key={field.id} className={field.cls || undefined}>
                    <span>
                      {field.label} {field.optional && <small>(Optional)</small>}
                    </span>
                    {field.tag === 'select' ? (
                      <select value={value} onChange={(e) => onChange(e.target.value)}>
                        {(field.options ?? []).map((option) => (
                          <option key={`${option.value}-${option.label}`} value={option.value ?? option.label}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type || 'text'}
                        maxLength={field.maxlength ? Number(field.maxlength) : undefined}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        placeholder={field.placeholder}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                      />
                    )}
                  </label>
                )
              })}
            </div>
            <div className="game-details-note">
              <strong>{detailForm.noteStrong}</strong>
              <span>{detailForm.noteSpan}</span>
            </div>
            <footer>
              <button className="secondary-seller-action" type="button" onClick={() => setDetailsOpen(false)}>
                გაუქმება
              </button>
              <button
                className="seller-submit-button"
                type="button"
                onClick={() => {
                  setGameDetails(detailsDraft)
                  setDetailsOpen(false)
                }}
              >
                დეტალების შენახვა
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
