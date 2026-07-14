// Augments Express's Request with the fields AuthGuard attaches after verifying the session
// cookie. Keep this in sync with what auth.guard.ts actually sets.
declare namespace Express {
  export interface Request {
    userId?: string;
  }
}
