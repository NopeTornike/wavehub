import { useRouter } from 'next/router'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import { useAuth } from './auth'

// The viewer's saved listings (the prototype's ♡ buttons + Favorites page), backed by the real
// favourites API. One fetch of the saved ids per session; toggling updates optimistically and rolls
// back on failure. A signed-out click goes to login and returns to the same page.

type FavoritesContextValue = {
  ids: Set<string>
  isFavorite: (listingId: string) => boolean
  toggle: (listingId: string) => Promise<number | null>
}

const FavoritesContext = createContext<FavoritesContextValue>({
  ids: new Set(),
  isFavorite: () => false,
  toggle: async () => null,
})

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { user } = useAuth()
  const userId = user?.id
  const [ids, setIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) {
      // Signed out — nothing saved to show. A response to the auth change, not derived state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIds(new Set())
      return
    }
    api
      .listFavoriteIds()
      .then((list) => setIds(new Set(list)))
      .catch(() => setIds(new Set()))
  }, [userId])

  const toggle = useCallback(
    async (listingId: string): Promise<number | null> => {
      if (!userId) {
        router.push(`/login?next=${encodeURIComponent(router.asPath)}`)
        return null
      }
      const wasFavorite = ids.has(listingId)
      const apply = (favorite: boolean) =>
        setIds((current) => {
          const next = new Set(current)
          if (favorite) next.add(listingId)
          else next.delete(listingId)
          return next
        })
      apply(!wasFavorite)
      try {
        const result = wasFavorite ? await api.removeFavorite(listingId) : await api.addFavorite(listingId)
        return result.favoriteCount
      } catch {
        apply(wasFavorite)
        return null
      }
    },
    [userId, ids, router],
  )

  const value = useMemo(() => ({ ids, isFavorite: (id: string) => ids.has(id), toggle }), [ids, toggle])
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  return useContext(FavoritesContext)
}
