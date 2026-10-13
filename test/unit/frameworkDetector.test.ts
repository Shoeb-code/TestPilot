import * as assert from 'assert';
import * as path from 'path';
import { FrameworkDetector } from '../../src/runners/frameworkDetector';

describe('FrameworkDetector Unit Tests', () => {
  it('should detect environment for active folder without throwing', async () => {
    const env = await FrameworkDetector.detectEnvironment(process.cwd());

    assert.ok(env.rootPath);
    assert.ok(env.framework === 'jest' || env.framework === 'vitest' || env.framework === 'unknown');
    assert.ok(env.packageManager === 'npm' || env.packageManager === 'yarn' || env.packageManager === 'pnpm');
    assert.ok(typeof env.runnerCommand === 'string');
  });
});
