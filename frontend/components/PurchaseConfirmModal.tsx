import { useEffect, useRef } from 'react'
import { gel } from '../lib/money'

type PurchaseItem = { title: string; quantity?: number; imageUrl?: string | null; detail?: string }

export default function PurchaseConfirmModal({ open, items, subtotal, fee = 0, feePercent, total, busy = false, onCancel, onConfirm }: { open: boolean; items: PurchaseItem[]; subtotal?: number; fee?: number; feePercent?: number | null; total: number; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    window.setTimeout(() => confirmRef.current?.focus(), 0)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel, open])

  if (!open) return null
  return (
    <div className="purchase-confirm-backdrop" role="presentation" onMouseDown={() => !busy && onCancel()}>
      <section className="purchase-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="purchaseConfirmTitle" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="purchase-confirm-close" aria-label="დახურვა" onClick={onCancel} disabled={busy}>×</button>
        <header className="purchase-confirm-head">
          <span className="purchase-confirm-icon" aria-hidden="true">🛒</span>
          <div><h2 id="purchaseConfirmTitle">შესყიდვის დადასტურება</h2><p>ნამდვილად გსურთ ამ პროდუქტის შეძენა?</p></div>
        </header>
        <ul className="purchase-confirm-items">
          {items.map((item) => (
            <li key={item.title}>
              {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="purchase-confirm-placeholder" aria-hidden="true">◈</span>}
              <span><strong>{item.title}{item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : ''}</strong>{item.detail && <small>{item.detail}</small>}</span>
            </li>
          ))}
        </ul>
        <div className="purchase-confirm-price">
          {subtotal !== undefined && <div><span>პროდუქტის ფასი</span><strong>{gel(subtotal)} GEL</strong></div>}
          {fee > 0 && <div><span>Marketplace საკომისიო{feePercent != null ? ` (${feePercent}%)` : ''}</span><strong>+{gel(fee)} GEL</strong></div>}
          <div className="purchase-confirm-total"><span>სულ გადასახდელი</span><strong>{gel(total)} GEL</strong></div>
        </div>
        <p className="purchase-confirm-escrow"><span aria-hidden="true">♢</span> თქვენი გადახდა დაცულია WaveHubX-ის Escrow სისტემით — თანხა გამყიდველს მხოლოდ შეკვეთის დასრულების შემდეგ ერიცხება.</p>
        <div className="purchase-confirm-actions">
          <button type="button" onClick={onCancel} disabled={busy}>გაუქმება</button>
          <button ref={confirmRef} type="button" onClick={onConfirm} disabled={busy}>{busy ? 'მიმდინარეობს…' : 'შესყიდვის დადასტურება'}</button>
        </div>
      </section>
    </div>
  )
}
