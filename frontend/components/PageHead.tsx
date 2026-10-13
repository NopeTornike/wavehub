import Head from 'next/head'

const SITE_NAME = 'WaveHub'
const DEFAULT_DESCRIPTION =
  'WaveHub — გეიმინგ სერვისების, ანგარიშებისა და გასაღებების მარკეტფლეისი: რანკის აწევა, კოუჩინგი, ტურნირები და უსაფრთხო გადახდა.'

// <title> + description + Open Graph tags for one page. Layout renders this from its own
// `title`/`description`/`noIndex` props; the bare auth pages (which don't use Layout) render it
// directly. `noIndex` is for private pages (orders, wallet, admin, auth) that shouldn't appear in
// search results.
export default function PageHead({
  title,
  description,
  noIndex,
}: {
  title?: string
  description?: string
  noIndex?: boolean
}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — გეიმინგ მარკეტფლეისი`
  const metaDescription = description ?? DEFAULT_DESCRIPTION

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="ka_GE" />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
    </Head>
  )
}
