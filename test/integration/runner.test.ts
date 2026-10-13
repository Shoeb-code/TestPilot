import * as assert from 'assert';
import { TestRunner } from '../../src/runners/testRunner';

describe('TestRunner Integration Tests', () => {
  it('should execute a safe command and return stdout and exit code 0', async () => {
    const isWindows = process.platform === 'win32';
    const command = 'node';
    const args = ['-e', 'console.log("TESTPILOT_RUNNER_OK")'];

    const result = await TestRunner.execute({
      cwd: process.cwd(),
      command,
      args,
      timeoutMs: 5000,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('TESTPILOT_RUNNER_OK'));
    assert.strictEqual(result.timedOut, false);
    assert.strictEqual(result.cancelled, false);
  });

  it('should handle non-zero exit code accurately without claiming success', async () => {
    const command = 'node';
    const args = ['-e', 'process.exit(2)'];

    const result = await TestRunner.execute({
      cwd: process.cwd(),
      command,
      args,
      timeoutMs: 5000,
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.exitCode, 2);
    assert.ok(result.errorMessage?.includes('2'));
  });

  it('should trigger timeout when execution exceeds timeout limit', async () => {
    const command = 'node';
    // Runs an intentional 3-second wait, with a 500ms timeout
    const args = ['-e', 'setTimeout(() => {}, 3000)'];

    const result = await TestRunner.execute({
      cwd: process.cwd(),
      command,
      args,
      timeoutMs: 500,
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.timedOut, true);
    assert.ok(result.errorMessage?.includes('timed out'));
  });
});
