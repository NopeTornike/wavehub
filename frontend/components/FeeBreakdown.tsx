import type { OrderQuote } from '@wavehub/shared-types'
import { gel } from '../lib/money'

// Price + marketplace fee = total, shown before paying (the buyer carries the fee since 2026-10-03;
// the seller receives the full price). Amounts come from GET /order-quote — never computed here.
export default function FeeBreakdown({ quote, className = '' }: { quote: OrderQuote | null; className?: string }) {
  if (!quote) return null
  return (
    <dl className={`fee-breakdown ${className}`.trim()} aria-label="Payment breakdown">
      <div>
        <dt>ფასი</dt>
        <dd>{quote.priceWaveCoin} GEL</dd>
      </div>
      <div>
        <dt>{`მარკეტფლეისის საკომისიო (${quote.feePercent}%)`}</dt>
        <dd>+{gel(quote.feeWaveCoin)} GEL</dd>
      </div>
      <div className="fee-breakdown-total">
        <dt>სულ გადასახდელი</dt>
        <dd>{gel(quote.totalWaveCoin)} GEL</dd>
      </div>
    </dl>
  )
}
