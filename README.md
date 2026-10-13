# TestPilot — Intelligent VS Code Testing Assistant

[![VS Code](https://img.shields.io/badge/VS%20Code-^1.85.0-blue.svg)](https://code.visualstudio.com/)
[![Tests](https://img.shields.io/badge/Tests-24%20Passing-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Frameworks](https://img.shields.io/badge/Frameworks-Jest%20%7C%20Vitest-orange.svg)]()
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Offline%20First-success.svg)]()

**TestPilot** is an intelligent, developer-friendly VS Code extension that enables JavaScript and TypeScript engineers to generate unit tests, create test files, execute test suites, and diagnose failures without ever leaving their editor.

TestPilot operates **100% locally and offline** without requiring AI API keys, subscriptions, or external network requests. It uses the official TypeScript AST Compiler API to analyze function semantics and generate categorized unit test suites.

---

## 🌟 Key Features

| Feature | Description |
| :--- | :--- |
| **AST Source Analysis** | Parses selected JS/TS functions, arrow functions, classes, parameter types, default values, return expressions, and guard clauses. |
| **Categorized Test Generation** | Generates Positive, Negative, Boundary-Value, Edge-Case, and Error/Exception test scenarios. |
| **Interactive Review Webview** | Interactive UI matching native VS Code themes to select, edit test names/arguments, and preview before saving. |
| **Jest & Vitest Code Synthesis** | Emits clean, readable test files with relative module path imports, describe/it blocks, and framework assertions. |
| **Safe Process Execution** | Controlled process execution using argument arrays (no arbitrary shell strings), cancellation token support, and timeouts. |
| **Native Testing API Integration** | Native `vscode.TestController` integration providing discovered test hierarchies and live run results inside the VS Code Test Explorer. |
| **Structured Failure Diagnostics** | Detailed analytical reports categorizing likely causes (Assertion Mismatch, Unhandled Exception, Timeout, Null Dereference) with debugging steps. |
| **Modular Offline-First AI** | Optional AI integration for edge-case enrichment, disabled by default with zero external credentials needed. |

---

## 🚀 Quick Start

### 1. Launch in Extension Development Host
1. Clone or open this repository in VS Code.
2. Run `npm install` in your terminal.
3. Press **F5** (or navigate to **Run and Debug** -> **Run TestPilot Extension**).
4. A new VS Code Extension Development Host window will open with TestPilot active.

### 2. Generating Unit Tests for a Function
1. Open any JavaScript (`.js`) or TypeScript (`.ts`) file.
2. Place your cursor inside any function declaration, exported arrow function, or select the function block:
   ```typescript
   export function divide(a: number, b: number): number {
     if (b === 0) {
       throw new Error("Cannot divide by zero");
     }
     return a / b;
   }
   ```
3. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and execute:
   `TestPilot: Generate Test Cases`
4. The **TestPilot Review Panel** appears:
   - Review categorized test scenarios:
     - **[Error]** `should throw Error when b is 0`
     - **[Positive]** `should execute successfully with standard valid inputs`
     - **[Boundary]** `should handle boundary input for "a" = 0`
     - **[Negative]** `should handle negative or invalid value for "b" = -1`
   - Toggle checkboxes to select/deselect specific tests.
   - Edit test names or argument values inline.
   - Click **Generate Test File**.

### 3. Running Tests and Analyzing Failures
1. Open the generated test file (e.g., `math.test.ts`).
2. Run command: `TestPilot: Run Current Test File` (or right-click editor -> **TestPilot: Run Current Test File**).
3. Observe live execution status in the status bar (`$(check) TestPilot: Passed` or `$(error) TestPilot: Failed`).
4. If a test fails, click **Analyze Failure** to generate an instant diagnostic report with evidence, hypotheses, and suggested debugging steps.

---

## 📋 Extension Commands

All commands are accessible via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`), context menus, and the sidebar:

| Command | Identifier | Description |
| :--- | :--- | :--- |
| `TestPilot: Generate Test Cases` | `testpilot.generateTestCases` | Analyze selected function and open interactive review panel. |
| `TestPilot: Generate Test File` | `testpilot.generateTestFile` | Direct shortcut to generate and save a Jest/Vitest file. |
| `TestPilot: Run Current Test File` | `testpilot.runCurrentTestFile` | Safely execute the active or companion test suite. |
| `TestPilot: Analyze Test Failure` | `testpilot.analyzeTestFailure` | Diagnose failures, identify evidence, and formulate hypotheses. |
| `TestPilot: Show TestPilot` | `testpilot.showTestPilot` | Focus TestPilot sidebar and view environment status. |
| `TestPilot: Configure Settings` | `testpilot.configureSettings` | Configure framework preferences, naming patterns, and timeouts. |

---

## 🛠️ Architecture

```
testpilot/
├── src/
│   ├── extension.ts                # Entry point, command wiring, subscriptions
│   ├── commands/                   # VS Code command handlers
│   │   ├── generateTests.ts        # AST extraction & review panel launch
│   │   ├── generateTestFile.ts     # Test file generation & safe write
│   │   ├── runTests.ts             # Test runner execution & status updates
│   │   ├── analyzeFailure.ts       # Structured failure diagnostics
│   │   ├── showTestPilot.ts        # Quick launcher & sidebar focus
│   │   └── configureSettings.ts    # Settings page navigation
│   ├── analysis/                   # AST Analysis via TypeScript Compiler API
│   │   ├── functionAnalyzer.ts     # Declarations, arrow, params, returns, throws
│   │   ├── typeAnalyzer.ts         # Type inference & boundary value mapping
│   │   └── branchAnalyzer.ts       # Condition extraction (if/switch/ternary)
│   ├── generators/                 # Test Generation Engine
│   │   ├── testCaseGenerator.ts    # Scenario generation & confidence scoring
│   │   └── testFileGenerator.ts    # Jest & Vitest code generator
│   ├── runners/                    # Test Execution Engine
│   │   ├── testRunner.ts           # Safe process spawn, cancellation, timeout
│   │   ├── jestRunner.ts           # Jest CLI runner with JSON reporter
│   │   ├── vitestRunner.ts         # Vitest CLI runner with JSON reporter
│   │   └── frameworkDetector.ts    # Auto-detection for Jest/Vitest & package managers
│   ├── testing/                    # Native Testing API
│   │   └── testController.ts       # vscode.TestController discovery & run profiles
│   ├── reports/                    # Diagnostics & Output Parsing
│   │   ├── resultParser.ts         # JSON & raw output parser
│   │   └── failureAnalyzer.ts      # Structured hypotheses & actionable steps
│   ├── providers/                  # Modular AI Architecture
│   │   ├── providerTypes.ts        # AI provider interfaces & response schemas
│   │   └── aiProvider.ts           # Offline-first modular provider
│   ├── views/                      # UI Components
│   │   ├── testCaseReviewPanel.ts  # Theme-aware Webview review panel with CSP
│   │   ├── statusBar.ts            # Status bar indicator
│   │   └── overviewTreeProvider.ts # Sidebar assistant view
│   └── utils/                      # Utilities
│       ├── workspace.ts            # Safe file I/O & overwrite protection
│       ├── logger.ts               # Structured logger
│       └── validation.ts           # Input sanitization & security guards
├── test/
│   ├── unit/                       # Unit tests (AST, generators, parsers, analyzer)
│   ├── integration/                # Integration tests (runner, workspace)
│   ├── security/                   # Security tests (path traversal, input validation)
│   └── fixtures/                   # Runnable sample projects (JS & TS)
├── package.json                    # Extension manifest & scripts
├── tsconfig.json                   # TypeScript configuration
└── .vscodeignore                   # Packaging exclusions
```

---

## ⚙️ Configuration Settings

Configure TestPilot via VS Code Settings (`Ctrl+,` -> search `TestPilot`):

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `testpilot.defaultFramework` | `enum` | `"auto"` | Default test framework (`"auto"`, `"jest"`, `"vitest"`). |
| `testpilot.testFileNaming` | `enum` | `"[name].test.[ext]"` | Test file naming pattern (`"[name].test.[ext]"` or `"[name].spec.[ext]"`). |
| `testpilot.testDirectory` | `enum` | `"same-directory"` | Destination folder (`"same-directory"`, `"__tests__"`, `"test"`, `"tests"`). |
| `testpilot.executionTimeout` | `number` | `30000` | Process execution timeout in milliseconds. |
| `testpilot.preferredPackageManager` | `enum` | `"auto"` | Preferred package manager (`"auto"`, `"npm"`, `"yarn"`, `"pnpm"`). |
| `testpilot.ai.enabled` | `boolean` | `false` | Enable optional AI augmentation (100% offline by default). |
| `testpilot.ai.provider` | `enum` | `"offline"` | AI provider (`"offline"`, `"openai-compatible"`, `"anthropic-compatible"`). |
| `testpilot.ai.apiKey` | `string` | `""` | Optional API key for external AI provider. |

---

## 🧪 Testing TestPilot

TestPilot has a comprehensive test suite covering unit tests, integration tests, and security tests:

```bash
# Run all 24 tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run security tests
npm run test:security

# Run linting
npm run lint

# Run code formatter
npm run format
```

All 24 tests execute locally and pass cleanly.

---

## 📦 Packaging to .VSIX

To create an installable `.vsix` extension package:

```bash
# Package the extension
npm run package
```

The resulting file (`testpilot-1.0.0.vsix`) can be installed directly in any VS Code instance:
```bash
code --install-extension testpilot-1.0.0.vsix
```
Or via VS Code: Extensions view (`Ctrl+Shift+X`) -> `...` (More Actions) -> **Install from VSIX...**.

---

## 🔒 Security & Privacy

1. **Zero External Data Transmission**: By default, no code or telemetry is ever transmitted outside your machine.
2. **Safe Process Execution**: Tests are executed strictly using argument arrays (`child_process.spawn`) rather than unescaped shell strings, preventing command injection.
3. **Overwrite Guards**: TestPilot will never overwrite an existing file without explicit user confirmation in a modal dialog.
4. **Strict CSP**: Webview review panels enforce strict Content Security Policies with one-time nonces and restricted resource loading.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
