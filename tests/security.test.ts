import { describe, it, expect } from 'vitest';
import {
  generateUUID,
  generateBulkUUIDs,
  isValidUUID,
  detectUUIDVersion,
  applyUUIDFormat,
  NIL_UUID,
} from '@/lib/security/uuid';

describe('UUID Generator & Validator', () => {
  describe('generateUUID & versions', () => {
    it('generates valid v4 UUIDs', () => {
      const uuid = generateUUID('v4');
      expect(isValidUUID(uuid)).toBe(true);
      expect(detectUUIDVersion(uuid)).toBe('v4');
    });

    it('generates valid v7 UUIDs', () => {
      const uuid = generateUUID('v7');
      expect(isValidUUID(uuid)).toBe(true);
      expect(detectUUIDVersion(uuid)).toBe('v7');
    });

    it('generates valid v1 UUIDs', () => {
      const uuid = generateUUID('v1');
      expect(isValidUUID(uuid)).toBe(true);
      expect(detectUUIDVersion(uuid)).toBe('v1');
    });

    it('generates bulk UUIDs without duplicates', () => {
      const count = 50;
      const uuids = generateBulkUUIDs('v4', count);
      expect(uuids.length).toBe(count);
      const unique = new Set(uuids);
      expect(unique.size).toBe(count);
    });
  });

  describe('Formatting & Validation', () => {
    const sample = '550e8400-e29b-41d4-a716-446655440000';

    it('applies standard, uppercase, nohyphens, and braces formats', () => {
      expect(applyUUIDFormat(sample, 'standard')).toBe(sample);
      expect(applyUUIDFormat(sample, 'uppercase')).toBe(sample.toUpperCase());
      expect(applyUUIDFormat(sample, 'nohyphens')).toBe('550e8400e29b41d4a716446655440000');
      expect(applyUUIDFormat(sample, 'braces')).toBe(`{${sample}}`);
    });

    it('validates NIL UUID as valid', () => {
      expect(isValidUUID(NIL_UUID)).toBe(true);
      expect(detectUUIDVersion(NIL_UUID)).toBeNull();
    });

    it('validates UUID wrapped in braces', () => {
      expect(isValidUUID(`{${sample}}`)).toBe(true);
    });

    it('rejects invalid UUID formats', () => {
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('gggggggg-gggg-gggg-gggg-gggggggggggg')).toBe(false);
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false);
    });
  });
});
