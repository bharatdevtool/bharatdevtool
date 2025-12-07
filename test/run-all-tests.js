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
import { QRTester } from './qr-tests.js';
import { QRDecoderTester } from './qr-decoder-tests.js';
import { JSONDiffTester } from './jsondiff-tests.js';

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
// JSON COMPARISON (DIFF) TESTS
// ============================================================================

console.log('\n' + '='.repeat(60));
const jsonDiffTester = new JSONDiffTester();
const jsonDiffResults = jsonDiffTester.runAllTests();

// ============================================================================
// FINAL TEST SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('📊 COMPREHENSIVE TEST SUMMARY');
console.log('='.repeat(60));

const grandTotal = totalTests + deeplinkResults.total + urlEncoderResults.total + qrResults.total + qrDecoderResults.total + jsonDiffResults.total;
const grandPassed = totalPassed + deeplinkResults.passed + urlEncoderResults.passed + qrResults.passed + qrDecoderResults.passed + jsonDiffResults.passed;
const grandFailed = totalFailed + deeplinkResults.failed + urlEncoderResults.failed + qrResults.failed + qrDecoderResults.failed + jsonDiffResults.failed;

console.log(`Total Tests: ${grandTotal}`);
console.log(`✅ Passed: ${grandPassed}`);
console.log(`❌ Failed: ${grandFailed}`);
console.log(`Success Rate: ${((grandPassed / grandTotal) * 100).toFixed(1)}%`);

console.log('\n📋 Test Suite Breakdown:');
console.log(`JSON Formatter: ${totalTests} tests (${totalPassed} passed, ${totalFailed} failed)`);
console.log(`DeepLink Launcher: ${deeplinkResults.total} tests (${deeplinkResults.passed} passed, ${deeplinkResults.failed} failed)`);
console.log(`URL Encoder/Decoder: ${urlEncoderResults.total} tests (${urlEncoderResults.passed} passed, ${urlEncoderResults.failed} failed)`);
console.log(`QR Code Generator: ${qrResults.total} tests (${qrResults.passed} passed, ${qrResults.failed} failed)`);
console.log(`QR Code Decoder: ${qrDecoderResults.total} tests (${qrDecoderResults.passed} passed, ${qrDecoderResults.failed} failed)`);
console.log(`JSON Comparison (Diff): ${jsonDiffResults.total} tests (${jsonDiffResults.passed} passed, ${jsonDiffResults.failed} failed)`);

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
  
  console.log('\nPlease review the failed tests above.');
  process.exit(1);
}
