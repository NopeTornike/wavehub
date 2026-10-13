import { registerDecorator, type ValidationOptions } from 'class-validator';

// Item listings carry a flat bag of seller-entered, publicly shown details (account status, level,
// platform, region, per-game extras...). It's stored as jsonb, so the shape is enforced here:
// a plain object, at most MAX_KEYS keys, identifier-like keys, and only short strings, finite
// numbers or booleans as values — no nesting, no arrays, nothing that could smuggle markup-sized
// payloads or prototype-pollution keys into what every visitor's browser renders.
export const ITEM_ATTRIBUTES_MAX_KEYS = 40;
export const ITEM_ATTRIBUTE_MAX_STRING = 300;
const KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function isValidItemAttributes(value: unknown): value is Record<string, string | number | boolean> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > ITEM_ATTRIBUTES_MAX_KEYS) return false;
  return entries.every(([key, v]) => {
    if (!KEY_PATTERN.test(key) || FORBIDDEN_KEYS.has(key)) return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number') return Number.isFinite(v) && Math.abs(v) <= 1_000_000_000;
    if (typeof v === 'string') return v.length <= ITEM_ATTRIBUTE_MAX_STRING;
    return false;
  });
}

export function IsItemAttributes(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isItemAttributes',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a flat object of at most ${ITEM_ATTRIBUTES_MAX_KEYS} short string/number/boolean values`,
        ...options,
      },
      validator: { validate: (value: unknown) => isValidItemAttributes(value) },
    });
}
