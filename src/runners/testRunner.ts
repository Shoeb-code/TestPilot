import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { Logger } from '../utils/logger';

export interface ExecutionOptions {
  cwd: string;
  command: string;
  args: string[];
  timeoutMs?: number;
  token?: vscode.CancellationToken;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

export interface TestExecutionResult {
  success: boolean;
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  cancelled: boolean;
  timedOut: boolean;
  command: string;
  args: string[];
  errorMessage?: string;
}

export class TestRunner {
  /**
   * Execute a test runner binary safely using controlled child_process.spawn with an argument array
   */
  public static async execute(options: ExecutionOptions): Promise<TestExecutionResult> {
    const logger = Logger.getInstance();
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? 30000;

    let stdout = '';
    let stderr = '';
    let isCancelled = false;
    let isTimedOut = false;
    let childProcess: ChildProcess | undefined;

    logger.info(`Starting execution: ${options.command} ${options.args.join(' ')} in ${options.cwd}`);

    return new Promise<TestExecutionResult>((resolve) => {
      let timeoutHandle: NodeJS.Timeout | undefined;

      // Handle cancellation token if provided
      let tokenListener: vscode.Disposable | undefined;
      if (options.token) {
        tokenListener = options.token.onCancellationRequested(() => {
          isCancelled = true;
          logger.warn(`Execution cancelled by user.`);
          if (childProcess && !childProcess.killed) {
            try {
              if (process.platform === 'win32') {
                // Windows process tree kill
                spawn('taskkill', ['/pid', childProcess.pid!.toString(), '/f', '/t']);
              } else {
                childProcess.kill('SIGKILL');
              }
            } catch (e) {
              logger.error(`Error killing child process: ${e}`);
            }
          }
        });
      }

      // Handle timeout
      timeoutHandle = setTimeout(() => {
        isTimedOut = true;
        logger.error(`Execution timed out after ${timeoutMs}ms.`);
        if (childProcess && !childProcess.killed) {
          try {
            if (process.platform === 'win32') {
              spawn('taskkill', ['/pid', childProcess.pid!.toString(), '/f', '/t']);
            } else {
              childProcess.kill('SIGKILL');
            }
          } catch (e) {
            logger.error(`Error killing child process on timeout: ${e}`);
          }
        }
      }, timeoutMs);

      try {
        const isBatchScript =
          process.platform === 'win32' &&
          (options.command.toLowerCase().endsWith('.cmd') || options.command.toLowerCase().endsWith('.bat'));

        childProcess = spawn(options.command, options.args, {
          cwd: options.cwd,
          env: {
            ...process.env,
            CI: 'true',
            FORCE_COLOR: '0',
            NODE_ENV: 'test',
          },
          shell: isBatchScript,
          windowsHide: true,
        });

        childProcess.stdout?.on('data', (chunk) => {
          const str = chunk.toString();
          stdout += str;
          if (options.onStdout) {
            options.onStdout(str);
          }
        });

        childProcess.stderr?.on('data', (chunk) => {
          const str = chunk.toString();
          stderr += str;
          if (options.onStderr) {
            options.onStderr(str);
          }
        });

        childProcess.on('error', (err) => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          if (tokenListener) {
            tokenListener.dispose();
          }

          const durationMs = Date.now() - startTime;
          logger.error(`Child process spawn error: ${err.message}`);
          resolve({
            success: false,
            exitCode: null,
            durationMs,
            stdout,
            stderr,
            cancelled: isCancelled,
            timedOut: isTimedOut,
            command: options.command,
            args: options.args,
            errorMessage: `Failed to launch test runner: ${err.message}. Ensure dependencies and package manager are installed.`,
          });
        });

        childProcess.on('close', (code) => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          if (tokenListener) {
            tokenListener.dispose();
          }

          const durationMs = Date.now() - startTime;
          const success = code === 0 && !isCancelled && !isTimedOut;

          let errorMessage: string | undefined;
          if (isCancelled) {
            errorMessage = 'Test execution was cancelled by the user.';
          } else if (isTimedOut) {
            errorMessage = `Test execution timed out after ${timeoutMs / 1000} seconds.`;
          } else if (code !== 0) {
            errorMessage = `Tests exited with non-zero status code: ${code}.`;
          }

          resolve({
            success,
            exitCode: code,
            durationMs,
            stdout,
            stderr,
            cancelled: isCancelled,
            timedOut: isTimedOut,
            command: options.command,
            args: options.args,
            errorMessage,
          });
        });
      } catch (err: unknown) {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        if (tokenListener) {
          tokenListener.dispose();
        }

        const durationMs = Date.now() - startTime;
        const msg = err instanceof Error ? err.message : String(err);
        resolve({
          success: false,
          exitCode: null,
          durationMs,
          stdout,
          stderr,
          cancelled: isCancelled,
          timedOut: isTimedOut,
          command: options.command,
          args: options.args,
          errorMessage: `Exception launching test runner: ${msg}`,
        });
      }
    });
  }
}
