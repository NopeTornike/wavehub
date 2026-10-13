import { generateKeyPairSync, createSign } from 'crypto';
import { verifyBogCallbackSignature } from './bog-signature.util';

describe('verifyBogCallbackSignature', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  function sign(body: string): string {
    const signer = createSign('RSA-SHA256');
    signer.update(body);
    signer.end();
    return signer.sign(privateKeyPem, 'base64');
  }

  it('accepts a correctly signed body against the matching public key', () => {
    const body = JSON.stringify({ event: 'order_payment', body: { order_id: 'abc' } });
    const signature = sign(body);

    expect(verifyBogCallbackSignature(body, signature, publicKeyPem)).toBe(true);
  });

  it('rejects a signature that does not match the body (tampered payload)', () => {
    const originalBody = JSON.stringify({ event: 'order_payment', body: { order_id: 'abc' } });
    const signature = sign(originalBody);
    const tamperedBody = JSON.stringify({ event: 'order_payment', body: { order_id: 'DIFFERENT' } });

    expect(verifyBogCallbackSignature(tamperedBody, signature, publicKeyPem)).toBe(false);
  });

  it('rejects a signature produced by the wrong private key', () => {
    const body = JSON.stringify({ event: 'order_payment', body: { order_id: 'abc' } });
    const { privateKey: otherPrivateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const signer = createSign('RSA-SHA256');
    signer.update(body);
    signer.end();
    const wrongSignature = signer.sign(otherPrivateKey.export({ type: 'pkcs8', format: 'pem' }), 'base64');

    expect(verifyBogCallbackSignature(body, wrongSignature, publicKeyPem)).toBe(false);
  });

  it('rejects an empty signature', () => {
    expect(verifyBogCallbackSignature('{}', '', publicKeyPem)).toBe(false);
  });

  it('does not throw on malformed base64 input, just returns false', () => {
    expect(verifyBogCallbackSignature('{}', 'not-valid-base64!!!', publicKeyPem)).toBe(false);
  });
});
