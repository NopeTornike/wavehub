// Per-game artwork, keyed by the games table's `slug` (seeded in the
// CommunityShellAndGameCatalogue migration). Same files and the same game→image choices as the
// static prototype: `cover` is marketplace.js#getMarketplaceCardImage (listing cards, carousels),
// `tile` is the home page's game grid art, `icon` is the small title icon.

type GameArt = { cover: string; tile: string; icon: string }

const A = (file: string) => `/assets/${file}`

export const GAME_ART: Record<string, GameArt> = {
  cs2: { cover: A('cs2-marketplace-cover.png'), tile: A('home-game-cs2.png'), icon: A('cs2-title-icon.png') },
  'dota-2': { cover: A('dota-2-marketplace-cover.png'), tile: A('home-game-dota2.jpg'), icon: A('dota-2-title-icon.png') },
  'pubg-mobile': { cover: A('pubg-mobile-marketplace-cover.png'), tile: A('home-game-pubg-mobile.jpg'), icon: A('pubg-mobile-title-icon.png') },
  'mobile-legends': { cover: A('mobile-legends-marketplace-cover.png'), tile: A('home-game-mobile-legends.png'), icon: A('mobile-legends-title-icon.png') },
  'cod-mobile': { cover: A('call-of-duty-marketplace-photo.png'), tile: A('home-game-call-of-duty-mobile.jpg'), icon: A('call-of-duty-title-icon.png') },
  fortnite: { cover: A('fortnite-marketplace-cover.png'), tile: A('home-game-fortnite.jpg'), icon: A('fortnite-title-icon.png') },
  roblox: { cover: A('roblox-marketplace-cover.png'), tile: A('home-game-roblox.png'), icon: A('roblox-title-icon.png') },
  'standoff-2': { cover: A('home-game-standoff2.png'), tile: A('home-game-standoff2.png'), icon: A('home-game-standoff2.png') },
  'free-fire': { cover: A('freefire-photo.jpeg'), tile: A('freefire-photo.jpeg'), icon: A('freefire-photo.jpeg') },
  'clash-of-clans': { cover: A('clash-of-clans-marketplace-cover.png'), tile: A('clash-of-clans-marketplace-cover.png'), icon: A('clash-of-clans-title-icon.png') },
  'league-of-legends': { cover: A('league-of-legends-marketplace-cover.png'), tile: A('league-of-legends-marketplace-cover.png'), icon: A('league-of-legends-title-icon.png') },
  minecraft: { cover: A('minecraft-marketplace-cover.png'), tile: A('minecraft-marketplace-cover.png'), icon: A('minecraft-title-icon.png') },
  'gta-5': { cover: A('gta-5-marketplace-cover.png'), tile: A('gta-5-marketplace-cover.png'), icon: A('gta-5-title-icon.png') },
  valorant: { cover: A('valorant-marketplace-cover.png'), tile: A('valorant-marketplace-cover.png'), icon: A('valorant-title-icon.png') },
}

// Art staff uploaded in Admin → Games (games.coverUrl/tileUrl/iconUrl), registered by the shell
// once GET /stats/games loads. It wins over the bundled art, and is the only art a game added
// after launch has. Module-level so the plain helpers below keep their signatures.
const uploadedArt: Record<string, Partial<GameArt>> = {}

export function registerGameArt(games: Array<{ slug: string; coverUrl?: string | null; tileUrl?: string | null; iconUrl?: string | null }>) {
  for (const game of games) {
    uploadedArt[game.slug] = {
      cover: game.coverUrl || undefined,
      tile: game.tileUrl || undefined,
      // Seeded games carry a bundled `/assets/...` iconUrl already — only an upload overrides.
      icon: game.iconUrl && !game.iconUrl.startsWith('/assets/') ? game.iconUrl : undefined,
    }
  }
}

export function gameCover(slug: string | null | undefined, fallback: string | null = null): string | null {
  return (slug && (uploadedArt[slug]?.cover || GAME_ART[slug]?.cover)) || fallback
}

export function gameTile(slug: string | null | undefined): string | null {
  return (slug && (uploadedArt[slug]?.tile || GAME_ART[slug]?.tile || uploadedArt[slug]?.cover)) || null
}

export function gameIcon(slug: string | null | undefined): string | null {
  return (slug && (uploadedArt[slug]?.icon || GAME_ART[slug]?.icon)) || null
}

// The prototype shows game names in caps on the home grid (e.g. "CALL OF DUTY MOBILE").
export function gameDisplayName(name: string): string {
  return name.toUpperCase()
}
