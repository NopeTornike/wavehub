import Link from 'next/link'

// Backed by the admin-editable Content pages (backend/src/content/) — an admin can rename
// titles/body from /admin/content, but these 5 slugs/hrefs are the fixed set Footer.tsx commits
// to. Contact intentionally doesn't link here — logged-in users have a real Support ticket flow
// (/support) that does more than a static contact page could.
export default function Footer() {
  return (
    <footer className="site-footer">
      <div>© {new Date().getFullYear()} WaveHub</div>
      <div>
        <Link href="/pages/about">About</Link>
        <Link href="/support">Contact</Link>
        <Link href="/pages/terms-of-service">Terms of Service</Link>
        <Link href="/pages/privacy-policy">Privacy Policy</Link>
        <Link href="/pages/refund-policy">Refund Policy</Link>
      </div>
    </footer>
  )
}
