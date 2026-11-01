import { describe, it, expect } from 'vitest';
import { parseCurl, toFetch, toPython } from '@/lib/curl/parser';
import { generateUUID } from '@/lib/security/uuid';
import { diffJSON } from '@/lib/json/differ';
import { repairJSON } from '@/lib/json/formatter';
import { analyzeText } from '@/lib/text/wordCounter';

describe('code review regressions', () => {
  it('ignores URLs inside headers and bodies when picking the request URL', () => {
    const curl = `curl 'https://api.site.com/x' -H 'origin: https://site.com' -H 'referer: https://site.com/page' --data-raw '{"cb":"https://hook.io"}'`;
    const parsed = parseCurl(curl);
    expect(parsed.url).toBe('https://api.site.com/x');
    expect(parsed.headers.referer).toBe('https://site.com/page');
  });

  it('does not strip -v/-s/-i text inside header values', () => {
    const parsed = parseCurl(`curl -s https://a.com -H 'X-Note: foo -s bar'`);
    expect(parsed.headers['X-Note']).toBe('foo -s bar');
  });

  it('generates fetch code that stringifies JSON bodies', () => {
    const code = toFetch(parseCurl(`curl https://a.com -d '{"name":"x"}'`));
    expect(code).toContain('"body": JSON.stringify(');
    expect(code).not.toContain('"body": {');
  });

  it('generates fetch code with a string literal for non-JSON bodies', () => {
    const code = toFetch(parseCurl(`curl https://a.com -d 'a=1&b=2'`));
    expect(code).toContain('"body": "a=1&b=2"');
  });

  it('generates valid Python literals for JSON and form bodies', () => {
    const json = toPython(parseCurl(`curl https://a.com -d '{"active": true, "x": null, "n": [false]}'`));
    expect(json).toContain('"active": True');
    expect(json).toContain('"x": None');
    expect(json).toContain('False');
    expect(json).toContain('json=data');

    const form = toPython(parseCurl(`curl https://a.com -d 'a=1&b=2'`));
    expect(form).toContain('data = "a=1&b=2"');
    expect(form).toContain('data=data');
  });

  it('encodes the full v1 timestamp', () => {
    const before = BigInt(Date.now()) * 10000n + 122192928000000000n;
    const hex = generateUUID('v1').replace(/-/g, '');
    const ts = BigInt('0x' + hex.slice(13, 16) + hex.slice(8, 12) + hex.slice(0, 8));
    expect(ts >= before - 10000n * 1000n && ts <= before + 10000n * 1000n).toBe(true);
  });

  it('diffs a top-level null and array/object mismatches without throwing', () => {
    expect(() => diffJSON('null', '{"a":1}')).not.toThrow();
    expect(diffJSON('null', '{"a":1}')[0].type).toBe('changed');
    expect(diffJSON('[1,2]', '{"0":1,"1":2}')[0].type).toBe('changed');
  });

  it('repairs -Infinity to null', () => {
    expect(JSON.parse(repairJSON('{a: -Infinity, b: Infinity}'))).toEqual({ a: null, b: null });
  });

  it('counts unique non-Latin words', () => {
    expect(analyzeText('नमस्ते दुनिया भारत').uniqueWords).toBe(3);
    expect(analyzeText('1 2 2 three').uniqueWords).toBe(3);
  });
});
