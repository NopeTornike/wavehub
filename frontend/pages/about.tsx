import Link from 'next/link'
import Layout from '../components/Layout'

// The prototype's about.html (body.about-page-body, main.about-main-panel): the "one gaming
// ecosystem" panel with its four feature cards and the explore button. Static copy — every claim
// here describes a feature that exists on this platform (escrow, verified coaches/sellers, the
// marketplace/coaching/tournaments/keys, support tickets). The longer company text lives in the
// admin-editable CMS page at /pages/about (footer → "ჩვენ შესახებ").
const FEATURES = [
  { tone: 'is-pink', icon: 'payments', glyph: '▣', label: 'Protected payments icon', title: 'დაცული გადახდები', text: 'Secure escrow system keeps your payments safe until the order is completed.' },
  { tone: 'is-purple', icon: 'verified', glyph: '✓', label: 'Verified sellers and coaches icon', title: 'ვერიფიცირებული გამყიდველები და ქოუჩები', text: 'All sellers and coaches are carefully verified to ensure a safe and trusted experience.' },
  { tone: 'is-violet', icon: 'services', glyph: '＋', label: 'Gaming and digital services icon', title: 'გეიმინგ და ციფრული სერვისები', text: 'Marketplace, coaching, tournaments, game keys and digital services — all in one place.' },
  { tone: 'is-blue', icon: 'support', glyph: '?', label: 'Fast support icon', title: 'სწრაფი საფორთი', text: 'Our support team is always ready to help you, 24/7. Quick answers, real support, real people.' },
]

export default function About() {
  return (
    <Layout
      title="ჩვენს შესახებ"
      description="WaveHubX — ყველაფერი, რაც გჭირდება, ერთ გეიმინგ ეკოსისტემაში: მარკეტი, ქოუჩინგი, ტურნირები და ციფრული გასაღებები."
      bodyClass="about-page-body"
      mainClass="about-main-panel"
    >
      <section className="about-page" aria-labelledby="aboutTitle">
        <div className="about-ecosystem-panel">
          <header className="about-hero-copy">
            <p className="about-eyebrow">
              <span></span>
              <b aria-hidden="true">◆</b> WAVEHUBX <span></span>
            </p>
            <h1 id="aboutTitle">
              ყველაფერი, რაც გჭირდება. <em>ერთი გეიმინგ ეკოსისტემა.</em>
            </h1>
            <p>იყიდე, გაყიდე, ისწავლე, შეეჯიბრე და გაიზარდე — ყველაფერი ერთ დაცულ პლატფორმაზე, გეიმერების მიერ გეიმერებისთვის.</p>
          </header>
          <div className="about-feature-grid">
            {FEATURES.map((feature) => (
              <article key={feature.icon} className={`about-feature-card ${feature.tone}`}>
                <div className="about-feature-icon" data-about-icon={feature.icon} aria-label={feature.label}>
                  <span>{feature.glyph}</span>
                </div>
                <h2>{feature.title}</h2>
                <i></i>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
          <Link className="about-explore-button" href="/marketplace">
            <b aria-hidden="true">◆</b>
            <span>აღმოაჩინე WaveHubX</span>
            <strong aria-hidden="true">→</strong>
          </Link>
        </div>
      </section>
    </Layout>
  )
}
