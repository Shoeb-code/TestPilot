import { describe, it, expect } from 'vitest';
import { calculateDiscount, formatCurrency } from './calculator';

describe('calculateDiscount', () => {
  it('should apply discount with default rate', () => {
    expect(calculateDiscount(100)).toBe(90);
  });

  it('should apply custom discount rate', () => {
    expect(calculateDiscount(100, 0.2)).toBe(80);
  });

  it('should throw RangeError on negative price', () => {
    expect(() => calculateDiscount(-10)).toThrow(RangeError);
  });

  it('should throw RangeError on invalid discount rate', () => {
    expect(() => calculateDiscount(100, 1.5)).toThrow(RangeError);
  });
});

describe('formatCurrency', () => {
  it('should format dollar amount with 2 decimals', () => {
    expect(formatCurrency(19.99)).toBe('$19.99');
  });

  it('should format integer amount with .00 suffix', () => {
    expect(formatCurrency(50)).toBe('$50.00');
  });
});
