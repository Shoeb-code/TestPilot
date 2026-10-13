export interface ParsedAssertion {
  title: string;
  fullName: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  durationMs?: number;
  failureMessages: string[];
}

export interface ParsedTestSuite {
  filePath: string;
  status: 'passed' | 'failed';
  durationMs?: number;
  assertions: ParsedAssertion[];
  rawFailureMessage?: string;
}

export interface ParsedTestResult {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  suites: ParsedTestSuite[];
  hasRawOutputOnly: boolean;
  rawText: string;
}

export class ResultParser {
  /**
   * Parse test execution output into structured test results.
   * Handles Jest and Vitest JSON output, with a robust regex fallback for raw CLI text.
   */
  public static parse(stdout: string, stderr: string, durationMs: number = 0): ParsedTestResult {
    const combined = `${stdout}\n${stderr}`;

    // Attempt to locate and parse JSON payload
    const jsonParsed = this.tryParseJson(stdout) || this.tryParseJson(stderr) || this.tryParseJson(combined);
    if (jsonParsed) {
      return jsonParsed;
    }

    // Fallback to text parsing
    return this.parseTextOutput(combined, durationMs);
  }

  private static tryParseJson(text: string): ParsedTestResult | undefined {
    // Look for JSON object bounds
    const startIdx = text.indexOf('{"numTotal');
    const altStartIdx = startIdx === -1 ? text.indexOf('{"testResults"') : startIdx;
    if (altStartIdx === -1) {
      return undefined;
    }

    try {
      // Find matching closing brace
      const endIdx = text.lastIndexOf('}');
      if (endIdx <= altStartIdx) {
        return undefined;
      }

      const jsonStr = text.substring(altStartIdx, endIdx + 1);
      const data = JSON.parse(jsonStr);

      const total = Number(data.numTotalTests ?? data.numTotalTestSuites ?? 0);
      const passed = Number(data.numPassedTests ?? 0);
      const failed = Number(data.numFailedTests ?? 0);
      const skipped = Number(data.numPendingTests ?? data.numTodoTests ?? 0);
      const duration = Number(data.startTime && data.endTime ? data.endTime - data.startTime : 0);

      const suites: ParsedTestSuite[] = [];

      if (Array.isArray(data.testResults)) {
        for (const tr of data.testResults) {
          const filePath = String(tr.name || tr.testFilePath || '');
          const assertions: ParsedAssertion[] = [];

          if (Array.isArray(tr.assertionResults)) {
            for (const ar of tr.assertionResults) {
              assertions.push({
                title: String(ar.title || ''),
                fullName: String(ar.fullName || ar.title || ''),
                status: ar.status === 'passed' ? 'passed' : ar.status === 'failed' ? 'failed' : 'skipped',
                durationMs: ar.duration ? Number(ar.duration) : undefined,
                failureMessages: Array.isArray(ar.failureMessages) ? ar.failureMessages.map(String) : [],
              });
            }
          }

          suites.push({
            filePath,
            status: tr.status === 'passed' ? 'passed' : 'failed',
            durationMs: tr.perfStats?.duration,
            assertions,
            rawFailureMessage: tr.message,
          });
        }
      }

      return {
        total,
        passed,
        failed,
        skipped,
        durationMs: duration,
        suites,
        hasRawOutputOnly: false,
        rawText: text,
      };
    } catch {
      return undefined;
    }
  }

  private static parseTextOutput(text: string, durationMs: number): ParsedTestResult {
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    // Regex check for standard Jest/Vitest summary line:
    // Tests:       1 failed, 2 passed, 3 total
    const summaryMatch = text.match(
      /Tests:\s*(?:(\d+)\s*failed,\s*)?(?:(\d+)\s*passed,\s*)?(?:(\d+)\s*skipped,\s*)?(\d+)\s*total/i
    );
    if (summaryMatch) {
      failed = summaryMatch[1] ? parseInt(summaryMatch[1], 10) : 0;
      passed = summaryMatch[2] ? parseInt(summaryMatch[2], 10) : 0;
      skipped = summaryMatch[3] ? parseInt(summaryMatch[3], 10) : 0;
      total = summaryMatch[4] ? parseInt(summaryMatch[4], 10) : passed + failed + skipped;
    } else {
      // Vitest style summary:
      // Test Files  1 failed (1)
      // Tests  1 failed | 2 passed (3)
      const vitestMatch = text.match(/Tests\s+(?:(\d+)\s*failed\s*\|?\s*)?(?:(\d+)\s*passed\s*\|?\s*)?\((\d+)\)/i);
      if (vitestMatch) {
        failed = vitestMatch[1] ? parseInt(vitestMatch[1], 10) : 0;
        passed = vitestMatch[2] ? parseInt(vitestMatch[2], 10) : 0;
        total = vitestMatch[3] ? parseInt(vitestMatch[3], 10) : passed + failed;
      }
    }

    // Extract individual failed assertions from text
    const failedAssertions: ParsedAssertion[] = [];
    const failLines = text.match(/[✕×●]\s+([^\n\r]+)/g);
    if (failLines) {
      for (const line of failLines) {
        const title = line.replace(/^[✕×●]\s+/, '').trim();
        failedAssertions.push({
          title,
          fullName: title,
          status: 'failed',
          failureMessages: [line],
        });
      }
      if (failed === 0 && failedAssertions.length > 0) {
        failed = failedAssertions.length;
        total = Math.max(total, failed);
      }
    }

    const suites: ParsedTestSuite[] = [
      {
        filePath: '',
        status: failed > 0 ? 'failed' : 'passed',
        assertions: failedAssertions,
        rawFailureMessage: text,
      },
    ];

    return {
      total: total || (failed > 0 ? failed : passed),
      passed,
      failed,
      skipped,
      durationMs,
      suites,
      hasRawOutputOnly: true,
      rawText: text,
    };
  }
}
