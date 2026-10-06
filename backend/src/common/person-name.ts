// How a person is named in notification texts (client feedback #9, 2026-10-04): "First Last", or
// "@username" when the account has no name.
export function personName(user: { firstName?: string | null; lastName?: string | null; username: string } | null | undefined): string {
  if (!user) return '';
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return full || `@${user.username}`;
}
