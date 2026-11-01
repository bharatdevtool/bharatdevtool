import { describe, it, expect } from 'vitest';
import {
  encodeBase64,
  decodeBase64,
  isValidBase64,
  toUrlSafeBase64,
  fromUrlSafeBase64,
  parseHexString,
} from '@/lib/encoding/base64';

describe('Base64 Encoding & Decoding', () => {
  describe('Standard Base64', () => {
    it('encodes simple ASCII strings correctly', () => {
      expect(encodeBase64('Hello, World!')).toBe('SGVsbG8sIFdvcmxkIQ==');
      expect(encodeBase64('test')).toBe('dGVzdA==');
    });

    it('decodes standard Base64 strings correctly', () => {
      expect(decodeBase64('SGVsbG8sIFdvcmxkIQ==')).toBe('Hello, World!');
      expect(decodeBase64('dGVzdA==')).toBe('test');
    });

    it('handles unicode characters and emojis', () => {
      const input = 'Bharat Dev Tools 🚀 🇮🇳 - नमस्ते दुनिया';
      const encoded = encodeBase64(input);
      const decoded = decodeBase64(encoded);
      expect(decoded).toBe(input);
    });

    it('handles empty and whitespace input', () => {
      expect(encodeBase64('')).toBe('');
      expect(decodeBase64('')).toBe('');
      expect(decodeBase64('   \n  ')).toBe('');
    });
  });

  describe('URL-Safe Base64', () => {
    it('converts + and / to - and _ respectively', () => {
      // Input that produces + and / in standard base64
      const standard = 'a+b/cw==';
      expect(toUrlSafeBase64(standard)).toBe('a-b_cw==');
      expect(fromUrlSafeBase64('a-b_cw==')).toBe('a+b/cw==');
    });

    it('encodes directly with urlSafe option', () => {
      const input = 'subjects?_d=1&test=+';
      const encoded = encodeBase64(input, { urlSafe: true });
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(decodeBase64(encoded, { urlSafe: true })).toBe(input);
    });

    it('strips padding when stripPadding is enabled', () => {
      const input = 'test';
      const padded = encodeBase64(input);
      const unpadded = encodeBase64(input, { stripPadding: true });
      expect(padded).toBe('dGVzdA==');
      expect(unpadded).toBe('dGVzdA');

      // Should still decode correctly without padding
      expect(decodeBase64(unpadded)).toBe(input);
    });
  });

  describe('Hex Binary Mode', () => {
    it('parses valid hex strings to byte arrays', () => {
      const bytes = parseHexString('48656c6c6f');
      expect(Array.from(bytes)).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    });

    it('throws when parsing odd-length hex strings', () => {
      expect(() => parseHexString('abc')).toThrowError(/even number of digits/);
    });

    it('encodes hex binary data to Base64', () => {
      // '48656c6c6f' is 'Hello' in hex -> 'SGVsbG8='
      const encoded = encodeBase64('48656c6c6f', { interpretHex: true });
      expect(encoded).toBe('SGVsbG8=');
    });
  });

  describe('isValidBase64', () => {
    it('returns true for valid standard and url-safe Base64', () => {
      expect(isValidBase64('SGVsbG8=')).toBe(true);
      expect(isValidBase64('dGVzdA==')).toBe(true);
      expect(isValidBase64('dGVzdA')).toBe(true);
      expect(isValidBase64('a-b_cw==')).toBe(true);
    });

    it('returns false for invalid Base64 characters', () => {
      expect(isValidBase64('not a base 64 string!!')).toBe(false);
      expect(isValidBase64('')).toBe(false);
      expect(isValidBase64('   ')).toBe(false);
    });
  });
});
