const path = require('path')

// turbopack.root must point at the monorepo root (not this frontend/ dir) now that `next` and
// other deps are hoisted into the root node_modules by npm workspaces (added in Phase 0 of the
// build plan) — otherwise Turbopack can't resolve next/package.json and the build fails.
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework in an `X-Powered-By` response header.
  poweredByHeader: false,
  // Next 16's `next dev` auto-generates an AGENTS.md "agent rules" block. In THIS repo every
  // AGENTS.md is a plain symlink to its sibling CLAUDE.md (root CLAUDE.md, "Tool portability"), so
  // that generator followed frontend/AGENTS.md and appended its block into frontend/CLAUDE.md
  // itself — a spurious, self-re-creating modification to a hand-maintained module doc on every
  // dev-server start. Disabled so the symlink convention keeps working.
  agentRules: false,
  // Files in public/assets were sent with max-age=0, so every visit re-downloaded every icon and
  // cover. Browsers may now keep them for a week. These names carry no content hash: when you
  // replace a file, give it a NEW name, or visitors can see the old one for up to 7 days.
  async headers() {
    return [
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
    ]
  },
  turbopack: {
    root: path.join(__dirname, '..'),
  },
}
module.exports = nextConfig
