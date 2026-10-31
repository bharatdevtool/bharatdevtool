// lib/regex/engine.ts — Ported from assets/js/regex-engine.js

export interface RegexMatch {
  value: string;
  index: number;
  end: number;
  groups: Record<string, string>;
}

export interface RegexTestResult {
  valid: boolean;
  matches: RegexMatch[];
  error?: string;
  matchCount: number;
}

export function testRegex(pattern: string, flags: string, input: string): RegexTestResult {
  try {
    const re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
    const matches: RegexMatch[] = [];
    let m: RegExpExecArray | null;
    let iterations = 0;
    while ((m = re.exec(input)) !== null && iterations < 1000) {
      matches.push({
        value: m[0],
        index: m.index,
        end: m.index + m[0].length,
        groups: m.groups ?? {},
      });
      if (!flags.includes('g')) break;
      if (m[0].length === 0) re.lastIndex++;
      iterations++;
    }
    return { valid: true, matches, matchCount: matches.length };
  } catch (err) {
    return { valid: false, matches: [], error: (err as Error).message, matchCount: 0 };
  }
}

export function validateRegexPattern(pattern: string, flags: string): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern, flags);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

