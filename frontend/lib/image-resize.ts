// User photos are capped at 2MB server-side (listing photos, avatars/coach portraits, team logos —
// owner decision 2026-10-03). Phone cameras routinely produce 3-8MB files, so before uploading a
// JPG/PNG/WEBP over the cap we re-encode it in the browser: longest side ≤ 2048px, JPEG, stepping
// quality/size down until it fits. Anything we can't shrink is sent as-is and the server refuses it
// with a clear message. Never changes a file that is already small enough.

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024

const RESIZABLE = ['image/jpeg', 'image/png', 'image/webp']

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unreadable image'))
    }
    img.src = url
  })
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

export async function shrinkPhoto(file: File, maxBytes = MAX_PHOTO_BYTES): Promise<File> {
  if (file.size <= maxBytes || !RESIZABLE.includes(file.type) || typeof document === 'undefined') return file
  try {
    const img = await loadImage(file)
    for (const side of [2048, 1600, 1280, 1024]) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) return file
      // JPEG has no alpha — paint transparent PNG areas dark (the site's background) not black-on-black artefacts.
      ctx.fillStyle = '#0b0a18'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.86, 0.78, 0.7]) {
        const blob = await encode(canvas, quality)
        if (blob && blob.size <= maxBytes) {
          const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
          return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
        }
      }
    }
  } catch {
    // fall through — the server gives the size error
  }
  return file
}

// The largest original we accept in a picker — anything up to this is downscaled to ≤2MB first.
export const PHOTO_SOURCE_MAX_BYTES = 20 * 1024 * 1024
export const PHOTO_LIMIT_TEXT = 'მაქსიმუმ 20MB — დიდი ფოტო ავტომატურად მცირდება 2MB-მდე'
