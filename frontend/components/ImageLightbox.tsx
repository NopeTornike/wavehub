import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Full-size photo viewer (owner bug list 2026-10-03, BUG 03): used for listing galleries, Steam
// games, profiles, coach photos and seller uploads. The whole image is shown (object-fit: contain,
// never cropped or stretched), arrows/swipe between several images, closes on ×, Esc or a tap
// outside the image. Rendered into <body> so no parent overflow/transform can clip it.
/* eslint-disable @next/next/no-img-element */

export type LightboxImage = { url: string; alt?: string }

export default function ImageLightbox({ images, index, onClose, onIndex }: { images: LightboxImage[]; index: number | null; onClose: () => void; onIndex?: (i: number) => void }) {
  const [mounted, setMounted] = useState(false)
  const [touchX, setTouchX] = useState<number | null>(null)
  const open = index !== null && images.length > 0
  const i = open ? Math.min(Math.max(index!, 0), images.length - 1) : 0
  const go = (delta: number) => onIndex?.((i + delta + images.length) % images.length)

  useEffect(() => {
    // Portals need document; render nothing during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onIndex?.((i + 1) % images.length)
      else if (e.key === 'ArrowLeft') onIndex?.((i - 1 + images.length) % images.length)
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, i, images.length, onClose, onIndex])

  if (!mounted || !open) return null
  const img = images[i]
  return createPortal(
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="ფოტოს ნახვა"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX === null || images.length < 2) return
        const dx = e.changedTouches[0].clientX - touchX
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        setTouchX(null)
      }}
    >
      <button type="button" className="lightbox-close" aria-label="დახურვა" onClick={onClose}>
        ×
      </button>
      <img src={img.url} alt={img.alt ?? ''} className="lightbox-img" />
      {images.length > 1 && (
        <>
          <button type="button" className="lightbox-nav prev" aria-label="წინა ფოტო" onClick={() => go(-1)}>
            ‹
          </button>
          <button type="button" className="lightbox-nav next" aria-label="შემდეგი ფოტო" onClick={() => go(1)}>
            ›
          </button>
          <span className="lightbox-count">
            {i + 1} / {images.length}
          </span>
        </>
      )}
    </div>,
    document.body,
  )
}
