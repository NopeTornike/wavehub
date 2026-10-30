import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { gel } from '../lib/money'

type PurchaseItem = { title: string; quantity?: number; imageUrl?: string | null; detail?: string }

export default function PurchaseConfirmModal({ open, items, subtotal, fee = 0, feePercent, total, busy = false, onCancel, onConfirm }: { open: boolean; items: PurchaseItem[]; subtotal?: number; fee?: number; feePercent?: number | null; total: number; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  // Rendered on <body> so it sits above the phone bottom bar (the page shell is its own layer).

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    window.setTimeout(() => confirmRef.current?.focus(), 0)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel, open])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="purchase-confirm-backdrop" role="presentation" onMouseDown={() => !busy && onCancel()}>
      <section className="purchase-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="purchaseConfirmTitle" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="purchase-confirm-close" aria-label="დახურვა" onClick={onCancel} disabled={busy}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <header className="purchase-confirm-head">
          <span className="purchase-confirm-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M3 4h2.2l2.2 10.2a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.5L20.5 8H6.4" /><circle cx="10" cy="19.5" r="1.4" /><circle cx="17" cy="19.5" r="1.4" /></svg>
          </span>
          <div><h2 id="purchaseConfirmTitle">შესყიდვის დადასტურება</h2><p>ნამდვილად გსურთ ამ პროდუქტის შეძენა?</p></div>
        </header>
        <ul className="purchase-confirm-items">
          {items.map((item) => (
            <li key={item.title}>
              {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="purchase-confirm-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" /></svg></span>}
              <span><strong>{item.title}{item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : ''}</strong>{item.detail && <small>{item.detail}</small>}</span>
            </li>
          ))}
        </ul>
        <div className="purchase-confirm-price">
          {subtotal !== undefined && <div><span>პროდუქტის ფასი</span><strong>{gel(subtotal)} GEL</strong></div>}
          {fee > 0 && <div><span>Marketplace საკომისიო{feePercent != null ? ` (${feePercent}%)` : ''}</span><strong>+{gel(fee)} GEL</strong></div>}
          <div className="purchase-confirm-total"><span>სულ გადასახდელი</span><strong>{gel(total)} GEL</strong></div>
        </div>
        <p className="purchase-confirm-escrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6z" /><path d="m8.8 12 2.2 2.2 4.3-4.4" /></svg><span>თქვენი გადახდა დაცულია WaveHubX-ის Escrow სისტემით — თანხა გამყიდველს მხოლოდ შეკვეთის დასრულების შემდეგ ერიცხება.</span></p>
        <div className="purchase-confirm-actions">
          <button type="button" onClick={onCancel} disabled={busy}>გაუქმება</button>
          <button ref={confirmRef} type="button" onClick={onConfirm} disabled={busy}>{busy ? 'მიმდინარეობს…' : 'შესყიდვის დადასტურება'}</button>
        </div>
      </section>
    </div>
  , document.body)
}
