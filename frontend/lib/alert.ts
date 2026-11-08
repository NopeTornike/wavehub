// Sound + desktop alerts for new notifications (owner 2026-11-08: "must have sound … also when the
// user is on another tab or on desktop"). Browsers only let a page make sound after the person has
// interacted with it once, so the first tap / key press anywhere unlocks the audio and, once per
// browser, asks for desktop-notification permission.

let ctx: AudioContext | null = null
let armed = false

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  return ctx
}

const ASKED_KEY = 'wavehub.notifications.permissionAsked'

/** Call once (signed in): the next user gesture unlocks sound and asks for desktop alerts once. */
export function armAlerts(): void {
  if (armed || typeof window === 'undefined') return
  armed = true
  const unlock = () => {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    void audio()?.resume().catch(() => undefined)
    try {
      if ('Notification' in window && Notification.permission === 'default' && !localStorage.getItem(ASKED_KEY)) {
        localStorage.setItem(ASKED_KEY, '1')
        void Notification.requestPermission().catch(() => undefined)
      }
    } catch {
      // storage blocked — skip the prompt
    }
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

/** A short two-note chime, made in the browser (no file to download). */
export function playChime(): void {
  const ac = audio()
  if (!ac || ac.state !== 'running') return
  const now = ac.currentTime
  for (const [i, freq] of [880, 1320].entries()) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const start = now + i * 0.13
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32)
    osc.connect(gain).connect(ac.destination)
    osc.start(start)
    osc.stop(start + 0.35)
  }
}

/** A system notification while the site isn't the visible tab (permission granted only). */
export function desktopAlert(id: string, title: string, body: string, onOpen: () => void): void {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return
  if (document.visibilityState === 'visible') return
  try {
    const n = new Notification(title, { body, tag: id, icon: '/assets/whx-icon-192.png?v=5' })
    n.onclick = () => {
      window.focus()
      onOpen()
      n.close()
    }
  } catch {
    // some mobile browsers only allow notifications from a service worker — the in-page toast stays
  }
}

/** Runs `fn` in only one open tab at a time (so two tabs don't both chime for the same item). */
export async function inOneTab(fn: () => void | Promise<void>): Promise<void> {
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined
  if (locks) await locks.request('wavehub-notification-alert', async () => fn())
  else await fn()
}
