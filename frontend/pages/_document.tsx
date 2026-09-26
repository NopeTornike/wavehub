import { Html, Head, Main, NextScript } from 'next/document'

// The whole UI copy is Georgian, so the document language is `ka` (screen readers pick the right
// voice, browsers offer the right hyphenation/translation behavior). Favicon + theme color live here
// because they're identical for every page.
export default function Document() {
  return (
    <Html lang="ka">
      <Head>
        {/* The prototype's own favicon (index.html: assets/favicon.png?v=4). */}
        <link rel="icon" type="image/png" sizes="512x512" href="/assets/favicon.png?v=4" />
        <link rel="apple-touch-icon" href="/assets/favicon.png?v=4" />
        <meta name="theme-color" content="#050813" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
