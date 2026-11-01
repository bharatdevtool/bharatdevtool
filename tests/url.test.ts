import { describe, it, expect } from 'vitest';
import {
  encodeURL,
  decodeURL,
  parseURL,
  isValidDeepLink,
  parseDeepLink,
} from '@/lib/encoding/url';

describe('URL Encoder & Decoder', () => {
  it('encodes spaces and special characters', () => {
    const input = 'https://example.com/search?q=hello world&category=dev';
    const encoded = encodeURL(input);
    expect(encoded).toContain('hello%20world');
    expect(encoded).toContain('%26');
    expect(encoded).toContain('%3D');
  });

  it('decodes encoded URL components back to original', () => {
    const original = 'https://example.com/test?param=a b&c=1+2';
    const encoded = encodeURL(original);
    expect(decodeURL(encoded)).toBe(original);
  });

  it('encodes and decodes unicode and international characters', () => {
    const input = 'https://example.com/भारत/हिंदी';
    const encoded = encodeURL(input);
    expect(decodeURL(encoded)).toBe(input);
  });

  it('parses standard URLs into structured components', () => {
    const url = 'https://bharatdevtool.com/tools/json-formatter?theme=dark&tab=2#preview';
    const parsed = parseURL(url);
    expect(parsed).not.toBeNull();
    expect(parsed?.protocol).toBe('https:');
    expect(parsed?.host).toBe('bharatdevtool.com');
    expect(parsed?.pathname).toBe('/tools/json-formatter');
    expect(parsed?.params.theme).toBe('dark');
    expect(parsed?.params.tab).toBe('2');
    expect(parsed?.hash).toBe('#preview');
  });

  it('returns null when parsing invalid URLs', () => {
    expect(parseURL('not a valid url')).toBeNull();
  });
});

describe('DeepLink Launcher & Validation', () => {
  it('validates custom app schemes', () => {
    expect(isValidDeepLink('swiggy://restaurant/12345')).toBe(true);
    expect(isValidDeepLink('zomato://order/status?id=99')).toBe(true);
    expect(isValidDeepLink('myapp://profile/user123')).toBe(true);
  });

  it('validates standard http and https URLs as deep links', () => {
    expect(isValidDeepLink('https://bharatdevtool.com')).toBe(true);
    expect(isValidDeepLink('http://localhost:3000')).toBe(true);
  });

  it('rejects empty or whitespace-only links', () => {
    expect(isValidDeepLink('')).toBe(false);
    expect(isValidDeepLink('   \t\n  ')).toBe(false);
  });

  it('rejects URLs containing control characters or newlines', () => {
    expect(isValidDeepLink('myapp://test\nwith\nnewlines')).toBe(false);
    expect(isValidDeepLink('myapp://test\x00\x01\x02')).toBe(false);
  });

  it('rejects malformed URLs without scheme', () => {
    expect(isValidDeepLink('://broken')).toBe(false);
  });

  it('parses custom scheme deep links correctly', () => {
    const link = 'myapp://profile/view?user=42&theme=dark#top';
    const parsed = parseDeepLink(link);
    expect(parsed).not.toBeNull();
    expect(parsed?.scheme).toBe('myapp');
    expect(parsed?.host).toBe('profile');
    expect(parsed?.path).toBe('/view');
    expect(parsed?.query).toEqual({ user: '42', theme: 'dark' });
    expect(parsed?.fragment).toBe('top');
  });

  it('parses web URLs as deep links', () => {
    const link = 'https://api.example.com/v1/data?page=2';
    const parsed = parseDeepLink(link);
    expect(parsed).not.toBeNull();
    expect(parsed?.scheme).toBe('https');
    expect(parsed?.host).toBe('api.example.com');
    expect(parsed?.path).toBe('/v1/data');
    expect(parsed?.query).toEqual({ page: '2' });
  });
});

