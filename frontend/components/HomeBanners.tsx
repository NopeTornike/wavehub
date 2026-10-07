import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PublicBanner } from '@wavehub/shared-types'
import { BannerPlacement } from '@wavehub/shared-types'
import { api } from '../lib/api'

// Live CMS banners for one placement (Admin → Banners, backend/src/marketing/) — only ones with an
// image. Shared by the strips below and the home page's top hero.
export function useBanners(placement: BannerPlacement): PublicBanner[] {
  const [banners, setBanners] = useState<PublicBanner[]>([])
  useEffect(() => {
    let cancelled = false
    api
      .listBanners(placement)
      .then((list) => {
        if (!cancelled) setBanners(list.filter((b) => b.imageUrl))
      })
      .catch(() => {
        if (!cancelled) setBanners([])
      })
    return () => {
      cancelled = true
    }
  }, [placement])
  return banners
}

// Admin-managed banners at one placement: the homepage strip (default) or the top of a page
// (`*_top`, owner 2026-10-07: every banner is editable from the CMS). Renders nothing until at
// least one banner is published, so there is never placeholder promo content (rule #6).
// Several banners rotate every 7 seconds; dots switch manually.
export default function HomeBanners({ placement = BannerPlacement.HomeStrip }: { placement?: BannerPlacement }) {
  const banners = useBanners(placement)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (banners.length < 2) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % banners.length), 7000)
    return () => window.clearInterval(timer)
  }, [banners.length])

  if (banners.length === 0) return null
  const b = banners[Math.min(index, banners.length - 1)]
  const internal = b.linkUrl?.startsWith('/')
  // A button only when button text was entered; a link without one makes the whole banner a link.
  const cta = b.linkUrl && b.buttonLabel?.trim()
  const wholeLink = b.linkUrl && !cta ? b.linkUrl : null
  const hasText = !!(b.title?.trim() || b.subtitle?.trim() || cta)

  return (
    <section className={`home-banners${placement === BannerPlacement.HomeStrip ? '' : ' page-top-banners'}`} aria-label="აქციები და სიახლეები">
      <div
        className="home-banner"
        style={{
          backgroundImage: hasText ? `linear-gradient(90deg, rgba(5, 4, 15, .82), rgba(5, 4, 15, .2) 70%), url("${b.imageUrl}")` : `url("${b.imageUrl}")`,
        }}
      >
        {wholeLink &&
          (internal ? (
            <Link className="home-banner-link" href={wholeLink} aria-label={b.title || 'ბანერი'} />
          ) : (
            <a className="home-banner-link" href={wholeLink} target="_blank" rel="noopener noreferrer" aria-label={b.title || 'ბანერი'} />
          ))}
        <div className="home-banner-copy">
          {b.title?.trim() && <h2>{b.title}</h2>}
          {b.subtitle && <p>{b.subtitle}</p>}
          {cta &&
            (internal ? (
              <Link className="home-banner-cta" href={b.linkUrl!}>
                {cta} <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <a className="home-banner-cta" href={b.linkUrl!} target="_blank" rel="noopener noreferrer">
                {cta} <span aria-hidden="true">↗</span>
              </a>
            ))}
        </div>
      </div>
      {banners.length > 1 && (
        <div className="home-banner-dots">
          {banners.map((x, i) => (
            <button key={x.id} type="button" aria-label={`ბანერი ${i + 1}`} aria-current={i === index} className={i === index ? 'active' : undefined} onClick={() => setIndex(i)} />
          ))}
        </div>
      )}
    </section>
  )
}
