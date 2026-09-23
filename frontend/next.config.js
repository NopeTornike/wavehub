const path = require('path')

// turbopack.root must point at the monorepo root (not this frontend/ dir) now that `next` and
// other deps are hoisted into the root node_modules by npm workspaces (added in Phase 0 of the
// build plan) — otherwise Turbopack can't resolve next/package.json and the build fails.
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 16's `next dev` auto-generates an AGENTS.md "agent rules" block. In THIS repo every
  // AGENTS.md is a plain symlink to its sibling CLAUDE.md (root CLAUDE.md, "Tool portability"), so
  // that generator followed frontend/AGENTS.md and appended its block into frontend/CLAUDE.md
  // itself — a spurious, self-re-creating modification to a hand-maintained module doc on every
  // dev-server start. Disabled so the symlink convention keeps working.
  agentRules: false,
  turbopack: {
    root: path.join(__dirname, '..'),
  },
}
module.exports = nextConfig
