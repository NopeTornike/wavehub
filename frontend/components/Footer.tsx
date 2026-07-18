// Static/legal pages (About, Terms, Privacy, Refund Policy, Guidelines) don't exist yet as real
// routes (build-plan Phase 12, CMS-backed) — these links are placeholders pointing at "#" rather
// than 404ing or being silently omitted, so the footer's structure matches the spec now and just
// needs real hrefs swapped in later.
export default function Footer() {
  return (
    <footer className="site-footer">
      <div>© {new Date().getFullYear()} WaveHub</div>
      <div>
        <a href="#">About</a>
        <a href="#">Contact</a>
        <a href="#">Terms of Service</a>
        <a href="#">Privacy Policy</a>
        <a href="#">Refund Policy</a>
      </div>
    </footer>
  )
}
