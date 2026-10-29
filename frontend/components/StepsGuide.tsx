// "How it works" steps (marketplace / services "როგორ მუშაობს Escrow?", coaching guide).
// Redesigned 2026-10-29 (owner: "make it beautiful, with icons"): an icon tile per step joined by a
// glowing line — a row on desktop, a vertical timeline on phones — plus an optional one-line note.
export type StepIcon = 'click' | 'form' | 'review' | 'publish' | 'wait' | 'image' | 'package' | 'search' | 'calendar' | 'card' | 'star'

const PATHS: Record<StepIcon, JSX.Element> = {
  click: (
    <>
      <path d="M9 9l10.5 4.2-4.4 1.6-1.6 4.4z" />
      <path d="M5.2 5.2l1.6 1.6M3.5 10h2.2M10 3.5v2.2M14.3 5.6l-1.5 1.5" />
    </>
  ),
  form: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
    </>
  ),
  review: (
    <>
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  publish: (
    <>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4.5 14.5v3a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-3" />
    </>
  ),
  wait: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6z" />
      <path d="m8.8 12 2.2 2.2 4.3-4.4" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m20.5 16-4.8-4.8L6 19.5" />
    </>
  ),
  package: (
    <>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
      <path d="M2.5 10h19M6.5 14.5h4" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
}

export default function StepsGuide({
  title,
  accent,
  subtitle,
  note,
  steps,
  id,
}: {
  title: string
  accent?: string
  subtitle?: string
  note?: string
  steps: Array<{ text: string; icon: StepIcon }>
  id: string
}) {
  return (
    <section className="how-steps" aria-labelledby={id} style={{ ['--how-count' as string]: steps.length }}>
      <header className="how-head">
        <span className="how-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24">{PATHS.wait}</svg>
        </span>
        <div>
          <h2 id={id}>
            {title} {accent && <span>{accent}</span>}?
          </h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>
      <ol className="how-list">
        {steps.map((step, index) => (
          <li key={step.text}>
            <span className="how-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">{PATHS[step.icon]}</svg>
              <b>{index + 1}</b>
            </span>
            <span className="how-text">
              <small>ნაბიჯი {index + 1}</small>
              <strong>{step.text}</strong>
            </span>
          </li>
        ))}
      </ol>
      {note && (
        <p className="how-note">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="10.5" width="14" height="10" rx="2" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
          </svg>
          <span>{note}</span>
        </p>
      )}
    </section>
  )
}
