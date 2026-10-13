import * as vscode from 'vscode';

export class StatusBarController implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'testpilot.showTestPilot';
    this.setStatus('ready');
    this.statusBarItem.show();
  }

  public setStatus(status: 'ready' | 'running' | 'passed' | 'failed', details?: string): void {
    switch (status) {
      case 'running':
        this.statusBarItem.text = `$(sync~spin) TestPilot: Running...`;
        this.statusBarItem.tooltip = details || 'Executing test suite...';
        this.statusBarItem.backgroundColor = undefined;
        break;

      case 'passed':
        this.statusBarItem.text = `$(check) TestPilot: Passed`;
        this.statusBarItem.tooltip = details || 'All tests passed';
        this.statusBarItem.backgroundColor = undefined;
        break;

      case 'failed':
        this.statusBarItem.text = `$(error) TestPilot: Failed`;
        this.statusBarItem.tooltip = details || 'One or more tests failed. Click to analyze.';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        break;

      case 'ready':
      default:
        this.statusBarItem.text = `$(beaker) TestPilot`;
        this.statusBarItem.tooltip = 'TestPilot: Ready. Click to open Assistant.';
        this.statusBarItem.backgroundColor = undefined;
        break;
    }
  }

  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
