import { describe, it, expect } from 'vitest';
import { testRegex, validateRegexPattern, escapeRegex } from '@/lib/regex/engine';
import { REGEX_PATTERNS, searchPatterns } from '@/lib/regex/patterns';

describe('Regex Engine', () => {
  describe('testRegex', () => {
    it('finds global matches with correct indices', () => {
      const result = testRegex('\\d+', 'g', 'Score: 10, Points: 250');
      expect(result.valid).toBe(true);
      expect(result.matchCount).toBe(2);
      expect(result.matches[0].value).toBe('10');
      expect(result.matches[1].value).toBe('250');
    });

    it('captures named and positional groups', () => {
      const result = testRegex('(?<year>\\d{4})-(?<month>\\d{2})', '', '2026-11-01');
      expect(result.valid).toBe(true);
      expect(result.matches[0].groups.year).toBe('2026');
      expect(result.matches[0].groups.month).toBe('11');
    });

    it('returns error gracefully for malformed regex', () => {
      const result = testRegex('(?<broken', 'g', 'test');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.matches).toEqual([]);
    });
  });

  describe('validateRegexPattern', () => {
    it('returns valid true for valid patterns', () => {
      expect(validateRegexPattern('^[a-z]+$', 'i').valid).toBe(true);
    });

    it('returns valid false for invalid syntax', () => {
      expect(validateRegexPattern('[unclosed', '').valid).toBe(false);
      expect(validateRegexPattern('test', 'invalid_flag').valid).toBe(false);
    });
  });

  describe('escapeRegex', () => {
    it('escapes all special regex meta-characters', () => {
      const literal = 'Hello. [World]? (1 + 2) * $100^';
      const escaped = escapeRegex(literal);
      const re = new RegExp(escaped);
      expect(re.test(literal)).toBe(true);
    });
  });
});

describe('Curated Regex Patterns Library', () => {
  function getPattern(id: string): RegExp {
    const item = REGEX_PATTERNS.find((p) => p.id === id);
    if (!item) throw new Error(`Pattern ${id} not found`);
    return new RegExp(item.pattern, item.flags.replace('g', ''));
  }

  it('validates email addresses', () => {
    expect(getPattern('email').test('user@example.com')).toBe(true);
    expect(getPattern('email').test('john.doe+tag@sub.domain.co.in')).toBe(true);
    expect(getPattern('email').test('invalid-email')).toBe(false);
  });

  it('validates web URLs', () => {
    expect(getPattern('url').test('https://bharatdevtool.com/tools')).toBe(true);
    expect(getPattern('url').test('http://example.com:8080/path?query=1')).toBe(true);
  });

  it('validates Indian mobile numbers', () => {
    const re = getPattern('phone-in');
    expect(re.test('+919876543210')).toBe(true);
    expect(re.test('9876543210')).toBe(true);
    expect(re.test('09876543210')).toBe(true);
    expect(re.test('1234567890')).toBe(false); // Does not start with 6-9
  });

  it('validates IPv4 addresses', () => {
    const re = getPattern('ipv4');
    expect(re.test('192.168.1.1')).toBe(true);
    expect(re.test('10.0.0.1')).toBe(true);
    expect(re.test('999.999.999.999')).toBe(false);
  });

  it('validates ISO 8601 dates', () => {
    const re = getPattern('date-iso');
    expect(re.test('2026-11-01')).toBe(true);
    expect(re.test('2026-13-45')).toBe(false);
  });

  it('searches library patterns by keywords', () => {
    const results = searchPatterns('phone');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((p) => p.name.includes('Phone'))).toBe(true);
  });
});
