import Router from 'next/router'

// Remembers a list page's loaded data and scroll position when you leave it, and hands them back
// when you return with the browser's Back button (client 2026-10-07: scrolling down the
// marketplace, opening a product and coming back used to start again at the top — the list is
// fetched client-side, so the browser's own scroll restore ran against an empty page).

type Snapshot<T> = { data: T; scrollY: number; savedAt: number }
const snapshots = new Map<string, Snapshot<unknown>>()
const MAX_AGE_MS = 10 * 60 * 1000

// A popstate (Back/Forward) precedes the route change it causes; remember it for that navigation.
let poppedTo: string | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    poppedTo = window.location.pathname + window.location.search
  })
  Router.events.on('routeChangeComplete', (url: string) => {
    if (poppedTo !== url) poppedTo = null
  })
}

export function saveSnapshot<T>(key: string, data: T): void {
  snapshots.set(key, { data, scrollY: window.scrollY, savedAt: Date.now() })
}

// The snapshot for `key`, only when this page was reached by Back/Forward and it's still fresh.
export function takeSnapshot<T>(key: string): Snapshot<T> | null {
  const snap = snapshots.get(key) as Snapshot<T> | undefined
  if (!snap || poppedTo !== key || Date.now() - snap.savedAt > MAX_AGE_MS) return null
  snapshots.delete(key)
  poppedTo = null
  return snap
}

// Scroll once the restored list has rendered (two frames: layout, then images' boxes).
export function restoreScroll(y: number): void {
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)))
}

// Every page (owner 2026-10-15: "open a tournament card, go back, and the site jumps to the top"):
// the scroll position is remembered when you leave a page, and Back/Forward scrolls back to it once
// the page is tall enough — content is fetched client-side, so that can take a moment. Gives up
// after a few seconds, or as soon as the visitor scrolls themselves.
const positions = new Map<string, number>()
let poppedForScroll: string | null = null
let settleTimer: number | null = null

function stopSettling() {
  if (settleTimer !== null) window.clearInterval(settleTimer)
  settleTimer = null
  window.removeEventListener('wheel', stopSettling)
  window.removeEventListener('touchstart', stopSettling)
  window.removeEventListener('keydown', stopSettling)
}

// Next.js resets the scroll to the top when the page commits, which can land after this restore —
// so the position is re-applied until it has held for a few ticks.
function settleScroll(y: number) {
  stopSettling()
  if (y <= 0) return
  let tries = 0
  let held = 0
  const attempt = () => {
    tries += 1
    const reachable = document.documentElement.scrollHeight - window.innerHeight >= y - 2
    if (Math.abs(window.scrollY - y) < 3) held += 1
    else if (reachable || tries >= 40) {
      held = 0
      window.scrollTo(0, y)
    }
    if (held >= 3 || tries >= 50) stopSettling()
  }
  window.addEventListener('wheel', stopSettling, { passive: true })
  window.addEventListener('touchstart', stopSettling, { passive: true })
  window.addEventListener('keydown', stopSettling)
  settleTimer = window.setInterval(attempt, 100)
  attempt()
}

if (typeof window !== 'undefined') {
  // This module restores Back/Forward positions itself; the browser's own attempt runs against a
  // page that hasn't loaded yet and lands at the top.
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
  // The page being shown. On Back/Forward the address bar already shows the destination when the
  // route change starts, so the position is saved under this key, not window.location.
  let currentKey = window.location.pathname + window.location.search
  window.addEventListener('popstate', () => {
    poppedForScroll = window.location.pathname + window.location.search
  })
  Router.events.on('routeChangeStart', () => {
    positions.set(currentKey, window.scrollY)
  })
  Router.events.on('routeChangeComplete', (url: string) => {
    currentKey = url
    const popped = poppedForScroll === url
    poppedForScroll = null
    if (popped) settleScroll(positions.get(url) ?? 0)
  })
}
