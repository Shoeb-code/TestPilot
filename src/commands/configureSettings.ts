import * as vscode from 'vscode';

export async function configureSettingsCommand(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.openSettings', 'testpilot');
}
