import * as path from 'path';

export interface FailureEvidence {
  testName: string;
  filePath?: string;
  line?: number;
  column?: number;
  errorMessage: string;
  expectedValue?: string;
  actualValue?: string;
  stackTrace?: string;
}

export type HypothesisCategory =
  | 'ASSERTION_MISMATCH'
  | 'UNEXPECTED_EXCEPTION'
  | 'TIMEOUT_ERROR'
  | 'NULL_POINTER_OR_TYPE_ERROR'
  | 'MODULE_OR_IMPORT_ERROR'
  | 'UNKNOWN_FAILURE';

export interface StructuredFailureReport {
  summary: string;
  evidence: FailureEvidence;
  hypothesisCategory: HypothesisCategory;
  hypothesis: string;
  actionableSteps: string[];
  sourceLocation?: {
    filePath: string;
    line?: number;
    column?: number;
    markdownLink: string;
  };
  formattedMarkdown: string;
}

export class FailureAnalyzer {
  /**
   * Analyze test failure messages and produce a structured diagnostic report
   */
  public static analyzeFailure(
    testName: string,
    rawFailureText: string,
    defaultFilePath?: string
  ): StructuredFailureReport {
    const evidence = this.extractEvidence(testName, rawFailureText, defaultFilePath);
    const { category, hypothesis, steps } = this.deriveHypothesisAndSteps(evidence);

    const sourceLoc = evidence.filePath
      ? {
          filePath: evidence.filePath,
          line: evidence.line,
          column: evidence.column,
          markdownLink: this.formatClickableLink(evidence.filePath, evidence.line),
        }
      : undefined;

    const formattedMarkdown = this.formatReportMarkdown({
      summary: `Failure in test "${evidence.testName}"`,
      evidence,
      hypothesisCategory: category,
      hypothesis,
      actionableSteps: steps,
      sourceLocation: sourceLoc,
    });

    return {
      summary: `Failure in test "${evidence.testName}"`,
      evidence,
      hypothesisCategory: category,
      hypothesis,
      actionableSteps: steps,
      sourceLocation: sourceLoc,
      formattedMarkdown,
    };
  }

  private static extractEvidence(testName: string, rawText: string, defaultFilePath?: string): FailureEvidence {
    // Strip ANSI escape sequences
    const clean = rawText.replace(/\u001b\[[0-9;]*m/g, '');

    // Extract Expected vs Received
    let expectedValue: string | undefined;
    let actualValue: string | undefined;

    const expectedMatch = clean.match(/Expected:\s*([^\n]+)/i);
    if (expectedMatch) {
      expectedValue = expectedMatch[1].trim();
    }

    const receivedMatch = clean.match(/Received:\s*([^\n]+)/i);
    if (receivedMatch) {
      actualValue = receivedMatch[1].trim();
    }

    // Extract file and line from stack trace
    let filePath = defaultFilePath;
    let line: number | undefined;
    let column: number | undefined;

    // Stack line match e.g. at Object.<anonymous> (/path/to/math.test.ts:15:23)
    const stackMatch = clean.match(/at\s+.*?\((.*?):(\d+):(\d+)\)/) || clean.match(/at\s+(.*?):(\d+):(\d+)/);

    if (stackMatch) {
      filePath = stackMatch[1];
      line = parseInt(stackMatch[2], 10);
      column = parseInt(stackMatch[3], 10);
    }

    // Extract core error message (first line of error)
    const lines = clean
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    let errorMessage = lines[0] || 'Unknown test failure';
    for (const l of lines) {
      if (
        l.startsWith('Error:') ||
        l.startsWith('TypeError:') ||
        l.startsWith('ReferenceError:') ||
        l.startsWith('AssertionError:') ||
        l.includes('expect(')
      ) {
        errorMessage = l;
        break;
      }
    }

    return {
      testName,
      filePath,
      line,
      column,
      errorMessage,
      expectedValue,
      actualValue,
      stackTrace: clean,
    };
  }

  private static deriveHypothesisAndSteps(evidence: FailureEvidence): {
    category: HypothesisCategory;
    hypothesis: string;
    steps: string[];
  } {
    const msg = evidence.errorMessage.toLowerCase();
    const trace = (evidence.stackTrace || '').toLowerCase();

    // 1. Timeout
    if (msg.includes('timeout') || trace.includes('exceeded timeout') || msg.includes('timed out')) {
      return {
        category: 'TIMEOUT_ERROR',
        hypothesis:
          'Hypothesis: The function or async test took longer than the configured timeout to complete, likely due to an unhandled Promise or long-running loop.',
        steps: [
          'Verify that all Promises in the tested function resolve or reject in a timely manner.',
          'Check for infinite recursion or un-terminated while/for loops.',
          'If the operation requires network or file I/O, consider mocking dependencies.',
        ],
      };
    }

    // 2. Null Pointer / Type Error
    if (
      msg.includes('cannot read property') ||
      msg.includes('cannot read properties') ||
      msg.includes('is not a function') ||
      msg.includes('null') ||
      msg.includes('undefined')
    ) {
      return {
        category: 'NULL_POINTER_OR_TYPE_ERROR',
        hypothesis:
          'Hypothesis: An attempt was made to access a property or call a method on a null or undefined reference.',
        steps: [
          'Inspect parameter validations at the entry point of the function.',
          'Verify optional chaining (?.) is used when navigating nested structures.',
          `Check inputs passed to the test to ensure required parameters are defined.`,
        ],
      };
    }

    // 3. Assertion Mismatch
    if (evidence.expectedValue !== undefined || evidence.actualValue !== undefined) {
      return {
        category: 'ASSERTION_MISMATCH',
        hypothesis: `Hypothesis: The function returned ${evidence.actualValue ?? 'an unexpected value'}, but the test expected ${evidence.expectedValue ?? 'a different value'}. This suggests a calculation or conditional branch difference.`,
        steps: [
          `Compare the actual result (${evidence.actualValue ?? 'output'}) against the expected specification (${evidence.expectedValue ?? 'expected'}).`,
          'Verify if the test assertion expectation accurately reflects the business requirements.',
          'Inspect the return expression and branch conditions in the source function.',
        ],
      };
    }

    // 4. Module / Import Error
    if (msg.includes('cannot find module') || msg.includes('is not defined') || msg.includes('syntaxerror')) {
      return {
        category: 'MODULE_OR_IMPORT_ERROR',
        hypothesis: 'Hypothesis: The test runner was unable to resolve a required module, symbol, or import statement.',
        steps: [
          'Verify that the function is properly exported in the source file (e.g. export function...).',
          'Verify that relative import paths in the test file point to the correct source location.',
          'Check for missing dependencies in package.json.',
        ],
      };
    }

    // 5. Thrown Exception
    if (msg.includes('error: ') || msg.includes('throw')) {
      return {
        category: 'UNEXPECTED_EXCEPTION',
        hypothesis: `Hypothesis: An exception was thrown during execution: "${evidence.errorMessage}". If this was not expected by the test, it indicates an unhandled error state.`,
        steps: [
          'Check guard conditions to see if the input triggers an intentional throw.',
          'Wrap the call with expect(() => ...).toThrow() if the exception is intentional.',
          'Inspect exception handling (try/catch) in the source function.',
        ],
      };
    }

    // Fallback
    return {
      category: 'UNKNOWN_FAILURE',
      hypothesis:
        'Hypothesis: The test failed with non-zero exit status. Available evidence is insufficient to pinpoint the exact root cause with certainty.',
      steps: [
        'Review the complete test output and stack trace below.',
        'Set a breakpoint in the test and step through the execution with the VS Code debugger.',
        'Run the test isolated in the terminal for verbose output.',
      ],
    };
  }

  private static formatClickableLink(filePath: string, line?: number): string {
    const normalized = filePath.replace(/\\/g, '/');
    const target = line ? `${normalized}#L${line}` : normalized;
    return `[${path.basename(filePath)}${line ? `:${line}` : ''}](file:///${target})`;
  }

  private static formatReportMarkdown(report: Omit<StructuredFailureReport, 'formattedMarkdown'>): string {
    const lines: string[] = [];
    lines.push(`## 🔍 TestPilot Failure Diagnostic Report`);
    lines.push(`**Test:** \`${report.evidence.testName}\``);
    if (report.sourceLocation) {
      lines.push(`**Location:** ${report.sourceLocation.markdownLink}`);
    }
    lines.push('');
    lines.push(`### 1. Failure Summary`);
    lines.push(`> ${report.evidence.errorMessage}`);
    lines.push('');
    lines.push(`### 2. Available Evidence`);
    if (report.evidence.expectedValue !== undefined) {
      lines.push(`- **Expected:** \`${report.evidence.expectedValue}\``);
    }
    if (report.evidence.actualValue !== undefined) {
      lines.push(`- **Received:** \`${report.evidence.actualValue}\``);
    }
    if (report.evidence.line) {
      lines.push(`- **Failure Line:** ${report.evidence.line}`);
    }
    lines.push('');
    lines.push(`### 3. Likely Cause (Hypothesis)`);
    lines.push(`*Note: This is an analytical hypothesis based on available evidence, not an absolute guarantee.*`);
    lines.push(`**Category:** \`${report.hypothesisCategory}\``);
    lines.push(`${report.hypothesis}`);
    lines.push('');
    lines.push(`### 4. Suggested Debugging Steps`);
    for (const step of report.actionableSteps) {
      lines.push(`- [ ] ${step}`);
    }
    lines.push('');
    if (report.evidence.stackTrace) {
      lines.push(`### 5. Relevant Stack Trace`);
      lines.push('```text');
      lines.push(report.evidence.stackTrace.substring(0, 1500));
      lines.push('```');
    }
    return lines.join('\n');
  }
}
