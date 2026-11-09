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

// Copies picked files into memory right away (owner 2026-10-15): on Android a photo chosen from a
// cloud / gallery app is a temporary reference that can expire before the form is submitted, and
// the upload then fails. A file that can't be read is left out and reported.
export async function materializeFiles(files: File[]): Promise<{ files: File[]; unreadable: number }> {
  const out: File[] = []
  let unreadable = 0
  for (const file of files) {
    try {
      out.push(new File([await file.arrayBuffer()], file.name, { type: file.type, lastModified: file.lastModified }))
    } catch {
      unreadable += 1
    }
  }
  return { files: out, unreadable }
}

// Cover overlays (Tournament Gift / custom covers, owner 2026-11-09) are usually PNGs with a
// transparent background. shrinkPhoto() flattens to JPEG on a dark fill, which turned those
// backgrounds black — so a cover over the cap is shrunk keeping its alpha: WebP (lossy with alpha)
// where the browser can encode it, else a smaller PNG. A small file is sent untouched.
export async function shrinkKeepingAlpha(file: File, maxBytes = MAX_PHOTO_BYTES): Promise<File> {
  if (file.size <= maxBytes || !RESIZABLE.includes(file.type) || typeof document === 'undefined') return file
  if (file.type === 'image/jpeg') return shrinkPhoto(file, maxBytes)
  try {
    const img = await loadImage(file)
    for (const side of [1600, 1280, 1024, 800, 640]) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) return file
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const attempts: Array<[string, number | undefined]> = [['image/webp', 0.9], ['image/webp', 0.8], ['image/png', undefined]]
      for (const [type, quality] of attempts) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
        // A browser that can't encode WebP hands back a PNG — fine, it still has alpha.
        if (blob && blob.size <= maxBytes && (blob.type === 'image/webp' || blob.type === 'image/png')) {
          const ext = blob.type === 'image/webp' ? '.webp' : '.png'
          return new File([blob], file.name.replace(/\.[^.]+$/, '') + ext, { type: blob.type, lastModified: Date.now() })
        }
      }
    }
  } catch {
    // fall through — the server gives the size error
  }
  return file
}

// Cover overlay upload: trims the empty transparent border many badge PNGs come with (otherwise the
// badge shows tiny in the middle of the photo), then keeps the result under the cap with its alpha.
// JPEGs and images without a transparent border pass through to shrinkKeepingAlpha unchanged.
export async function prepareCoverImage(file: File, maxBytes = MAX_PHOTO_BYTES): Promise<File> {
  if (typeof document === 'undefined' || (file.type !== 'image/png' && file.type !== 'image/webp')) return shrinkKeepingAlpha(file, maxBytes)
  try {
    const img = await loadImage(file)
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return shrinkKeepingAlpha(file, maxBytes)
    ctx.drawImage(img, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h).data
    let x0 = w
    let y0 = h
    let x1 = -1
    let y1 = -1
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (data[(y * w + x) * 4 + 3] > 12) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
      }
    }
    if (x1 < 0) return shrinkKeepingAlpha(file, maxBytes) // fully transparent — let the server judge
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03)
    x0 = Math.max(0, x0 - pad)
    y0 = Math.max(0, y0 - pad)
    x1 = Math.min(w - 1, x1 + pad)
    y1 = Math.min(h - 1, y1 + pad)
    const cw = x1 - x0 + 1
    const ch = y1 - y0 + 1
    if (cw >= w * 0.97 && ch >= h * 0.97 && scale === 1) return shrinkKeepingAlpha(file, maxBytes) // nothing to trim
    const out = document.createElement('canvas')
    out.width = cw
    out.height = ch
    out.getContext('2d')?.drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch)
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'))
    if (!blob) return shrinkKeepingAlpha(file, maxBytes)
    const trimmed = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png', lastModified: Date.now() })
    return shrinkKeepingAlpha(trimmed, maxBytes)
  } catch {
    return shrinkKeepingAlpha(file, maxBytes)
  }
}
