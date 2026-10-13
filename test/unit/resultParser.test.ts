import * as assert from 'assert';
import { ResultParser } from '../../src/reports/resultParser';

describe('ResultParser Unit Tests', () => {
  it('should parse Jest JSON output accurately', () => {
    const jestJson = JSON.stringify({
      numTotalTests: 3,
      numPassedTests: 2,
      numFailedTests: 1,
      numPendingTests: 0,
      startTime: 1000,
      endTime: 1500,
      testResults: [
        {
          name: '/project/math.test.ts',
          status: 'failed',
          assertionResults: [
            {
              title: 'should add numbers',
              fullName: 'add should add numbers',
              status: 'passed',
              duration: 10,
              failureMessages: [],
            },
            {
              title: 'should throw on zero',
              fullName: 'divide should throw on zero',
              status: 'failed',
              duration: 12,
              failureMessages: ['Error: Expected to throw but did not throw'],
            },
          ],
        },
      ],
    });

    const parsed = ResultParser.parse(jestJson, '');
    assert.strictEqual(parsed.total, 3);
    assert.strictEqual(parsed.passed, 2);
    assert.strictEqual(parsed.failed, 1);
    assert.strictEqual(parsed.durationMs, 500);
    assert.strictEqual(parsed.suites.length, 1);
    assert.strictEqual(parsed.suites[0].assertions.length, 2);
    assert.strictEqual(parsed.suites[0].assertions[1].status, 'failed');
  });

  it('should parse raw text output when JSON is not available', () => {
    const rawText = `
      PASS  src/add.test.ts
      FAIL  src/math.test.ts
        ● divide › should throw on zero

          Expected: "Cannot divide by zero"
          Received: undefined

      Tests:       1 failed, 2 passed, 3 total
      Snapshots:   0 total
      Time:        1.234 s
    `;

    const parsed = ResultParser.parse(rawText, '', 1234);
    assert.strictEqual(parsed.total, 3);
    assert.strictEqual(parsed.failed, 1);
    assert.strictEqual(parsed.passed, 2);
  });
});
