/**
 * Password Generator Test Suite
 */

const CHAR_SETS_TEST = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

const AMBIGUOUS_CHARS_TEST = new Set(['0', 'O', 'l', '1', 'I']);

function buildCharsetTest(options) {
  let charset = '';
  if (options.uppercase) charset += CHAR_SETS_TEST.uppercase;
  if (options.lowercase) charset += CHAR_SETS_TEST.lowercase;
  if (options.numbers)   charset += CHAR_SETS_TEST.numbers;
  if (options.symbols)   charset += CHAR_SETS_TEST.symbols;
  if (options.excludeAmbiguous) {
    charset = charset.split('').filter(c => !AMBIGUOUS_CHARS_TEST.has(c)).join('');
  }
  return charset;
}

function generatePasswordTest(length, options) {
  const charset = buildCharsetTest(options);
  if (charset.length === 0) return null;
  if (options.noRepeat && length > charset.length) length = charset.length;

  const array = new Uint32Array(length * 2);
  crypto.getRandomValues(array);

  const usedIndices = options.noRepeat ? new Set() : null;
  const result = [];
  let arrayIndex = 0;

  while (result.length < length) {
    if (arrayIndex >= array.length) {
      const refill = new Uint32Array(length * 2);
      crypto.getRandomValues(refill);
      array.set(refill);
      arrayIndex = 0;
    }
    const idx = array[arrayIndex++] % charset.length;
    if (options.noRepeat) {
      if (!usedIndices.has(idx)) { usedIndices.add(idx); result.push(charset[idx]); }
    } else {
      result.push(charset[idx]);
    }
  }
  return result.join('');
}

class PasswordGeneratorTester {
  constructor() {
    this.testsPassed = 0;
    this.testsFailed = 0;
    this.totalTests  = 0;
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

  runAll() {
    console.log('\n🔑 Password Generator Tests\n' + '─'.repeat(40));

    // Length tests
    this.runTest('generates password of correct length (8)', () => {
      const pw = generatePasswordTest(8, { uppercase: true, lowercase: true, numbers: true, symbols: false, excludeAmbiguous: false, noRepeat: false });
      return pw !== null && pw.length === 8;
    });

    this.runTest('generates password of correct length (16)', () => {
      const pw = generatePasswordTest(16, { uppercase: true, lowercase: true, numbers: true, symbols: true, excludeAmbiguous: false, noRepeat: false });
      return pw !== null && pw.length === 16;
    });

    this.runTest('generates password of correct length (32)', () => {
      const pw = generatePasswordTest(32, { uppercase: true, lowercase: true, numbers: true, symbols: true, excludeAmbiguous: false, noRepeat: false });
      return pw !== null && pw.length === 32;
    });

    // Character type tests
    this.runTest('uppercase-only password contains only uppercase', () => {
      const pw = generatePasswordTest(20, { uppercase: true, lowercase: false, numbers: false, symbols: false, excludeAmbiguous: false, noRepeat: false });
      return /^[A-Z]+$/.test(pw);
    });

    this.runTest('lowercase-only password contains only lowercase', () => {
      const pw = generatePasswordTest(20, { uppercase: false, lowercase: true, numbers: false, symbols: false, excludeAmbiguous: false, noRepeat: false });
      return /^[a-z]+$/.test(pw);
    });

    this.runTest('numbers-only password contains only digits', () => {
      const pw = generatePasswordTest(20, { uppercase: false, lowercase: false, numbers: true, symbols: false, excludeAmbiguous: false, noRepeat: false });
      return /^[0-9]+$/.test(pw);
    });

    this.runTest('all character types — charset includes all four sets', () => {
      const charset = buildCharsetTest({ uppercase: true, lowercase: true, numbers: true, symbols: true, excludeAmbiguous: false });
      return charset.includes('A') && charset.includes('a') && charset.includes('0') && charset.includes('!');
    });

    // Exclude ambiguous
    this.runTest('excludeAmbiguous removes 0, O, l, 1, I from charset', () => {
      const charset = buildCharsetTest({ uppercase: true, lowercase: true, numbers: true, symbols: false, excludeAmbiguous: true });
      const ambiguous = ['0', 'O', 'l', '1', 'I'];
      return ambiguous.every(c => !charset.includes(c));
    });

    this.runTest('excludeAmbiguous still generates password', () => {
      const pw = generatePasswordTest(12, { uppercase: true, lowercase: true, numbers: true, symbols: false, excludeAmbiguous: true, noRepeat: false });
      return pw !== null && pw.length === 12;
    });

    // No repeat test
    this.runTest('noRepeat — no character appears twice (short password)', () => {
      const pw = generatePasswordTest(10, { uppercase: true, lowercase: true, numbers: true, symbols: false, excludeAmbiguous: false, noRepeat: true });
      const chars = pw.split('');
      return new Set(chars).size === chars.length;
    });

    // Null result when no charset
    this.runTest('returns null when no character type selected', () => {
      const charset = buildCharsetTest({ uppercase: false, lowercase: false, numbers: false, symbols: false, excludeAmbiguous: false });
      return charset.length === 0;
    });

    // Uniqueness / randomness
    this.runTest('two generated passwords are not identical (high probability)', () => {
      const opts = { uppercase: true, lowercase: true, numbers: true, symbols: true, excludeAmbiguous: false, noRepeat: false };
      const pw1 = generatePasswordTest(16, opts);
      const pw2 = generatePasswordTest(16, opts);
      return pw1 !== pw2;
    });

    // Edge case: length 4
    this.runTest('minimum length 4 works', () => {
      const pw = generatePasswordTest(4, { uppercase: true, lowercase: true, numbers: false, symbols: false, excludeAmbiguous: false, noRepeat: false });
      return pw !== null && pw.length === 4;
    });

    // Edge case: length 64
    this.runTest('maximum length 64 works', () => {
      const pw = generatePasswordTest(64, { uppercase: true, lowercase: true, numbers: true, symbols: true, excludeAmbiguous: false, noRepeat: false });
      return pw !== null && pw.length === 64;
    });

    console.log('\n' + '─'.repeat(40));
    console.log(`Total: ${this.totalTests} | Passed: ${this.testsPassed} | Failed: ${this.testsFailed}`);
    if (this.failedTests.length > 0) {
      console.log('Failed tests:', this.failedTests.join(', '));
    }
    return { passed: this.testsPassed, failed: this.testsFailed, total: this.totalTests };
  }
}

export { PasswordGeneratorTester };
