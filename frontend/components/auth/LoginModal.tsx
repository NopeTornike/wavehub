/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import LoginForm from './LoginForm'

// The login drawer (desktop: slides in from the right) / card (phones: centred) — owner design
// 2026-10-15. Escape, the × and the backdrop close it; the page behind doesn't scroll.
export default function LoginModal({ next, onClose }: { next?: string; onClose: () => void }) {
  const router = useRouter()
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    document.body.classList.add('ax-modal-open')
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLInputElement>('input')?.focus())
    return () => {
      cancelAnimationFrame(frame)
      document.body.classList.remove('ax-modal-open')
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div className="ax-modal" role="presentation">
      <div className="ax-modal-backdrop" onClick={onClose} />
      <section className="ax-drawer" ref={panel} role="dialog" aria-modal="true" aria-labelledby="axLoginTitle">
        <button type="button" className="ax-close" aria-label="დახურვა" onClick={onClose}>
          ×
        </button>
        <img className="ax-logo" src="/assets/logo-wavehubx-main.png" alt="WaveHubX" />
        <h2 id="axLoginTitle" className="ax-heading">
          შესვლა
        </h2>
        <p className="ax-lead">კეთილი იყოს შენი დაბრუნება! შედი WaveHubX ანგარიშზე და განაგრძე გეიმინგ მოგზაურობა.</p>
        <LoginForm
          next={next}
          onDone={onClose}
          onSignUp={() => {
            onClose()
            void router.push('/register')
          }}
        />
      </section>
    </div>,
    document.body,
  )
}
