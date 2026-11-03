/**
 * UUID Generator Test Suite
 *
 * Tests UUID generation logic, validation, and formatting helpers
 * that mirror the browser implementation in uuid-generator.html.
 */

// ── Helpers (mirrors html implementation) ────────────────────────────────────

function formatBytesAsUUID(bytes) {
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join('')
  ].join('-');
}

function applyFormat(uuid, format) {
  switch (format) {
    case 'uppercase':  return uuid.toUpperCase();
    case 'nohyphens':  return uuid.replace(/-/g, '');
    case 'braces':     return '{' + uuid + '}';
    default:           return uuid;
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

function isValidUUID(uuid) {
  const cleaned = uuid.trim().replace(/[{}]/g, '');
  if (cleaned === NIL_UUID) return true;
  return UUID_REGEX.test(cleaned);
}

function detectUUIDVersion(uuid) {
  const cleaned = uuid.trim().toLowerCase().replace(/[{}]/g, '').replace(/-/g, '');
  if (cleaned.length !== 32) return null;
  const v = parseInt(cleaned[12], 16);
  if (v >= 1 && v <= 8) return v;
  return null;
}

// ── Test Class ────────────────────────────────────────────────────────────────

export class UUIDGeneratorTester {
  constructor() {
    this.testsPassed = 0;
    this.testsFailed = 0;
    this.totalTests = 0;
    this.failedTests = [];
  }

  runTest(name, fn) {
    this.totalTests++;
    try {
      const result = fn();
      if (result === true) {
        this.testsPassed++;
        console.log(`✅ ${name}`);
      } else {
        this.testsFailed++;
        this.failedTests.push(name);
        console.log(`❌ ${name} - Expected true, got ${result}`);
      }
    } catch (err) {
      this.testsFailed++;
      this.failedTests.push(name);
      console.log(`❌ ${name} - Error: ${err.message}`);
    }
  }

  assertEqual(actual, expected, msg) {
    if (actual === expected) return true;
    throw new Error(`${msg} — expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`);
  }

  // ── Format helpers ──────────────────────────────────────────────────────────
  testFormatHelpers() {
    console.log('\n🧪 Testing UUID format helpers…\n');
    const sample = '550e8400-e29b-41d4-a716-446655440000';

    this.runTest('applyFormat – standard (no-op)', () =>
      this.assertEqual(applyFormat(sample, 'standard'), sample, 'standard'));

    this.runTest('applyFormat – uppercase', () =>
      this.assertEqual(applyFormat(sample, 'uppercase'), sample.toUpperCase(), 'uppercase'));

    this.runTest('applyFormat – nohyphens length = 32', () =>
      this.assertEqual(applyFormat(sample, 'nohyphens').length, 32, 'nohyphens length'));

    this.runTest('applyFormat – nohyphens has no dash', () => {
      const r = applyFormat(sample, 'nohyphens');
      if (r.includes('-')) throw new Error('hyphen found in nohyphens format');
      return true;
    });

    this.runTest('applyFormat – braces wraps with {}', () => {
      const r = applyFormat(sample, 'braces');
      if (!r.startsWith('{') || !r.endsWith('}')) throw new Error('no braces: ' + r);
      return true;
    });
  }

  // ── UUID Validation ─────────────────────────────────────────────────────────
  testValidation() {
    console.log('\n🧪 Testing UUID validation…\n');

    this.runTest('isValidUUID – valid v4', () => {
      if (!isValidUUID('550e8400-e29b-41d4-a716-446655440000')) throw new Error('should be valid');
      return true;
    });

    this.runTest('isValidUUID – nil UUID is valid', () => {
      if (!isValidUUID(NIL_UUID)) throw new Error('nil should be valid');
      return true;
    });

    this.runTest('isValidUUID – random 32-hex (no hyphens) is invalid', () => {
      if (isValidUUID('550e8400e29b41d4a716446655440000')) throw new Error('should be invalid without hyphens');
      return true;
    });

    this.runTest('isValidUUID – empty string is invalid', () => {
      if (isValidUUID('')) throw new Error('should be invalid');
      return true;
    });

    this.runTest('isValidUUID – invalid characters are invalid', () => {
      if (isValidUUID('gggggggg-gggg-gggg-gggg-gggggggggggg')) throw new Error('should be invalid');
      return true;
    });

    this.runTest('isValidUUID – braced UUID is valid', () => {
      if (!isValidUUID('{550e8400-e29b-41d4-a716-446655440000}')) throw new Error('should be valid with braces');
      return true;
    });

    this.runTest('detectUUIDVersion – v4 detected', () => {
      const v = detectUUIDVersion('550e8400-e29b-41d4-a716-446655440000');
      return this.assertEqual(v, 4, 'version should be 4');
    });

    this.runTest('detectUUIDVersion – v1 detected', () => {
      const v = detectUUIDVersion('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
      return this.assertEqual(v, 1, 'version should be 1');
    });

    this.runTest('detectUUIDVersion – nil UUID returns null', () => {
      const v = detectUUIDVersion(NIL_UUID);
      if (v !== null) throw new Error('nil uuid version should be null, got ' + v);
      return true;
    });
  }

  // ── formatBytesAsUUID structure ─────────────────────────────────────────────
  testBytesFormat() {
    console.log('\n🧪 Testing formatBytesAsUUID…\n');

    this.runTest('formatBytesAsUUID – correct length 36', () => {
      const bytes = new Uint8Array(16).fill(0xab);
      const uuid = formatBytesAsUUID(bytes);
      return this.assertEqual(uuid.length, 36, 'uuid length');
    });

    this.runTest('formatBytesAsUUID – has 4 hyphens at correct positions', () => {
      const bytes = new Uint8Array(16).fill(0x00);
      const uuid = formatBytesAsUUID(bytes);
      const dashes = [8, 13, 18, 23].every(i => uuid[i] === '-');
      if (!dashes) throw new Error('hyphens at wrong positions in: ' + uuid);
      return true;
    });
  }

  runAll() {
    console.log('🔑 UUID Generator Test Suite');
    console.log('============================\n');
    this.testFormatHelpers();
    this.testValidation();
    this.testBytesFormat();

    console.log('\n────────────────────────────────────────');
    console.log(`UUID Generator: ${this.testsPassed}/${this.totalTests} passed`);
    if (this.testsFailed > 0) {
      console.log('Failed tests:', this.failedTests);
    }
    return { passed: this.testsPassed, failed: this.testsFailed, total: this.totalTests, failedTests: this.failedTests };
  }
}
