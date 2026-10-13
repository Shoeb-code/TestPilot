import * as assert from 'assert';
import * as path from 'path';
import { WorkspaceUtils } from '../../src/utils/workspace';

describe('WorkspaceUtils Integration Tests', () => {
  it('should compute relative import paths cleanly with forward slashes', () => {
    const testPath = 'C:\\workspace\\project\\src\\__tests__\\math.test.ts';
    const srcPath = 'C:\\workspace\\project\\src\\math.ts';

    const rel = WorkspaceUtils.computeRelativeImportPath(testPath, srcPath);
    assert.strictEqual(rel, '../math');
  });

  it('should compute relative import paths in same directory', () => {
    const testPath = '/workspace/src/math.test.ts';
    const srcPath = '/workspace/src/math.ts';

    const rel = WorkspaceUtils.computeRelativeImportPath(testPath, srcPath);
    assert.strictEqual(rel, './math');
  });

  it('should correctly identify test files by naming convention', () => {
    assert.strictEqual(WorkspaceUtils.isTestFile('math.test.ts'), true);
    assert.strictEqual(WorkspaceUtils.isTestFile('math.spec.js'), true);
    assert.strictEqual(WorkspaceUtils.isTestFile('src/__tests__/calc.ts'), true);
    assert.strictEqual(WorkspaceUtils.isTestFile('math.ts'), false);
    assert.strictEqual(WorkspaceUtils.isTestFile('component.tsx'), false);
  });
});
