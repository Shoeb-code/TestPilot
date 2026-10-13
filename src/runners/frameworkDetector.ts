import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';

export type DetectedFramework = 'jest' | 'vitest' | 'unknown';
export type DetectedPackageManager = 'npm' | 'yarn' | 'pnpm';

export interface ProjectEnvironment {
  framework: DetectedFramework;
  packageManager: DetectedPackageManager;
  rootPath: string;
  hasConfigFile: boolean;
  configFile?: string;
  runnerCommand: string;
}

export class FrameworkDetector {
  /**
   * Detect test framework and package manager for a given file or workspace
   */
  public static async detectEnvironment(targetFilePath?: string): Promise<ProjectEnvironment> {
    const logger = Logger.getInstance();

    let rootPath = process.cwd();
    if (targetFilePath) {
      const uri = vscode.Uri.file(targetFilePath);
      const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
      if (wsFolder) {
        rootPath = wsFolder.uri.fsPath;
      } else {
        rootPath = path.dirname(targetFilePath);
      }
    } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    const config = vscode.workspace.getConfiguration('testpilot');
    const configuredFramework = config.get<string>('defaultFramework', 'auto');
    const configuredPm = config.get<string>('preferredPackageManager', 'auto');

    let detectedFramework: DetectedFramework = 'unknown';
    let detectedPm: DetectedPackageManager = 'npm';
    let hasConfigFile = false;
    let configFile: string | undefined;

    // 1. Detect package manager from lockfiles
    if (fs.existsSync(path.join(rootPath, 'pnpm-lock.yaml'))) {
      detectedPm = 'pnpm';
    } else if (fs.existsSync(path.join(rootPath, 'yarn.lock'))) {
      detectedPm = 'yarn';
    } else if (fs.existsSync(path.join(rootPath, 'package-lock.json'))) {
      detectedPm = 'npm';
    }

    if (configuredPm !== 'auto' && (configuredPm === 'npm' || configuredPm === 'yarn' || configuredPm === 'pnpm')) {
      detectedPm = configuredPm;
    }

    // 2. Detect framework from config files
    const vitestConfigs = [
      'vitest.config.ts',
      'vitest.config.js',
      'vitest.config.mjs',
      'vite.config.ts',
      'vite.config.js',
    ];
    for (const cfg of vitestConfigs) {
      const fullPath = path.join(rootPath, cfg);
      if (fs.existsSync(fullPath)) {
        detectedFramework = 'vitest';
        hasConfigFile = true;
        configFile = fullPath;
        break;
      }
    }

    if (detectedFramework === 'unknown') {
      const jestConfigs = [
        'jest.config.ts',
        'jest.config.js',
        'jest.config.mjs',
        'jest.config.cjs',
        'jest.config.json',
      ];
      for (const cfg of jestConfigs) {
        const fullPath = path.join(rootPath, cfg);
        if (fs.existsSync(fullPath)) {
          detectedFramework = 'jest';
          hasConfigFile = true;
          configFile = fullPath;
          break;
        }
      }
    }

    // 3. Inspect package.json dependencies
    const packageJsonPath = path.join(rootPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const raw = fs.readFileSync(packageJsonPath, 'utf8');
        const pkg = JSON.parse(raw);
        const allDeps = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {}),
        };

        if (detectedFramework === 'unknown') {
          if ('vitest' in allDeps) {
            detectedFramework = 'vitest';
          } else if ('jest' in allDeps || 'ts-jest' in allDeps || '@types/jest' in allDeps) {
            detectedFramework = 'jest';
          }
        }
      } catch (err) {
        logger.warn(`Could not parse package.json at ${packageJsonPath}: ${err}`);
      }
    }

    // 4. Fallback to user configuration or default
    if (configuredFramework !== 'auto' && (configuredFramework === 'jest' || configuredFramework === 'vitest')) {
      detectedFramework = configuredFramework;
    } else if (detectedFramework === 'unknown') {
      detectedFramework = 'jest'; // Reasonable default in JavaScript/TypeScript ecosystem
    }

    // Determine command binary
    const isWindows = process.platform === 'win32';
    let runnerCommand = detectedPm;
    if (isWindows && !runnerCommand.endsWith('.cmd')) {
      runnerCommand += '.cmd';
    }

    logger.info(`Detected environment for ${rootPath}: Framework=${detectedFramework}, PM=${detectedPm}`);

    return {
      framework: detectedFramework,
      packageManager: detectedPm,
      rootPath,
      hasConfigFile,
      configFile,
      runnerCommand,
    };
  }
}
