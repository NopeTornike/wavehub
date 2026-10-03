import type { ValueTransformer } from 'typeorm';

// WaveCoin amounts carry tetri since 2026-10-03 (the owner wants the exact fee: 80 GEL at 6% is
// 4.80, not 5). Balances, ledger rows and an order's fee/total are `numeric(14,2)` columns; prices,
// seller/coach payouts and withdrawals stay whole GEL. JS arithmetic on two-decimal values drifts
// (100 - 84.8 = 15.200000000000003), so every computed amount goes through `roundMoney` before it is
// compared or written.

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// pg returns numeric as a string; entities expose a number.
export const moneyTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | number | null) => (value === null || value === undefined ? value : Number(value)),
};

// "84.80" for an amount with tetri, "84" for a whole one — used in notification texts.
export function formatGel(value: number): string {
  const rounded = roundMoney(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}
