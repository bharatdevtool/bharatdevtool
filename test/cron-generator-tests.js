/**
 * Cron Expression Generator Test Suite
 *
 * Tests cron parsing, validation, description generation, and next-run
 * calculations that mirror the browser implementation in cron-generator.html.
 */

// ── Field ranges (mirror implementation) ────────────────────────────────────
const FIELD_RANGES = {
  minute: { min: 0, max: 59 },
  hour:   { min: 0, max: 23 },
  dom:    { min: 1, max: 31 },
  month:  { min: 1, max: 12 },
  dow:    { min: 0, max: 7 }
};
const FIELD_KEYS = ['minute', 'hour', 'dom', 'month', 'dow'];

function isValidPrimitive(val, range) {
  if (/^\d+(-\d+)?(\/\d+)?$/.test(val)) {
    const slashIdx = val.indexOf('/');
    const baseRange = slashIdx === -1 ? val : val.slice(0, slashIdx);
    const dashIdx = baseRange.indexOf('-');
    if (dashIdx === -1) {
      const n = parseInt(baseRange, 10);
      return n >= range.min && n <= range.max;
    }
    const lo = parseInt(baseRange.slice(0, dashIdx), 10);
    const hi = parseInt(baseRange.slice(dashIdx + 1), 10);
    return lo >= range.min && hi <= range.max && lo <= hi;
  }
  if (/^\*\/\d+$/.test(val)) {
    const step = parseInt(val.slice(2), 10);
    return step >= 1;
  }
  return false;
}

function isValidFieldValue(val, range) {
  if (val === '*') return true;
  if (/^\*\/\d+$/.test(val)) {
    const step = parseInt(val.slice(2), 10);
    return step >= 1 && step <= range.max;
  }
  const parts = val.split(',');
  return parts.every(function(part) { return isValidPrimitive(part.trim(), range); });
}

function parseCronExpression(expr) {
  const trimmed = (expr || '').trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) return null;
  const fields = {};
  for (let i = 0; i < 5; i++) {
    const key = FIELD_KEYS[i];
    if (!isValidFieldValue(parts[i], FIELD_RANGES[key])) return null;
    fields[key] = parts[i];
  }
  fields._parts = parts;
  return fields;
}

function isValidCronExpression(expr) {
  return parseCronExpression(expr) !== null;
}

function expandField(val, min, max) {
  const result = new Set();
  if (val === '*') {
    for (let i = min; i <= max; i++) result.add(i);
    return result;
  }
  if (/^\*\/(\d+)$/.test(val)) {
    const step = parseInt(val.match(/^\*\/(\d+)$/)[1], 10);
    for (let i = min; i <= max; i += step) result.add(i);
    return result;
  }
  const parts = val.split(',');
  parts.forEach(function(part) {
    part = part.trim();
    const rangeMatch = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
    if (rangeMatch) {
      const lo   = parseInt(rangeMatch[1], 10);
      const hi   = parseInt(rangeMatch[2], 10);
      const step = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : 1;
      for (let i = lo; i <= hi; i += step) result.add(i);
    } else {
      result.add(parseInt(part, 10));
    }
  });
  return result;
}

// ── Test Class ────────────────────────────────────────────────────────────────

export class CronGeneratorTester {
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
        console.log('  ✅ ' + name);
      } else {
        this.testsFailed++;
        this.failedTests.push(name);
        console.log('  ❌ ' + name + ' — returned: ' + result);
      }
    } catch (err) {
      this.testsFailed++;
      this.failedTests.push(name);
      console.log('  ❌ ' + name + ' — Error: ' + err.message);
    }
  }

  assertEqual(actual, expected, msg) {
    if (actual === expected) return true;
    throw new Error((msg || '') + ' | expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual));
  }

  // ── Validation tests ────────────────────────────────────────────────────────
  runValidationTests() {
    console.log('\n  Validation');

    this.runTest('* * * * * is valid', () =>
      this.assertEqual(isValidCronExpression('* * * * *'), true, 'wildcard'));

    this.runTest('0 0 * * * is valid', () =>
      this.assertEqual(isValidCronExpression('0 0 * * *'), true, 'midnight'));

    this.runTest('0 9 * * 1-5 is valid', () =>
      this.assertEqual(isValidCronExpression('0 9 * * 1-5'), true, 'weekdays'));

    this.runTest('*/15 * * * * is valid', () =>
      this.assertEqual(isValidCronExpression('*/15 * * * *'), true, 'step'));

    this.runTest('0 8,20 * * * is valid (list)', () =>
      this.assertEqual(isValidCronExpression('0 8,20 * * *'), true, 'list'));

    this.runTest('0 0 1 * * is valid (first of month)', () =>
      this.assertEqual(isValidCronExpression('0 0 1 * *'), true, 'dom'));

    this.runTest('30 * * * * is valid (half past every hour)', () =>
      this.assertEqual(isValidCronExpression('30 * * * *'), true, 'half-hour'));

    this.runTest('0-30/5 * * * * is valid (range with step)', () =>
      this.assertEqual(isValidCronExpression('0-30/5 * * * *'), true, 'range-step'));

    this.runTest('60 * * * * is invalid (minute > 59)', () =>
      this.assertEqual(isValidCronExpression('60 * * * *'), false, 'invalid minute'));

    this.runTest('* 24 * * * is invalid (hour > 23)', () =>
      this.assertEqual(isValidCronExpression('* 24 * * *'), false, 'invalid hour'));

    this.runTest('* * 0 * * is invalid (dom < 1)', () =>
      this.assertEqual(isValidCronExpression('* * 0 * *'), false, 'invalid dom'));

    this.runTest('* * * 13 * is invalid (month > 12)', () =>
      this.assertEqual(isValidCronExpression('* * * 13 *'), false, 'invalid month'));

    this.runTest('* * * * 8 is invalid (dow > 7)', () =>
      this.assertEqual(isValidCronExpression('* * * * 8'), false, 'invalid dow'));

    this.runTest('only 4 fields is invalid', () =>
      this.assertEqual(isValidCronExpression('* * * *'), false, '4 fields'));

    this.runTest('6 fields is invalid', () =>
      this.assertEqual(isValidCronExpression('* * * * * *'), false, '6 fields'));

    this.runTest('empty string is invalid', () =>
      this.assertEqual(isValidCronExpression(''), false, 'empty'));

    this.runTest('alphabetic is invalid', () =>
      this.assertEqual(isValidCronExpression('abc def * * *'), false, 'alpha'));
  }

  // ── Field expansion tests ───────────────────────────────────────────────────
  runExpansionTests() {
    console.log('\n  Field expansion');

    this.runTest('expandField * 0-5 → {0,1,2,3,4,5}', () => {
      const s = expandField('*', 0, 5);
      for (let i = 0; i <= 5; i++) {
        if (!s.has(i)) throw new Error('Missing ' + i);
      }
      return this.assertEqual(s.size, 6, 'size');
    });

    this.runTest('expandField */15 0-59 → {0,15,30,45}', () => {
      const s = expandField('*/15', 0, 59);
      return this.assertEqual(s.size, 4, 'step 15');
    });

    this.runTest('expandField 1-3 → {1,2,3}', () => {
      const s = expandField('1-3', 0, 59);
      return this.assertEqual(s.size, 3, 'range 1-3');
    });

    this.runTest('expandField 1,3,5 → {1,3,5}', () => {
      const s = expandField('1,3,5', 0, 59);
      return this.assertEqual(s.size, 3, 'list');
    });

    this.runTest('expandField 0 → {0}', () => {
      const s = expandField('0', 0, 59);
      return this.assertEqual(s.size, 1, 'single zero');
    });

    this.runTest('expandField 1-5/2 → {1,3,5}', () => {
      const s = expandField('1-5/2', 0, 59);
      if (!s.has(1) || !s.has(3) || !s.has(5)) throw new Error('Missing values');
      return this.assertEqual(s.size, 3, 'range with step');
    });
  }

  // ── Parse structure tests ───────────────────────────────────────────────────
  runParseTests() {
    console.log('\n  Expression parsing');

    this.runTest('parse * * * * * returns 5 fields', () => {
      const f = parseCronExpression('* * * * *');
      if (!f) throw new Error('returned null');
      return this.assertEqual(f._parts.length, 5, 'parts length');
    });

    this.runTest('parse 0 9 * * 1-5 fields correct', () => {
      const f = parseCronExpression('0 9 * * 1-5');
      if (!f) throw new Error('returned null');
      if (f.minute !== '0')   throw new Error('minute wrong');
      if (f.hour   !== '9')   throw new Error('hour wrong');
      if (f.dow    !== '1-5') throw new Error('dow wrong');
      return true;
    });

    this.runTest('parse invalid returns null', () => {
      return this.assertEqual(parseCronExpression('not valid'), null, 'null');
    });

    this.runTest('parse extra whitespace is tolerated', () => {
      const f = parseCronExpression('  *   *  *  *  *  ');
      return this.assertEqual(f !== null, true, 'whitespace');
    });
  }

  // ── Common template expressions ─────────────────────────────────────────────
  runTemplateTests() {
    console.log('\n  Template expressions');

    const templates = [
      '* * * * *',
      '0 * * * *',
      '0 0 * * *',
      '0 9 * * *',
      '0 9 * * 1-5',
      '*/15 * * * *',
      '*/30 * * * *',
      '0 0 * * 0',
      '0 0 1 * *',
      '30 * * * *',
      '0 8,20 * * *',
      '*/5 * * * *'
    ];

    templates.forEach(function(expr) {
      this.runTest('template valid: ' + expr, function() {
        return this.assertEqual(isValidCronExpression(expr), true, expr);
      }.bind(this));
    }, this);
  }

  runAll() {
    console.log('🧪 Cron Expression Generator Test Suite');
    this.runValidationTests();
    this.runExpansionTests();
    this.runParseTests();
    this.runTemplateTests();

    console.log('\n  Summary: ' + this.testsPassed + '/' + this.totalTests + ' passed');
    return {
      total:       this.totalTests,
      passed:      this.testsPassed,
      failed:      this.testsFailed,
      failedTests: this.failedTests
    };
  }
}
