import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FrameworkDetector } from '../runners/frameworkDetector';
import { JestRunner } from '../runners/jestRunner';
import { VitestRunner } from '../runners/vitestRunner';
import { TestExecutionResult } from '../runners/testRunner';
import { ResultParser, ParsedTestResult } from '../reports/resultParser';
import { StatusBarController } from '../views/statusBar';
import { Logger } from '../utils/logger';
import { WorkspaceUtils } from '../utils/workspace';

// Shared state storing last execution result for failure analysis
export let lastTestExecution:
  | {
      result: TestExecutionResult;
      parsed: ParsedTestResult;
      testFilePath: string;
    }
  | undefined;

export async function runCurrentTestFileCommand(statusBar?: StatusBarController): Promise<void> {
  const logger = Logger.getInstance();
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showWarningMessage('No active editor found. Please open a test file.');
    return;
  }

  let testFilePath = editor.document.uri.fsPath;

  // If active file is not a test file, check if a companion test file exists
  if (!WorkspaceUtils.isTestFile(testFilePath)) {
    const candidatePath = WorkspaceUtils.computeSuggestedtestFilePath(testFilePath);
    if (fs.existsSync(candidatePath)) {
      const choice = await vscode.window.showInformationMessage(
        `Active file is not a test file. Found companion test file: "${path.basename(candidatePath)}". Run it?`,
        'Run Companion Test',
        'Cancel'
      );
      if (choice !== 'Run Companion Test') {
        return;
      }
      testFilePath = candidatePath;
    } else {
      vscode.window.showWarningMessage('Active file is not a test file and no companion test file was found.');
      return;
    }
  }

  statusBar?.setStatus('running', `Running tests in ${path.basename(testFilePath)}...`);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `TestPilot: Running ${path.basename(testFilePath)}...`,
      cancellable: true,
    },
    async (progress, token) => {
      const env = await FrameworkDetector.detectEnvironment(testFilePath);
      logger.info(`Running ${testFilePath} with ${env.framework}...`);

      const execution =
        env.framework === 'vitest'
          ? await VitestRunner.runTestFile(testFilePath, env, token)
          : await JestRunner.runTestFile(testFilePath, env, token);

      const parsed = ResultParser.parse(execution.stdout, execution.stderr, execution.durationMs);
      lastTestExecution = { result: execution, parsed, testFilePath };

      logger.info(`Test run complete: ${parsed.passed} passed, ${parsed.failed} failed of ${parsed.total} total.`);
      if (execution.stdout) {
        logger.debug('STDOUT:\n' + execution.stdout);
      }
      if (execution.stderr) {
        logger.debug('STDERR:\n' + execution.stderr);
      }

      if (execution.cancelled) {
        statusBar?.setStatus('ready');
        vscode.window.showWarningMessage('Test execution was cancelled.');
        return;
      }

      if (execution.timedOut) {
        statusBar?.setStatus('failed', 'Timed out');
        vscode.window.showErrorMessage('Test execution timed out.');
        return;
      }

      if (execution.success && parsed.failed === 0) {
        statusBar?.setStatus('passed', `${parsed.passed} passed in ${execution.durationMs}ms`);
        vscode.window.showInformationMessage(
          `✅ TestPilot: All ${parsed.passed} tests passed (${execution.durationMs}ms)!`
        );
      } else {
        statusBar?.setStatus('failed', `${parsed.failed} failed`);
        const msg = `❌ TestPilot: ${parsed.failed} tests failed in ${path.basename(testFilePath)}.`;
        vscode.window.showErrorMessage(msg, 'Analyze Failure', 'View Logs').then((action) => {
          if (action === 'Analyze Failure') {
            vscode.commands.executeCommand('testpilot.analyzeTestFailure');
          } else if (action === 'View Logs') {
            logger.show();
          }
        });
      }
    }
  );
}
