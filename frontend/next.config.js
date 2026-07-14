const path = require('path')

// turbopack.root must point at the monorepo root (not this frontend/ dir) now that `next` and
// other deps are hoisted into the root node_modules by npm workspaces (added in Phase 0 of the
// build plan) — otherwise Turbopack can't resolve next/package.json and the build fails.
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.join(__dirname, '..'),
  },
}
module.exports = nextConfig
