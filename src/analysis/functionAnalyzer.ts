import * as ts from 'typescript';
import { BranchAnalyzer } from './branchAnalyzer';
import { TypeAnalyzer } from './typeAnalyzer';

export interface ParameterInfo {
  name: string;
  type?: string;
  category: string;
  defaultValue?: string;
  isOptional: boolean;
  isRest: boolean;
}

export interface ThrownErrorInfo {
  errorType: string;
  message?: string;
  locationLine: number;
}

export interface BranchConditionInfo {
  conditionText: string;
  paramName?: string;
  operator?: string;
  comparedValue?: string;
  isGuardClause: boolean;
  locationLine: number;
  testCandidates?: {
    satisfies: string;
    violates: string;
    boundary?: string;
  };
}

export interface AnalyzedFunction {
  name: string;
  isExported: boolean;
  isDefaultExport: boolean;
  isAsync: boolean;
  parameters: ParameterInfo[];
  returnType?: string;
  returnExpressions: string[];
  thrownErrors: ThrownErrorInfo[];
  branches: BranchConditionInfo[];
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  sourceCode: string;
  filePath: string;
  language: 'typescript' | 'javascript';
}

export class FunctionAnalyzer {
  /**
   * Parse a file or snippet and extract all analyzable functions
   */
  public static analyzeSource(sourceText: string, filePath: string = 'snippet.ts'): AnalyzedFunction[] {
    const isTs = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
    const scriptKind = filePath.endsWith('.tsx')
      ? ts.ScriptKind.TSX
      : filePath.endsWith('.jsx')
        ? ts.ScriptKind.JSX
        : isTs
          ? ts.ScriptKind.TS
          : ts.ScriptKind.JS;

    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind);

    const functions: AnalyzedFunction[] = [];

    const visit = (node: ts.Node) => {
      // 1. Function Declarations: function foo(...) {}
      if (ts.isFunctionDeclaration(node)) {
        const analyzed = this.analyzeFunctionDeclaration(
          node,
          sourceFile,
          filePath,
          isTs ? 'typescript' : 'javascript'
        );
        if (analyzed) {
          functions.push(analyzed);
        }
      }

      // 2. Variable Statements: const foo = (...) => {} or const foo = function(...) {}
      else if (ts.isVariableStatement(node)) {
        const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
        const isExported = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
        for (const decl of node.declarationList.declarations) {
          if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
            const funcName = decl.name.getText(sourceFile);
            const analyzed = this.analyzeFunctionLike(
              decl.initializer,
              funcName,
              sourceFile,
              filePath,
              isTs ? 'typescript' : 'javascript',
              isExported,
              false
            );
            if (analyzed) {
              functions.push(analyzed);
            }
          }
        }
      }

      // 3. Method Declarations in classes
      else if (ts.isMethodDeclaration(node)) {
        const funcName = node.name.getText(sourceFile);
        const analyzed = this.analyzeFunctionLike(
          node,
          funcName,
          sourceFile,
          filePath,
          isTs ? 'typescript' : 'javascript',
          false,
          false
        );
        if (analyzed) {
          functions.push(analyzed);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return functions;
  }

  /**
   * Find the function enclosing or matching the given offset range
   */
  public static findFunctionAtOffset(
    sourceText: string,
    startOffset: number,
    endOffset: number,
    filePath: string = 'snippet.ts'
  ): AnalyzedFunction | undefined {
    const all = this.analyzeSource(sourceText, filePath);
    if (all.length === 0) {
      return undefined;
    }

    // Exact match or contains selection
    const containing = all.filter((f) => f.startOffset <= startOffset && f.endOffset >= endOffset);

    if (containing.length > 0) {
      // Return smallest enclosing function
      containing.sort((a, b) => a.endOffset - a.startOffset - (b.endOffset - b.startOffset));
      return containing[0];
    }

    // Overlapping match
    const overlapping = all.filter((f) => startOffset <= f.endOffset && endOffset >= f.startOffset);
    if (overlapping.length > 0) {
      return overlapping[0];
    }

    // Fallback: if user highlighted within file, pick closest
    return undefined;
  }

  private static analyzeFunctionDeclaration(
    node: ts.FunctionDeclaration,
    sourceFile: ts.SourceFile,
    filePath: string,
    language: 'typescript' | 'javascript'
  ): AnalyzedFunction | undefined {
    const name = node.name ? node.name.getText(sourceFile) : 'anonymous';
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    const isExported = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    const isDefaultExport = modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;

    return this.analyzeFunctionLike(node, name, sourceFile, filePath, language, isExported, isDefaultExport);
  }

  private static analyzeFunctionLike(
    node: ts.FunctionLikeDeclaration,
    name: string,
    sourceFile: ts.SourceFile,
    filePath: string,
    language: 'typescript' | 'javascript',
    isExported: boolean,
    isDefaultExport: boolean
  ): AnalyzedFunction | undefined {
    const startPos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const endPos = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    const startOffset = node.getStart(sourceFile);
    const endOffset = node.getEnd();
    const sourceCode = node.getText(sourceFile);

    const isAsync = (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async) !== 0;

    // Parameters
    const parameters: ParameterInfo[] = node.parameters.map((param) => {
      const paramName = param.name.getText(sourceFile);
      const typeText = param.type ? param.type.getText(sourceFile) : undefined;
      const defaultValue = param.initializer ? param.initializer.getText(sourceFile) : undefined;
      const isOptional = Boolean(param.questionToken || defaultValue);
      const isRest = Boolean(param.dotDotDotToken);
      const category = TypeAnalyzer.inferCategory(typeText, defaultValue);

      return {
        name: paramName,
        type: typeText,
        category,
        defaultValue,
        isOptional,
        isRest,
      };
    });

    // Return type
    const returnType = node.type ? node.type.getText(sourceFile) : undefined;

    // Traverse body for returns, throws, branches
    const returnExpressions: string[] = [];
    const thrownErrors: ThrownErrorInfo[] = [];
    const branches: BranchConditionInfo[] = [];

    if (node.body) {
      this.inspectFunctionBody(node.body, sourceFile, returnExpressions, thrownErrors, branches);
    }

    return {
      name,
      isExported,
      isDefaultExport,
      isAsync,
      parameters,
      returnType,
      returnExpressions,
      thrownErrors,
      branches,
      startLine: startPos.line + 1,
      endLine: endPos.line + 1,
      startOffset,
      endOffset,
      sourceCode,
      filePath,
      language,
    };
  }

  private static inspectFunctionBody(
    body: ts.Node,
    sourceFile: ts.SourceFile,
    returnExpressions: string[],
    thrownErrors: ThrownErrorInfo[],
    branches: BranchConditionInfo[]
  ): void {
    const visit = (node: ts.Node) => {
      // Don't recurse into nested function declarations
      if (
        node !== body &&
        (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node))
      ) {
        return;
      }

      // Return statements
      if (ts.isReturnStatement(node)) {
        if (node.expression) {
          returnExpressions.push(node.expression.getText(sourceFile).trim());
        } else {
          returnExpressions.push('undefined');
        }
      }

      // Throw statements
      else if (ts.isThrowStatement(node)) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        let errorType = 'Error';
        let message: string | undefined;

        if (node.expression && ts.isNewExpression(node.expression)) {
          errorType = node.expression.expression.getText(sourceFile).trim();
          if (node.expression.arguments && node.expression.arguments.length > 0) {
            const firstArg = node.expression.arguments[0];
            if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
              message = firstArg.text;
            } else {
              message = firstArg.getText(sourceFile);
            }
          }
        } else if (node.expression) {
          message = node.expression.getText(sourceFile);
        }

        thrownErrors.push({
          errorType,
          message,
          locationLine: line,
        });
      }

      // If statements
      else if (ts.isIfStatement(node)) {
        const isGuard = this.isGuardClause(node.thenStatement);
        const cond = BranchAnalyzer.analyzeCondition(node.expression, sourceFile, isGuard);
        if (cond) {
          branches.push({
            conditionText: cond.rawText,
            paramName: cond.paramName,
            operator: cond.operator,
            comparedValue: cond.comparedValue,
            isGuardClause: cond.isGuardClause,
            locationLine: cond.locationLine,
            testCandidates: cond.testCandidates,
          });
        }
      }

      // Conditional (ternary) expression
      else if (ts.isConditionalExpression(node)) {
        const cond = BranchAnalyzer.analyzeCondition(node.condition, sourceFile, false);
        if (cond) {
          branches.push({
            conditionText: cond.rawText,
            paramName: cond.paramName,
            operator: cond.operator,
            comparedValue: cond.comparedValue,
            isGuardClause: false,
            locationLine: cond.locationLine,
            testCandidates: cond.testCandidates,
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(body);
  }

  private static isGuardClause(statement: ts.Statement): boolean {
    if (ts.isThrowStatement(statement) || ts.isReturnStatement(statement)) {
      return true;
    }
    if (ts.isBlock(statement) && statement.statements.length > 0) {
      const first = statement.statements[0];
      return ts.isThrowStatement(first) || ts.isReturnStatement(first);
    }
    return false;
  }
}
