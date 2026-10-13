import { Html, Head, Main, NextScript } from 'next/document'

// The whole UI copy is Georgian, so the document language is `ka` (screen readers pick the right
// voice, browsers offer the right hyphenation/translation behavior). Favicon + theme color live here
// because they're identical for every page.
export default function Document() {
  return (
    <Html lang="ka">
      <Head>
        {/* The owner's WHX site icon (2026-10-07), generated at the sizes browsers ask for; /favicon.ico
            for clients that request it directly. */}
        <link rel="icon" href="/favicon.ico?v=5" sizes="48x48" />
        <link rel="icon" type="image/png" sizes="32x32" href="/assets/whx-icon-32.png?v=5" />
        <link rel="icon" type="image/png" sizes="192x192" href="/assets/whx-icon-192.png?v=5" />
        <link rel="icon" type="image/png" sizes="512x512" href="/assets/whx-icon-512.png?v=5" />
        <link rel="apple-touch-icon" sizes="180x180" href="/assets/whx-icon-180.png?v=5" />
        <meta name="theme-color" content="#050813" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
