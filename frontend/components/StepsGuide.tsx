// "How it works" numbered steps strip (design 2026-10-04: marketplace "როგორ მუშაობს Escrow?",
// the coaching directory guide — client feedback #8).
export default function StepsGuide({ title, accent, steps, id }: { title: string; accent?: string; steps: string[]; id: string }) {
  return (
    <section className="escrow-steps" aria-labelledby={id}>
      <h2 id={id}>
        {title} {accent && <span>{accent}</span>} ?
      </h2>
      <ol style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => (
          <li key={step}>
            <b>{index + 1}</b>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
