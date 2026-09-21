import Link from 'next/link'
import type { NextPageContext } from 'next'
import PageHead from '../components/PageHead'

// Rendered for unexpected server/client errors (500 and anything else that isn't a plain 404 —
// pages/404.tsx handles those). Deliberately does NOT use Layout: if the crash came from the shell
// itself (auth provider, sidebar…), wrapping the error page in it would just crash again.
function ErrorPage({ statusCode }: { statusCode?: number }) {
  return (
    <main className="error-page">
      <PageHead title="შეცდომა" noIndex />
      <p className="error-page-code" aria-hidden="true">
        {statusCode ?? '!'}
      </p>
      <h1>რაღაც არასწორად წავიდა</h1>
      <p>მოულოდნელი შეცდომა მოხდა. სცადეთ გვერდის განახლება — თუ პრობლემა გრძელდება, მოგვწერეთ მხარდაჭერაში.</p>
      <div className="error-page-actions">
        <button type="button" onClick={() => window.location.reload()}>
          გვერდის განახლება
        </button>
        <Link href="/" className="secondary">
          მთავარი გვერდი
        </Link>
      </div>
    </main>
  )
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default ErrorPage
