// Augments Express's Request with the fields AuthGuard/AdminGuard attach after verifying the
// session cookie / admin role. Keep this in sync with what auth.guard.ts and
// admin/admin-role.guard.ts actually set.
declare namespace Express {
  export interface Request {
    userId?: string;
    adminRole?: string;
  }
}
