import * as vscode from 'vscode';
import { FunctionAnalyzer } from '../analysis/functionAnalyzer';
import { TestCaseGenerator } from '../generators/testCaseGenerator';
import { TestFileGenerator } from '../generators/testFileGenerator';
import { WorkspaceUtils } from '../utils/workspace';
import { FrameworkDetector } from '../runners/frameworkDetector';
import { Logger } from '../utils/logger';

export async function generateTestFileCommand(): Promise<void> {
  const logger = Logger.getInstance();
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showWarningMessage('No active editor found. Open a JavaScript or TypeScript file first.');
    return;
  }

  const document = editor.document;
  const sourceText = document.getText();
  const selection = editor.selection;
  const startOffset = document.offsetAt(selection.start);
  const endOffset = document.offsetAt(selection.end);
  const filePath = document.uri.fsPath;

  let targetFunc = FunctionAnalyzer.findFunctionAtOffset(sourceText, startOffset, endOffset, filePath);
  if (!targetFunc) {
    targetFunc = FunctionAnalyzer.findFunctionAtOffset(sourceText, startOffset, startOffset, filePath);
  }

  if (!targetFunc) {
    const all = FunctionAnalyzer.analyzeSource(sourceText, filePath);
    if (all.length === 0) {
      vscode.window.showInformationMessage('No functions detected in this file.');
      return;
    }
    const picked = await vscode.window.showQuickPick(
      all.map((f) => ({
        label: `$(symbol-function) ${f.name}`,
        description: `Line ${f.startLine}-${f.endLine}`,
        func: f,
      })),
      { placeHolder: 'Select function for test file generation:' }
    );
    if (!picked) {
      return;
    }
    targetFunc = picked.func;
  }

  // Detect environment
  const env = await FrameworkDetector.detectEnvironment(filePath);
  const framework = env.framework === 'vitest' ? 'vitest' : 'jest';

  // Generate cases
  const testCases = TestCaseGenerator.generateTestCases(targetFunc);

  const suggestedPath = WorkspaceUtils.computeSuggestedtestFilePath(filePath);
  const relImport = WorkspaceUtils.computeRelativeImportPath(suggestedPath, filePath);

  const content = TestFileGenerator.generateTestFile(targetFunc, {
    framework,
    relativeImportPath: relImport,
    testCases,
  });

  const saveRes = await WorkspaceUtils.safeWriteFile({
    suggestedPath,
    content,
    promptOverwrite: true,
  });

  if (saveRes.saved && saveRes.filePath) {
    vscode.window
      .showInformationMessage(`Generated ${framework.toUpperCase()} test file at ${saveRes.filePath}`, 'Open File')
      .then(async (action) => {
        if (action === 'Open File') {
          const doc = await vscode.workspace.openTextDocument(saveRes.filePath!);
          await vscode.window.showTextDocument(doc);
        }
      });
  }
}
