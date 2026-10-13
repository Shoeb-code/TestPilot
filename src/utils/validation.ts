import * as path from 'path';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export class ValidationUtils {
  /**
   * Ensure a target path is safely within the expected base directory
   * and prevents path traversal attacks (e.g., ../../etc/passwd)
   */
  public static isSafePath(baseDir: string, targetPath: string): boolean {
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(targetPath);
    const relative = path.relative(resolvedBase, resolvedTarget);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  /**
   * Validate that a test file path does not contain illegal characters
   */
  public static validateFilePath(filePath: string): ValidationResult {
    if (!filePath || filePath.trim().length === 0) {
      return { valid: false, error: 'File path cannot be empty.' };
    }
    // Disallow null bytes and illegal control characters
    if (/[\0<>:"|?*]/.test(filePath.replace(/^[a-zA-Z]:/, ''))) {
      return { valid: false, error: 'File path contains illegal characters.' };
    }
    return { valid: true };
  }

  /**
   * Validate that a function name is a valid JS/TS identifier or string
   */
  public static isValidIdentifier(name: string): boolean {
    return /^[$A-Z_][0-9A-Z_$]*$/i.test(name);
  }

  /**
   * Sanitize string for display/logging
   */
  public static sanitizeString(input: string, maxLength: number = 2000): string {
    if (typeof input !== 'string') {
      return '';
    }
    const truncated = input.length > maxLength ? input.substring(0, maxLength) + '...[truncated]' : input;
    return truncated.replace(/\0/g, '');
  }

  /**
   * Validate AI test suggestion schema
   */
  public static validateAiScenarioPayload(payload: unknown): {
    valid: boolean;
    data?: {
      testName: string;
      category: string;
      inputArgs: unknown[];
      expectedResult?: unknown;
      expectedThrows?: boolean;
      expectedExceptionMessage?: string;
      reason: string;
    };
    error?: string;
  } {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Payload must be an object' };
    }
    const obj = payload as Record<string, unknown>;
    if (typeof obj.testName !== 'string' || obj.testName.trim().length === 0) {
      return { valid: false, error: 'Missing or invalid "testName"' };
    }
    if (typeof obj.category !== 'string') {
      return { valid: false, error: 'Missing or invalid "category"' };
    }
    if (!Array.isArray(obj.inputArgs)) {
      return { valid: false, error: '"inputArgs" must be an array' };
    }
    if (typeof obj.reason !== 'string') {
      return { valid: false, error: 'Missing or invalid "reason"' };
    }

    return {
      valid: true,
      data: {
        testName: obj.testName.trim(),
        category: obj.category.trim(),
        inputArgs: obj.inputArgs,
        expectedResult: obj.expectedResult,
        expectedThrows: typeof obj.expectedThrows === 'boolean' ? obj.expectedThrows : false,
        expectedExceptionMessage:
          typeof obj.expectedExceptionMessage === 'string' ? obj.expectedExceptionMessage : undefined,
        reason: obj.reason.trim(),
      },
    };
  }
}
