import { AdminRole } from '@wavehub/shared-types'

// Staff roles that publish Steam games — mirrors STEAM_PUBLISHER_ROLES in
// backend/src/listings/listings.service.ts (the backend is the real gate; this only hides UI).
const STEAM_PUBLISHER_ROLES: AdminRole[] = [AdminRole.SuperAdmin, AdminRole.OperationLead, AdminRole.MainAdministrator, AdminRole.MarketplaceCoachingOpsManager]

export function canPublishSteam(user: { adminRole?: AdminRole | null } | null | undefined): boolean {
  return Boolean(user?.adminRole && STEAM_PUBLISHER_ROLES.includes(user.adminRole))
}

// Game Manager (owner 2026-11-06): a per-game head who sees only the admin pages of the areas it
// was given — marketplace listings and / or tournaments, each for its own games. The API checks
// every action against those games; this only decides which admin pages to show.
export type GameManagerArea = 'marketplace' | 'tournaments'
export const GAME_MANAGER_PAGES: Record<GameManagerArea, string> = {
  marketplace: '/admin/listings',
  tournaments: '/admin/tournaments',
}

export function gameManagerAreas(user: { adminRole?: AdminRole | null; staffScopes?: { marketplaceGameIds: string[]; tournamentGameIds: string[] } | null } | null | undefined): GameManagerArea[] | null {
  if (user?.adminRole !== AdminRole.GameManager) return null
  const areas: GameManagerArea[] = []
  if (user.staffScopes?.marketplaceGameIds?.length) areas.push('marketplace')
  if (user.staffScopes?.tournamentGameIds?.length) areas.push('tournaments')
  return areas
}
