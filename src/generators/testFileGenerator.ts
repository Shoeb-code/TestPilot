import { AnalyzedFunction } from '../analysis/functionAnalyzer';
import { TestCase } from './testCaseGenerator';

export type TestFramework = 'jest' | 'vitest';

export interface TestFileOptions {
  framework: TestFramework;
  relativeImportPath: string;
  testCases: TestCase[];
}

export class TestFileGenerator {
  /**
   * Generate clean, complete, runnable test file contents for Jest or Vitest
   */
  public static generateTestFile(func: AnalyzedFunction, options: TestFileOptions): string {
    const { framework, relativeImportPath, testCases } = options;
    const selectedCases = testCases.filter((tc) => tc.selected);

    const lines: string[] = [];

    // Header comment
    lines.push(
      '/**',
      ` * Auto-generated unit tests for "${func.name}" by TestPilot.`,
      ` * Target Source: ${func.filePath}`,
      ` * Framework: ${framework === 'vitest' ? 'Vitest' : 'Jest'}`,
      ' */'
    );
    lines.push('');

    // Framework imports
    if (framework === 'vitest') {
      lines.push("import { describe, it, expect } from 'vitest';");
    } else {
      // For Jest, support explicit @jest/globals or globals
      lines.push('// In Jest, globals (describe, it, expect) are available by default.');
      lines.push('// Alternatively uncomment for explicit globals:');
      lines.push("// import { describe, it, expect } from '@jest/globals';");
    }

    // Function import
    if (func.isDefaultExport) {
      lines.push(`import ${func.name} from '${relativeImportPath}';`);
    } else if (func.isExported) {
      lines.push(`import { ${func.name} } from '${relativeImportPath}';`);
    } else {
      // Function was not exported
      lines.push(`// NOTE: "${func.name}" was not detected as an export in the source file.`);
      lines.push(`// Ensure it is exported or import the module appropriately.`);
      lines.push(`import { ${func.name} } from '${relativeImportPath}';`);
    }
    lines.push('');

    // Describe block
    lines.push(`describe('${func.name}', () => {`);

    if (selectedCases.length === 0) {
      lines.push("  it('placeholder test', () => {");
      lines.push('    expect(true).toBe(true);');
      lines.push('  });');
    } else {
      for (const tc of selectedCases) {
        lines.push('');
        lines.push(`  // Category: [${tc.category}] - ${tc.reason}`);
        if (tc.confidenceNote) {
          lines.push(`  // Note: ${tc.confidenceNote}`);
        }

        const asyncKeyword = func.isAsync ? 'async ' : '';
        const safeTestName = tc.testName.replace(/'/g, "\\'");
        lines.push(`  it('${safeTestName}', ${asyncKeyword}() => {`);

        const argsStr = tc.inputArgs.join(', ');

        if (tc.expectedThrows) {
          if (func.isAsync) {
            if (tc.expectedExceptionMessage) {
              lines.push(
                `    await expect(${func.name}(${argsStr})).rejects.toThrow('${tc.expectedExceptionMessage.replace(/'/g, "\\'")}');`
              );
            } else if (tc.expectedExceptionType) {
              lines.push(`    await expect(${func.name}(${argsStr})).rejects.toThrow(${tc.expectedExceptionType});`);
            } else {
              lines.push(`    await expect(${func.name}(${argsStr})).rejects.toThrow();`);
            }
          } else {
            if (tc.expectedExceptionMessage) {
              lines.push(
                `    expect(() => ${func.name}(${argsStr})).toThrow('${tc.expectedExceptionMessage.replace(/'/g, "\\'")}');`
              );
            } else if (tc.expectedExceptionType) {
              lines.push(`    expect(() => ${func.name}(${argsStr})).toThrow(${tc.expectedExceptionType});`);
            } else {
              lines.push(`    expect(() => ${func.name}(${argsStr})).toThrow();`);
            }
          }
        } else {
          // Non-throwing call
          const awaitPrefix = func.isAsync ? 'await ' : '';
          lines.push(`    const result = ${awaitPrefix}${func.name}(${argsStr});`);

          if (tc.expectedResult !== undefined) {
            lines.push(`    expect(result).toEqual(${tc.expectedResult});`);
          } else {
            lines.push(`    // Assert output - update with your expected value:`);
            lines.push(`    expect(result).toBeDefined();`);
          }
        }

        lines.push('  });');
      }
    }

    lines.push('});');
    lines.push('');

    return lines.join('\n');
  }
}
