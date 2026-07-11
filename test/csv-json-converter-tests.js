/**
 * CSV ↔ JSON Converter Test Suite
 *
 * Tests CSV-to-JSON and JSON-to-CSV conversion logic that mirrors
 * the browser implementation in csv-json-converter.html.
 */

'use strict';

// ── Inline core logic (mirrors csv-json-converter.html) ──────────────────────

function parseCSVRow(row, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function convertCSVtoJSON(csvText, delimiter, hasHeader, pretty) {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter(l => l.trim() !== '');
  if (nonEmpty.length === 0) throw new Error('Input is empty.');
  let headers, dataLines;
  if (hasHeader) {
    if (nonEmpty.length < 2) throw new Error('CSV must have at least a header row and one data row.');
    headers = parseCSVRow(nonEmpty[0], delimiter);
    dataLines = nonEmpty.slice(1);
  } else {
    const colCount = parseCSVRow(nonEmpty[0], delimiter).length;
    headers = Array.from({ length: colCount }, (_, i) => 'column' + (i + 1));
    dataLines = nonEmpty;
  }
  const result = dataLines.map(line => {
    const values = parseCSVRow(line, delimiter);
    const obj = {};
    headers.forEach((header, i) => {
      const key = header.trim() || ('column' + (i + 1));
      const raw = values[i] !== undefined ? values[i].trim() : '';
      if (raw !== '' && !isNaN(Number(raw))) { obj[key] = Number(raw); }
      else if (raw === 'true') { obj[key] = true; }
      else if (raw === 'false') { obj[key] = false; }
      else if (raw === 'null' || raw === '') { obj[key] = null; }
      else { obj[key] = raw; }
    });
    return obj;
  });
  return pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);
}

function escapeCsvField(value, delimiter) {
  const str = value === null || value === undefined ? '' : String(value);
  const needsQuotes = str.includes('"') || str.includes(delimiter) || str.includes('\n') || str.includes('\r');
  return needsQuotes ? '"' + str.replace(/"/g, '""') + '"' : str;
}

function convertJSONtoCSV(jsonText, delimiter, includeHeader) {
  let parsed;
  try { parsed = JSON.parse(jsonText); } catch (e) { throw new Error('Invalid JSON: ' + e.message); }
  if (!Array.isArray(parsed)) {
    if (typeof parsed === 'object' && parsed !== null) { parsed = [parsed]; }
    else { throw new Error('JSON must be an array of objects or a single object.'); }
  }
  if (parsed.length === 0) throw new Error('JSON array is empty — nothing to convert.');
  const allKeys = [];
  parsed.forEach(obj => {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return;
    Object.keys(obj).forEach(k => { if (!allKeys.includes(k)) allKeys.push(k); });
  });
  if (allKeys.length === 0) throw new Error('No object keys found in JSON array items.');
  const rows = [];
  if (includeHeader) rows.push(allKeys.map(k => escapeCsvField(k, delimiter)).join(delimiter));
  parsed.forEach(obj => {
    const row = allKeys.map(key => {
      const val = (typeof obj === 'object' && obj !== null) ? obj[key] : undefined;
      return escapeCsvField(val === undefined ? '' : val, delimiter);
    });
    rows.push(row.join(delimiter));
  });
  return rows.join('\n');
}

// ── Test Class ────────────────────────────────────────────────────────────────

export class CSVJsonConverterTester {
  constructor() {
    this.totalTests = 0;
    this.testsPassed = 0;
    this.testsFailed = 0;
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
      console.log(`❌ ${name} - ${err.message}`);
    }
  }

  assertEqual(actual, expected, msg) {
    if (actual === expected) return true;
    throw new Error(`${msg || ''} — expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`);
  }

  assertDeepEqual(actual, expected, msg) {
    if (JSON.stringify(actual) === JSON.stringify(expected)) return true;
    throw new Error(`${msg || ''} — expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`);
  }

  assertThrows(fn, msgContains) {
    try {
      fn();
      throw new Error('Expected function to throw, but it did not.');
    } catch (err) {
      if (msgContains && !err.message.includes(msgContains)) {
        throw new Error(`Expected error containing "${msgContains}" but got: ${err.message}`);
      }
      return true;
    }
  }

  // ── CSV → JSON ──────────────────────────────────────────────────────────────
  testCsvToJson() {
    console.log('\n🧪 Testing CSV → JSON…\n');

    this.runTest('basic CSV with header row', () => {
      const out = JSON.parse(convertCSVtoJSON('name,age\nAlice,30\nBob,25', ',', true, false));
      return this.assertDeepEqual(out, [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]);
    });

    this.runTest('numeric type coercion', () => {
      const out = JSON.parse(convertCSVtoJSON('val\n42\n3.14', ',', true, false));
      if (out[0].val !== 42) throw new Error('Expected 42');
      if (out[1].val !== 3.14) throw new Error('Expected 3.14');
      return true;
    });

    this.runTest('boolean type coercion', () => {
      const out = JSON.parse(convertCSVtoJSON('flag\ntrue\nfalse', ',', true, false));
      if (out[0].flag !== true) throw new Error('Expected true');
      if (out[1].flag !== false) throw new Error('Expected false');
      return true;
    });

    this.runTest('null coercion for empty fields', () => {
      const out = JSON.parse(convertCSVtoJSON('a,b\n1,\n2,hello', ',', true, false));
      if (out[0].b !== null) throw new Error('Expected null');
      if (out[1].b !== 'hello') throw new Error('Expected hello');
      return true;
    });

    this.runTest('null literal coercion', () => {
      const out = JSON.parse(convertCSVtoJSON('x\nnull', ',', true, false));
      return this.assertEqual(out[0].x, null, 'null literal');
    });

    this.runTest('semicolon delimiter', () => {
      const out = JSON.parse(convertCSVtoJSON('a;b\n1;2', ';', true, false));
      return this.assertDeepEqual(out, [{ a: 1, b: 2 }]);
    });

    this.runTest('tab delimiter (TSV)', () => {
      const out = JSON.parse(convertCSVtoJSON('a\tb\n1\t2', '\t', true, false));
      return this.assertDeepEqual(out, [{ a: 1, b: 2 }]);
    });

    this.runTest('pipe delimiter', () => {
      const out = JSON.parse(convertCSVtoJSON('a|b\nfoo|bar', '|', true, false));
      return this.assertDeepEqual(out, [{ a: 'foo', b: 'bar' }]);
    });

    this.runTest('no header row generates column names', () => {
      const out = JSON.parse(convertCSVtoJSON('Alice,30\nBob,25', ',', false, false));
      if (out[0].column1 !== 'Alice') throw new Error('Expected Alice');
      if (out[0].column2 !== 30) throw new Error('Expected 30');
      return true;
    });

    this.runTest('quoted fields with comma inside', () => {
      const out = JSON.parse(convertCSVtoJSON('name,address\nAlice,"Mumbai, India"', ',', true, false));
      return this.assertEqual(out[0].address, 'Mumbai, India', 'quoted field');
    });

    this.runTest('quoted fields with escaped double-quote', () => {
      const out = JSON.parse(convertCSVtoJSON('val\n"say ""hello"""', ',', true, false));
      return this.assertEqual(out[0].val, 'say "hello"', 'escaped quote');
    });

    this.runTest('pretty-print produces indented JSON', () => {
      const out = convertCSVtoJSON('a\n1', ',', true, true);
      if (!out.startsWith('[\n')) throw new Error('Expected indented JSON');
      return true;
    });

    this.runTest('CRLF line endings handled', () => {
      const out = JSON.parse(convertCSVtoJSON('a,b\r\n1,2\r\n3,4', ',', true, false));
      if (out.length !== 2) throw new Error('Expected 2 rows');
      if (out[0].a !== 1) throw new Error('Expected 1');
      return true;
    });

    this.runTest('empty input throws', () =>
      this.assertThrows(() => convertCSVtoJSON('   ', ',', true, false), 'empty'));

    this.runTest('header-only CSV throws (hasHeader=true)', () =>
      this.assertThrows(() => convertCSVtoJSON('name,age', ',', true, false), 'header row'));

    this.runTest('multiple rows produce correct array length', () => {
      const out = JSON.parse(convertCSVtoJSON('id\n1\n2\n3\n4\n5', ',', true, false));
      return this.assertEqual(out.length, 5, 'array length');
    });
  }

  // ── JSON → CSV ──────────────────────────────────────────────────────────────
  testJsonToCsv() {
    console.log('\n🧪 Testing JSON → CSV…\n');

    this.runTest('basic array of objects', () => {
      const csv = convertJSONtoCSV('[{"name":"Alice","age":30},{"name":"Bob","age":25}]', ',', true);
      const lines = csv.split('\n');
      if (lines[0] !== 'name,age') throw new Error('Header mismatch: ' + lines[0]);
      if (lines[1] !== 'Alice,30') throw new Error('Row 1 mismatch: ' + lines[1]);
      if (lines[2] !== 'Bob,25') throw new Error('Row 2 mismatch: ' + lines[2]);
      return true;
    });

    this.runTest('no header option omits header row', () => {
      const csv = convertJSONtoCSV('[{"a":1}]', ',', false);
      return this.assertEqual(csv.split('\n').length, 1, 'no header');
    });

    this.runTest('single object (not array) is wrapped', () => {
      const lines = convertJSONtoCSV('{"x":"hello"}', ',', true).split('\n');
      if (lines[0] !== 'x') throw new Error('Header mismatch');
      if (lines[1] !== 'hello') throw new Error('Row mismatch');
      return true;
    });

    this.runTest('null values become empty string', () => {
      const csv = convertJSONtoCSV('[{"a":null}]', ',', true);
      return this.assertEqual(csv.split('\n')[1], '', 'null to empty');
    });

    this.runTest('fields with commas are quoted', () => {
      const csv = convertJSONtoCSV('[{"address":"Mumbai, India"}]', ',', true);
      return this.assertEqual(csv.split('\n')[1], '"Mumbai, India"', 'quoted field');
    });

    this.runTest('fields with double-quotes are escaped', () => {
      const csv = convertJSONtoCSV('[{"q":"say \\"hi\\""}]', ',', true);
      return this.assertEqual(csv.split('\n')[1], '"say ""hi"""', 'escaped quote');
    });

    this.runTest('boolean values output as string', () => {
      const csv = convertJSONtoCSV('[{"ok":true,"fail":false}]', ',', true);
      return this.assertEqual(csv.split('\n')[1], 'true,false', 'booleans');
    });

    this.runTest('sparse keys — missing key outputs empty', () => {
      const csv = convertJSONtoCSV('[{"a":1,"b":2},{"a":3}]', ',', true);
      const lines = csv.split('\n');
      if (lines[0] !== 'a,b') throw new Error('Header mismatch');
      if (lines[2] !== '3,') throw new Error('Sparse row mismatch: ' + lines[2]);
      return true;
    });

    this.runTest('semicolon delimiter in JSON→CSV', () => {
      const csv = convertJSONtoCSV('[{"a":1,"b":2}]', ';', true);
      const lines = csv.split('\n');
      if (lines[0] !== 'a;b') throw new Error('Header: ' + lines[0]);
      if (lines[1] !== '1;2') throw new Error('Row: ' + lines[1]);
      return true;
    });

    this.runTest('invalid JSON throws', () =>
      this.assertThrows(() => convertJSONtoCSV('{bad}', ',', true), 'Invalid JSON'));

    this.runTest('empty array throws', () =>
      this.assertThrows(() => convertJSONtoCSV('[]', ',', true), 'empty'));

    this.runTest('non-object/non-array JSON throws', () =>
      this.assertThrows(() => convertJSONtoCSV('"just a string"', ',', true)));
  }

  // ── parseCSVRow ─────────────────────────────────────────────────────────────
  testParseCSVRow() {
    console.log('\n🧪 Testing parseCSVRow…\n');

    this.runTest('simple comma split', () =>
      this.assertDeepEqual(parseCSVRow('a,b,c', ','), ['a', 'b', 'c']));

    this.runTest('quoted field preserves delimiter inside', () =>
      this.assertDeepEqual(parseCSVRow('"a,b",c', ','), ['a,b', 'c']));

    this.runTest('double-quote escape inside quoted field', () =>
      this.assertDeepEqual(parseCSVRow('"a""b"', ','), ['a"b']));

    this.runTest('empty fields produce empty strings', () =>
      this.assertDeepEqual(parseCSVRow(',,', ','), ['', '', '']));
  }

  runAllTests() {
    console.log('📊 CSV ↔ JSON Converter Test Suite');
    console.log('====================================\n');
    this.testCsvToJson();
    this.testJsonToCsv();
    this.testParseCSVRow();

    console.log('\n────────────────────────────────────────');
    console.log(`CSV ↔ JSON Converter: ${this.testsPassed}/${this.totalTests} passed`);
    if (this.testsFailed > 0) {
      console.log('Failed tests:', this.failedTests);
    }
    return {
      passed: this.testsPassed,
      failed: this.testsFailed,
      total: this.totalTests,
      failedTests: this.failedTests
    };
  }
}
