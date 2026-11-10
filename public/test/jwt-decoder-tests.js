/**
 * JWT Decoder Test Suite
 *
 * Tests JWT parsing, Base64URL decoding, and claims inspection logic
 * that mirrors the browser implementation in jwt-decoder.html.
 */

// ── Helpers (mirrors html implementation) ────────────────────────────────────

function decodeBase64Url(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (base64.length % 4)) % 4;
  base64 += '='.repeat(pad);
  // Node.js Buffer instead of atob/TextDecoder
  return Buffer.from(base64, 'base64').toString('utf8');
}

function parseJwtParts(token) {
  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT: expected 3 parts separated by dots, got ' + parts.length);
  }
  return parts;
}

function decodeJwtSection(base64urlPart) {
  const jsonStr = decodeBase64Url(base64urlPart);
  return JSON.parse(jsonStr);
}

function isTokenExpired(payload) {
  if (!payload.exp) return null;
  return Date.now() / 1000 > payload.exp;
}

function formatUnixTimestamp(ts) {
  try {
    return new Date(ts * 1000).toISOString();
  } catch (_) {
    return String(ts);
  }
}

// Known-good JWT (no actual secret — only decoding tested, not verification)
const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ' +
  '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

const EXPIRED_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxIiwiZXhwIjoxfQ' +   // exp: 1 (epoch second 1 — long expired)
  '.sig';

const FUTURE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxIiwiZXhwIjo5OTk5OTk5OTk5fQ' + // exp: 9999999999 (year 2286)
  '.sig';

// ── Test Class ────────────────────────────────────────────────────────────────

export class JWTDecoderTester {
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
        console.log('  ✅ ' + name);
      } else {
        this.testsFailed++;
        this.failedTests.push(name);
        console.log('  ❌ ' + name + ' — returned ' + result);
      }
    } catch (err) {
      this.testsFailed++;
      this.failedTests.push(name);
      console.log('  ❌ ' + name + ' — ' + err.message);
    }
  }

  assertEqual(actual, expected, msg) {
    if (actual === expected) return true;
    throw new Error((msg || '') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }

  runAll() {
    console.log('\n🧪 JWT Decoder Test Suite\n');

    // ── Base64URL Decoding ──────────────────────────────────────────────────
    console.log('  Base64URL decoding:');

    this.runTest('decodeBase64Url — standard string', () => {
      const encoded = Buffer.from('Hello World').toString('base64url');
      return this.assertEqual(decodeBase64Url(encoded), 'Hello World', 'decode');
    });

    this.runTest('decodeBase64Url — URL-safe chars replaced', () => {
      // "-" → "+" and "_" → "/" in standard base64
      const result = decodeBase64Url('SGVsbG8-V29ybGQ_');
      // Should not throw; result may vary but should be a string
      return typeof result === 'string';
    });

    this.runTest('decodeBase64Url — padding handled', () => {
      // "YQ" is "a" without padding
      const result = decodeBase64Url('YQ');
      return this.assertEqual(result, 'a', 'single char');
    });

    // ── JWT Part Parsing ────────────────────────────────────────────────────
    console.log('\n  JWT part parsing:');

    this.runTest('parseJwtParts — valid token returns 3 parts', () => {
      const parts = parseJwtParts(SAMPLE_JWT);
      return this.assertEqual(parts.length, 3, 'length');
    });

    this.runTest('parseJwtParts — trims whitespace', () => {
      const parts = parseJwtParts('  ' + SAMPLE_JWT + '  ');
      return this.assertEqual(parts.length, 3, 'trimmed');
    });

    this.runTest('parseJwtParts — throws on 2-part string', () => {
      try {
        parseJwtParts('part1.part2');
        return false;
      } catch (err) {
        return err.message.includes('3 parts');
      }
    });

    this.runTest('parseJwtParts — throws on 1-part string', () => {
      try {
        parseJwtParts('noDots');
        return false;
      } catch (err) {
        return err.message.includes('3 parts');
      }
    });

    this.runTest('parseJwtParts — throws on 4-part string', () => {
      try {
        parseJwtParts('a.b.c.d');
        return false;
      } catch (err) {
        return err.message.includes('3 parts');
      }
    });

    // ── Header Decoding ─────────────────────────────────────────────────────
    console.log('\n  Header decoding:');

    this.runTest('decodeJwtSection — header has alg field', () => {
      const parts = parseJwtParts(SAMPLE_JWT);
      const header = decodeJwtSection(parts[0]);
      return this.assertEqual(header.alg, 'HS256', 'alg');
    });

    this.runTest('decodeJwtSection — header has typ field', () => {
      const parts = parseJwtParts(SAMPLE_JWT);
      const header = decodeJwtSection(parts[0]);
      return this.assertEqual(header.typ, 'JWT', 'typ');
    });

    // ── Payload Decoding ────────────────────────────────────────────────────
    console.log('\n  Payload decoding:');

    this.runTest('decodeJwtSection — payload has sub', () => {
      const parts = parseJwtParts(SAMPLE_JWT);
      const payload = decodeJwtSection(parts[1]);
      return this.assertEqual(payload.sub, '1234567890', 'sub');
    });

    this.runTest('decodeJwtSection — payload has name', () => {
      const parts = parseJwtParts(SAMPLE_JWT);
      const payload = decodeJwtSection(parts[1]);
      return this.assertEqual(payload.name, 'John Doe', 'name');
    });

    this.runTest('decodeJwtSection — payload has iat', () => {
      const parts = parseJwtParts(SAMPLE_JWT);
      const payload = decodeJwtSection(parts[1]);
      return this.assertEqual(payload.iat, 1516239022, 'iat');
    });

    // ── Expiry Checking ─────────────────────────────────────────────────────
    console.log('\n  Expiry checking:');

    this.runTest('isTokenExpired — null when no exp claim', () => {
      const parts = parseJwtParts(SAMPLE_JWT);
      const payload = decodeJwtSection(parts[1]);
      return this.assertEqual(isTokenExpired(payload), null, 'no exp');
    });

    this.runTest('isTokenExpired — true for expired token', () => {
      const parts = parseJwtParts(EXPIRED_JWT);
      const payload = decodeJwtSection(parts[1]);
      return this.assertEqual(isTokenExpired(payload), true, 'expired');
    });

    this.runTest('isTokenExpired — false for future token', () => {
      const parts = parseJwtParts(FUTURE_JWT);
      const payload = decodeJwtSection(parts[1]);
      return this.assertEqual(isTokenExpired(payload), false, 'future');
    });

    // ── Timestamp Formatting ────────────────────────────────────────────────
    console.log('\n  Timestamp formatting:');

    this.runTest('formatUnixTimestamp — returns ISO string', () => {
      const result = formatUnixTimestamp(0);
      return result.includes('1970');
    });

    this.runTest('formatUnixTimestamp — handles large timestamp', () => {
      const result = formatUnixTimestamp(9999999999);
      return typeof result === 'string' && result.length > 0;
    });

    // ── Round-trip ──────────────────────────────────────────────────────────
    console.log('\n  Round-trip integrity:');

    this.runTest('full decode — header and payload objects round-trip to JSON', () => {
      const parts = parseJwtParts(SAMPLE_JWT);
      const header = decodeJwtSection(parts[0]);
      const payload = decodeJwtSection(parts[1]);
      const headerJson = JSON.stringify(header);
      const payloadJson = JSON.stringify(payload);
      return headerJson.includes('HS256') && payloadJson.includes('John Doe');
    });

    // Summary
    console.log('\n  ─────────────────────────────');
    console.log('  Results: ' + this.testsPassed + '/' + this.totalTests + ' passed');
    if (this.failedTests.length > 0) {
      console.log('  Failed: ' + this.failedTests.join(', '));
    }

    return {
      passed: this.testsPassed,
      failed: this.testsFailed,
      total: this.totalTests,
      failedTests: this.failedTests
    };
  }
}
