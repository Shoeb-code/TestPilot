import * as assert from 'assert';
import { FunctionAnalyzer } from '../../src/analysis/functionAnalyzer';
import { TestCaseGenerator } from '../../src/generators/testCaseGenerator';
import { TestFileGenerator } from '../../src/generators/testFileGenerator';

describe('TestFileGenerator Unit Tests', () => {
  it('should generate valid Jest test file content with proper imports and expectations', () => {
    const code = `
      export function add(a: number, b: number): number {
        return a + b;
      }
    `;

    const funcs = FunctionAnalyzer.analyzeSource(code, 'src/math.ts');
    const cases = TestCaseGenerator.generateTestCases(funcs[0]);

    const generated = TestFileGenerator.generateTestFile(funcs[0], {
      framework: 'jest',
      relativeImportPath: './math',
      testCases: cases,
    });

    assert.ok(generated.includes("import { add } from './math';"), 'Must import named function');
    assert.ok(generated.includes("describe('add', () => {"), 'Must have describe block');
    assert.ok(generated.includes('it('), 'Must have it blocks');
    assert.ok(generated.includes('expect('), 'Must have expect assertions');
  });

  it('should generate valid Vitest test file content with vitest imports', () => {
    const code = `
      export default function multiply(x: number, y: number): number {
        return x * y;
      }
    `;

    const funcs = FunctionAnalyzer.analyzeSource(code, 'src/calc.ts');
    const cases = TestCaseGenerator.generateTestCases(funcs[0]);

    const generated = TestFileGenerator.generateTestFile(funcs[0], {
      framework: 'vitest',
      relativeImportPath: './calc',
      testCases: cases,
    });

    assert.ok(generated.includes("import { describe, it, expect } from 'vitest';"), 'Must import from vitest');
    assert.ok(generated.includes("import multiply from './calc';"), 'Must import default export');
  });
});
