import * as assert from 'assert';
import { FunctionAnalyzer } from '../../src/analysis/functionAnalyzer';

describe('FunctionAnalyzer Unit Tests', () => {
  it('should analyze standard function declarations with parameters and throw statements', () => {
    const code = `
      function divide(a, b) {
        if (b === 0) {
          throw new Error("Cannot divide by zero");
        }
        return a / b;
      }
    `;

    const funcs = FunctionAnalyzer.analyzeSource(code, 'math.js');
    assert.strictEqual(funcs.length, 1);

    const f = funcs[0];
    assert.strictEqual(f.name, 'divide');
    assert.strictEqual(f.parameters.length, 2);
    assert.strictEqual(f.parameters[0].name, 'a');
    assert.strictEqual(f.parameters[1].name, 'b');
    assert.strictEqual(f.thrownErrors.length, 1);
    assert.strictEqual(f.thrownErrors[0].errorType, 'Error');
    assert.strictEqual(f.thrownErrors[0].message, 'Cannot divide by zero');
    assert.strictEqual(f.branches.length >= 1, true);
    assert.strictEqual(f.branches[0].paramName, 'b');
    assert.strictEqual(f.branches[0].comparedValue, '0');
  });

  it('should analyze exported TypeScript arrow functions with type annotations', () => {
    const code = `
      export const calculateDiscount = (price: number, discountRate: number = 0.1): number => {
        if (price < 0) {
          throw new RangeError("Price must be positive");
        }
        return price * (1 - discountRate);
      };
    `;

    const funcs = FunctionAnalyzer.analyzeSource(code, 'discount.ts');
    assert.strictEqual(funcs.length, 1);

    const f = funcs[0];
    assert.strictEqual(f.name, 'calculateDiscount');
    assert.strictEqual(f.isExported, true);
    assert.strictEqual(f.parameters.length, 2);
    assert.strictEqual(f.parameters[0].type, 'number');
    assert.strictEqual(f.parameters[0].category, 'number');
    assert.strictEqual(f.parameters[1].defaultValue, '0.1');
    assert.strictEqual(f.thrownErrors.length, 1);
    assert.strictEqual(f.thrownErrors[0].errorType, 'RangeError');
  });

  it('should find function at specific offset position', () => {
    const code = `
      function first() { return 1; }
      function second(x) { return x * 2; }
    `;

    const offsetSecond = code.indexOf('second') + 2;
    const found = FunctionAnalyzer.findFunctionAtOffset(code, offsetSecond, offsetSecond, 'test.js');

    assert.ok(found);
    assert.strictEqual(found?.name, 'second');
  });
});
