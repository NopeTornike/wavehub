// Sound + desktop alerts for new notifications (owner 2026-11-08: "must have sound … also when the
// user is on another tab or on desktop"). Browsers only let a page make sound after the person has
// interacted with it, so taps / key presses unlock the audio and, once per browser, ask for
// desktop-notification permission.

// Sound (owner 2026-11-09: "we need notification sounds on mobile and web"): a small mp3 played
// through an <audio> element. The first version made a Web Audio tone, which stayed silent on phones:
// iOS mutes Web Audio when the ring switch is on silent and only counts touchend/click as the gesture
// that unlocks sound, and phones suspend the audio again after the screen locks — while unlocking
// happened only on the very first pointerdown. Now every tap re-unlocks, and a media element plays
// like any site's sound on iPhone and Android alike.
const SOUND_URL = '/assets/sounds/notify.mp3'
const MUTED_KEY = 'wavehub.notifications.soundOff'
const ASKED_KEY = 'wavehub.notifications.permissionAsked'

let player: HTMLAudioElement | null = null
let unlocked = false
let armed = false

function getPlayer(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
  if (!player) {
    player = new Audio(SOUND_URL)
    player.preload = 'auto'
  }
  return player
}

export function soundEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(MUTED_KEY) !== '1'
  } catch {
    return true
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    if (on) localStorage.removeItem(MUTED_KEY)
    else localStorage.setItem(MUTED_KEY, '1')
  } catch {
    // storage blocked — the choice lasts until reload
  }
  if (on) playChime(true)
}

/** Call once (signed in): taps / key presses keep sound unlocked and ask for desktop alerts once. */
export function armAlerts(): void {
  if (armed || typeof window === 'undefined') return
  armed = true
  const unlock = () => {
    const el = getPlayer()
    if (el && !unlocked) {
      // A silent play inside the gesture is what lets later, gesture-less plays make sound.
      el.muted = true
      el.play()
        .then(() => {
          el.pause()
          el.currentTime = 0
          el.muted = false
          unlocked = true
        })
        .catch(() => {
          el.muted = false
        })
    }
    try {
      if ('Notification' in window && Notification.permission === 'default' && !localStorage.getItem(ASKED_KEY)) {
        localStorage.setItem(ASKED_KEY, '1')
        void Notification.requestPermission().catch(() => undefined)
      }
    } catch {
      // storage blocked — skip the prompt
    }
  }
  // Kept for the whole visit: a locked screen or app switch can take the unlock away again.
  for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(type, unlock, { passive: true })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') unlocked = false
  })
}

/** The notification chime (+ a short buzz on Android). `force` plays even when sound is off (preview). */
export function playChime(force = false): void {
  if (!force && !soundEnabled()) return
  const el = getPlayer()
  if (el) {
    el.muted = false
    el.volume = 0.8
    el.currentTime = 0
    void el.play().catch(() => undefined)
  }
  try {
    if (!force && document.visibilityState === 'visible' && 'vibrate' in navigator) navigator.vibrate([60, 40, 60])
  } catch {
    // vibration not allowed — sound only
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
