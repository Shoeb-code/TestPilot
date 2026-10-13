const { divide, multiply } = require('../math');

describe('divide', () => {
  it('should divide two positive numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  it('should throw Error when dividing by zero', () => {
    expect(() => divide(10, 0)).toThrow('Cannot divide by zero');
  });

  it('should divide zero by a nonzero number', () => {
    expect(divide(0, 5)).toBe(0);
  });
});

describe('multiply', () => {
  it('should multiply two numbers', () => {
    expect(multiply(3, 4)).toBe(12);
  });
});
