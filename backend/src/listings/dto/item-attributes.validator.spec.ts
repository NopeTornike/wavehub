import { ITEM_ATTRIBUTES_MAX_KEYS, ITEM_ATTRIBUTE_MAX_STRING, isValidItemAttributes } from './item-attributes.validator';

describe('isValidItemAttributes', () => {
  it('accepts a flat object of short strings, numbers and booleans', () => {
    expect(isValidItemAttributes({ kind: 'account', accountStatus: 'rare', accountLevel: 72, fullAccess: true, region: 'EU' })).toBe(true);
    expect(isValidItemAttributes({})).toBe(true);
  });

  it('rejects non-objects, arrays and nested values', () => {
    for (const bad of [null, 'x', 3, [], [{ a: 1 }], { a: { b: 1 } }, { a: [1] }, { a: null }]) {
      expect(isValidItemAttributes(bad)).toBe(false);
    }
  });

  it('rejects prototype-pollution and non-identifier keys', () => {
    expect(isValidItemAttributes(JSON.parse('{"__proto__": "x"}'))).toBe(false);
    expect(isValidItemAttributes({ constructor: 'x' })).toBe(false);
    expect(isValidItemAttributes({ 'bad key': 'x' })).toBe(false);
    expect(isValidItemAttributes({ '1abc': 'x' })).toBe(false);
    expect(isValidItemAttributes({ ['a'.repeat(41)]: 'x' })).toBe(false);
  });

  it('enforces the size limits', () => {
    expect(isValidItemAttributes({ note: 'x'.repeat(ITEM_ATTRIBUTE_MAX_STRING) })).toBe(true);
    expect(isValidItemAttributes({ note: 'x'.repeat(ITEM_ATTRIBUTE_MAX_STRING + 1) })).toBe(false);
    const many = Object.fromEntries(Array.from({ length: ITEM_ATTRIBUTES_MAX_KEYS + 1 }, (_, i) => [`k${i}`, i]));
    expect(isValidItemAttributes(many)).toBe(false);
    expect(isValidItemAttributes({ n: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isValidItemAttributes({ n: Number.NaN })).toBe(false);
  });

  it('rejects class instances (only plain objects)', () => {
    expect(isValidItemAttributes(new Date())).toBe(false);
    expect(isValidItemAttributes(new Map())).toBe(false);
  });
});
