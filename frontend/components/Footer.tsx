import Link from 'next/link'

// Backed by the admin-editable Content pages (backend/src/content/) — an admin can rename
// titles/body from /admin/content, but these slugs/hrefs are the fixed set Footer.tsx commits to.
// Matches site-footer.js's real link list on origin/main (see LAUNCH_PLAN.md §2a) — the 5 pages
// added alongside content-page sync (delivery/dispute/community/coach-standards/seller-standards)
// are wired in here too, not left orphaned in the CMS with no way to reach them. Contact
// intentionally doesn't link here — logged-in users have a real Support ticket flow (/support)
// that does more than a static contact page could.
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
        <Link href="/pages/delivery-policy">Delivery Policy</Link>
        <Link href="/pages/dispute-resolution">Dispute Resolution</Link>
        <Link href="/pages/community-guidelines">Community Guidelines</Link>
        <Link href="/pages/coach-standards">Coach Standards</Link>
        <Link href="/pages/seller-standards">Seller Standards</Link>
      </div>
    </footer>
  )
}
