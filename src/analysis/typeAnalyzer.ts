export interface TypeCandidates {
  positive: unknown[];
  negative: unknown[];
  boundary: unknown[];
  edge: unknown[];
}

export class TypeAnalyzer {
  /**
   * Normalize and infer high-level type category from TypeScript annotation or default value
   */
  public static inferCategory(typeAnnotation?: string, defaultValue?: string): string {
    if (typeAnnotation) {
      const clean = typeAnnotation.trim().toLowerCase();
      if (clean === 'number') {
        return 'number';
      }
      if (clean === 'string') {
        return 'string';
      }
      if (clean === 'boolean') {
        return 'boolean';
      }
      if (clean.endsWith('[]') || clean.startsWith('array<')) {
        return 'array';
      }
      if (clean === 'object' || clean.startsWith('{')) {
        return 'object';
      }
      if (clean === 'any' || clean === 'unknown') {
        return 'any';
      }
      if (clean.includes('|')) {
        return 'union';
      }
    }

    if (defaultValue) {
      const clean = defaultValue.trim();
      if (/^-?\d+(\.\d+)?$/.test(clean)) {
        return 'number';
      }
      if (/^["'`].*["'`]$/.test(clean)) {
        return 'string';
      }
      if (clean === 'true' || clean === 'false') {
        return 'boolean';
      }
      if (clean.startsWith('[') && clean.endsWith(']')) {
        return 'array';
      }
      if (clean.startsWith('{') && clean.endsWith('}')) {
        return 'object';
      }
    }

    // Default fallback when untyped
    return 'any';
  }

  /**
   * Get rich candidate inputs for a specific parameter category
   */
  public static getCandidatesForCategory(category: string): TypeCandidates {
    switch (category) {
      case 'number':
        return {
          positive: [5, 10, 42],
          negative: [-1, -42],
          boundary: [0, 1, -1, 'Number.MAX_SAFE_INTEGER', 'Number.MIN_SAFE_INTEGER'],
          edge: ['NaN', 'Infinity', '-Infinity', 0.00001],
        };

      case 'string':
        return {
          positive: ['"hello"', '"test"', '"valid-input"'],
          negative: ['""', 'null', 'undefined'],
          boundary: ['""', '"a"', '"Lorem ipsum dolor sit amet"'],
          edge: ['"   "', '"\\n\\t"', '"🚀🔥"', '"<script>alert(1)</script>"', '"!@#$%^&*()"'],
        };

      case 'boolean':
        return {
          positive: [true],
          negative: [false],
          boundary: [true, false],
          edge: ['null', 'undefined', '0'],
        };

      case 'array':
        return {
          positive: ['[1, 2, 3]', '["a", "b", "c"]'],
          negative: ['null', 'undefined'],
          boundary: ['[]', '[1]', '[0]'],
          edge: ['new Array(1000).fill(1)', '[null, undefined]'],
        };

      case 'object':
        return {
          positive: ['{ id: 1, name: "test" }', '{ enabled: true }'],
          negative: ['null', 'undefined'],
          boundary: ['{}', '{ id: 0 }'],
          edge: ['Object.create(null)', '{ nested: { val: null } }'],
        };

      default:
        // Any / untyped
        return {
          positive: [10, '"sample"', true],
          negative: ['null', 'undefined', 'NaN'],
          boundary: [0, '""', '[]', '{}'],
          edge: ['-1', 'Infinity', '"   "'],
        };
    }
  }

  /**
   * Format JS value or expression into valid code literal
   */
  public static formatLiteral(val: unknown): string {
    if (typeof val === 'string') {
      // Check if it's already an expression or quoted
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'")) ||
        (val.startsWith('`') && val.endsWith('`')) ||
        val === 'null' ||
        val === 'undefined' ||
        val === 'NaN' ||
        val === 'Infinity' ||
        val === '-Infinity' ||
        val.startsWith('Number.') ||
        val.startsWith('new ') ||
        val.startsWith('Object.') ||
        val.startsWith('[') ||
        val.startsWith('{')
      ) {
        return val;
      }
      return JSON.stringify(val);
    }
    if (typeof val === 'number' || typeof val === 'boolean') {
      return String(val);
    }
    if (val === null) {
      return 'null';
    }
    if (val === undefined) {
      return 'undefined';
    }
    return JSON.stringify(val);
  }
}
