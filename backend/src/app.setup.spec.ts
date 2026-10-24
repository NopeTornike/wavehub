import express = require('express');
import { trustProxySetting } from './app.setup';

describe('trustProxySetting', () => {
  it('turns a hop count into a number so Express trusts that many proxies', () => {
    expect(trustProxySetting('1')).toBe(1);
    expect(trustProxySetting(' 2 ')).toBe(2);
    expect(trustProxySetting('true')).toBe(1);
  });

  it('passes addresses through and treats empty as unset', () => {
    expect(trustProxySetting('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
    expect(trustProxySetting(undefined)).toBeUndefined();
    expect(trustProxySetting('  ')).toBeUndefined();
  });

  it('makes Express trust the first hop for TRUST_PROXY=1 (the string "1" trusted nothing)', () => {
    const app = express();
    app.set('trust proxy', trustProxySetting('1'));
    const trust = app.get('trust proxy fn') as (addr: string, hop: number) => boolean;
    expect(trust('172.18.0.5', 0)).toBe(true);
    expect(trust('203.0.113.9', 1)).toBe(false);
  });
});
