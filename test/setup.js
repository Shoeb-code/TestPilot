const path = require('path');

// Comprehensive VS Code API mock for standalone unit/integration test runner
const vscodeMock = {
  Uri: {
    file: (fsPath) => ({
      fsPath: path.resolve(fsPath),
      toString: () => 'file:///' + path.resolve(fsPath).replace(/\\/g, '/'),
    }),
    parse: (uriStr) => ({
      fsPath: uriStr,
      toString: () => uriStr,
    }),
  },
  workspace: {
    workspaceFolders: [
      {
        uri: {
          fsPath: process.cwd(),
          toString: () => 'file:///' + process.cwd().replace(/\\/g, '/'),
        },
        name: 'test-workspace',
        index: 0,
      },
    ],
    getWorkspaceFolder: (_uri) => ({
      uri: {
        fsPath: process.cwd(),
        toString: () => 'file:///' + process.cwd().replace(/\\/g, '/'),
      },
      name: 'test-workspace',
      index: 0,
    }),
    getConfiguration: (_section) => ({
      get: (_key, defaultValue) => defaultValue,
    }),
    fs: {
      stat: async () => ({ size: 100 }),
      writeFile: async () => {},
      createDirectory: async () => {},
    },
    createFileSystemWatcher: () => ({
      onDidCreate: () => ({ dispose: () => {} }),
      onDidChange: () => ({ dispose: () => {} }),
      onDidDelete: () => ({ dispose: () => {} }),
      dispose: () => {},
    }),
    findFiles: async () => [],
    openTextDocument: async (content) => ({
      getText: () => (typeof content === 'string' ? content : content?.content || ''),
      uri: { fsPath: 'untitled.md' },
    }),
  },
  window: {
    activeTextEditor: undefined,
    createOutputChannel: (_name) => ({
      appendLine: () => {},
      append: () => {},
      show: () => {},
      dispose: () => {},
    }),
    createStatusBarItem: () => ({
      text: '',
      tooltip: '',
      show: () => {},
      hide: () => {},
      dispose: () => {},
    }),
    showInformationMessage: async () => undefined,
    showWarningMessage: async () => undefined,
    showErrorMessage: async () => undefined,
    showQuickPick: async () => undefined,
    showInputBox: async () => undefined,
    showTextDocument: async () => {},
    withProgress: async (_opts, task) => {
      const progress = { report: () => {} };
      const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };
      return task(progress, token);
    },
    registerTreeDataProvider: () => ({ dispose: () => {} }),
    createWebviewPanel: () => ({
      webview: {
        cspSource: 'https://*.vscode-cdn.net',
        html: '',
        onDidReceiveMessage: () => ({ dispose: () => {} }),
        postMessage: async () => true,
      },
      reveal: () => {},
      dispose: () => {},
      onDidDispose: () => ({ dispose: () => {} }),
    }),
  },
  commands: {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: async () => undefined,
  },
  tests: {
    createTestController: (_id, _label) => ({
      items: {
        get: () => undefined,
        add: () => {},
        delete: () => {},
        replace: () => {},
        forEach: () => {},
      },
      createTestItem: (id, label, uri) => ({
        id,
        label,
        uri,
        children: {
          add: () => {},
          replace: () => {},
          forEach: () => {},
          size: 0,
        },
      }),
      createRunProfile: () => {},
      dispose: () => {},
    }),
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
  ProgressLocation: {
    SourceControl: 1,
    Window: 10,
    Notification: 15,
  },
  ViewColumn: {
    Active: -1,
    Beside: -2,
    One: 1,
    Two: 2,
  },
  TestRunProfileKind: {
    Run: 1,
    Debug: 2,
    Coverage: 3,
  },
  ThemeColor: class ThemeColor {
    constructor(id) {
      this.id = id;
    }
  },
  ThemeIcon: class ThemeIcon {
    constructor(id) {
      this.id = id;
    }
  },
  TreeItem: class TreeItem {
    constructor(label, collapsibleState) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  },
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
  },
  EventEmitter: class EventEmitter {
    constructor() {
      this.event = () => ({ dispose: () => {} });
    }
    fire() {}
  },
  Range: class Range {
    constructor(startLine, startCol, endLine, endCol) {
      this.startLine = startLine;
      this.startCol = startCol;
      this.endLine = endLine;
      this.endCol = endCol;
    }
  },
  TestMessage: class TestMessage {
    constructor(message) {
      this.message = message;
    }
  },
};

// Intercept 'vscode' import in Node.js module resolution
const Module = require('module');
const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
  if (request === 'vscode') {
    return vscodeMock;
  }
  return originalLoad.apply(this, arguments);
};
