// At least 8 characters, at least one letter and one digit. Deliberately not a stricter "must
// include a symbol" rule — that tends to push users toward predictable substitutions (e.g.
// "Password1!") without meaningfully raising real entropy. See root CLAUDE.md non-negotiable rule
// #1 for why any password strength floor is required at all (the source spec had marked this
// optional for MVP, which this repo does not follow).
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && PASSWORD_PATTERN.test(password);
}
