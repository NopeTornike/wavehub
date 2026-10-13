import { createVerify } from 'crypto';

// Published by Bank of Georgia for verifying the `Callback-Signature` header on
// /payments/bog/callback (RSA-SHA256 over the raw request body). Source:
// https://api.bog.ge/docs/en/payments/standard-process/callback (fetched 2026-07-15).
// Overridable via BOG_CALLBACK_PUBLIC_KEY in case BOG rotates it — don't hardcode reliance on this
// exact string anywhere else.
export const BOG_DEFAULT_CALLBACK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu4RUyAw3+CdkS3ZNILQhzHI9Hemo+vKB9U2BSabppkKjzjjkf+0Sm76hSMiu/HFtYhqWOESryoCDJoqffY0Q1VNt25aTxbj068QNUtnxQ7KQVLA+pG0smf+EBWlS1vBEAFbIas9d8c9b9sSEkTrrTYQ90WIM8bGB6S/KLVoT1a7SnzabjoLc5Qf/SLDG5fu8dH8zckyeYKdRKSBJKvhxtcBuHV4f7qsynQT+f2UYbESX/TLHwT5qFWZDHZ0YUOUIvb8n7JujVSGZO9/+ll/g4ZIWhC1MlJgPObDwRkRd8NFOopgxMcMsDIZIoLbWKhHVq67hdbwpAq9K9WMmEhPnPwIDAQAB
-----END PUBLIC KEY-----`;

// `rawBody` MUST be the exact bytes BOG sent (before JSON.parse) — verifying a re-serialized copy
// of the parsed object can produce false negatives/positives if key order or whitespace differs.
// See main.ts's `rawBody: true` option, which is what makes `request.rawBody` available.
export function verifyBogCallbackSignature(
  rawBody: Buffer | string,
  signatureBase64: string,
  publicKeyPem: string = process.env.BOG_CALLBACK_PUBLIC_KEY || BOG_DEFAULT_CALLBACK_PUBLIC_KEY,
): boolean {
  if (!signatureBase64) {
    return false;
  }
  try {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(rawBody);
    verifier.end();
    return verifier.verify(publicKeyPem, signatureBase64, 'base64');
  } catch {
    return false;
  }
}
