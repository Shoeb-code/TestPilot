import * as vscode from 'vscode';
import { FunctionAnalyzer, AnalyzedFunction } from '../analysis/functionAnalyzer';
import { TestCaseGenerator } from '../generators/testCaseGenerator';
import { TestCaseReviewPanel } from '../views/testCaseReviewPanel';
import { Logger } from '../utils/logger';

export async function generateTestsCommand(): Promise<void> {
  const logger = Logger.getInstance();
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showWarningMessage('No active editor found. Open a JavaScript or TypeScript file first.');
    return;
  }

  const document = editor.document;
  const langId = document.languageId;
  const supported = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];

  if (!supported.includes(langId)) {
    vscode.window.showWarningMessage(`Unsupported language "${langId}". TestPilot supports JavaScript and TypeScript.`);
    return;
  }

  const sourceText = document.getText();
  const selection = editor.selection;
  const startOffset = document.offsetAt(selection.start);
  const endOffset = document.offsetAt(selection.end);
  const filePath = document.uri.fsPath;

  let targetFunc: AnalyzedFunction | undefined;

  // 1. Try finding function at selection
  if (!selection.isEmpty || startOffset !== endOffset) {
    targetFunc = FunctionAnalyzer.findFunctionAtOffset(sourceText, startOffset, endOffset, filePath);
  }

  // 2. If not found or empty selection, look at cursor position
  if (!targetFunc) {
    targetFunc = FunctionAnalyzer.findFunctionAtOffset(sourceText, startOffset, startOffset, filePath);
  }

  // 3. If still not found, list all functions in document for user selection
  if (!targetFunc) {
    const allFuncs = FunctionAnalyzer.analyzeSource(sourceText, filePath);
    if (allFuncs.length === 0) {
      vscode.window.showInformationMessage(
        'No function declarations found in the current file. Please place your cursor inside a function.'
      );
      return;
    }

    const items = allFuncs.map((f) => ({
      label: `$(symbol-function) ${f.name}`,
      description: `Line ${f.startLine}-${f.endLine} (${f.parameters.length} params)`,
      detail: f.parameters.map((p) => `${p.name}: ${p.category}`).join(', ') || 'No parameters',
      func: f,
    }));

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a function to generate test cases for:',
    });

    if (!picked) {
      return;
    }
    targetFunc = picked.func;
  }

  logger.info(`Analyzing function: ${targetFunc.name} at line ${targetFunc.startLine}`);

  // Generate test cases
  const cases = TestCaseGenerator.generateTestCases(targetFunc);
  logger.info(`Generated ${cases.length} test cases for ${targetFunc.name}`);

  // Open review interface
  TestCaseReviewPanel.render(targetFunc, cases);
}
