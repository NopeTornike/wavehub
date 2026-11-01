// Repeats `fn` every `ms` while the tab is visible. A hidden tab (another tab in front, window
// minimised, phone screen off) skips its turns, and coming back runs `fn` at once, so nothing the
// user sees is ever late. Returns the cleanup for a useEffect.
export function pollWhileVisible(fn: () => void, ms: number): () => void {
  const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible'
  const timer = window.setInterval(() => {
    if (visible()) fn()
  }, ms)
  const onShow = () => {
    if (visible()) fn()
  }
  document.addEventListener('visibilitychange', onShow)
  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onShow)
  }
}
