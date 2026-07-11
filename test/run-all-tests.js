#!/usr/bin/env node

/**
 * Comprehensive Test Runner for Bharat Dev Tools
 * 
 * This script runs all test suites for the project:
 * - JSON Formatter tests (original)
 * - DeepLink Launcher tests (new)
 * - URL Encoder/Decoder tests (new)
 * - QR Code Generator tests (new)
 * 
 * Each test suite runs independently to avoid conflicts.
 * 
 * node test/run-all-tests.js to run the test suite
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the original formatter functions
import { 
  formatJSON,
  minifyJSON,
  isValidJSON,
  escapeJSONString,
  unescapeJSONString,
  repairJSON
} from '../assets/js/formatter.js';

// Import test classes
import { DeepLinkTester } from './deeplink-tests.js';
import { URLEncoderTester } from './url-encoder-tests.js';
import { Base64Tester } from './base64-tests.js';
import { QRTester } from './qr-tests.js';
import { QRDecoderTester } from './qr-decoder-tests.js';
import { JSONDiffTester } from './jsondiff-tests.js';
import { ColorPickerTester } from './color-picker-tests.js';
import { CurlTesterTests } from './curl-tester-tests.js';
import { CurlComparisonTests } from './curl-comparison-tests.js';
import { PasswordGeneratorTester } from './password-generator-tests.js';
import { TextCaseConverterTester } from './text-case-converter-tests.js';
import { UUIDGeneratorTester } from './uuid-generator-tests.js';
import { PercentageCalculatorTester } from './percentage-calculator-tests.js';
import { BMICalculatorTester } from './bmi-calculator-tests.js';
import { EMICalculatorTester } from './emi-calculator-tests.js';
import { TimestampConverterTester } from './timestamp-converter-tests.js';
import { JWTDecoderTester } from './jwt-decoder-tests.js';
import { ImageConverterTester } from './image-converter-tests.js';
import { ImageResizerTester } from './image-resizer-tests.js';
import { CSVJsonConverterTester } from './csv-json-converter-tests.js';
import { YAMLJSONConverterTester } from './yaml-json-converter-tests.js';
import { DiffCheckerTester } from './diff-checker-tests.js';
import { CronGeneratorTester } from './cron-generator-tests.js';
import { LoremIpsumTester } from './lorem-ipsum-tests.js';

// Test Results Tracking
let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;
let allFailedTests = [];

function runTest(testName, testFunction) {
  totalTests++;
  try {
    const result = testFunction();
    if (result === true) {
      totalPassed++;
      console.log(`✅ ${testName}`);
    } else {
      totalFailed++;
      allFailedTests.push(testName);
      console.log(`❌ ${testName} - Expected true, got ${result}`);
    }
  } catch (error) {
    totalFailed++;
    allFailedTests.push(testName);
    console.log(`❌ ${testName} - Error: ${error.message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    return true;
  } else {
    throw new Error(`${message} - Expected: ${expected}, Got: ${actual}`);
  }
}

function assertContains(actual, expected, message) {
  if (actual.includes(expected)) {
    return true;
  } else {
    throw new Error(`${message} - Expected to contain: ${expected}, Got: ${actual}`);
  }
}

// ============================================================================
// ORIGINAL JSON FORMATTER TESTS
// ============================================================================

function runJSONFormatterTests() {
  console.log('🧪 JSON Formatter Test Suite');
  console.log('============================\n');

  // Basic JSON Formatting Tests
  console.log('🧪 Testing Basic JSON Formatting...\n');

  runTest('formatJSON - Basic object formatting', () => {
    const input = '{"name":"John","age":30}';
    const expected = '{\n  "name": "John",\n  "age": 30\n}';
    return assertEqual(formatJSON(input), expected, 'Basic object formatting');
  });

  runTest('formatJSON - Array formatting', () => {
    const input = '[1,2,3,{"nested":"value"}]';
    const result = formatJSON(input);
    return assertContains(result, '"nested"', 'Array with nested object formatting');
  });

  runTest('formatJSON - Invalid JSON throws error', () => {
    try {
      formatJSON('{"invalid": json}');
      return false;
    } catch (error) {
      return assertContains(error.message, 'Invalid JSON', 'Invalid JSON should throw error');
    }
  });

  // JSON Minification Tests
  console.log('\n🧪 Testing JSON Minification...\n');

  runTest('minifyJSON - Basic minification', () => {
    const input = '{\n  "name": "John",\n  "age": 30\n}';
    const expected = '{"name":"John","age":30}';
    return assertEqual(minifyJSON(input), expected, 'Basic minification');
  });

  runTest('minifyJSON - Already minified', () => {
    const input = '{"name":"John","age":30}';
    const expected = '{"name":"John","age":30}';
    return assertEqual(minifyJSON(input), expected, 'Already minified JSON');
  });

  // JSON Validation Tests
  console.log('\n🧪 Testing JSON Validation...\n');

  runTest('isValidJSON - Valid JSON returns true', () => {
    return assertEqual(isValidJSON('{"name":"John"}'), true, 'Valid JSON should return true');
  });

  runTest('isValidJSON - Invalid JSON returns false', () => {
    return assertEqual(isValidJSON('{"invalid": json}'), false, 'Invalid JSON should return false');
  });

  runTest('isValidJSON - Empty string returns false', () => {
    return assertEqual(isValidJSON(''), false, 'Empty string should return false');
  });

  // JSON Repair Tests (Core Feature)
  console.log('\n🧪 Testing JSON Repair (Core Feature)...\n');

  runTest('repairJSON - Remove trailing commas', () => {
    const input = '{"name":"John",}';
    const result = repairJSON(input);
    return assertContains(result, '"name": "John"', 'Should remove trailing comma');
  });

  runTest('repairJSON - Quote unquoted keys', () => {
    const input = '{name:"John",age:30}';
    const result = repairJSON(input);
    return assertContains(result, '"name"', 'Should quote unquoted keys');
  });

  runTest('repairJSON - Replace undefined with null', () => {
    const input = '{"value":undefined}';
    const result = repairJSON(input);
    return assertContains(result, '"value": null', 'Should replace undefined with null');
  });

  runTest('repairJSON - Replace NaN with null', () => {
    const input = '{"value":NaN}';
    const result = repairJSON(input);
    return assertContains(result, '"value": null', 'Should replace NaN with null');
  });

  runTest('repairJSON - Replace Infinity with null', () => {
    const input = '{"value":Infinity}';
    const result = repairJSON(input);
    return assertContains(result, '"value": null', 'Should replace Infinity with null');
  });

  runTest('repairJSON - Remove single line comments', () => {
    const input = '{"name":"John"} // comment';
    const result = repairJSON(input);
    return assertEqual(result.trim(), '{\n  "name": "John"\n}', 'Should remove single line comments');
  });

  runTest('repairJSON - Remove multi-line comments', () => {
    const input = '{"name":"John"} /* comment */';
    const result = repairJSON(input);
    return assertEqual(result.trim(), '{\n  "name": "John"\n}', 'Should remove multi-line comments');
  });

  runTest('repairJSON - Unwrap JSONP', () => {
    const input = 'callback({"name":"John"})';
    const result = repairJSON(input);
    return assertContains(result, '"name": "John"', 'Should unwrap JSONP');
  });

  runTest('repairJSON - Handle single quotes', () => {
    const input = "{'name':'John'}";
    const result = repairJSON(input);
    return assertContains(result, '"name": "John"', 'Should convert single quotes to double quotes');
  });

  runTest('repairJSON - Add missing commas', () => {
    const input = '{"a":"x"\n"b":1}';
    const result = repairJSON(input);
    return assertContains(result, '"a": "x",', 'Should add missing commas');
  });

  runTest('repairJSON - Handle BOM', () => {
    const input = '\uFEFF{"name":"John"}';
    const result = repairJSON(input);
    return assertContains(result, '"name": "John"', 'Should remove BOM');
  });

  runTest('repairJSON - Wrap bare object', () => {
    const input = 'name:"John",age:30';
    const result = repairJSON(input);
    return assertContains(result, '{', 'Should wrap bare object in braces');
  });

  // Hex Color Preview Tests
  console.log('\n🧪 Testing Hex Color Preview Feature...\n');

  runTest('Hex Color Detection - 6 character hex', () => {
    const line = '  "color": "#ff0000",';
    const hexRegex = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
    const match = hexRegex.exec(line);
    return assertEqual(match[0], '#ff0000', 'Should detect 6-character hex color');
  });

  runTest('Hex Color Detection - 8 character hex with alpha', () => {
    const line = '  "color": "#ff0000ff",';
    const hexRegex = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
    const match = hexRegex.exec(line);
    return assertEqual(match[0], '#ff0000ff', 'Should detect 8-character hex color');
  });

  runTest('Hex Color Detection - 3 character hex', () => {
    const line = '  "color": "#f00",';
    const hexRegex = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
    const match = hexRegex.exec(line);
    return assertEqual(match[0], '#f00', 'Should detect 3-character hex color');
  });

  runTest('Hex Color Detection - Prioritize longer matches', () => {
    const line = '  "color": "#ff0000",';
    const hexRegex = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
    const match = hexRegex.exec(line);
    return assertEqual(match[0], '#ff0000', 'Should match full 6-character hex, not just #ff0');
  });

  // Search Functionality Tests
  console.log('\n🧪 Testing Search Functionality...\n');

  runTest('Search - Single character search', () => {
    const query = 'a';
    const text = '{"name":"John","age":30}';
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    return assertEqual(index !== -1, true, 'Should find single character matches');
  });

  runTest('Search - Case insensitive search', () => {
    const query = 'JOHN';
    const text = '{"name":"John","age":30}';
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    return assertEqual(index !== -1, true, 'Should be case insensitive');
  });

  // URL Detection Tests
  console.log('\n🧪 Testing URL Detection in JSON Formatter...\n');

  // Helper function to test URL detection (simulating isUrl function)
  function testIsUrl(text) {
    const cleanText = text.replace(/^["']|["']$/g, '').trim();
    try {
      if (cleanText.match(/^https?:\/\//i)) {
        new URL(cleanText);
        return true;
      }
      if (cleanText.match(/^[\da-z][\da-z\.-]*\.[a-z]{2,}/i)) {
        new URL('https://' + cleanText);
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  runTest('URL Detection - HTTP URL', () => {
    const url = 'https://example.com';
    return assertEqual(testIsUrl(url), true, 'Should detect HTTPS URL');
  });

  runTest('URL Detection - HTTPS URL', () => {
    const url = 'https://example.com';
    return assertEqual(testIsUrl(url), true, 'Should detect HTTPS URL');
  });

  runTest('URL Detection - URL with query parameters', () => {
    const url = 'https://www.google.com/maps/dir/?api=1&origin=12.918966000000001,77.63625060000003&destination=12.9759688,77.601646&travelmode=driving';
    return assertEqual(testIsUrl(url), true, 'Should detect URL with query parameters');
  });

  runTest('URL Detection - URL with single query parameter', () => {
    const url = 'https://example.com/page?param=value';
    return assertEqual(testIsUrl(url), true, 'Should detect URL with single query parameter');
  });

  runTest('URL Detection - URL with multiple query parameters', () => {
    const url = 'https://example.com/search?q=test&page=1&sort=date';
    return assertEqual(testIsUrl(url), true, 'Should detect URL with multiple query parameters');
  });

  runTest('URL Detection - URL with fragment', () => {
    const url = 'https://example.com/page#section';
    return assertEqual(testIsUrl(url), true, 'Should detect URL with fragment');
  });

  runTest('URL Detection - URL with query and fragment', () => {
    const url = 'https://example.com/page?param=value#section';
    return assertEqual(testIsUrl(url), true, 'Should detect URL with query and fragment');
  });

  runTest('URL Detection - URL with encoded characters', () => {
    const url = 'https://example.com/search?q=hello%20world&lang=en';
    return assertEqual(testIsUrl(url), true, 'Should detect URL with encoded characters');
  });

  runTest('URL Detection - URL with port number', () => {
    const url = 'https://example.com:8080/path';
    return assertEqual(testIsUrl(url), true, 'Should detect URL with port number');
  });

  runTest('URL Detection - Invalid text (not a URL)', () => {
    const text = 'This is not a URL';
    return assertEqual(testIsUrl(text), false, 'Should reject non-URL text');
  });

  runTest('URL Detection - URL in JSON string format', () => {
    const url = '"https://example.com?param=value"';
    return assertEqual(testIsUrl(url), true, 'Should detect URL when wrapped in quotes');
  });

  // Performance Tests
  console.log('\n🧪 Testing Performance...\n');

  runTest('Performance - Large JSON formatting', () => {
    const largeJson = JSON.stringify(Array.from({length: 1000}, (_, i) => ({id: i, name: `Item ${i}`})));
    const start = performance.now();
    const result = formatJSON(largeJson);
    const end = performance.now();
    const duration = end - start;
    return assertEqual(duration < 1000, true, `Large JSON formatting should complete in < 1s (took ${duration}ms)`);
  });

  // Edge Cases Tests
  console.log('\n🧪 Testing Edge Cases...\n');

  runTest('Edge Case - Empty input', () => {
    try {
      const result = repairJSON('');
      return assertEqual(result.trim(), '{}', 'Empty input should return empty object');
    } catch (error) {
      return assertContains(error.message, 'Could not repair JSON', 'Empty input should throw repair error');
    }
  });

  runTest('Edge Case - Whitespace only', () => {
    try {
      const result = repairJSON('   \n\t  ');
      return assertEqual(result.trim(), '{}', 'Whitespace only should return empty object');
    } catch (error) {
      return assertContains(error.message, 'Could not repair JSON', 'Whitespace only should throw repair error');
    }
  });

  // Integration Tests
  console.log('\n🧪 Testing Integration Scenarios...\n');

  runTest('Integration - Complete workflow with hex colors', () => {
    const input = `{
      "colors": {
        "primary": "#ff0000",
        "secondary": "#00ff00",
        "transparent": "#00000000"
      },
      "name": "Test"
    }`;
    
    const repaired = repairJSON(input);
    const isValid = isValidJSON(repaired);
    const formatted = formatJSON(repaired);
    
    return assertEqual(isValid, true, 'Complete workflow should produce valid JSON');
  });

  runTest('Integration - Complex JSON with all features', () => {
    const input = `{
      // This is a comment
      name: "John", // Another comment
      age: 30,
      colors: {
        primary: "#ff0000",
        secondary: "#00ff00"
      },
      url: "https://example.com",
      data: undefined,
      value: NaN
    }`;
    
    const result = repairJSON(input);
    const isValid = isValidJSON(result);
    
    return assertEqual(isValid, true, 'Complex JSON with all features should be repairable');
  });
}

// ============================================================================
// MAIN TEST EXECUTION
// ============================================================================

console.log('🧪 Bharat Dev Tools - Comprehensive Test Suite');
console.log('==============================================\n');

// Run JSON Formatter Tests
const jsonResults = runJSONFormatterTests();

// Run DeepLink Launcher Tests
console.log('\n' + '='.repeat(60));
const deeplinkTester = new DeepLinkTester();
const deeplinkResults = deeplinkTester.runAllTests();

// Run URL Encoder/Decoder Tests
console.log('\n' + '='.repeat(60));
const urlEncoderTester = new URLEncoderTester();
const urlEncoderResults = urlEncoderTester.runAllTests();

// Run QR Code Generator Tests
console.log('\n' + '='.repeat(60));
const qrTester = new QRTester();
const qrResults = qrTester.runAllTests();

// ============================================================================
// QR CODE DECODER TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('QR CODE DECODER TEST SUITE');
console.log('='.repeat(60));

const qrDecoderTester = new QRDecoderTester();
const qrDecoderResults = qrDecoderTester.runAllTests();

// ============================================================================
// BASE64 ENCODER/DECODER TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('BASE64 ENCODER/DECODER TEST SUITE');
console.log('='.repeat(60));

const base64Tester = new Base64Tester();
const base64Results = base64Tester.runAllTests();

// ============================================================================
// JSON COMPARISON (DIFF) TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
const jsonDiffTester = new JSONDiffTester();
const jsonDiffResults = jsonDiffTester.runAllTests();

// ============================================================================
// COLOR PICKER TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('COLOR PICKER TEST SUITE');
console.log('='.repeat(60));

const colorPickerTester = new ColorPickerTester();
const colorPickerResults = colorPickerTester.runAllTests();

// ============================================================================
// CURL TESTER TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('CURL TESTER TEST SUITE');
console.log('='.repeat(60));

const curlTesterTests = new CurlTesterTests();
const curlTesterResults = curlTesterTests.runAllTests();

// ============================================================================
// CURL COMPARISON TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('CURL COMPARISON TEST SUITE');
console.log('='.repeat(60));

const curlComparisonTests = new CurlComparisonTests();
const curlComparisonResults = curlComparisonTests.runAllTests();

console.log('\n' + '='.repeat(60));
console.log('TEXT CASE CONVERTER TEST SUITE');
console.log('='.repeat(60));

const textCaseConverterTester = new TextCaseConverterTester();
const textCaseConverterResults = textCaseConverterTester.runAllTests();

// ============================================================================
// PASSWORD GENERATOR TEST SUITE
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('PASSWORD GENERATOR TEST SUITE');
console.log('='.repeat(60));

const passwordGeneratorTester = new PasswordGeneratorTester();
const passwordGeneratorResults = passwordGeneratorTester.runAll();

// ============================================================================
// UUID GENERATOR TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('UUID GENERATOR TEST SUITE');
console.log('='.repeat(60));

const uuidTester = new UUIDGeneratorTester();
const uuidResults = uuidTester.runAll();

console.log('\n' + '='.repeat(60));
console.log('JWT DECODER TEST SUITE');
console.log('='.repeat(60));

const jwtTester = new JWTDecoderTester();
const jwtResults = jwtTester.runAll();

// ============================================================================
// PERCENTAGE CALCULATOR TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('PERCENTAGE CALCULATOR TEST SUITE');
console.log('='.repeat(60));

const percentageTester = new PercentageCalculatorTester();
const percentageResults = percentageTester.runAll();

// ============================================================================
// BMI CALCULATOR TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('BMI CALCULATOR TEST SUITE');
console.log('='.repeat(60));

const bmiTester = new BMICalculatorTester();
const bmiResults = bmiTester.runAll();

// ============================================================================
// EMI CALCULATOR TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('EMI CALCULATOR TEST SUITE');
console.log('='.repeat(60));

const emiTester = new EMICalculatorTester();
const emiResults = emiTester.runAllTests();
// UNIX TIMESTAMP CONVERTER TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('UNIX TIMESTAMP CONVERTER TEST SUITE');
console.log('='.repeat(60));

const timestampTester = new TimestampConverterTester();
const timestampResults = timestampTester.runAll();

// ============================================================================
// IMAGE CONVERTER TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('IMAGE CONVERTER TEST SUITE');
console.log('='.repeat(60));

const imageConverterTester = new ImageConverterTester();
const imageConverterResults = imageConverterTester.runAllTests();

// ============================================================================
// IMAGE RESIZER TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('IMAGE RESIZER TEST SUITE');
console.log('='.repeat(60));

const imageResizerTester = new ImageResizerTester();
const imageResizerResults = imageResizerTester.runAll();

// ============================================================================
// CSV ↔ JSON CONVERTER TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('CSV JSON CONVERTER TEST SUITE');
console.log('='.repeat(60));

const csvJsonTester = new CSVJsonConverterTester();
const csvJsonResults = csvJsonTester.runAllTests();

// ============================================================================
// YAML JSON CONVERTER TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('YAML JSON CONVERTER TEST SUITE');
console.log('='.repeat(60));

const yamlJsonTester = new YAMLJSONConverterTester();
const yamlJsonResults = yamlJsonTester.runAll();

// ============================================================================
// DIFF CHECKER TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('DIFF CHECKER TEST SUITE');
console.log('='.repeat(60));

const diffCheckerTester = new DiffCheckerTester();
const diffCheckerResults = diffCheckerTester.runAllTests();

// ============================================================================
// CRON EXPRESSION GENERATOR TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('CRON EXPRESSION GENERATOR TEST SUITE');
console.log('='.repeat(60));

const cronTester = new CronGeneratorTester();
const cronResults = cronTester.runAll();

// ============================================================================
// LOREM IPSUM GENERATOR TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('LOREM IPSUM GENERATOR TEST SUITE');
console.log('='.repeat(60));

const loremTester = new LoremIpsumTester();
const loremResults = loremTester.runAllTests();

// ============================================================================
// FINAL TEST SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('📊 COMPREHENSIVE TEST SUMMARY');
console.log('='.repeat(60));


const grandTotal = totalTests + deeplinkResults.total + urlEncoderResults.total + base64Results.total + qrResults.total + qrDecoderResults.total + jsonDiffResults.total + colorPickerResults.total + curlTesterResults.total + curlComparisonResults.total + passwordGeneratorResults.total + textCaseConverterResults.total + uuidResults.total + percentageResults.total + bmiResults.total + emiResults.total + timestampResults.total + jwtResults.total + imageConverterResults.total + imageResizerResults.total + csvJsonResults.total + yamlJsonResults.total + diffCheckerResults.total + cronResults.total + loremResults.total;
const grandPassed = totalPassed + deeplinkResults.passed + urlEncoderResults.passed + base64Results.passed + qrResults.passed + qrDecoderResults.passed + jsonDiffResults.passed + colorPickerResults.passed + curlTesterResults.passed + curlComparisonResults.passed + passwordGeneratorResults.passed + textCaseConverterResults.passed + uuidResults.passed + percentageResults.passed + bmiResults.passed + emiResults.passed + timestampResults.passed + jwtResults.passed + imageConverterResults.passed + imageResizerResults.passed + csvJsonResults.passed + yamlJsonResults.passed + diffCheckerResults.passed + cronResults.passed + loremResults.passed;
const grandFailed = totalFailed + deeplinkResults.failed + urlEncoderResults.failed + base64Results.failed + qrResults.failed + qrDecoderResults.failed + jsonDiffResults.failed + colorPickerResults.failed + curlTesterResults.failed + curlComparisonResults.failed + passwordGeneratorResults.failed + textCaseConverterResults.failed + uuidResults.failed + percentageResults.failed + bmiResults.failed + emiResults.failed + timestampResults.failed + jwtResults.failed + imageConverterResults.failed + imageResizerResults.failed + csvJsonResults.failed + yamlJsonResults.failed + diffCheckerResults.failed + cronResults.failed + loremResults.failed;

console.log(`Total Tests: ${grandTotal}`);
console.log(`✅ Passed: ${grandPassed}`);
console.log(`❌ Failed: ${grandFailed}`);
console.log(`Success Rate: ${((grandPassed / grandTotal) * 100).toFixed(1)}%`);

console.log('\n📋 Test Suite Breakdown:');
console.log(`JSON Formatter: ${totalTests} tests (${totalPassed} passed, ${totalFailed} failed)`);
console.log(`DeepLink Launcher: ${deeplinkResults.total} tests (${deeplinkResults.passed} passed, ${deeplinkResults.failed} failed)`);
console.log(`URL Encoder/Decoder: ${urlEncoderResults.total} tests (${urlEncoderResults.passed} passed, ${urlEncoderResults.failed} failed)`);
console.log(`Base64 Encoder/Decoder: ${base64Results.total} tests (${base64Results.passed} passed, ${base64Results.failed} failed)`);
console.log(`QR Code Generator: ${qrResults.total} tests (${qrResults.passed} passed, ${qrResults.failed} failed)`);
console.log(`QR Code Decoder: ${qrDecoderResults.total} tests (${qrDecoderResults.passed} passed, ${qrDecoderResults.failed} failed)`);
console.log(`JSON Comparison (Diff): ${jsonDiffResults.total} tests (${jsonDiffResults.passed} passed, ${jsonDiffResults.failed} failed)`);
console.log(`Color Picker: ${colorPickerResults.total} tests (${colorPickerResults.passed} passed, ${colorPickerResults.failed} failed)`);
console.log(`cURL Tester: ${curlTesterResults.total} tests (${curlTesterResults.passed} passed, ${curlTesterResults.failed} failed)`);
console.log(`cURL Comparison: ${curlComparisonResults.total} tests (${curlComparisonResults.passed} passed, ${curlComparisonResults.failed} failed)`);
console.log(`Password Generator: ${passwordGeneratorResults.total} tests (${passwordGeneratorResults.passed} passed, ${passwordGeneratorResults.failed} failed)`);
console.log(`Text Case Converter: ${textCaseConverterResults.total} tests (${textCaseConverterResults.passed} passed, ${textCaseConverterResults.failed} failed)`);
console.log(`UUID Generator: ${uuidResults.total} tests (${uuidResults.passed} passed, ${uuidResults.failed} failed)`);
console.log(`Percentage Calculator: ${percentageResults.total} tests (${percentageResults.passed} passed, ${percentageResults.failed} failed)`);
console.log(`BMI Calculator: ${bmiResults.total} tests (${bmiResults.passed} passed, ${bmiResults.failed} failed)`);
console.log(`EMI Calculator: ${emiResults.total} tests (${emiResults.passed} passed, ${emiResults.failed} failed)`);
console.log(`Unix Timestamp Converter: ${timestampResults.total} tests (${timestampResults.passed} passed, ${timestampResults.failed} failed)`);
console.log(`JWT Decoder: ${jwtResults.total} tests (${jwtResults.passed} passed, ${jwtResults.failed} failed)`);
console.log(`Image Converter: ${imageConverterResults.total} tests (${imageConverterResults.passed} passed, ${imageConverterResults.failed} failed)`);
console.log(`Image Resizer: ${imageResizerResults.total} tests (${imageResizerResults.passed} passed, ${imageResizerResults.failed} failed)`);
console.log(`CSV ↔ JSON Converter: ${csvJsonResults.total} tests (${csvJsonResults.passed} passed, ${csvJsonResults.failed} failed)`);
console.log(`YAML JSON Converter: ${yamlJsonResults.total} tests (${yamlJsonResults.passed} passed, ${yamlJsonResults.failed} failed)`);
console.log(`Diff Checker: ${diffCheckerResults.total} tests (${diffCheckerResults.passed} passed, ${diffCheckerResults.failed} failed)`);
console.log(`Cron Expression Generator: ${cronResults.total} tests (${cronResults.passed} passed, ${cronResults.failed} failed)`);
console.log(`Lorem Ipsum Generator: ${loremResults.total} tests (${loremResults.passed} passed, ${loremResults.failed} failed)`);


if (grandFailed === 0) {
  console.log('\n🎉 ALL TESTS PASSED! All components are working perfectly.');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${grandFailed} tests failed:`);
  
  if (totalFailed > 0) {
    console.log('\nJSON Formatter failures:');
    allFailedTests.forEach(test => console.log(`   - ${test}`));
  }
  
  if (deeplinkResults.failed > 0) {
    console.log('\nDeepLink Launcher failures:');
    deeplinkResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  
  if (urlEncoderResults.failed > 0) {
    console.log('\nURL Encoder/Decoder failures:');
    urlEncoderResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  
  if (base64Results.failed > 0) {
    console.log('\nBase64 Encoder/Decoder failures:');
    base64Results.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  
  if (qrResults.failed > 0) {
    console.log('\nQR Code Generator failures:');
    qrResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  
  if (qrDecoderResults.failed > 0) {
    console.log('\nQR Code Decoder failures:');
    qrDecoderResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  
  if (jsonDiffResults.failed > 0) {
    console.log('\nJSON Comparison (Diff) failures:');
    jsonDiffResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  
  if (colorPickerResults.failed > 0) {
    console.log('\nColor Picker failures:');
    colorPickerResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  
  if (curlTesterResults.failed > 0) {
    console.log('\ncURL Tester failures:');
    curlTesterResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  
  if (curlComparisonResults.failed > 0) {
    console.log('\ncURL Comparison failures:');
    curlComparisonResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }

  if (passwordGeneratorResults.failed > 0) {
    console.log('\nPassword Generator failures:');
    passwordGeneratorResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  if (textCaseConverterResults.failed > 0) {
    console.log('\nText Case Converter failures:');
    textCaseConverterResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  if (uuidResults.failed > 0) {
    console.log('\nUUID Generator failures:');
    uuidResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  if (percentageResults.failed > 0) {
    console.log('\nPercentage Calculator failures:');
    percentageResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  if (bmiResults.failed > 0) {
    console.log('\nBMI Calculator failures:');
    bmiResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  if (emiResults.failed > 0) {
    console.log('\nEMI Calculator failures:');
    emiResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  if (timestampResults.failed > 0) {
    console.log('\nUnix Timestamp Converter failures:');
    timestampResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  if (jwtResults.failed > 0) {
    console.log('\nJWT Decoder failures:');
    jwtResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  if (imageConverterResults.failed > 0) {
    console.log('\nImage Converter failures:');
    imageConverterResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  if (imageResizerResults.failed > 0) {
    console.log('\nImage Resizer failures:');
    imageResizerResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  if (csvJsonResults.failed > 0) {
    console.log('\nCSV ↔ JSON Converter failures:');
    csvJsonResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  if (yamlJsonResults.failed > 0) {
    console.log('\nYAML JSON Converter failures:');
    yamlJsonResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  if (diffCheckerResults.failed > 0) {
    console.log('\nDiff Checker failures:');
    diffCheckerResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  if (cronResults.failed > 0) {
    console.log('\nCron Expression Generator failures:');
    cronResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }
  if (loremResults.failed > 0) {
    console.log('\nLorem Ipsum Generator failures:');
    loremResults.failedTests.forEach(test => console.log(`   - ${test}`));
  }

  console.log('\nPlease review the failed tests above.');
  process.exit(1);
}