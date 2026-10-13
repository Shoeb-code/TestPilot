import { AnalyzedFunction, ParameterInfo } from '../analysis/functionAnalyzer';
import { TypeAnalyzer } from '../analysis/typeAnalyzer';

export type TestCategory = 'Positive' | 'Negative' | 'Boundary' | 'Edge' | 'Error';
export type TestConfidence = 'verified' | 'suggested' | 'manual_review_required';

export interface TestCase {
  id: string;
  testName: string;
  category: TestCategory;
  inputArgs: string[];
  expectedResult?: string;
  expectedThrows: boolean;
  expectedExceptionType?: string;
  expectedExceptionMessage?: string;
  reason: string;
  confidence: TestConfidence;
  confidenceNote?: string;
  selected: boolean;
}

export class TestCaseGenerator {
  /**
   * Generate a comprehensive suite of structured test cases for an analyzed function
   */
  public static generateTestCases(func: AnalyzedFunction): TestCase[] {
    const cases: TestCase[] = [];
    let counter = 1;

    const nextId = () => `tc-${counter++}`;

    // 1. Error & Exception Testing (from guard clauses & throw statements)
    for (const thrown of func.thrownErrors) {
      // Find matching guard branch
      const guardBranch = func.branches.find(
        (b) => b.isGuardClause && Math.abs(b.locationLine - thrown.locationLine) <= 4
      );

      const inputArgs = this.buildInputArgsForCondition(func.parameters, guardBranch, true);
      const conditionDesc = guardBranch
        ? `${guardBranch.paramName || 'parameter'} is ${guardBranch.comparedValue || guardBranch.conditionText}`
        : 'an error condition is triggered';

      cases.push({
        id: nextId(),
        testName: `should throw ${thrown.errorType} when ${conditionDesc}`,
        category: 'Error',
        inputArgs,
        expectedThrows: true,
        expectedExceptionType: thrown.errorType,
        expectedExceptionMessage: thrown.message,
        reason: `Guards against invalid state by asserting that line ${thrown.locationLine} throws ${thrown.errorType}.`,
        confidence: 'suggested',
        confidenceNote: 'Assertion verified from AST throw expression; confirm error type and message.',
        selected: true,
      });
    }

    // 2. Positive Testing: Standard Happy Path
    const standardArgs = func.parameters.map((p, idx) => {
      const candidates = TypeAnalyzer.getCandidatesForCategory(p.category);
      const chosen = candidates.positive[idx % candidates.positive.length] ?? '1';
      return TypeAnalyzer.formatLiteral(chosen);
    });

    cases.push({
      id: nextId(),
      testName: `should execute successfully with standard valid inputs`,
      category: 'Positive',
      inputArgs: standardArgs,
      expectedThrows: false,
      reason: 'Validates standard functional execution with canonical input arguments.',
      confidence: 'suggested',
      confidenceNote: 'Expected return value must be confirmed by developer based on business logic.',
      selected: true,
    });

    // Positive with secondary inputs
    if (func.parameters.some((p) => p.category === 'number' || p.category === 'string')) {
      const altArgs = func.parameters.map((p) => {
        const candidates = TypeAnalyzer.getCandidatesForCategory(p.category);
        const chosen = candidates.positive[1] ?? candidates.positive[0] ?? '2';
        return TypeAnalyzer.formatLiteral(chosen);
      });

      if (JSON.stringify(altArgs) !== JSON.stringify(standardArgs)) {
        cases.push({
          id: nextId(),
          testName: `should return expected output for alternate valid inputs`,
          category: 'Positive',
          inputArgs: altArgs,
          expectedThrows: false,
          reason: 'Ensures calculation or output is consistent across varied valid values.',
          confidence: 'suggested',
          confidenceNote: 'Assertion suggestion only; verify expected return value.',
          selected: true,
        });
      }
    }

    // Positive with default parameters omitted
    const hasDefault = func.parameters.some((p) => p.defaultValue !== undefined || p.isOptional);
    if (hasDefault) {
      const requiredArgs = func.parameters
        .filter((p) => !p.defaultValue && !p.isOptional)
        .map((p, idx) => {
          const candidates = TypeAnalyzer.getCandidatesForCategory(p.category);
          return TypeAnalyzer.formatLiteral(candidates.positive[idx % candidates.positive.length] ?? '1');
        });

      cases.push({
        id: nextId(),
        testName: `should use default parameter values when optional arguments are omitted`,
        category: 'Positive',
        inputArgs: requiredArgs,
        expectedThrows: false,
        reason: 'Verifies fallback behavior when optional or defaulted parameters are not provided.',
        confidence: 'suggested',
        confidenceNote: 'Verify that defaults produce expected output.',
        selected: true,
      });
    }

    // 3. Boundary-Value Testing
    for (const p of func.parameters) {
      const candidates = TypeAnalyzer.getCandidatesForCategory(p.category);

      for (const boundaryVal of candidates.boundary.slice(0, 2)) {
        const formatted = TypeAnalyzer.formatLiteral(boundaryVal);
        const args = func.parameters.map((other) => {
          if (other.name === p.name) {
            return formatted;
          }
          const c = TypeAnalyzer.getCandidatesForCategory(other.category);
          return TypeAnalyzer.formatLiteral(c.positive[0]);
        });

        cases.push({
          id: nextId(),
          testName: `should handle boundary input for "${p.name}" = ${formatted}`,
          category: 'Boundary',
          inputArgs: args,
          expectedThrows: false,
          reason: `Tests boundary limit of ${p.category} domain for parameter "${p.name}".`,
          confidence: 'suggested',
          confidenceNote: 'Check whether boundary value should return a result or handle gracefully.',
          selected: true,
        });
      }
    }

    // Branch condition boundaries
    for (const b of func.branches) {
      if (b.testCandidates?.boundary && b.paramName) {
        const args = func.parameters.map((p) => {
          if (p.name === b.paramName) {
            return b.testCandidates!.boundary!;
          }
          const c = TypeAnalyzer.getCandidatesForCategory(p.category);
          return TypeAnalyzer.formatLiteral(c.positive[0]);
        });

        cases.push({
          id: nextId(),
          testName: `should handle condition threshold where "${b.paramName}" is ${b.testCandidates.boundary}`,
          category: 'Boundary',
          inputArgs: args,
          expectedThrows: b.isGuardClause,
          reason: `Exercises boundary condition "${b.conditionText}" at line ${b.locationLine}.`,
          confidence: 'suggested',
          confidenceNote: 'Boundary identified from AST branch condition.',
          selected: true,
        });
      }
    }

    // 4. Negative Testing
    for (const p of func.parameters) {
      const candidates = TypeAnalyzer.getCandidatesForCategory(p.category);

      for (const negVal of candidates.negative.slice(0, 2)) {
        const formatted = TypeAnalyzer.formatLiteral(negVal);
        const args = func.parameters.map((other) => {
          if (other.name === p.name) {
            return formatted;
          }
          const c = TypeAnalyzer.getCandidatesForCategory(other.category);
          return TypeAnalyzer.formatLiteral(c.positive[0]);
        });

        cases.push({
          id: nextId(),
          testName: `should handle negative or invalid value for "${p.name}" = ${formatted}`,
          category: 'Negative',
          inputArgs: args,
          expectedThrows: false,
          reason: `Validates system resilience when "${p.name}" receives negative/invalid input ${formatted}.`,
          confidence: 'manual_review_required',
          confidenceNote: 'Function may either throw, return default, or return NaN/null depending on specifications.',
          selected: false,
        });
      }
    }

    // 5. Edge-Case Testing
    for (const p of func.parameters) {
      const candidates = TypeAnalyzer.getCandidatesForCategory(p.category);

      for (const edgeVal of candidates.edge.slice(0, 2)) {
        const formatted = TypeAnalyzer.formatLiteral(edgeVal);
        const args = func.parameters.map((other) => {
          if (other.name === p.name) {
            return formatted;
          }
          const c = TypeAnalyzer.getCandidatesForCategory(other.category);
          return TypeAnalyzer.formatLiteral(c.positive[0]);
        });

        cases.push({
          id: nextId(),
          testName: `should handle edge case for "${p.name}" = ${formatted}`,
          category: 'Edge',
          inputArgs: args,
          expectedThrows: false,
          reason: `Verifies behavior under rare or extreme edge case: ${formatted}.`,
          confidence: 'manual_review_required',
          confidenceNote: 'Edge case behavior should be explicitly reviewed against requirements.',
          selected: false,
        });
      }
    }

    return cases;
  }

  private static buildInputArgsForCondition(
    parameters: ParameterInfo[],
    branch?: { paramName?: string; testCandidates?: { satisfies: string } },
    targetSatisfies: boolean = true
  ): string[] {
    return parameters.map((p) => {
      if (branch && branch.paramName === p.name && branch.testCandidates) {
        return targetSatisfies ? branch.testCandidates.satisfies : '1';
      }
      const candidates = TypeAnalyzer.getCandidatesForCategory(p.category);
      return TypeAnalyzer.formatLiteral(candidates.positive[0]);
    });
  }
}
