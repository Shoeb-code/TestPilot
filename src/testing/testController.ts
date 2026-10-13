import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FrameworkDetector } from '../runners/frameworkDetector';
import { JestRunner } from '../runners/jestRunner';
import { VitestRunner } from '../runners/vitestRunner';
import { ResultParser } from '../reports/resultParser';
import { Logger } from '../utils/logger';

export class TestPilotController implements vscode.Disposable {
  private controller: vscode.TestController;
  private disposables: vscode.Disposable[] = [];
  private fileWatcher?: vscode.FileSystemWatcher;

  constructor() {
    this.controller = vscode.tests.createTestController('testpilot', 'TestPilot');
    this.disposables.push(this.controller);

    // Create default Run Profile
    this.controller.createRunProfile(
      'Run Tests (TestPilot)',
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runHandler(request, token),
      true
    );

    this.controller.resolveHandler = async (item) => {
      if (!item) {
        await this.discoverAllTests();
      } else {
        await this.discoverTestsInItem(item);
      }
    };

    this.initWatcher();
  }

  public getController(): vscode.TestController {
    return this.controller;
  }

  private initWatcher(): void {
    this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{test,spec}.{js,ts,jsx,tsx}');
    this.disposables.push(this.fileWatcher);

    this.fileWatcher.onDidCreate((uri) => this.updateTestFile(uri));
    this.fileWatcher.onDidChange((uri) => this.updateTestFile(uri));
    this.fileWatcher.onDidDelete((uri) => {
      const id = uri.toString();
      this.controller.items.delete(id);
    });
  }

  public async discoverAllTests(): Promise<void> {
    const uris = await vscode.workspace.findFiles('**/*.{test,spec}.{js,ts,jsx,tsx}', '**/node_modules/**');
    for (const uri of uris) {
      await this.updateTestFile(uri);
    }
  }

  public async updateTestFile(uri: vscode.Uri): Promise<void> {
    const id = uri.toString();
    const label = path.basename(uri.fsPath);
    let fileItem = this.controller.items.get(id);

    if (!fileItem) {
      fileItem = this.controller.createTestItem(id, label, uri);
      this.controller.items.add(fileItem);
    }

    try {
      const content = fs.readFileSync(uri.fsPath, 'utf8');
      fileItem.children.replace([]); // Clear existing children
      this.parseTestsFromContent(content, fileItem, uri);
    } catch {
      // Ignore file read error if temporarily locked
    }
  }

  private parseTestsFromContent(content: string, parentItem: vscode.TestItem, uri: vscode.Uri): void {
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match describe('name', ...)
      const describeMatch = line.match(/describe\s*\(\s*['"`](.*?)['"`]/);
      if (describeMatch) {
        const title = describeMatch[1];
        const describeId = `${uri.toString()}#describe#${i}#${title}`;
        const describeItem = this.controller.createTestItem(describeId, `Suite: ${title}`, uri);
        describeItem.range = new vscode.Range(i, 0, i, line.length);
        parentItem.children.add(describeItem);
        continue;
      }

      // Match it('name', ...) or test('name', ...)
      const testMatch = line.match(/(?:it|test)\s*\(\s*['"`](.*?)['"`]/);
      if (testMatch) {
        const title = testMatch[1];
        const testId = `${uri.toString()}#test#${i}#${title}`;
        const testItem = this.controller.createTestItem(testId, title, uri);
        testItem.range = new vscode.Range(i, 0, i, line.length);
        parentItem.children.add(testItem);
      }
    }
  }

  private async discoverTestsInItem(item: vscode.TestItem): Promise<void> {
    if (item.uri) {
      await this.updateTestFile(item.uri);
    }
  }

  private async runHandler(request: vscode.TestRunRequest, token: vscode.CancellationToken): Promise<void> {
    const logger = Logger.getInstance();
    const run = this.controller.createTestRun(request);
    const queue: vscode.TestItem[] = [];

    if (request.include) {
      queue.push(...request.include);
    } else {
      this.controller.items.forEach((item) => queue.push(item));
    }

    // Find unique test files to execute
    const fileItems = new Map<string, vscode.TestItem>();
    for (const item of queue) {
      const fileUri = item.uri;
      if (fileUri) {
        const filePath = fileUri.fsPath;
        if (!fileItems.has(filePath)) {
          // If the item is a child, find the root file item
          const rootFileItem = this.controller.items.get(fileUri.toString()) || item;
          fileItems.set(filePath, rootFileItem);
        }
      }
    }

    for (const [filePath, rootItem] of fileItems) {
      if (token.isCancellationRequested) {
        break;
      }

      run.started(rootItem);
      logger.info(`Running tests for ${filePath} via TestPilot Test Controller...`);

      const env = await FrameworkDetector.detectEnvironment(filePath);
      const execution =
        env.framework === 'vitest'
          ? await VitestRunner.runTestFile(filePath, env, token)
          : await JestRunner.runTestFile(filePath, env, token);

      const parsed = ResultParser.parse(execution.stdout, execution.stderr, execution.durationMs);

      // Update child items
      if (rootItem.children.size > 0) {
        rootItem.children.forEach((child) => {
          // Look for matching assertion
          const matchingAssertion = parsed.suites
            .flatMap((s) => s.assertions)
            .find((a) => a.title.includes(child.label) || child.label.includes(a.title));

          if (matchingAssertion) {
            if (matchingAssertion.status === 'passed') {
              run.passed(child, matchingAssertion.durationMs);
            } else if (matchingAssertion.status === 'failed') {
              const msg = matchingAssertion.failureMessages.join('\n') || 'Test failed';
              run.failed(child, new vscode.TestMessage(msg), matchingAssertion.durationMs);
            } else {
              run.skipped(child);
            }
          } else {
            // Default according to execution success
            if (execution.success) {
              run.passed(child, 10);
            } else {
              run.failed(child, new vscode.TestMessage(execution.errorMessage || 'Test failed'));
            }
          }
        });
      }

      if (execution.success) {
        run.passed(rootItem, execution.durationMs);
      } else {
        const errorMsg = execution.errorMessage || 'One or more tests failed.';
        run.failed(rootItem, new vscode.TestMessage(errorMsg), execution.durationMs);
      }
    }

    run.end();
  }

  public dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
