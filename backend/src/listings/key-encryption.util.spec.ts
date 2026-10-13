import { encryptKeyValue, decryptKeyValue } from './key-encryption.util';

// Runs against the insecure dev-default key (no KEY_ENCRYPTION_SECRET set in the test environment)
// — fine for round-trip correctness tests, since the point being tested is the encrypt/decrypt
// contract, not the specific key material.
describe('key-encryption.util', () => {
  it('round-trips a plaintext key value', () => {
    const plaintext = 'ABCDE-FGHIJ-KLMNO-PQRST';
    const ciphertext = encryptKeyValue(plaintext);
    expect(ciphertext).not.toContain(plaintext);
    expect(decryptKeyValue(ciphertext)).toBe(plaintext);
  });

  it('produces a different ciphertext for the same plaintext every time (random IV)', () => {
    const plaintext = 'SAME-KEY-VALUE';
    const a = encryptKeyValue(plaintext);
    const b = encryptKeyValue(plaintext);
    expect(a).not.toBe(b);
    expect(decryptKeyValue(a)).toBe(plaintext);
    expect(decryptKeyValue(b)).toBe(plaintext);
  });

  it('rejects a tampered ciphertext instead of silently returning garbage', () => {
    const ciphertext = encryptKeyValue('REAL-KEY-VALUE');
    const [iv, tag, data] = ciphertext.split('.');
    const tamperedData = Buffer.from(data, 'base64');
    tamperedData[0] ^= 0xff;
    const tampered = [iv, tag, tamperedData.toString('base64')].join('.');
    expect(() => decryptKeyValue(tampered)).toThrow();
  });

  it('rejects a malformed (non-triple) ciphertext string', () => {
    expect(() => decryptKeyValue('not-a-real-ciphertext')).toThrow('Malformed encrypted key value');
  });

  it('handles unicode plaintext correctly', () => {
    const plaintext = 'ключ- activation-码-🔑';
    expect(decryptKeyValue(encryptKeyValue(plaintext))).toBe(plaintext);
  });
});
