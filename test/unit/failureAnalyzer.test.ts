import * as assert from 'assert';
import { FailureAnalyzer } from '../../src/reports/failureAnalyzer';

describe('FailureAnalyzer Unit Tests', () => {
  it('should detect assertion mismatch and produce hypothesis and debugging steps', () => {
    const errorTrace = `
      Error: expect(received).toBe(expected) // Object.is equality

      Expected: 10
      Received: 5

      at Object.<anonymous> (c:/workspace/src/math.test.ts:18:25)
    `;

    const report = FailureAnalyzer.analyzeFailure(
      'should calculate double',
      errorTrace,
      'c:/workspace/src/math.test.ts'
    );

    assert.strictEqual(report.hypothesisCategory, 'ASSERTION_MISMATCH');
    assert.strictEqual(report.evidence.expectedValue, '10');
    assert.strictEqual(report.evidence.actualValue, '5');
    assert.strictEqual(report.evidence.line, 18);
    assert.ok(report.hypothesis.includes('Hypothesis:'));
    assert.ok(report.actionableSteps.length >= 2);
    assert.ok(report.formattedMarkdown.includes('## 🔍 TestPilot Failure Diagnostic Report'));
  });

  it('should detect null pointer type error and categorize accurately', () => {
    const errorTrace = `
      TypeError: Cannot read properties of undefined (reading 'length')
      at countItems (c:/workspace/src/counter.ts:5:19)
      at Object.<anonymous> (c:/workspace/src/counter.test.ts:8:12)
    `;

    const report = FailureAnalyzer.analyzeFailure('should handle undefined input', errorTrace);

    assert.strictEqual(report.hypothesisCategory, 'NULL_POINTER_OR_TYPE_ERROR');
    assert.ok(report.hypothesis.includes('null or undefined reference'));
    assert.ok(report.actionableSteps.some((s) => s.includes('optional chaining') || s.includes('validations')));
  });

  it('should detect timeout error', () => {
    const errorTrace = `
      Error: Timeout of 5000ms exceeded. For async tests and hooks, ensure "done()" is called; if returning a Promise, ensure it resolves.
      at listOnTimeout (node:internal/timers:573:17)
    `;

    const report = FailureAnalyzer.analyzeFailure('should fetch remote data', errorTrace);

    assert.strictEqual(report.hypothesisCategory, 'TIMEOUT_ERROR');
    assert.ok(report.actionableSteps.some((s) => s.includes('Promises')));
  });
});
