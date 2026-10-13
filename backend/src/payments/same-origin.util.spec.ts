import { isSameOriginAsFrontend } from './same-origin.util';

describe('isSameOriginAsFrontend', () => {
  const frontend = 'https://wavehub.example';

  it('accepts an exact match', () => {
    expect(isSameOriginAsFrontend('https://wavehub.example/checkout/success', frontend)).toBe(true);
  });

  it('accepts a match with a different path/query', () => {
    expect(isSameOriginAsFrontend('https://wavehub.example/anything?x=1', frontend)).toBe(true);
  });

  it('rejects a different host (classic open-redirect attempt)', () => {
    expect(isSameOriginAsFrontend('https://evil.example/checkout/success', frontend)).toBe(false);
  });

  it('rejects a different scheme even with the same host', () => {
    expect(isSameOriginAsFrontend('http://wavehub.example/checkout/success', frontend)).toBe(false);
  });

  it('rejects a lookalike host (prefix/suffix trick)', () => {
    expect(isSameOriginAsFrontend('https://wavehub.example.evil.com', frontend)).toBe(false);
    expect(isSameOriginAsFrontend('https://evilwavehub.example', frontend)).toBe(false);
  });

  it('rejects a different port', () => {
    expect(isSameOriginAsFrontend('https://wavehub.example:8443', frontend)).toBe(false);
  });

  it('rejects malformed URLs instead of throwing', () => {
    expect(isSameOriginAsFrontend('not a url', frontend)).toBe(false);
  });

  it('rejects javascript: and data: URLs', () => {
    expect(isSameOriginAsFrontend('javascript:alert(1)', frontend)).toBe(false);
    expect(isSameOriginAsFrontend('data:text/html,hi', frontend)).toBe(false);
  });
});
