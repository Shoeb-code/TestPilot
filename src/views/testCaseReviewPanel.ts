import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { AnalyzedFunction } from '../analysis/functionAnalyzer';
import { TestCase, TestCaseGenerator } from '../generators/testCaseGenerator';
import { TestFileGenerator, TestFramework } from '../generators/testFileGenerator';
import { WorkspaceUtils } from '../utils/workspace';
import { FrameworkDetector } from '../runners/frameworkDetector';
import { ModularAiProvider } from '../providers/aiProvider';
import { Logger } from '../utils/logger';

export class TestCaseReviewPanel {
  public static currentPanel: TestCaseReviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private analyzedFunc: AnalyzedFunction;
  private testCases: TestCase[];
  private framework: TestFramework = 'jest';
  private aiProvider = new ModularAiProvider();

  private constructor(panel: vscode.WebviewPanel, func: AnalyzedFunction, cases: TestCase[]) {
    this.panel = panel;
    this.analyzedFunc = func;
    this.testCases = cases;

    this.initFramework();
    this.updateWebview();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message);
      },
      null,
      this.disposables
    );
  }

  public static render(func: AnalyzedFunction, cases: TestCase[]): TestCaseReviewPanel {
    const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

    if (TestCaseReviewPanel.currentPanel) {
      TestCaseReviewPanel.currentPanel.analyzedFunc = func;
      TestCaseReviewPanel.currentPanel.testCases = cases;
      TestCaseReviewPanel.currentPanel.panel.reveal(column);
      TestCaseReviewPanel.currentPanel.updateWebview();
      return TestCaseReviewPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel('testpilotReview', `TestPilot: ${func.name}`, column, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });

    TestCaseReviewPanel.currentPanel = new TestCaseReviewPanel(panel, func, cases);
    return TestCaseReviewPanel.currentPanel;
  }

  private async initFramework(): Promise<void> {
    const env = await FrameworkDetector.detectEnvironment(this.analyzedFunc.filePath);
    this.framework = env.framework === 'vitest' ? 'vitest' : 'jest';
    this.updateWebview();
  }

  private async handleMessage(message: { command: string; [key: string]: any }): Promise<void> {
    const logger = Logger.getInstance();

    switch (message.command) {
      case 'toggleCase': {
        const id = message.id;
        const tc = this.testCases.find((c) => c.id === id);
        if (tc) {
          tc.selected = !tc.selected;
        }
        break;
      }

      case 'toggleAll': {
        const select = Boolean(message.select);
        for (const tc of this.testCases) {
          tc.selected = select;
        }
        this.updateWebview();
        break;
      }

      case 'updateCase': {
        const { id, testName, inputArgsStr } = message;
        const tc = this.testCases.find((c) => c.id === id);
        if (tc) {
          tc.testName = testName;
          tc.inputArgs = inputArgsStr.split(',').map((s: string) => s.trim());
        }
        break;
      }

      case 'setFramework': {
        this.framework = message.framework === 'vitest' ? 'vitest' : 'jest';
        this.updateWebview();
        break;
      }

      case 'regenerate': {
        this.testCases = TestCaseGenerator.generateTestCases(this.analyzedFunc);
        this.updateWebview();
        vscode.window.showInformationMessage('Regenerated deterministic test cases.');
        break;
      }

      case 'requestAi': {
        const res = await this.aiProvider.generateAdditionalCases({
          functionName: this.analyzedFunc.name,
          sourceCode: this.analyzedFunc.sourceCode,
          parameters: this.analyzedFunc.parameters.map((p) => p.name),
          existingCasesCount: this.testCases.length,
        });

        if (res.success && res.testCases.length > 0) {
          this.testCases.push(...res.testCases);
          this.updateWebview();
          vscode.window.showInformationMessage(`Added ${res.testCases.length} AI-suggested edge cases for review.`);
        } else {
          vscode.window.showWarningMessage(res.errorMessage || 'No additional cases could be generated.');
        }
        break;
      }

      case 'generateFile': {
        const selectedCount = this.testCases.filter((c) => c.selected).length;
        if (selectedCount === 0) {
          vscode.window.showWarningMessage('Please select at least one test case to generate.');
          return;
        }

        const suggestedPath = WorkspaceUtils.computeSuggestedtestFilePath(this.analyzedFunc.filePath);
        const relImport = WorkspaceUtils.computeRelativeImportPath(suggestedPath, this.analyzedFunc.filePath);

        const content = TestFileGenerator.generateTestFile(this.analyzedFunc, {
          framework: this.framework,
          relativeImportPath: relImport,
          testCases: this.testCases,
        });

        const saveRes = await WorkspaceUtils.safeWriteFile({
          suggestedPath,
          content,
          promptOverwrite: true,
        });

        if (saveRes.saved && saveRes.filePath) {
          vscode.window
            .showInformationMessage(
              `Generated ${this.framework.toUpperCase()} test file at ${saveRes.filePath}`,
              'Open File'
            )
            .then(async (action) => {
              if (action === 'Open File') {
                const doc = await vscode.workspace.openTextDocument(saveRes.filePath!);
                await vscode.window.showTextDocument(doc);
              }
            });
        }
        break;
      }
    }
  }

  private updateWebview(): void {
    this.panel.webview.html = this.getHtml();
  }

  private getNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private getHtml(): string {
    const nonce = this.getNonce();
    const cspSource = this.panel.webview.cspSource;

    const func = this.analyzedFunc;
    const cases = this.testCases;
    const selectedCount = cases.filter((c) => c.selected).length;

    const categoryBadge = (cat: string) => {
      let bg = '#3b82f6';
      if (cat === 'Positive') {
        bg = '#10b981';
      }
      if (cat === 'Negative') {
        bg = '#f59e0b';
      }
      if (cat === 'Boundary') {
        bg = '#6366f1';
      }
      if (cat === 'Edge') {
        bg = '#8b5cf6';
      }
      if (cat === 'Error') {
        bg = '#ef4444';
      }

      return `<span class="badge" style="background:${bg};">${cat}</span>`;
    };

    const caseCards = cases
      .map(
        (c) => `
      <div class="card ${c.selected ? 'card-selected' : ''}" id="card-${c.id}">
        <div class="card-header">
          <label class="checkbox-container">
            <input type="checkbox" id="check-${c.id}" ${c.selected ? 'checked' : ''} onchange="toggleCase('${c.id}')" />
            <span class="checkmark"></span>
          </label>
          <div class="card-title-group">
            <input type="text" class="test-name-input" id="name-${c.id}" value="${this.escapeHtml(c.testName)}" onchange="updateCase('${c.id}')" />
            <div class="badges">
              ${categoryBadge(c.category)}
              <span class="confidence-tag">${c.confidence}</span>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="meta-row">
            <span class="meta-label">Inputs:</span>
            <input type="text" class="input-args-input" id="args-${c.id}" value="${this.escapeHtml(c.inputArgs.join(', '))}" onchange="updateCase('${c.id}')" />
          </div>
          <div class="meta-row">
            <span class="meta-label">Expectation:</span>
            <span class="expectation-text">
              ${c.expectedThrows ? `Throws <code>${c.expectedExceptionType || 'Error'}</code> (${this.escapeHtml(c.expectedExceptionMessage || 'any message')})` : c.expectedResult !== undefined ? `Returns <code>${this.escapeHtml(c.expectedResult)}</code>` : 'Returns valid result (Confirm assertion)'}
            </span>
          </div>
          <p class="reason-text">${this.escapeHtml(c.reason)}</p>
          ${c.confidenceNote ? `<p class="note-text"><em>⚠️ ${this.escapeHtml(c.confidenceNote)}</em></p>` : ''}
        </div>
      </div>
    `
      )
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TestPilot: ${this.escapeHtml(func.name)}</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --border: var(--vscode-panel-border, rgba(128, 128, 128, 0.2));
      --btn-bg: var(--vscode-button-background);
      --btn-fg: var(--vscode-button-foreground);
      --btn-hover: var(--vscode-button-hoverBackground);
      --sec-bg: var(--vscode-button-secondaryBackground, #3a3d41);
      --sec-fg: var(--vscode-button-secondaryForeground, #ffffff);
      --input-bg: var(--vscode-input-background);
      --input-fg: var(--vscode-input-foreground);
      --card-bg: var(--vscode-sideBar-background, rgba(255, 255, 255, 0.04));
    }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      margin: 0;
      padding: 20px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 20px;
    }
    .title-group h1 {
      margin: 0 0 6px 0;
      font-size: 1.4rem;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .meta-subtitle {
      font-size: 0.85rem;
      opacity: 0.8;
    }
    .toolbar {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 16px;
      padding: 12px;
      background: var(--card-bg);
      border-radius: 6px;
      border: 1px solid var(--border);
    }
    .btn {
      background: var(--btn-bg);
      color: var(--btn-fg);
      border: none;
      padding: 6px 14px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn:hover { background: var(--btn-hover); }
    .btn-secondary {
      background: var(--sec-bg);
      color: var(--sec-fg);
    }
    .btn-secondary:hover { opacity: 0.9; }
    select {
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--border);
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .card-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 14px;
      transition: border-color 0.15s ease;
    }
    .card-selected {
      border-color: var(--btn-bg);
    }
    .card-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .card-title-group {
      flex: 1;
    }
    .test-name-input {
      width: 100%;
      background: transparent;
      color: var(--fg);
      border: 1px solid transparent;
      padding: 4px 6px;
      font-size: 0.95rem;
      font-weight: 600;
      border-radius: 4px;
    }
    .test-name-input:focus {
      background: var(--input-bg);
      border-color: var(--btn-bg);
      outline: none;
    }
    .badges {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 4px;
    }
    .badge {
      font-size: 0.72rem;
      color: #fff;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .confidence-tag {
      font-size: 0.75rem;
      opacity: 0.75;
      font-style: italic;
    }
    .card-body {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--border);
    }
    .meta-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
      font-size: 0.85rem;
    }
    .meta-label {
      width: 85px;
      font-weight: 600;
      opacity: 0.8;
    }
    .input-args-input {
      flex: 1;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--border);
      padding: 4px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.85rem;
    }
    .expectation-text {
      font-size: 0.85rem;
    }
    .reason-text {
      font-size: 0.85rem;
      margin: 8px 0 4px 0;
      opacity: 0.9;
    }
    .note-text {
      font-size: 0.8rem;
      margin: 4px 0 0 0;
      opacity: 0.8;
      color: #f59e0b;
    }
    code {
      background: rgba(128, 128, 128, 0.15);
      padding: 2px 5px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-group">
      <h1>🚀 TestPilot: <code>${this.escapeHtml(func.name)}</code></h1>
      <div class="meta-subtitle">
        Language: <strong>${func.language}</strong> | File: <code>${this.escapeHtml(func.filePath)}</code> | Line: ${func.startLine}-${func.endLine}
      </div>
    </div>
    <div>
      <button class="btn" onclick="generateFile()">✨ Generate Test File (${selectedCount} selected)</button>
    </div>
  </div>

  <div class="toolbar">
    <label>Framework:
      <select id="framework-select" onchange="setFramework(this.value)">
        <option value="jest" ${this.framework === 'jest' ? 'selected' : ''}>Jest</option>
        <option value="vitest" ${this.framework === 'vitest' ? 'selected' : ''}>Vitest</option>
      </select>
    </label>
    <button class="btn btn-secondary" onclick="toggleAll(true)">Select All</button>
    <button class="btn btn-secondary" onclick="toggleAll(false)">Deselect All</button>
    <button class="btn btn-secondary" onclick="regenerate()">🔄 Regenerate</button>
    <button class="btn btn-secondary" onclick="requestAi()">✨ Ask AI for Edge Cases</button>
  </div>

  <div class="card-list">
    ${caseCards}
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    function toggleCase(id) {
      vscode.postMessage({ command: 'toggleCase', id });
      const card = document.getElementById('card-' + id);
      const chk = document.getElementById('check-' + id);
      if (card && chk) {
        if (chk.checked) {
          card.classList.add('card-selected');
        } else {
          card.classList.remove('card-selected');
        }
      }
    }

    function toggleAll(select) {
      vscode.postMessage({ command: 'toggleAll', select });
    }

    function updateCase(id) {
      const name = document.getElementById('name-' + id)?.value;
      const args = document.getElementById('args-' + id)?.value;
      vscode.postMessage({ command: 'updateCase', id, testName: name, inputArgsStr: args });
    }

    function setFramework(framework) {
      vscode.postMessage({ command: 'setFramework', framework });
    }

    function regenerate() {
      vscode.postMessage({ command: 'regenerate' });
    }

    function requestAi() {
      vscode.postMessage({ command: 'requestAi' });
    }

    function generateFile() {
      vscode.postMessage({ command: 'generateFile' });
    }
  </script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public dispose(): void {
    TestCaseReviewPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
