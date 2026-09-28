import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

// Single-series trend (dataviz spec): 2px line, ~10% area wash, one y-axis with clean rounded
// ticks, recessive hairline grid, a crosshair that snaps to the nearest point and a tooltip that
// also follows keyboard focus (←/→). One series → no legend; the caller's title names it.

export type TrendPoint = { label: string; value: number }

const HEIGHT = 240
const PAD = { top: 16, right: 16, bottom: 28, left: 52 }

function niceMax(max: number): number {
  if (max <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(max)))
  const f = max / exp
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return step * exp
}

export default function TrendChart({
  points,
  color,
  format,
  tipFormat = format,
  ariaLabel,
}: {
  points: TrendPoint[]
  color: string
  format: (n: number) => string // axis ticks (compact)
  tipFormat?: (n: number) => string // tooltip (full value)
  ariaLabel: string
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const max = niceMax(Math.max(0, ...points.map((p) => p.value)))
  const innerW = width - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (points.length <= 1 ? innerW / 2 : (i * innerW) / (points.length - 1))
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = points.length ? `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : ''
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f)
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 72))))

  const nearest = (clientX: number) => {
    const box = wrap.current?.getBoundingClientRect()
    if (!box || points.length === 0) return null
    const px = clientX - box.left
    const i = Math.round(((px - PAD.left) / innerW) * (points.length - 1))
    return Math.min(points.length - 1, Math.max(0, i))
  }
  const onMove = (event: PointerEvent<SVGRectElement>) => setActive(nearest(event.clientX))
  const onKey = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    setActive((cur) => {
      const base = cur ?? (event.key === 'ArrowLeft' ? points.length : -1)
      return Math.min(points.length - 1, Math.max(0, base + (event.key === 'ArrowRight' ? 1 : -1)))
    })
  }

  const tip = active !== null ? points[active] : null
  const tipLeft = active !== null ? Math.min(Math.max(x(active), 70), width - 70) : 0

  return (
    <div className="tc-wrap" ref={wrap}>
      <svg width={width} height={HEIGHT} role="img" aria-label={ariaLabel} tabIndex={0} onKeyDown={onKey} onBlur={() => setActive(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="tc-grid" />
            <text x={PAD.left - 8} y={y(t)} className="tc-axis" textAnchor="end" dominantBaseline="middle">
              {format(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.label} x={x(i)} y={HEIGHT - 8} className="tc-axis" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>
              {p.label}
            </text>
          ) : null,
        )}
        <path d={area} fill={color} opacity={0.1} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {active !== null && (
          <g>
            <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} className="tc-crosshair" />
            <circle cx={x(active)} cy={y(points[active].value)} r={5} fill={color} className="tc-dot" />
          </g>
        )}
        <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setActive(null)} />
      </svg>
      {tip && (
        <div className="tc-tip" style={{ left: tipLeft }} role="status">
          <strong>{tipFormat(tip.value)}</strong>
          <span>{tip.label}</span>
        </div>
      )}
    </div>
  )
}
