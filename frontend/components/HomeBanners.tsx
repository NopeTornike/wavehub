import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PublicBanner } from '@wavehub/shared-types'
import { BannerPlacement } from '@wavehub/shared-types'
import { api } from '../lib/api'
import { BannerVideo, useBannerRotation, useSwipe } from './BannerSlides'

// A link to a video (YouTube / Vimeo / a file): such a banner opens by tapping it, without a button.
function isVideoLink(url: string | null | undefined) {
  return !!url && /(?:youtu\.be\/|youtube\.com\/|vimeo\.com\/|\.(?:mp4|webm)(?:[?#]|$))/i.test(url)
}

// Live CMS banners for one placement (Admin → Banners, backend/src/marketing/) — only ones with a
// photo or a video. Shared by the strips below and the home page's top hero.
export function useBanners(placement: BannerPlacement): PublicBanner[] {
  const [banners, setBanners] = useState<PublicBanner[]>([])
  useEffect(() => {
    let cancelled = false
    api
      .listBanners(placement)
      .then((list) => {
        if (!cancelled) setBanners(list.filter((b) => b.imageUrl || b.videoUrl))
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
// Photos rotate every 7 seconds, a video plays to its end first (BannerSlides); dots and swipe
// switch manually.
export default function HomeBanners({ placement = BannerPlacement.HomeStrip }: { placement?: BannerPlacement }) {
  const banners = useBanners(placement)
  const { index, current: b, setIndex, next, prev, paused, setPaused, count } = useBannerRotation(banners)
  const swipe = useSwipe(prev, next)

  if (!b) return null
  const internal = b.linkUrl?.startsWith('/')
  // Video banners are opened by clicking the whole banner; their CTA must not remain over the video.
  // (Tornike 2026-10-29: no CTA button over a video banner either.)
  const cta = !b.videoUrl && !isVideoLink(b.linkUrl) && b.linkUrl && b.buttonLabel?.trim()
  const wholeLink = b.linkUrl && !cta ? b.linkUrl : null
  const hasText = !!(b.title?.trim() || b.subtitle?.trim() || cta)
  const video = b.videoUrl

  return (
    <section className={`home-banners${placement === BannerPlacement.HomeStrip ? '' : ' page-top-banners'}`} aria-label="აქციები და სიახლეები">
      <div
        className={`home-banner${video ? ' is-video' : ''}${hasText ? ' has-text' : ''}`}
        style={
          video
            ? undefined
            : { backgroundImage: hasText ? `linear-gradient(90deg, rgba(5, 4, 15, .82), rgba(5, 4, 15, .2) 70%), url("${b.imageUrl}")` : `url("${b.imageUrl}")` }
        }
        {...swipe}
      >
        {video && (
          <BannerVideo
            key={b.id}
            src={video}
            className="home-banner-video"
            loop={count < 2}
            paused={paused}
            onPausedChange={setPaused}
            onEnded={next}
          />
        )}
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
      {count > 1 && (
        <div className="home-banner-dots">
          {banners.map((x, i) => (
            <button key={x.id} type="button" aria-label={`ბანერი ${i + 1}`} aria-current={i === index} className={i === index ? 'active' : undefined} onClick={() => setIndex(i)} />
          ))}
        </div>
      )}
    </section>
  )
}
