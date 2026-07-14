import { isValidPassword, PASSWORD_MIN_LENGTH } from './password-policy';

describe('isValidPassword', () => {
  it('rejects passwords shorter than the minimum length', () => {
    expect(isValidPassword('a1'.repeat(3))).toBe(false); // 6 chars, has letter+digit, too short
  });

  it('rejects passwords with no digit', () => {
    expect(isValidPassword('abcdefgh')).toBe(false);
  });

  it('rejects passwords with no letter', () => {
    expect(isValidPassword('12345678')).toBe(false);
  });

  it('accepts a password meeting length + letter + digit requirements', () => {
    expect(isValidPassword('abcdefg1')).toBe(true);
  });

  it(`accepts a password exactly at the ${PASSWORD_MIN_LENGTH}-char minimum`, () => {
    const password = 'a1'.padEnd(PASSWORD_MIN_LENGTH, 'x');
    expect(password).toHaveLength(PASSWORD_MIN_LENGTH);
    expect(isValidPassword(password)).toBe(true);
  });
});
