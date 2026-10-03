import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PublicBanner } from '@wavehub/shared-types'
import { api } from '../lib/api'

// Admin-managed homepage banners (Admin → Banners, backend/src/marketing/). Renders nothing until
// at least one banner is published, so there is never placeholder promo content (rule #6).
// Several banners rotate every 7 seconds; dots switch manually.
export default function HomeBanners() {
  const [banners, setBanners] = useState<PublicBanner[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    api
      .listBanners()
      .then((list) => setBanners(list.filter((b) => b.imageUrl)))
      .catch(() => setBanners([]))
  }, [])

  useEffect(() => {
    if (banners.length < 2) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % banners.length), 7000)
    return () => window.clearInterval(timer)
  }, [banners.length])

  if (banners.length === 0) return null
  const b = banners[Math.min(index, banners.length - 1)]
  const internal = b.linkUrl?.startsWith('/')
  const cta = b.linkUrl && (b.buttonLabel || 'ნახვა')

  return (
    <section className="home-banners" aria-label="აქციები და სიახლეები">
      <div className="home-banner" style={{ backgroundImage: `linear-gradient(90deg, rgba(5, 4, 15, .82), rgba(5, 4, 15, .2) 70%), url("${b.imageUrl}")` }}>
        <div className="home-banner-copy">
          <h2>{b.title}</h2>
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
