import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// The prototype's cart (cart.html / cart.js). The real backend's checkout is one order per listing
// (backend/src/orders/ — escrow is per order), so the cart is a client-side list of listings the
// viewer intends to buy, and pages/cart.tsx checks out by placing one real order per line. Nothing
// here is trusted for money: the snapshot fields are display-only, and every order's price is taken
// from the listing server-side at purchase time.
//
// Only listing types that can be bought without per-order input go in the cart — items and digital
// keys. Service listings need a package choice + requirements form, so they're bought from their
// own page (the "add to cart" button isn't offered for them).
//
// A per-viewer convenience, so localStorage (wrapped — may be unavailable) rather than the server.

export interface CartLine {
  listingId: string
  title: string
  priceWaveCoin: number
  imageUrl: string | null
  gameName: string | null
  sellerUsername: string
  type: 'item' | 'digital_key'
  quantity: number
}

const STORAGE_KEY = 'wavehub.cart'

type CartContextValue = {
  lines: CartLine[]
  count: number
  totalWaveCoin: number
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void
  setQuantity: (listingId: string, quantity: number) => void
  remove: (listingId: string) => void
  clear: () => void
  has: (listingId: string) => boolean
}

const CartContext = createContext<CartContextValue | null>(null)

function readStored(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((line) => line && typeof line.listingId === 'string') : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])

  useEffect(() => {
    // Hydrate once from storage after mount (SSR renders an empty cart).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLines(readStored())
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setLines(readStored())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const persist = useCallback((next: CartLine[]) => {
    setLines(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // storage unavailable — the cart just won't survive a reload
    }
  }, [])

  const value = useMemo<CartContextValue>(() => {
    const clamp = (n: number) => Math.max(1, Math.min(99, Math.floor(n) || 1))
    return {
      lines,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      totalWaveCoin: lines.reduce((sum, line) => sum + line.priceWaveCoin * line.quantity, 0),
      add: (line, quantity = 1) => {
        const existing = lines.find((l) => l.listingId === line.listingId)
        persist(
          existing
            ? lines.map((l) => (l.listingId === line.listingId ? { ...l, ...line, quantity: clamp(l.quantity + quantity) } : l))
            : [...lines, { ...line, quantity: clamp(quantity) }],
        )
      },
      setQuantity: (listingId, quantity) =>
        persist(lines.map((l) => (l.listingId === listingId ? { ...l, quantity: clamp(quantity) } : l))),
      remove: (listingId) => persist(lines.filter((l) => l.listingId !== listingId)),
      clear: () => persist([]),
      has: (listingId) => lines.some((l) => l.listingId === listingId),
    }
  }, [lines, persist])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}
