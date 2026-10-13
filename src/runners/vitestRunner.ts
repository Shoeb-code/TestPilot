import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TestRunner, TestExecutionResult } from './testRunner';
import { ProjectEnvironment } from './frameworkDetector';

export class VitestRunner {
  /**
   * Run a test file with Vitest and return full execution results
   */
  public static async runTestFile(
    testFilePath: string,
    env: ProjectEnvironment,
    token?: vscode.CancellationToken,
    timeoutMs?: number
  ): Promise<TestExecutionResult> {
    const isWindows = process.platform === 'win32';
    const relativeTarget = path.relative(env.rootPath, testFilePath);

    // Look for local vitest binary in node_modules/.bin
    const localBin = path.join(env.rootPath, 'node_modules', '.bin', isWindows ? 'vitest.cmd' : 'vitest');

    let command: string;
    let args: string[];

    if (fs.existsSync(localBin)) {
      command = localBin;
      args = ['run', relativeTarget, '--reporter=json'];
    } else {
      command = isWindows ? 'npx.cmd' : 'npx';
      args = ['vitest', 'run', relativeTarget, '--reporter=json'];
    }

    return TestRunner.execute({
      cwd: env.rootPath,
      command,
      args,
      token,
      timeoutMs,
    });
  }
}
