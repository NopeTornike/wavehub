import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Encrypts Steam-key (or similar digital-activation-code) secrets at rest before they ever reach
// the database — a leaked plaintext key is a direct, unrecoverable financial loss to the seller,
// the same spirit as root CLAUDE.md's non-negotiable rule #2 ("no raw card/payment data") even
// though this isn't payment data specifically. AES-256-GCM: a random 96-bit IV per value (an IV
// must never repeat under the same key), stored alongside the ciphertext and auth tag — none of
// those three are secret on their own, only KEY_ENCRYPTION_SECRET is.
//
// Same required-in-production / insecure-dev-fallback pattern as JWT_SECRET (see
// backend/src/auth/auth.module.ts) — validated and resolved once at import time (not on first
// use), so a missing/malformed secret fails loudly at boot, not the first time a seller uploads a
// key.
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const DEV_INSECURE_KEY_HEX = '0'.repeat(64);

const secret = process.env.KEY_ENCRYPTION_SECRET;
if (!secret && process.env.NODE_ENV === 'production') {
  throw new Error('KEY_ENCRYPTION_SECRET must be set in production');
}
if (secret && !/^[0-9a-f]{64}$/i.test(secret)) {
  throw new Error('KEY_ENCRYPTION_SECRET must be a 64-character hex string (32 bytes, for AES-256)');
}
if (!secret) {
  // eslint-disable-next-line no-console
  console.warn(
    '[listings] KEY_ENCRYPTION_SECRET is not set — using an insecure development-only default. ' +
      'Keys encrypted with this default must never be treated as real secrets.',
  );
}
const KEY = Buffer.from(secret || DEV_INSECURE_KEY_HEX, 'hex');

export function encryptKeyValue(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((buf) => buf.toString('base64')).join('.');
}

export function decryptKeyValue(ciphertext: string): string {
  const [ivB64, tagB64, dataB64] = ciphertext.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted key value');
  }
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}
