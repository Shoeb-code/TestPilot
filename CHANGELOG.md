# Changelog

All notable changes to the **TestPilot** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-13

### Added
- **Core AST Function Analysis**:
  - Full TypeScript Compiler API analysis of JavaScript and TypeScript functions.
  - Supports function declarations, exported functions, arrow functions, and method declarations.
  - Analyzes parameters, default arguments, return types, return expressions, guard clauses, and thrown exceptions.
- **Categorized Test Generation**:
  - Generates positive, negative, boundary-value, edge-case, and error/exception test scenarios.
  - Distinguishes clearly between deterministic suggestions and verified assertions.
- **Interactive Review Interface**:
  - Native theme-compatible Webview panel with strict Content Security Policy (CSP).
  - Checkbox selection, inline editable test names and input parameters, and instant regeneration.
- **Test File Authoring**:
  - Generates Jest and Vitest test files with proper import specifiers and describe/it structure.
  - Built-in safe file creation with overwrite protection and directory resolution.
- **Safe Test Execution**:
  - Controlled process execution using argument arrays without arbitrary shell expansion.
  - Real-time stdout/stderr capture, cancellation token support, and timeout guards.
  - Auto-detection for project test frameworks (Jest, Vitest) and package managers (`npm`, `pnpm`, `yarn`).
- **VS Code Native Testing API Integration**:
  - Custom `vscode.TestController` providing hierarchical test discovery in the VS Code Test Explorer.
  - Live test run profile with pass/fail tracking and failure message diagnostics.
- **Structured Failure Diagnostics**:
  - Detailed diagnostic reports classifying failure hypotheses (Assertion Mismatch, Unhandled Exception, Timeout, Null/Undefined Dereference, Module Resolution).
  - Actionable debugging steps and clickable source links (`file:line`).
- **Offline-First Modular AI Integration**:
  - Core features work 100% offline without any AI credentials.
  - Modular provider interface with strict JSON schema validation and explicit user consent prompts.
- **Developer Experience & Tooling**:
  - Pre-configured `.vscode/launch.json` for F5 Extension Development Host debugging.
  - Comprehensive unit, integration, and security test suites with 24 passing tests.
  - Runnable JavaScript and TypeScript fixture projects.
