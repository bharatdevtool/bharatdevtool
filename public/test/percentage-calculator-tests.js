/**
 * Percentage Calculator Test Suite
 *
 * Tests percentage calculation logic that mirrors the browser
 * implementation in percentage-calculator.html.
 */

// ── Helpers (mirrors html implementation) ────────────────────────────────────

function calcPctOf(x, y) { return (x / 100) * y; }
function calcWhatPct(x, y) { return (x / y) * 100; }
function calcChange(from, to) { return ((to - from) / Math.abs(from)) * 100; }
function calcDiff(a, b) { return (Math.abs(a - b) / Math.abs((a + b) / 2)) * 100; }
function calcAdd(val, pct) { return val * (1 + pct / 100); }
function calcSub(val, pct) { return val * (1 - pct / 100); }

function isValidNumber(v) {
  return v !== '' && v !== null && v !== undefined && !isNaN(Number(v)) && isFinite(Number(v));
}

function formatNumber(n) {
  if (!isFinite(n)) return String(n);
  const rounded = Math.round(n * 100000) / 100000;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(4).replace(/\.?0+$/, '');
}

// ── Test Class ────────────────────────────────────────────────────────────────

export class PercentageCalculatorTester {
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

  // ── pct_of ──────────────────────────────────────────────────────────────────
  testPctOf() {
    console.log('\n🧪 Testing "What is X% of Y?"…\n');
    this.runTest('calcPctOf – 10% of 200 = 20', () => this.assertEqual(calcPctOf(10, 200), 20, 'pct_of'));
    this.runTest('calcPctOf – 18% of 5000 = 900 (GST)', () => this.assertEqual(calcPctOf(18, 5000), 900, 'pct_of GST'));
    this.runTest('calcPctOf – 0% of 500 = 0', () => this.assertEqual(calcPctOf(0, 500), 0, 'zero pct'));
    this.runTest('calcPctOf – 100% of 75 = 75', () => this.assertEqual(calcPctOf(100, 75), 75, '100%'));
    this.runTest('calcPctOf – 50% of 1 = 0.5', () => this.assertEqual(calcPctOf(50, 1), 0.5, '50% of 1'));
    this.runTest('calcPctOf – 12.5% of 80 = 10', () => this.assertEqual(calcPctOf(12.5, 80), 10, '12.5%'));
  }

  // ── what_pct ────────────────────────────────────────────────────────────────
  testWhatPct() {
    console.log('\n🧪 Testing "X is what % of Y?"…\n');
    this.runTest('calcWhatPct – 25 is 12.5% of 200', () => this.assertEqual(calcWhatPct(25, 200), 12.5, 'what_pct'));
    this.runTest('calcWhatPct – 200 is 100% of 200', () => this.assertEqual(calcWhatPct(200, 200), 100, '100%'));
    this.runTest('calcWhatPct – 0 is 0% of 500', () => this.assertEqual(calcWhatPct(0, 500), 0, 'zero'));
    this.runTest('calcWhatPct – 50 is 50% of 100', () => this.assertEqual(calcWhatPct(50, 100), 50, '50%'));
  }

  // ── pct_change ──────────────────────────────────────────────────────────────
  testPctChange() {
    console.log('\n🧪 Testing percentage change…\n');
    this.runTest('calcChange – 500→600 = +20%', () => this.assertEqual(calcChange(500, 600), 20, 'increase'));
    this.runTest('calcChange – 100→150 = +50%', () => this.assertEqual(calcChange(100, 150), 50, '+50%'));
    this.runTest('calcChange – 200→100 = -50%', () => this.assertEqual(calcChange(200, 100), -50, '-50%'));
    this.runTest('calcChange – 100→100 = 0%', () => this.assertEqual(calcChange(100, 100), 0, 'no change'));
    this.runTest('calcChange – -100→-50 = +50% (|from|)', () => this.assertEqual(calcChange(-100, -50), 50, 'negative from'));
  }

  // ── pct_diff ────────────────────────────────────────────────────────────────
  testPctDiff() {
    console.log('\n🧪 Testing percentage difference…\n');
    this.runTest('calcDiff – equal values = 0%', () => this.assertEqual(calcDiff(50, 50), 0, 'equal'));
    this.runTest('calcDiff – symmetric (a,b) = (b,a)', () => this.assertEqual(calcDiff(100, 200), calcDiff(200, 100), 'symmetric'));
    this.runTest('calcDiff – 0 vs 100 = 200%', () => this.assertEqual(calcDiff(0, 100), 200, '0 vs 100'));
  }

  // ── add_pct ─────────────────────────────────────────────────────────────────
  testAddPct() {
    console.log('\n🧪 Testing add percentage…\n');
    this.runTest('calcAdd – 1000 + 18% = 1180 (GST)', () => this.assertEqual(calcAdd(1000, 18), 1180, 'GST'));
    this.runTest('calcAdd – 500 + 10% = 550', () => this.assertEqual(calcAdd(500, 10), 550, '+10%'));
    this.runTest('calcAdd – 100 + 0% = 100', () => this.assertEqual(calcAdd(100, 0), 100, '+0%'));
    this.runTest('calcAdd – 200 + 50% = 300', () => this.assertEqual(calcAdd(200, 50), 300, '+50%'));
    this.runTest('calcAdd – 100 + 100% = 200', () => this.assertEqual(calcAdd(100, 100), 200, '+100%'));
  }

  // ── sub_pct ─────────────────────────────────────────────────────────────────
  testSubPct() {
    console.log('\n🧪 Testing subtract percentage…\n');
    this.runTest('calcSub – 1000 - 10% = 900', () => this.assertEqual(calcSub(1000, 10), 900, '-10%'));
    this.runTest('calcSub – 500 - 20% = 400', () => this.assertEqual(calcSub(500, 20), 400, '-20%'));
    this.runTest('calcSub – 100 - 0% = 100', () => this.assertEqual(calcSub(100, 0), 100, '-0%'));
    this.runTest('calcSub – 200 - 50% = 100', () => this.assertEqual(calcSub(200, 50), 100, '-50%'));
    this.runTest('calcSub – 100 - 100% = 0', () => this.assertEqual(calcSub(100, 100), 0, '-100%'));
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  testHelpers() {
    console.log('\n🧪 Testing isValidNumber and formatNumber helpers…\n');
    this.runTest('isValidNumber – "42" is valid', () => { if (!isValidNumber('42')) throw new Error('should be valid'); return true; });
    this.runTest('isValidNumber – "3.14" is valid', () => { if (!isValidNumber('3.14')) throw new Error('should be valid'); return true; });
    this.runTest('isValidNumber – "" is invalid', () => { if (isValidNumber('')) throw new Error('should be invalid'); return true; });
    this.runTest('isValidNumber – "abc" is invalid', () => { if (isValidNumber('abc')) throw new Error('should be invalid'); return true; });
    this.runTest('isValidNumber – null is invalid', () => { if (isValidNumber(null)) throw new Error('should be invalid'); return true; });
    this.runTest('isValidNumber – Infinity is invalid', () => { if (isValidNumber(Infinity)) throw new Error('should be invalid'); return true; });
    this.runTest('formatNumber – integer 10', () => this.assertEqual(formatNumber(10), '10', 'int'));
    this.runTest('formatNumber – 12.5', () => this.assertEqual(formatNumber(12.5), '12.5', 'decimal'));
    this.runTest('formatNumber – strips trailing zeros', () => this.assertEqual(formatNumber(1.10), '1.1', 'trailing zero'));
    this.runTest('formatNumber – zero', () => this.assertEqual(formatNumber(0), '0', 'zero'));
  }

  runAll() {
    console.log('% Percentage Calculator Test Suite');
    console.log('===================================\n');
    this.testPctOf();
    this.testWhatPct();
    this.testPctChange();
    this.testPctDiff();
    this.testAddPct();
    this.testSubPct();
    this.testHelpers();

    console.log('\n────────────────────────────────────────');
    console.log(`Percentage Calculator: ${this.testsPassed}/${this.totalTests} passed`);
    if (this.testsFailed > 0) {
      console.log('Failed tests:', this.failedTests);
    }
    return { passed: this.testsPassed, failed: this.testsFailed, total: this.totalTests, failedTests: this.failedTests };
  }
}
