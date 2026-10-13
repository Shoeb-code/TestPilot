import * as vscode from 'vscode';
import { FrameworkDetector } from '../runners/frameworkDetector';

export class OverviewItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    command?: vscode.Command,
    iconPath?: vscode.ThemeIcon,
    description?: string
  ) {
    super(label, collapsibleState);
    this.command = command;
    this.iconPath = iconPath;
    this.description = description;
  }
}

export class OverviewTreeProvider implements vscode.TreeDataProvider<OverviewItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<OverviewItem | undefined | null | void> = new vscode.EventEmitter<
    OverviewItem | undefined | null | void
  >();
  readonly onDidChangeTreeData: vscode.Event<OverviewItem | undefined | null | void> = this._onDidChangeTreeData.event;

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: OverviewItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: OverviewItem): Promise<OverviewItem[]> {
    if (element) {
      return [];
    }

    const items: OverviewItem[] = [];

    // 1. Actions group
    items.push(
      new OverviewItem(
        'Generate Test Cases',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'testpilot.generateTestCases',
          title: 'Generate Test Cases',
        },
        new vscode.ThemeIcon('beaker'),
        'Analyze selection'
      )
    );

    items.push(
      new OverviewItem(
        'Generate Test File',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'testpilot.generateTestFile',
          title: 'Generate Test File',
        },
        new vscode.ThemeIcon('file-code'),
        'Create Jest/Vitest file'
      )
    );

    items.push(
      new OverviewItem(
        'Run Current Test File',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'testpilot.runCurrentTestFile',
          title: 'Run Current Test File',
        },
        new vscode.ThemeIcon('play'),
        'Execute test runner'
      )
    );

    items.push(
      new OverviewItem(
        'Analyze Test Failure',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'testpilot.analyzeTestFailure',
          title: 'Analyze Test Failure',
        },
        new vscode.ThemeIcon('debug-alt'),
        'Inspect failure hypothesis'
      )
    );

    items.push(
      new OverviewItem(
        'Configure Settings',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'testpilot.configureSettings',
          title: 'Configure Settings',
        },
        new vscode.ThemeIcon('gear'),
        'Framework & preferences'
      )
    );

    // 2. Detected environment info
    try {
      const activeDoc = vscode.window.activeTextEditor?.document;
      const env = await FrameworkDetector.detectEnvironment(activeDoc?.uri.fsPath);

      const config = vscode.workspace.getConfiguration('testpilot.ai');
      const aiEnabled = config.get<boolean>('enabled', false);

      items.push(
        new OverviewItem(
          `Framework: ${env.framework.toUpperCase()}`,
          vscode.TreeItemCollapsibleState.None,
          undefined,
          new vscode.ThemeIcon('info'),
          env.hasConfigFile ? 'Config file found' : 'Default'
        )
      );

      items.push(
        new OverviewItem(
          `Package Manager: ${env.packageManager}`,
          vscode.TreeItemCollapsibleState.None,
          undefined,
          new vscode.ThemeIcon('package')
        )
      );

      items.push(
        new OverviewItem(
          `AI Assistant: ${aiEnabled ? 'Active' : 'Offline Mode'}`,
          vscode.TreeItemCollapsibleState.None,
          undefined,
          new vscode.ThemeIcon(aiEnabled ? 'sparkle' : 'shield'),
          aiEnabled ? 'Configured' : 'Local Only'
        )
      );
    } catch {
      // Ignore detection issues for sidebar
    }

    return items;
  }
}
