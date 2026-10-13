/**
 * Sample calculation helper with validations and default parameters
 */
export function calculateDiscount(price: number, discountRate: number = 0.1): number {
  if (price < 0) {
    throw new RangeError('Price must be positive');
  }
  if (discountRate < 0 || discountRate > 1) {
    throw new RangeError('Discount rate must be between 0 and 1');
  }
  return price * (1 - discountRate);
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
