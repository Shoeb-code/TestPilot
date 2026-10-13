import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ValidationUtils } from './validation';
import { Logger } from './logger';

export interface SaveFileOptions {
  suggestedPath: string;
  content: string;
  promptOverwrite?: boolean;
}

export interface SaveFileResult {
  saved: boolean;
  filePath?: string;
  cancelled?: boolean;
  error?: string;
}

export class WorkspaceUtils {
  /**
   * Get the workspace folder containing the given document URI, or the first workspace folder
   */
  public static getWorkspaceFolder(documentUri?: vscode.Uri): vscode.WorkspaceFolder | undefined {
    if (documentUri) {
      const folder = vscode.workspace.getWorkspaceFolder(documentUri);
      if (folder) {
        return folder;
      }
    }
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0] : undefined;
  }

  /**
   * Compute relative import specifier from test file location to source file location
   * Uses forward slashes and strips .ts/.js/.tsx/.jsx extensions according to standard ESM/CJS rules.
   */
  public static computeRelativeImportPath(testFilePath: string, sourceFilePath: string): string {
    const testDir = path.dirname(testFilePath);
    let relPath = path.relative(testDir, sourceFilePath);

    // Convert Windows backslashes to forward slashes for imports
    relPath = relPath.replace(/\\/g, '/');

    // Strip extension (.ts, .tsx, .js, .jsx)
    relPath = relPath.replace(/\.(ts|tsx|js|jsx)$/, '');

    // Prepend ./ if in same folder or descending
    if (!relPath.startsWith('.')) {
      relPath = './' + relPath;
    }

    return relPath;
  }

  /**
   * Calculate suggested test file path for a given source file based on settings
   */
  public static computeSuggestedtestFilePath(sourceFilePath: string): string {
    const config = vscode.workspace.getConfiguration('testpilot');
    const namingPattern: string = config.get('testFileNaming', '[name].test.[ext]');
    const targetDirSetting: string = config.get('testDirectory', 'same-directory');

    const parsed = path.parse(sourceFilePath);
    const sourceDir = parsed.dir;
    const baseName = parsed.name;
    const extWithDot = parsed.ext; // e.g. .ts or .js
    const ext = extWithDot.startsWith('.') ? extWithDot.substring(1) : extWithDot;

    // Build filename
    const filename = namingPattern.replace('[name]', baseName).replace('[ext]', ext);

    let targetDir = sourceDir;
    if (targetDirSetting === '__tests__') {
      targetDir = path.join(sourceDir, '__tests__');
    } else if (targetDirSetting === 'test' || targetDirSetting === 'tests') {
      // Find workspace root
      const wsFolder = this.getWorkspaceFolder(vscode.Uri.file(sourceFilePath));
      if (wsFolder) {
        targetDir = path.join(wsFolder.uri.fsPath, targetDirSetting);
      } else {
        targetDir = path.join(sourceDir, targetDirSetting);
      }
    }

    return path.join(targetDir, filename);
  }

  /**
   * Safely write a file to disk with strict overwrite confirmation
   */
  public static async safeWriteFile(options: SaveFileOptions): Promise<SaveFileResult> {
    const logger = Logger.getInstance();
    const filePath = path.resolve(options.suggestedPath);

    // Security validation
    const pathVal = ValidationUtils.validateFilePath(filePath);
    if (!pathVal.valid) {
      logger.error(`Invalid file path: ${pathVal.error}`);
      return { saved: false, error: pathVal.error };
    }

    const fileUri = vscode.Uri.file(filePath);

    // Check if target already exists
    let fileExists = false;
    try {
      await vscode.workspace.fs.stat(fileUri);
      fileExists = true;
    } catch {
      fileExists = false;
    }

    if (fileExists && options.promptOverwrite !== false) {
      const choice = await vscode.window.showWarningMessage(
        `File already exists: "${path.basename(filePath)}". Overwrite existing file?`,
        { modal: true },
        'Overwrite',
        'Choose New Location',
        'Cancel'
      );

      if (!choice || choice === 'Cancel') {
        logger.info(`User cancelled overwriting ${filePath}`);
        return { saved: false, cancelled: true };
      }

      if (choice === 'Choose New Location') {
        const selectedUri = await vscode.window.showSaveDialog({
          defaultUri: fileUri,
          saveLabel: 'Save Test File',
        });
        if (!selectedUri) {
          return { saved: false, cancelled: true };
        }
        return this.safeWriteFile({
          ...options,
          suggestedPath: selectedUri.fsPath,
          promptOverwrite: true,
        });
      }
    }

    try {
      // Ensure directory exists
      const dirUri = vscode.Uri.file(path.dirname(filePath));
      await vscode.workspace.fs.createDirectory(dirUri);

      // Write content as UTF-8 buffer
      const buffer = Buffer.from(options.content, 'utf8');
      await vscode.workspace.fs.writeFile(fileUri, buffer);

      logger.info(`Successfully wrote test file to: ${filePath}`);
      return { saved: true, filePath };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to write file ${filePath}: ${errorMsg}`);
      return { saved: false, error: errorMsg };
    }
  }

  /**
   * Check if a file is a test file by its name pattern
   */
  public static isTestFile(filePath: string): boolean {
    const filename = path.basename(filePath);
    return /\.(test|spec)\.(ts|js|tsx|jsx|mjs|cjs)$/i.test(filename) || /[\\/]__tests__[\\/]/.test(filePath);
  }
}
