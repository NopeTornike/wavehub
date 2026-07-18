import Link from 'next/link'
import Layout from '../components/Layout'

export default function Home() {
  return (
    <Layout>
      <div className="page">
        <div className="page-inner" style={{ textAlign: 'center', paddingTop: 60 }}>
          <h1 className="page-title" style={{ fontSize: '2.4rem' }}>
            WaveHub
          </h1>
          <p className="page-subtitle" style={{ fontSize: '1.05rem' }}>
            გეიმინგ სერვისების და ნივთების მარკეტფლეისი — რანკ პუშიდან კოუჩინგამდე
          </p>
          <Link href="/marketplace" className="button glow-on-hover" style={{ display: 'inline-block' }}>
            მარკეტფლეისის დათვალიერება
          </Link>
        </div>
      </div>
    </Layout>
  )
}
