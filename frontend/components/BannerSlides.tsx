import { useCallback, useEffect, useRef, useState } from 'react'
import type { PublicBanner } from '@wavehub/shared-types'

// Shared rotation for every CMS banner carousel (home hero, home strip, page tops).
// Photos stay 7 seconds; a video slide plays to its end and then moves on (owner 2026-10-24).
// Pausing a video also stops the rotation until it is played again.
export const BANNER_PHOTO_MS = 7000

export function useBannerRotation(banners: PublicBanner[]) {
  const [index, setIndexState] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = banners.length
  const current = count ? banners[index % count] : null
  const isVideo = !!current?.videoUrl

  const setIndex = useCallback((i: number) => {
    setIndexState(i)
    setPaused(false)
  }, [])
  const next = useCallback(() => {
    if (count > 1) setIndexState((i) => (i + 1) % count)
  }, [count])
  const prev = useCallback(() => {
    if (count > 1) setIndexState((i) => (i - 1 + count) % count)
  }, [count])

  useEffect(() => {
    if (count < 2 || isVideo || paused) return
    const timer = window.setTimeout(next, BANNER_PHOTO_MS)
    return () => window.clearTimeout(timer)
  }, [count, isVideo, paused, index, next])

  return { index: count ? index % count : 0, current, setIndex, next, prev, paused, setPaused, count }
}

// Swipe left/right on phones (and touch screens) to change slides.
export function useSwipe(onPrev: () => void, onNext: () => void) {
  const startX = useRef<number | null>(null)
  return {
    onTouchStart: (e: React.TouchEvent) => {
      startX.current = e.touches[0]?.clientX ?? null
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const from = startX.current
      startX.current = null
      const to = e.changedTouches[0]?.clientX
      if (from == null || to == null || Math.abs(to - from) < 40) return
      if (to < from) onNext()
      else onPrev()
    },
  }
}

// A video slide: autoplays muted inline, no photo behind it, only a pause / play control.
// With a single banner it loops; otherwise the carousel moves on when it ends.
// `bigPlay` (the home hero, round 4 02.jpg): the control is a large centred play button. While the
// preview plays muted, it turns the sound on (watch the video); after that it pauses / plays.
export function BannerVideo({
  src,
  className,
  loop,
  paused,
  onPausedChange,
  onEnded,
  bigPlay = false,
}: {
  bigPlay?: boolean
  src: string
  className?: string
  loop: boolean
  paused: boolean
  onPausedChange: (paused: boolean) => void
  onEnded: () => void
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)

  // The banner shows the whole video, never a zoomed crop (owner 2026-10-24: a vertical phone video
  // filled the wide frame by cropping). The frame learns the video's orientation so phones can give
  // a vertical video a taller (square) frame; the attribute is removed when the slide changes.
  useEffect(() => {
    const host = ref.current?.parentElement
    return () => {
      if (host) delete host.dataset.videoShape
    }
  }, [src])

  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (paused) v.pause()
    else void v.play().catch(() => undefined)
  }, [paused, src])

  return (
    <>
      <video
        ref={ref}
        className={className}
        src={src}
        autoPlay
        muted={muted}
        playsInline
        loop={loop}
        preload="auto"
        disablePictureInPicture
        controls={false}
        aria-hidden="true"
        onEnded={onEnded}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget
          const host = v.parentElement
          if (host && v.videoWidth && v.videoHeight) host.dataset.videoShape = v.videoHeight > v.videoWidth ? 'portrait' : 'landscape'
        }}
        // A file that can't play must not freeze the carousel.
        onError={onEnded}
      />
      {bigPlay ? (
        <button
          type="button"
          className={`banner-video-play${muted || paused ? '' : ' is-playing'}`}
          aria-label={muted ? 'ვიდეოს ხმით ნახვა' : paused ? 'ვიდეოს გაგრძელება' : 'ვიდეოს პაუზა'}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (muted) {
              const v = ref.current
              if (v) {
                v.muted = false
                void v.play().catch(() => undefined)
              }
              setMuted(false)
              onPausedChange(false)
            } else {
              onPausedChange(!paused)
            }
          }}
        >
          {muted || paused ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
            </svg>
          )}
        </button>
      ) : (
      <button
        type="button"
        className="banner-video-toggle"
        aria-label={paused ? 'ვიდეოს გაგრძელება' : 'ვიდეოს პაუზა'}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onPausedChange(!paused)
        }}
      >
        {paused ? (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
          </svg>
        )}
      </button>
      )}
    </>
  )
}
