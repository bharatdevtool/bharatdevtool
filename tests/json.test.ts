import { describe, it, expect } from 'vitest';
import {
  formatJSON,
  minifyJSON,
  isValidJSON,
  escapeJSON,
  unescapeJSON,
  repairJSON,
  validateJSON,
} from '@/lib/json/formatter';
import { diffJSON, diffStats } from '@/lib/json/differ';

describe('JSON Formatter & Utilities', () => {
  describe('formatJSON', () => {
    it('formats a basic JSON object with standard 2-space indentation', () => {
      const input = '{"name":"John","age":30}';
      const expected = '{\n  "name": "John",\n  "age": 30\n}';
      expect(formatJSON(input)).toBe(expected);
    });

    it('formats with custom indentation', () => {
      const input = '{"a":1}';
      expect(formatJSON(input, 4)).toBe('{\n    "a": 1\n}');
    });

    it('formats nested arrays and objects', () => {
      const input = '[1,2,{"key":"value"}]';
      const result = formatJSON(input);
      expect(result).toContain('"key": "value"');
    });

    it('throws an error with descriptive message on invalid JSON', () => {
      expect(() => formatJSON('{"invalid": json}')).toThrowError(/Invalid JSON/);
    });
  });

  describe('minifyJSON', () => {
    it('minifies formatted JSON to a single compact line', () => {
      const input = '{\n  "name": "John",\n  "age": 30\n}';
      expect(minifyJSON(input)).toBe('{"name":"John","age":30}');
    });

    it('handles already minified JSON', () => {
      const input = '{"name":"John","age":30}';
      expect(minifyJSON(input)).toBe('{"name":"John","age":30}');
    });

    it('throws on invalid JSON input', () => {
      expect(() => minifyJSON('{broken')).toThrowError(/Invalid JSON/);
    });
  });

  describe('isValidJSON', () => {
    it('returns true for valid JSON object', () => {
      expect(isValidJSON('{"name":"John"}')).toBe(true);
    });

    it('returns true for valid primitives (arrays, numbers, booleans)', () => {
      expect(isValidJSON('[1, 2, 3]')).toBe(true);
      expect(isValidJSON('123')).toBe(true);
      expect(isValidJSON('"hello"')).toBe(true);
      expect(isValidJSON('true')).toBe(true);
    });

    it('returns false for invalid JSON syntax', () => {
      expect(isValidJSON('{"invalid": json}')).toBe(false);
      expect(isValidJSON('{name: "John"}')).toBe(false);
    });

    it('returns false for empty or whitespace-only strings', () => {
      expect(isValidJSON('')).toBe(false);
      expect(isValidJSON('   \n\t  ')).toBe(false);
    });
  });

  describe('escapeJSON & unescapeJSON', () => {
    it('escapes quotes and newlines in JSON strings', () => {
      const input = 'Hello "World"\nLine 2';
      const escaped = escapeJSON(input);
      expect(escaped).toContain('\\"');
      expect(escaped).toContain('\\n');
    });

    it('escapes tabs and carriage returns', () => {
      const input = 'Col1\tCol2\r\n';
      const escaped = escapeJSON(input);
      expect(escaped).toContain('\\t');
      expect(escaped).toContain('\\r');
    });

    it('round-trips correctly through unescapeJSON', () => {
      const input = 'He said: "Hello\\World"\nNext line';
      const escaped = escapeJSON(input);
      const unescaped = unescapeJSON(escaped);
      expect(unescaped).toBe(input);
    });
  });

  describe('repairJSON', () => {
    it('removes trailing commas from objects', () => {
      const input = '{"name":"John","age":30,}';
      const repaired = repairJSON(input);
      expect(isValidJSON(repaired)).toBe(true);
      expect(JSON.parse(repaired)).toEqual({ name: 'John', age: 30 });
    });

    it('removes trailing commas from arrays', () => {
      const input = '[1, 2, 3, ]';
      const repaired = repairJSON(input);
      expect(isValidJSON(repaired)).toBe(true);
      expect(JSON.parse(repaired)).toEqual([1, 2, 3]);
    });

    it('converts single quotes to double quotes', () => {
      const input = "{'name':'John','age':30}";
      const repaired = repairJSON(input);
      expect(isValidJSON(repaired)).toBe(true);
      expect(JSON.parse(repaired)).toEqual({ name: 'John', age: 30 });
    });

    it('quotes unquoted property keys', () => {
      const input = '{name: "John", age: 30}';
      const repaired = repairJSON(input);
      expect(isValidJSON(repaired)).toBe(true);
      expect(JSON.parse(repaired)).toEqual({ name: 'John', age: 30 });
    });

    it('strips single-line comments', () => {
      const input = '{\n  // User name\n  "name": "John"\n}';
      const repaired = repairJSON(input);
      expect(isValidJSON(repaired)).toBe(true);
      expect(JSON.parse(repaired)).toEqual({ name: 'John' });
    });

    it('strips multi-line comments', () => {
      const input = '{\n  /* Multi-line\n     comment */\n  "name": "John"\n}';
      const repaired = repairJSON(input);
      expect(isValidJSON(repaired)).toBe(true);
      expect(JSON.parse(repaired)).toEqual({ name: 'John' });
    });

    it('replaces undefined and NaN with null', () => {
      const input = '{"value": undefined, "num": NaN}';
      const repaired = repairJSON(input);
      expect(isValidJSON(repaired)).toBe(true);
      expect(JSON.parse(repaired)).toEqual({ value: null, num: null });
    });

    it('handles empty input gracefully by returning empty object', () => {
      expect(repairJSON('')).toBe('{}');
      expect(repairJSON('   \n\t  ')).toBe('{}');
    });
  });

  describe('validateJSON', () => {
    it('returns valid true for valid JSON', () => {
      const res = validateJSON('{"a": 1, "b": [2, 3]}');
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('returns valid false with error and position on malformed JSON', () => {
      const res = validateJSON('{\n  "a": 1,\n  "b": \n}');
      expect(res.valid).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});

describe('JSON Differ & Stats', () => {
  it('detects unchanged objects correctly', () => {
    const left = '{"name": "Alice", "age": 25}';
    const right = '{"name": "Alice", "age": 25}';
    const diff = diffJSON(left, right);
    const stats = diffStats(diff);
    expect(stats.added).toBe(0);
    expect(stats.removed).toBe(0);
    expect(stats.changed).toBe(0);
  });

  it('detects added keys in right object', () => {
    const left = '{"a": 1}';
    const right = '{"a": 1, "b": 2}';
    const diff = diffJSON(left, right);
    const stats = diffStats(diff);
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(0);
  });

  it('detects removed keys from left object', () => {
    const left = '{"a": 1, "b": 2}';
    const right = '{"a": 1}';
    const diff = diffJSON(left, right);
    const stats = diffStats(diff);
    expect(stats.added).toBe(0);
    expect(stats.removed).toBe(1);
  });

  it('detects modified values and nested differences', () => {
    const left = '{"user": {"name": "Alice", "role": "admin"}}';
    const right = '{"user": {"name": "Bob", "role": "admin"}}';
    const diff = diffJSON(left, right);
    const stats = diffStats(diff);
    expect(stats.changed).toBe(1);
  });
});

