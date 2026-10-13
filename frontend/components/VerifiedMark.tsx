// The pink verified seal shown after a verified person's name (design 2026-10-04).
export default function VerifiedMark({ size = 18 }: { size?: number }) {
  return (
    <svg className="wh-verified" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="ვერიფიცირებული">
      <path fill="currentColor" d="M12 1.6l2.5 1.8 3.1-.2 1 2.9 2.6 1.7-.9 3 .9 3-2.6 1.7-1 2.9-3.1-.2L12 20.4l-2.5-1.8-3.1.2-1-2.9-2.6-1.7.9-3-.9-3 2.6-1.7 1-2.9 3.1.2z" />
      <path fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M8 12.2l2.7 2.6L16.2 9.4" />
    </svg>
  )
}
