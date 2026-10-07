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
