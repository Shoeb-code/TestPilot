import * as vscode from 'vscode';

export async function showTestPilotCommand(): Promise<void> {
  // Focus TestPilot view in activity bar if available, or show quick launcher
  try {
    await vscode.commands.executeCommand('testpilot.overview.focus');
  } catch {
    // Fallback to quick pick launcher
    const items = [
      {
        label: '$(beaker) Generate Test Cases',
        description: 'Analyze selected function and review test scenarios',
        command: 'testpilot.generateTestCases',
      },
      {
        label: '$(file-code) Generate Test File',
        description: 'Directly create a new Jest or Vitest test file',
        command: 'testpilot.generateTestFile',
      },
      {
        label: '$(play) Run Current Test File',
        description: 'Execute current test suite and observe pass/fail counts',
        command: 'testpilot.runCurrentTestFile',
      },
      {
        label: '$(debug-alt) Analyze Test Failure',
        description: 'Diagnose recent test failures and view hypotheses',
        command: 'testpilot.analyzeTestFailure',
      },
      {
        label: '$(gear) Configure Settings',
        description: 'Configure framework, test location, package manager, and AI',
        command: 'testpilot.configureSettings',
      },
    ];

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a TestPilot action to perform:',
    });

    if (picked) {
      await vscode.commands.executeCommand(picked.command);
    }
  }
}
