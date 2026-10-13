import Link from 'next/link'
import Layout from '../components/Layout'

// Next serves this for any unknown route (statically exported, so it can't depend on data).
export default function NotFound() {
  return (
    <Layout title="გვერდი ვერ მოიძებნა" noIndex>
      <div className="error-page">
        <p className="error-page-code" aria-hidden="true">
          404
        </p>
        <h1>გვერდი ვერ მოიძებნა</h1>
        <p>ბმული, რომელიც გახსენით, არასწორია ან გვერდი წაშლილია. სცადეთ მთავარი გვერდიდან ან მარკეტფლეისიდან.</p>
        <div className="error-page-actions">
          <Link href="/">მთავარი გვერდი</Link>
          <Link href="/marketplace" className="secondary">
            მარკეტფლეისი
          </Link>
        </div>
      </div>
    </Layout>
  )
}
