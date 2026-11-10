import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Telemetry (GA4 / Sentry) may only carry fixed labels and counts — never user input,
// file names, URLs or error text (browser error messages often quote the input).
const PUBLIC_DIR = join(process.cwd(), 'public');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'test' || name === 'fonts' ? [] : walk(p);
    return /\.(html|js)$/.test(name) ? [p] : [];
  });
}

const TELEMETRY_CALL = /\b(track[A-Za-z]*|Analytics\.[A-Za-z]+|gtag|captureException|captureMessage|addBreadcrumb|setContext)\s*\(/;
const RISKY_VALUE = [
  /\b(err|error|e)\.message\b/,
  /\berrorMessage\b/,
  /\bfile\.name\b|\bfileName\b/,
  /\binput_preview|url_preview|deeplink_url\b/,
  /\.substring\(0,\s*\d+\)/,
  /window\.location\.href/,
];

describe('telemetry privacy', () => {
  const files = walk(PUBLIC_DIR).filter((f) => !f.endsWith('assets/js/analytics.js'));

  it('never puts user input, file names, URLs or error text into analytics/Sentry calls', () => {
    const leaks: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        // The telemetry call itself, or a property line inside its argument object (up to 8 lines below it).
        const window = lines.slice(Math.max(0, i - 8), i + 1).join('\n');
        const inCall = TELEMETRY_CALL.test(line) || (/^\s*[\w$]+\s*:/.test(line) && TELEMETRY_CALL.test(window));
        if (!inCall) return;
        if (RISKY_VALUE.some((re) => re.test(line))) leaks.push(`${relative(PUBLIC_DIR, file)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(leaks).toEqual([]);
  });

  it('strips query and hash from page_location and scrubs Sentry events centrally', () => {
    const src = readFileSync(join(PUBLIC_DIR, 'assets/js/analytics.js'), 'utf8');
    expect(src).toContain('sanitizeEventParams(eventParams)');
    expect(src).toContain('page_location: stripQueryAndHash(window.location.href)');
    expect(src).toContain('beforeSend: scrubSentryEvent');
  });
});
