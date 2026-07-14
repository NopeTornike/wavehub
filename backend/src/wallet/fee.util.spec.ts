import { calculatePlatformFee } from './fee.util';

describe('calculatePlatformFee', () => {
  it('matches the spec example: $100 order, 10% fee -> seller gets $90', () => {
    expect(calculatePlatformFee(100, 10)).toEqual({ feeWaveCoin: 10, sellerReceivesWaveCoin: 90 });
  });

  it('matches the spec example: $20 order, 10% fee -> seller gets $18', () => {
    expect(calculatePlatformFee(20, 10)).toEqual({ feeWaveCoin: 2, sellerReceivesWaveCoin: 18 });
  });

  it('floors the fee instead of producing a fractional coin', () => {
    // 3 * 10% = 0.3 -> floors to 0, seller keeps the full amount rather than losing a fraction
    expect(calculatePlatformFee(3, 10)).toEqual({ feeWaveCoin: 0, sellerReceivesWaveCoin: 3 });
  });

  it('handles a 0% fee', () => {
    expect(calculatePlatformFee(50, 0)).toEqual({ feeWaveCoin: 0, sellerReceivesWaveCoin: 50 });
  });

  it('handles a 100% fee', () => {
    expect(calculatePlatformFee(50, 100)).toEqual({ feeWaveCoin: 50, sellerReceivesWaveCoin: 0 });
  });

  it('rejects a non-integer amount', () => {
    expect(() => calculatePlatformFee(10.5, 10)).toThrow();
  });

  it('rejects a negative amount', () => {
    expect(() => calculatePlatformFee(-5, 10)).toThrow();
  });

  it('rejects an out-of-range fee percent', () => {
    expect(() => calculatePlatformFee(10, 101)).toThrow();
    expect(() => calculatePlatformFee(10, -1)).toThrow();
  });
});
