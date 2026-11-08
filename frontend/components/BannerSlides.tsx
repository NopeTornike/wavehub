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
// Hero videos loop continuously. Like YouTube (owner 2026-11-08: the old button blinked and stayed
// on screen during playback — a phone tap left :hover stuck): paused → the play button stays;
// playing → hidden, flashed briefly after a tap or while the mouse moves; buffering → a spinner.
// The button follows what the <video> really does (its play / pause events), not only the requested
// state: when the browser blocks autoplay (iOS Low Power Mode, data saver) the button still says
// Play and a tap starts it. On the big hero a tap anywhere on the video pauses / resumes it — phones
// have no hover, so the faded pause button alone left no way to stop it (owner 2026-11-06).
// `bigPlay` (the home hero, round 4 02.jpg): a large centred play / pause button plus a separate
// sound on / off button (Tornike 2026-10-29); the preview starts muted.
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
  // What the <video> really does (its events), not what was requested — autoplay can be blocked.
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  // YouTube-style: while playing the control is hidden; it flashes after a tap and shows on mouse
  // movement, then fades. One timer at a time, so it never flickers between states.
  const [controlsShown, setControlsShown] = useState(false)
  const hideTimer = useRef<number | undefined>(undefined)
  const showControls = useCallback((ms: number) => {
    window.clearTimeout(hideTimer.current)
    setControlsShown(true)
    hideTimer.current = window.setTimeout(() => setControlsShown(false), ms)
  }, [])
  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

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

  const togglePlayback = () => {
    const v = ref.current
    if (!v) return
    if (v.paused || v.ended) {
      onPausedChange(false)
      void v.play().catch(() => undefined)
      showControls(700)
    } else {
      window.clearTimeout(hideTimer.current)
      setControlsShown(false)
      onPausedChange(true)
      v.pause()
    }
  }
  const stopped = !playing
  const controlVisible = stopped || buffering || controlsShown

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
        onPlay={() => setPlaying(true)}
        onPlaying={() => {
          setPlaying(true)
          setBuffering(false)
        }}
        onPause={() => {
          setPlaying(false)
          setBuffering(false)
        }}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget
          const host = v.parentElement
          if (host && v.videoWidth && v.videoHeight) host.dataset.videoShape = v.videoHeight > v.videoWidth ? 'portrait' : 'landscape'
        }}
        // A file that can't play must not freeze the carousel.
        onError={onEnded}
      />
      {bigPlay ? (
        <>
          {/* Tap the video itself to pause / resume (under the copy, the banner link and the buttons). */}
          <div
            className="banner-video-tap"
            aria-hidden="true"
            onClick={(e) => {
              e.preventDefault()
              togglePlayback()
            }}
            onPointerMove={(e) => {
              if (e.pointerType === 'mouse' && playing) showControls(2000)
            }}
          />
          <button
            type="button"
            className={`banner-video-play${stopped ? ' is-paused' : ' is-playing'} ${controlVisible ? 'vp-shown' : 'vp-hidden'}`}
            aria-label={stopped ? 'ვიდეოს გაგრძელება' : 'ვიდეოს პაუზა'}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              togglePlayback()
            }}
          >
            {buffering && !stopped ? (
              <span className="vp-spin" aria-hidden="true" />
            ) : stopped ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
              </svg>
            )}
          </button>
          {/* Sound on / off (Tornike 2026-10-29): the preview starts muted. */}
          <button
            type="button"
            className="hero-video-sound"
            aria-label={muted ? 'ხმის ჩართვა' : 'ხმის გამორთვა'}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const v = ref.current
              const next = !muted
              if (v) {
                v.muted = next
                if (!next && v.paused) {
                  onPausedChange(false)
                  void v.play().catch(() => undefined)
                }
              }
              setMuted(next)
            }}
          >
            <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
          </button>
        </>
      ) : (
      <button
        type="button"
        className="banner-video-toggle"
        aria-label={stopped ? 'ვიდეოს გაგრძელება' : 'ვიდეოს პაუზა'}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          togglePlayback()
        }}
      >
        {stopped ? (
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
