// WaveCoin amounts carry tetri since buyer fees are exact (80 GEL at 6% = 4.80). Show "84.80" for an
// amount with tetri and "84" for a whole one; sums computed here are rounded to the tetri first so
// float noise (15.200000000000003) never reaches the page.
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function gel(value: number | null | undefined): string {
  const rounded = roundMoney(Number(value ?? 0))
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}
