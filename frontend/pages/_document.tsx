import { Html, Head, Main, NextScript } from 'next/document'

// The whole UI copy is Georgian, so the document language is `ka` (screen readers pick the right
// voice, browsers offer the right hyphenation/translation behavior). Favicon + theme color live here
// because they're identical for every page.
export default function Document() {
  return (
    <Html lang="ka">
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#050813" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
