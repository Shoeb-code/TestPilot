import * as vscode from 'vscode';
import { lastTestExecution } from './runTests';
import { FailureAnalyzer } from '../reports/failureAnalyzer';
import { ModularAiProvider } from '../providers/aiProvider';
import { Logger } from '../utils/logger';

export async function analyzeFailureCommand(): Promise<void> {
  const logger = Logger.getInstance();

  let testName = 'Test Failure';
  let failureText = '';
  let filePath = '';

  if (lastTestExecution && lastTestExecution.parsed.failed > 0) {
    filePath = lastTestExecution.testFilePath;

    // Find all failed assertions
    const failedAssertions = lastTestExecution.parsed.suites
      .flatMap((s) => s.assertions)
      .filter((a) => a.status === 'failed');

    if (failedAssertions.length > 1) {
      const picked = await vscode.window.showQuickPick(
        failedAssertions.map((a) => ({
          label: `$(error) ${a.title}`,
          description: a.failureMessages[0]?.substring(0, 60),
          assertion: a,
        })),
        { placeHolder: 'Select a failed test case to diagnose:' }
      );

      if (!picked) {
        return;
      }
      testName = picked.assertion.title;
      failureText = picked.assertion.failureMessages.join('\n');
    } else if (failedAssertions.length === 1) {
      testName = failedAssertions[0].title;
      failureText = failedAssertions[0].failureMessages.join('\n');
    } else {
      // Raw failure text
      failureText = lastTestExecution.result.stderr || lastTestExecution.result.stdout || 'Test failed';
    }
  } else {
    // No recent failure in memory: prompt user to paste failure text or enter details
    const input = await vscode.window.showInputBox({
      prompt: 'Enter test failure message or error trace to analyze:',
      placeHolder: 'e.g. Expected: 5, Received: 4 ... at divide (math.test.ts:15:7)',
    });

    if (!input || input.trim().length === 0) {
      vscode.window.showInformationMessage('No failure text provided for analysis.');
      return;
    }
    failureText = input;
  }

  logger.info(`Analyzing failure for: ${testName}`);
  const report = FailureAnalyzer.analyzeFailure(testName, failureText, filePath);

  // Present report in a clean untitled markdown document
  const doc = await vscode.workspace.openTextDocument({
    language: 'markdown',
    content: report.formattedMarkdown,
  });
  await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });

  logger.info('Failure analysis report generated.');

  // Check if AI is configured and offer explanation
  const aiProvider = new ModularAiProvider();
  if (aiProvider.isConfigured()) {
    const askAi = await vscode.window.showInformationMessage(
      'Would you like an AI-assisted failure explanation and fix suggestion?',
      'Yes, Explain with AI',
      'No'
    );

    if (askAi === 'Yes, Explain with AI') {
      const aiResult = await aiProvider.explainFailure({
        testName,
        errorMessage: report.evidence.errorMessage,
        stackTrace: report.evidence.stackTrace || failureText,
      });

      if (aiResult.success) {
        const aiDoc = await vscode.workspace.openTextDocument({
          language: 'markdown',
          content: `## 🤖 AI Failure Explanation & Recommendation\n\n${aiResult.explanation}`,
        });
        await vscode.window.showTextDocument(aiDoc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
      } else {
        vscode.window.showWarningMessage(aiResult.errorMessage || 'AI explanation unavailable.');
      }
    }
  }
}
