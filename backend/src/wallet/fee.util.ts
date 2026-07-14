// Platform fee split for a completed order. WaveCoin amounts are always integers, so this rounds
// the fee down (favoring the seller by a fraction of a coin on odd amounts, e.g. fee on a 3-coin
// order at 10% floors to 0, not a fractional coin) rather than silently truncating value from a
// float — see WalletService for where this is used.
export interface FeeSplit {
  feeWaveCoin: number;
  sellerReceivesWaveCoin: number;
}

export function calculatePlatformFee(amountWaveCoin: number, feePercent: number): FeeSplit {
  if (!Number.isInteger(amountWaveCoin) || amountWaveCoin < 0) {
    throw new Error('amountWaveCoin must be a non-negative integer');
  }
  if (feePercent < 0 || feePercent > 100) {
    throw new Error('feePercent must be between 0 and 100');
  }

  const feeWaveCoin = Math.floor((amountWaveCoin * feePercent) / 100);
  return {
    feeWaveCoin,
    sellerReceivesWaveCoin: amountWaveCoin - feeWaveCoin,
  };
}
