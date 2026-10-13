import * as ts from 'typescript';

export interface ExtractedCondition {
  paramName?: string;
  operator: string;
  comparedValue?: string;
  isGuardClause: boolean;
  rawText: string;
  locationLine: number;
  testCandidates: {
    satisfies: string;
    violates: string;
    boundary?: string;
  };
}

export class BranchAnalyzer {
  /**
   * Analyze an AST node (IfStatement, ConditionalExpression, etc.)
   * and extract intelligent boundary values for known parameters
   */
  public static analyzeCondition(
    conditionNode: ts.Expression,
    sourceFile: ts.SourceFile,
    isGuard: boolean = false
  ): ExtractedCondition | undefined {
    const rawText = conditionNode.getText(sourceFile).trim();
    const pos = sourceFile.getLineAndCharacterOfPosition(conditionNode.getStart(sourceFile));
    const locationLine = pos.line + 1;

    // Check for Binary Expression (e.g. x === 0, age < 18, length > 0)
    if (ts.isBinaryExpression(conditionNode)) {
      const left = conditionNode.left.getText(sourceFile).trim();
      const op = conditionNode.operatorToken.getText(sourceFile).trim();
      const right = conditionNode.right.getText(sourceFile).trim();

      // Check numeric comparisons
      const numericRight = Number(right);
      const isNum = !isNaN(numericRight);

      if (op === '===' || op === '==') {
        return {
          paramName: left,
          operator: op,
          comparedValue: right,
          isGuardClause: isGuard,
          rawText,
          locationLine,
          testCandidates: {
            satisfies: right,
            violates: isNum ? String(numericRight + 1) : right === '""' ? '"test"' : 'null',
          },
        };
      }

      if (op === '!==' || op === '!=') {
        return {
          paramName: left,
          operator: op,
          comparedValue: right,
          isGuardClause: isGuard,
          rawText,
          locationLine,
          testCandidates: {
            satisfies: isNum ? String(numericRight + 1) : right === '""' ? '"test"' : 'null',
            violates: right,
          },
        };
      }

      if (isNum) {
        if (op === '<') {
          return {
            paramName: left,
            operator: op,
            comparedValue: right,
            isGuardClause: isGuard,
            rawText,
            locationLine,
            testCandidates: {
              satisfies: String(numericRight - 1),
              boundary: String(numericRight),
              violates: String(numericRight + 1),
            },
          };
        }
        if (op === '<=') {
          return {
            paramName: left,
            operator: op,
            comparedValue: right,
            isGuardClause: isGuard,
            rawText,
            locationLine,
            testCandidates: {
              satisfies: String(numericRight),
              boundary: String(numericRight),
              violates: String(numericRight + 1),
            },
          };
        }
        if (op === '>') {
          return {
            paramName: left,
            operator: op,
            comparedValue: right,
            isGuardClause: isGuard,
            rawText,
            locationLine,
            testCandidates: {
              satisfies: String(numericRight + 1),
              boundary: String(numericRight),
              violates: String(numericRight - 1),
            },
          };
        }
        if (op === '>=') {
          return {
            paramName: left,
            operator: op,
            comparedValue: right,
            isGuardClause: isGuard,
            rawText,
            locationLine,
            testCandidates: {
              satisfies: String(numericRight),
              boundary: String(numericRight),
              violates: String(numericRight - 1),
            },
          };
        }
      }
    }

    // Check for PrefixUnaryExpression (e.g. !str, !isValid)
    if (ts.isPrefixUnaryExpression(conditionNode) && conditionNode.operator === ts.SyntaxKind.ExclamationToken) {
      const operand = conditionNode.operand.getText(sourceFile).trim();
      return {
        paramName: operand,
        operator: '!',
        comparedValue: 'falsy',
        isGuardClause: isGuard,
        rawText,
        locationLine,
        testCandidates: {
          satisfies: 'null',
          violates: '"valid"',
          boundary: '""',
        },
      };
    }

    return {
      operator: 'truthy',
      rawText,
      locationLine,
      isGuardClause: isGuard,
      testCandidates: {
        satisfies: 'true',
        violates: 'false',
      },
    };
  }
}
