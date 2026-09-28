import { useState } from 'react'

// Horizontal bars for "which X sold most" (dataviz: magnitude → one hue). Bars ≤ 20px thick,
// rounded at the data end, square at the baseline, value at the tip in text ink (never the bar
// colour); each row is focusable and shows its full figures on hover/focus.

export type BarRow = { key: string; label: string; value: number; detail?: string }

export default function BarList({ rows, color, format, empty }: { rows: BarRow[]; color: string; format: (n: number) => string; empty: string }) {
  const [active, setActive] = useState<string | null>(null)
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (rows.length === 0) return <p className="an-empty">{empty}</p>
  return (
    <ul className="bl-list">
      {rows.map((row) => (
        <li
          key={row.key}
          className={active === row.key ? 'active' : undefined}
          tabIndex={0}
          onPointerEnter={() => setActive(row.key)}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(row.key)}
          onBlur={() => setActive(null)}
          aria-label={`${row.label}: ${format(row.value)}${row.detail ? `, ${row.detail}` : ''}`}
        >
          <span className="bl-label">{row.label}</span>
          <span className="bl-track">
            <span className="bl-bar" style={{ width: `${Math.max(1.5, (row.value / max) * 100)}%`, background: color }} />
            <b className="bl-value">{format(row.value)}</b>
          </span>
          {active === row.key && row.detail && <span className="bl-tip">{row.detail}</span>}
        </li>
      ))}
    </ul>
  )
}
