import * as assert from 'assert';
import { FunctionAnalyzer } from '../../src/analysis/functionAnalyzer';
import { ValidationUtils } from '../../src/utils/validation';
import { ResultParser } from '../../src/reports/resultParser';

describe('Security & Resilience Unit Tests', () => {
  it('should handle malformed or invalid JavaScript/TypeScript source gracefully', () => {
    const malformed = `
      function broken(a, b {
        return a +++ ??? ;;;
      }}
    `;

    // Must not crash or throw unhandled exceptions
    const funcs = FunctionAnalyzer.analyzeSource(malformed, 'broken.ts');
    assert.ok(Array.isArray(funcs));
  });

  it('should detect and prevent directory traversal attacks', () => {
    const baseDir = 'C:\\workspace\\project';
    const traversalPath = 'C:\\workspace\\project\\..\\..\\Windows\\System32';
    const safePath = 'C:\\workspace\\project\\src\\math.test.ts';

    assert.strictEqual(ValidationUtils.isSafePath(baseDir, traversalPath), false);
    assert.strictEqual(ValidationUtils.isSafePath(baseDir, safePath), true);
  });

  it('should reject invalid file paths containing illegal characters or null bytes', () => {
    const nullByte = 'src/test\0file.ts';
    const illegalChars = 'src/test*?.ts';
    const valid = 'src/__tests__/math.test.ts';

    assert.strictEqual(ValidationUtils.validateFilePath(nullByte).valid, false);
    assert.strictEqual(ValidationUtils.validateFilePath(illegalChars).valid, false);
    assert.strictEqual(ValidationUtils.validateFilePath(valid).valid, true);
    assert.strictEqual(ValidationUtils.validateFilePath('').valid, false);
  });

  it('should handle unexpected or corrupted test runner output safely', () => {
    const garbageOutput = '\x00\x01\x02\xFF\xFE Random Binary Crash Dump';
    const parsed = ResultParser.parse(garbageOutput, 'Fatal signal received', 100);

    assert.ok(parsed);
    assert.strictEqual(parsed.passed, 0);
    assert.strictEqual(parsed.hasRawOutputOnly, true);
  });

  it('should strictly validate AI payload schema and reject malformed items', () => {
    const invalidPayload1 = { testName: '' };
    const invalidPayload2 = { testName: 'Valid', inputArgs: 'not an array' };
    const invalidPayload3 = null;
    const validPayload = {
      testName: 'should handle empty string',
      category: 'Boundary',
      inputArgs: ['""'],
      reason: 'Boundary edge case',
      expectedThrows: false,
    };

    assert.strictEqual(ValidationUtils.validateAiScenarioPayload(invalidPayload1).valid, false);
    assert.strictEqual(ValidationUtils.validateAiScenarioPayload(invalidPayload2).valid, false);
    assert.strictEqual(ValidationUtils.validateAiScenarioPayload(invalidPayload3).valid, false);

    const validCheck = ValidationUtils.validateAiScenarioPayload(validPayload);
    assert.strictEqual(validCheck.valid, true);
    assert.strictEqual(validCheck.data?.testName, 'should handle empty string');
  });
});
