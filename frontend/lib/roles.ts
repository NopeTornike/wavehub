import { AdminRole } from '@wavehub/shared-types'

// Staff roles that publish Steam games — mirrors STEAM_PUBLISHER_ROLES in
// backend/src/listings/listings.service.ts (the backend is the real gate; this only hides UI).
const STEAM_PUBLISHER_ROLES: AdminRole[] = [AdminRole.SuperAdmin, AdminRole.OperationLead, AdminRole.MainAdministrator, AdminRole.MarketplaceCoachingOpsManager]

export function canPublishSteam(user: { adminRole?: AdminRole | null } | null | undefined): boolean {
  return Boolean(user?.adminRole && STEAM_PUBLISHER_ROLES.includes(user.adminRole))
}
