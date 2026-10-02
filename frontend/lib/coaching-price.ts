import { useEffect, useState } from 'react'
import { api } from './api'

// Every coach sells the platform's packages, so a coach card's price is the cheapest active
// package ("19₾-დან"). null until loaded, or when no package is active (cards then show the hourly rate).
export function useCoachingFromPrice(): number | null {
  const [price, setPrice] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    api
      .listCoachingPackages()
      .then((list) => {
        if (!cancelled) setPrice(list.length ? Math.min(...list.map((p) => p.priceWaveCoin)) : null)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  return price
}
