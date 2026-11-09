/**
 * Unix Timestamp Converter Test Suite
 *
 * Tests timestamp parsing, unit detection, date formatting helpers,
 * and relative time logic that mirror the browser implementation
 * in timestamp-converter.html.
 */

// ── Helpers (mirrors html implementation) ────────────────────────────────────

function detectTimestampUnit(raw) {
  const clean = raw.trim().replace(/[^0-9]/g, '');
  if (clean.length >= 13) return 'ms';
  return 's';
}

function parseTimestamp(raw) {
  if (raw.trim().startsWith('-')) return null;
  const clean = raw.trim().replace(/[^0-9.]/g, '');
  if (!clean) return null;
  const num = parseFloat(clean);
  if (isNaN(num)) return null;
  const unit = detectTimestampUnit(raw);
  return unit === 'ms' ? num : num * 1000;
}

function isValidTimestampMs(ms) {
  return ms >= -8640000000000000 && ms <= 8640000000000000;
}

function getRelativeTime(ms) {
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const future = diff > 0;

  const units = [
    { label: 'year',   ms: 365.25 * 24 * 3600 * 1000 },
    { label: 'month',  ms: 30.44 * 24 * 3600 * 1000 },
    { label: 'day',    ms: 24 * 3600 * 1000 },
    { label: 'hour',   ms: 3600 * 1000 },
    { label: 'minute', ms: 60 * 1000 },
    { label: 'second', ms: 1000 },
  ];

  for (let i = 0; i < units.length; i++) {
    const count = Math.floor(abs / units[i].ms);
    if (count >= 1) {
      const label = count + ' ' + units[i].label + (count !== 1 ? 's' : '');
      return future ? 'in ' + label : label + ' ago';
    }
  }
  return 'just now';
}

// ── Test Class ────────────────────────────────────────────────────────────────

export class TimestampConverterTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.failedTests = [];
  }

  assert(name, fn) {
    try {
      const result = fn();
      if (result === true) {
        this.passed++;
        console.log('  ✅ ' + name);
      } else {
        this.failed++;
        this.failedTests.push(name);
        console.log('  ❌ ' + name + ' — returned: ' + result);
      }
    } catch (e) {
      this.failed++;
      this.failedTests.push(name);
      console.log('  ❌ ' + name + ' — threw: ' + e.message);
    }
  }

  runAll() {
    console.log('\n🧪 Unix Timestamp Converter Tests\n');
    this.testDetectUnit();
    this.testParseTimestamp();
    this.testValidation();
    this.testRelativeTime();
    this.testKnownDates();

    console.log('\nResult: ' + this.passed + ' passed, ' + this.failed + ' failed');
    return { total: this.passed + this.failed, passed: this.passed, failed: this.failed, failedTests: this.failedTests };
  }

  testDetectUnit() {
    console.log('  — detectTimestampUnit');

    this.assert('10-digit number is seconds', () =>
      detectTimestampUnit('1700000000') === 's');

    this.assert('13-digit number is milliseconds', () =>
      detectTimestampUnit('1700000000000') === 'ms');

    this.assert('14-digit number is milliseconds', () =>
      detectTimestampUnit('17000000000001') === 'ms');

    this.assert('9-digit number is seconds', () =>
      detectTimestampUnit('999999999') === 's');

    this.assert('zero is seconds', () =>
      detectTimestampUnit('0') === 's');
  }

  testParseTimestamp() {
    console.log('  — parseTimestamp');

    this.assert('seconds input returns ms value', () => {
      const ms = parseTimestamp('1700000000');
      return ms === 1700000000 * 1000;
    });

    this.assert('milliseconds input returns same value', () => {
      const ms = parseTimestamp('1700000000000');
      return ms === 1700000000000;
    });

    this.assert('empty string returns null', () =>
      parseTimestamp('') === null);

    this.assert('non-numeric string returns null', () =>
      parseTimestamp('abc') === null);

    this.assert('negative value returns null', () =>
      parseTimestamp('-1') === null);

    this.assert('float seconds converts correctly', () => {
      const ms = parseTimestamp('1700000000.5');
      return ms === 1700000000.5 * 1000;
    });
  }

  testValidation() {
    console.log('  — isValidTimestampMs');

    this.assert('0 is valid', () =>
      isValidTimestampMs(0) === true);

    this.assert('current time ms is valid', () =>
      isValidTimestampMs(Date.now()) === true);

    this.assert('year 2100 ms is valid', () =>
      isValidTimestampMs(new Date('2100-01-01').getTime()) === true);

    this.assert('MAX_DATE boundary is valid', () =>
      isValidTimestampMs(8640000000000000) === true);

    this.assert('beyond MAX_DATE is invalid', () =>
      isValidTimestampMs(8640000000000001) === false);

    this.assert('known epoch ms 1700000000000 is valid', () =>
      isValidTimestampMs(1700000000000) === true);
  }

  testRelativeTime() {
    console.log('  — getRelativeTime');

    this.assert('past 1 year shows "X years ago"', () => {
      const ms = Date.now() - 2 * 365.25 * 24 * 3600 * 1000;
      const result = getRelativeTime(ms);
      return result.includes('ago') && result.includes('year');
    });

    this.assert('past 1 month shows "X month(s) ago"', () => {
      const ms = Date.now() - 45 * 24 * 3600 * 1000;
      const result = getRelativeTime(ms);
      return result.includes('ago') && result.includes('month');
    });

    this.assert('past 1 day shows "X day(s) ago"', () => {
      const ms = Date.now() - 2 * 24 * 3600 * 1000;
      const result = getRelativeTime(ms);
      return result.includes('ago') && result.includes('day');
    });

    this.assert('past 1 hour shows "X hour(s) ago"', () => {
      const ms = Date.now() - 2 * 3600 * 1000;
      const result = getRelativeTime(ms);
      return result.includes('ago') && result.includes('hour');
    });

    this.assert('past 1 minute shows "X minute(s) ago"', () => {
      const ms = Date.now() - 2 * 60 * 1000;
      const result = getRelativeTime(ms);
      return result.includes('ago') && result.includes('minute');
    });

    this.assert('future time shows "in X ..."', () => {
      const ms = Date.now() + 5 * 3600 * 1000;
      const result = getRelativeTime(ms);
      return result.startsWith('in ');
    });

    this.assert('very recent time shows "just now"', () => {
      const ms = Date.now() - 100;
      const result = getRelativeTime(ms);
      return result === 'just now';
    });

    this.assert('plural: 2 days ago', () => {
      const ms = Date.now() - 3 * 24 * 3600 * 1000;
      const result = getRelativeTime(ms);
      return result.includes('days');
    });

    this.assert('singular: 1 day ago', () => {
      const ms = Date.now() - 25 * 3600 * 1000;
      const result = getRelativeTime(ms);
      return result.includes('1 day');
    });
  }

  testKnownDates() {
    console.log('  — known date conversions');

    this.assert('timestamp 0 → Jan 1 1970 UTC', () => {
      const d = new Date(parseTimestamp('0'));
      return d.getUTCFullYear() === 1970 && d.getUTCMonth() === 0 && d.getUTCDate() === 1;
    });

    this.assert('timestamp 1700000000 → Nov 2023', () => {
      const d = new Date(parseTimestamp('1700000000'));
      return d.getUTCFullYear() === 2023 && d.getUTCMonth() === 10;
    });

    this.assert('1700000000 seconds == 1700000000000 ms for same date', () => {
      const fromSeconds = parseTimestamp('1700000000');
      const fromMs      = parseTimestamp('1700000000000');
      return fromSeconds === fromMs;
    });

    this.assert('ISO string round-trip', () => {
      const ms = parseTimestamp('1700000000');
      const iso = new Date(ms).toISOString();
      return iso.startsWith('2023-11-14');
    });
  }
}
