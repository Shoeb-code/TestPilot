import * as assert from 'assert';
import { FunctionAnalyzer } from '../../src/analysis/functionAnalyzer';
import { TestCaseGenerator } from '../../src/generators/testCaseGenerator';

describe('TestCaseGenerator Unit Tests', () => {
  it('should generate categorized test cases for division with guard clause', () => {
    const code = `
      export function divide(a: number, b: number): number {
        if (b === 0) {
          throw new Error("Cannot divide by zero");
        }
        return a / b;
      }
    `;

    const funcs = FunctionAnalyzer.analyzeSource(code, 'math.ts');
    const cases = TestCaseGenerator.generateTestCases(funcs[0]);

    assert.ok(cases.length >= 4, `Expected at least 4 test cases, got ${cases.length}`);

    // Verify presence of Error testing category
    const errorCase = cases.find((c) => c.category === 'Error');
    assert.ok(errorCase, 'Missing Error test case');
    assert.strictEqual(errorCase?.expectedThrows, true);
    assert.strictEqual(errorCase?.expectedExceptionType, 'Error');
    assert.strictEqual(errorCase?.expectedExceptionMessage, 'Cannot divide by zero');

    // Verify presence of Positive testing category
    const positiveCase = cases.find((c) => c.category === 'Positive');
    assert.ok(positiveCase, 'Missing Positive test case');
    assert.strictEqual(positiveCase?.expectedThrows, false);

    // Verify presence of Boundary-value testing category
    const boundaryCase = cases.find((c) => c.category === 'Boundary');
    assert.ok(boundaryCase, 'Missing Boundary test case');

    // Verify presence of Negative or Edge testing category
    const edgeOrNeg = cases.find((c) => c.category === 'Negative' || c.category === 'Edge');
    assert.ok(edgeOrNeg, 'Missing Negative/Edge test case');
  });

  it('should generate optional parameter handling case when default exists', () => {
    const code = `
      function greet(name: string, prefix: string = "Hello"): string {
        return prefix + ", " + name;
      }
    `;

    const funcs = FunctionAnalyzer.analyzeSource(code, 'greet.ts');
    const cases = TestCaseGenerator.generateTestCases(funcs[0]);

    const defaultParamCase = cases.find((c) => c.testName.includes('default'));
    assert.ok(defaultParamCase, 'Should generate test case testing default parameters');
  });
});
