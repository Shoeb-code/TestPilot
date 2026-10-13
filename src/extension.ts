import * as vscode from 'vscode';
import { generateTestsCommand } from './commands/generateTests';
import { generateTestFileCommand } from './commands/generateTestFile';
import { runCurrentTestFileCommand } from './commands/runTests';
import { analyzeFailureCommand } from './commands/analyzeFailure';
import { showTestPilotCommand } from './commands/showTestPilot';
import { configureSettingsCommand } from './commands/configureSettings';
import { StatusBarController } from './views/statusBar';
import { OverviewTreeProvider } from './views/overviewTreeProvider';
import { TestPilotController } from './testing/testController';
import { Logger } from './utils/logger';

export function activate(context: vscode.ExtensionContext): void {
  const logger = Logger.getInstance();
  logger.info('TestPilot extension activating...');

  // 1. Status Bar
  const statusBar = new StatusBarController();
  context.subscriptions.push(statusBar);

  // 2. Sidebar Tree View
  const overviewProvider = new OverviewTreeProvider();
  const treeView = vscode.window.registerTreeDataProvider('testpilot.overview', overviewProvider);
  context.subscriptions.push(treeView);

  // 3. Test Controller (VS Code Native Testing API)
  const testPilotController = new TestPilotController();
  context.subscriptions.push(testPilotController);

  // 4. Command Registrations
  context.subscriptions.push(
    vscode.commands.registerCommand('testpilot.generateTestCases', async () => {
      await generateTestsCommand();
      overviewProvider.refresh();
    }),
    vscode.commands.registerCommand('testpilot.generateTestFile', async () => {
      await generateTestFileCommand();
      overviewProvider.refresh();
    }),
    vscode.commands.registerCommand('testpilot.runCurrentTestFile', async () => {
      await runCurrentTestFileCommand(statusBar);
      overviewProvider.refresh();
    }),
    vscode.commands.registerCommand('testpilot.analyzeTestFailure', async () => {
      await analyzeFailureCommand();
    }),
    vscode.commands.registerCommand('testpilot.showTestPilot', async () => {
      await showTestPilotCommand();
    }),
    vscode.commands.registerCommand('testpilot.configureSettings', async () => {
      await configureSettingsCommand();
    })
  );

  logger.info('TestPilot extension successfully activated. Ready to assist testing!');
}

export function deactivate(): void {
  const logger = Logger.getInstance();
  logger.info('TestPilot extension deactivated.');
}
