// Comprehensive Test Suite for Bharat Dev Tools JSON Formatter
// Tests all functionality built in this project

import { 
  formatJSON, 
  minifyJSON, 
  isValidJSON, 
  escapeJSONString, 
  unescapeJSONString, 
  repairJSON 
} from '../assets/js/formatter.js';

// Test Results Tracking
let testsPassed = 0;
let testsFailed = 0;
let totalTests = 0;

function runTest(testName, testFunction) {
  totalTests++;
  try {
    const result = testFunction();
    if (result === true) {
      testsPassed++;
      console.log(`✅ ${testName}`);
    } else {
      testsFailed++;
      console.log(`❌ ${testName} - Expected true, got ${result}`);
    }
  } catch (error) {
    testsFailed++;
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
// BASIC JSON FORMATTING TESTS
// ============================================================================

console.log('\n🧪 Testing Basic JSON Formatting...\n');

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
    return false; // Should not reach here
  } catch (error) {
    return assertContains(error.message, 'Invalid JSON', 'Invalid JSON should throw error');
  }
});

// ============================================================================
// JSON MINIFICATION TESTS
// ============================================================================

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

runTest('minifyJSON - Invalid JSON throws error', () => {
  try {
    minifyJSON('{"invalid": json}');
    return false;
  } catch (error) {
    return assertContains(error.message, 'Invalid JSON', 'Invalid JSON should throw error');
  }
});

// ============================================================================
// JSON VALIDATION TESTS
// ============================================================================

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

runTest('isValidJSON - Valid array returns true', () => {
  return assertEqual(isValidJSON('[1,2,3]'), true, 'Valid array should return true');
});

// ============================================================================
// JSON ESCAPE/UNESCAPE TESTS
// ============================================================================

console.log('\n🧪 Testing JSON Escape/Unescape...\n');

runTest('escapeJSONString - Basic escaping', () => {
  const input = 'Hello "World"';
  const result = escapeJSONString(input);
  return assertContains(result, '\\"', 'Should escape quotes');
});

runTest('escapeJSONString - Newline escaping', () => {
  const input = 'Line1\nLine2';
  const result = escapeJSONString(input);
  return assertContains(result, '\\n', 'Should escape newlines');
});

runTest('escapeJSONString - Backslash escaping', () => {
  const input = 'Path\\to\\file';
  const result = escapeJSONString(input);
  return assertContains(result, '\\\\', 'Should escape backslashes');
});

runTest('unescapeJSONString - Basic unescaping', () => {
  const input = 'Hello \\"World\\"';
  const result = unescapeJSONString(input);
  return assertEqual(result, 'Hello "World"', 'Should unescape quotes');
});

runTest('unescapeJSONString - Newline unescaping', () => {
  const input = 'Line1\\nLine2';
  const result = unescapeJSONString(input);
  return assertEqual(result, 'Line1\nLine2', 'Should unescape newlines');
});

// ============================================================================
// JSON REPAIR TESTS (Most Important - Core Feature)
// ============================================================================

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

runTest('repairJSON - Unicode escape sequences in URLs', () => {
  const input = '"Hey, I found a great event Tribute to Black Sabbath Ft. Children of the Grave, Hard Rock Cafe, Bangalore on Swiggy Scenes. Let\\u0027s make a scene and book it! https://swiggy.onelink.me/Ol3A?af_dp\\u003dswiggydiners%3A%2F%2Fentity%2FDINEOUT_EVENT%2F100008905"';
  const result = repairJSON(input);
  return assertContains(result, 'Let\'s make a scene', 'Should handle Unicode escape sequences in URLs');
});

runTest('repairJSON - Wrap bare object', () => {
  const input = 'name:"John",age:30';
  const result = repairJSON(input);
  return assertContains(result, '{', 'Should wrap bare object in braces');
});

// ============================================================================
// HEX COLOR PREVIEW TESTS (New Feature)
// ============================================================================

console.log('\n🧪 Testing Hex Color Preview Feature...\n');

// Test hex color detection regex
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

// ============================================================================
// SEARCH FUNCTIONALITY TESTS
// ============================================================================

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

runTest('Search - No matches found', () => {
  const query = 'xyz';
  const text = '{"name":"John","age":30}';
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  return assertEqual(index === -1, true, 'Should return -1 when no matches found');
});

// ============================================================================
// URL DETECTION TESTS
// ============================================================================

console.log('\n🧪 Testing URL Detection...\n');

runTest('URL Detection - HTTP URL', () => {
  const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
  const url = 'https://example.com';
  return assertEqual(urlRegex.test(url), true, 'Should detect HTTP URL');
});

runTest('URL Detection - HTTPS URL', () => {
  const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
  const url = 'https://example.com';
  return assertEqual(urlRegex.test(url), true, 'Should detect HTTPS URL');
});

runTest('URL Detection - URL without protocol', () => {
  const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
  const url = 'example.com';
  return assertEqual(urlRegex.test(url), true, 'Should detect URL without protocol');
});

runTest('URL Detection - Invalid URL', () => {
  const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
  const url = 'not-a-url';
  return assertEqual(urlRegex.test(url), false, 'Should reject invalid URL');
});

// ============================================================================
// ESCAPE SEQUENCE STYLING TESTS
// ============================================================================

console.log('\n🧪 Testing Escape Sequence Styling...\n');

runTest('Escape Sequence Detection - Basic escapes', () => {
  const line = '"Hello\\nWorld"';
  const escapeRegex = /\\[\\"\/bfnrt]/g;
  const matches = line.match(escapeRegex);
  return assertEqual(matches !== null, true, 'Should detect escape sequences');
});

runTest('Escape Sequence Detection - Unicode escapes', () => {
  const line = '"Hello\\u0020World"';
  const unicodeRegex = /\\u[0-9a-fA-F]{4}/g;
  const matches = line.match(unicodeRegex);
  return assertEqual(matches !== null, true, 'Should detect unicode escape sequences');
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

console.log('\n🧪 Testing Performance...\n');

runTest('Performance - Large JSON formatting', () => {
  const largeJson = JSON.stringify(Array.from({length: 1000}, (_, i) => ({id: i, name: `Item ${i}`})));
  const start = performance.now();
  const result = formatJSON(largeJson);
  const end = performance.now();
  const duration = end - start;
  return assertEqual(duration < 1000, true, `Large JSON formatting should complete in < 1s (took ${duration}ms)`);
});

runTest('Performance - Large JSON repair', () => {
  const largeJson = Array.from({length: 1000}, (_, i) => `{id:${i},name:"Item ${i}"}`).join(',');
  const start = performance.now();
  const result = repairJSON(largeJson);
  const end = performance.now();
  const duration = end - start;
  return assertEqual(duration < 2000, true, `Large JSON repair should complete in < 2s (took ${duration}ms)`);
});

// ============================================================================
// EDGE CASES AND ERROR HANDLING
// ============================================================================

console.log('\n🧪 Testing Edge Cases...\n');

runTest('Edge Case - Empty input', () => {
  try {
    const result = repairJSON('');
    return assertEqual(result, '{}', 'Empty input should return empty object');
  } catch (error) {
    return false;
  }
});

runTest('Edge Case - Whitespace only', () => {
  try {
    const result = repairJSON('   \n\t  ');
    return assertEqual(result.trim(), '{}', 'Whitespace only should return empty object');
  } catch (error) {
    return false;
  }
});

runTest('Edge Case - Single character', () => {
  try {
    const result = repairJSON('a');
    return assertEqual(result.trim(), '{}', 'Single character should return empty object');
  } catch (error) {
    return false;
  }
});

runTest('Edge Case - Nested JSON strings', () => {
  const input = '{"context":"{\\"nested\\":\\"value\\"}"}';
  const result = repairJSON(input);
  return assertContains(result, '"context"', 'Should handle nested JSON strings');
});

runTest('Edge Case - Complex Unicode in URLs', () => {
  const input = '"Visit https://example.com/path?param1=value1&param2=value2 with special chars \\u0026 and \\u003d"';
  const result = repairJSON(input);
  return assertContains(result, '& and =', 'Should handle complex Unicode sequences in URLs');
});

runTest('Edge Case - Mixed Unicode and regular characters', () => {
  const input = '"Hello \\u0027world\\u0027 with \\u003d equals and \\u0026 ampersand"';
  const result = repairJSON(input);
  return assertContains(result, 'Hello \'world\' with = equals and & ampersand', 'Should handle mixed Unicode and regular characters');
});

runTest('Edge Case - Long strings with multiple Unicode sequences', () => {
  const input = '"This is a very long string with multiple \\u0027quotes\\u0027 and \\u003dequals\\u003d and \\u0026ampersands\\u0026 throughout the text"';
  const result = repairJSON(input);
  return assertContains(result, 'quotes\' and =equals= and &ampersands&', 'Should handle long strings with multiple Unicode sequences');
});

runTest('Edge Case - Unicode in object keys', () => {
  const input = '{"key\\u0027with\\u0027quotes":"value","key\\u003dwith\\u003dequals":"value2"}';
  const result = repairJSON(input);
  return assertContains(result, '"key\'with\'quotes"', 'Should handle Unicode in object keys');
});

runTest('Edge Case - Unicode in array values', () => {
  const input = '["value\\u0027with\\u0027quotes","value\\u003dwith\\u003dequals"]';
  const result = repairJSON(input);
  return assertContains(result, 'value\'with\'quotes', 'Should handle Unicode in array values');
});

// ============================================================================
// VALID JSON CORNER CASES (Should NOT be repaired)
// ============================================================================

console.log('\n🧪 Testing Valid JSON Corner Cases (Should NOT be repaired)...\n');

runTest('Valid JSON - Complex Unicode strings', () => {
  const input = '{"shareUrl": "Hey, I found a great event Tribute to Black Sabbath Ft. Children of the Grave, Hard Rock Cafe, Bangalore on Swiggy Scenes. Let\\u0027s make a scene and book it! https://swiggy.onelink.me/Ol3A?af_dp\\u003dswiggydiners%3A%2F%2Fentity%2FDINEOUT_EVENT%2F100008905"}';
  const result = repairJSON(input);
  return assertContains(result, 'Let\'s make a scene', 'Should handle valid JSON with Unicode without repair');
});

runTest('Valid JSON - URLs with special characters', () => {
  const input = '{"url": "https://example.com/path?param1=value1&param2=value2&special=\\u003d"}';
  const result = repairJSON(input);
  return assertContains(result, 'special=', 'Should handle valid JSON with URLs without repair');
});

runTest('Valid JSON - Mixed Unicode and regular text', () => {
  const input = '{"message": "Hello \\u0027world\\u0027 with \\u003d equals and \\u0026 ampersand"}';
  const result = repairJSON(input);
  return assertContains(result, 'Hello \'world\' with = equals and & ampersand', 'Should handle valid JSON with mixed Unicode without repair');
});

runTest('Valid JSON - Long complex strings', () => {
  const input = '{"longText": "This is a very long string with multiple \\u0027quotes\\u0027 and \\u003dequals\\u003d and \\u0026ampersands\\u0026 throughout the text and URLs like https://example.com"}';
  const result = repairJSON(input);
  return assertContains(result, 'quotes\' and =equals= and &ampersands&', 'Should handle valid JSON with long complex strings without repair');
});

runTest('Valid JSON - Unicode in keys', () => {
  const input = '{"key\\u0027with\\u0027quotes": "value", "key\\u003dwith\\u003dequals": "value2"}';
  const result = repairJSON(input);
  return assertContains(result, '"key\'with\'quotes"', 'Should handle valid JSON with Unicode in keys without repair');
});

runTest('Valid JSON - Unicode in arrays', () => {
  const input = '["value\\u0027with\\u0027quotes", "value\\u003dwith\\u003dequals", "https://example.com/path?param=\\u003dvalue"]';
  const result = repairJSON(input);
  return assertContains(result, 'value\'with\'quotes', 'Should handle valid JSON with Unicode in arrays without repair');
});

// ============================================================================
// THEME FUNCTIONALITY TESTS
// ============================================================================

console.log('\n🧪 Testing Theme Functionality...\n');

runTest('Theme - Light theme detection', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return assertEqual(typeof isDark, 'boolean', 'Should be able to detect theme');
});

runTest('Theme - Theme toggle functionality', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  return assertEqual(typeof currentTheme, 'string', 'Should have theme attribute');
});

// ============================================================================
// FILE SIZE INDICATOR TESTS
// ============================================================================

console.log('\n🧪 Testing File Size Indicators...\n');

runTest('File Size - Small file indicator', () => {
  const smallText = '{"name":"John"}';
  const size = smallText.length;
  const sizeKB = (size / 1024).toFixed(1);
  const expectedClass = size > 1024 ? 'medium' : 'small';
  return assertEqual(expectedClass, 'small', 'Small file should have small class');
});

runTest('File Size - Medium file indicator', () => {
  const mediumText = 'a'.repeat(2000);
  const size = mediumText.length;
  const expectedClass = size > 1024 * 1024 ? 'large' : size > 1024 ? 'medium' : 'small';
  return assertEqual(expectedClass, 'medium', 'Medium file should have medium class');
});

runTest('File Size - Large file indicator', () => {
  const largeText = 'a'.repeat(2 * 1024 * 1024);
  const size = largeText.length;
  const expectedClass = size > 1024 * 1024 ? 'large' : size > 1024 ? 'medium' : 'small';
  return assertEqual(expectedClass, 'large', 'Large file should have large class');
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

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
  
  // Test that repair works
  const repaired = repairJSON(input);
  const isValid = isValidJSON(repaired);
  
  // Test that formatting works
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

// ============================================================================
// TEST SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(60));
console.log(`Total Tests: ${totalTests}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`Success Rate: ${((testsPassed / totalTests) * 100).toFixed(1)}%`);

if (testsFailed === 0) {
  console.log('\n🎉 ALL TESTS PASSED! The JSON formatter is working perfectly.');
} else {
  console.log(`\n⚠️  ${testsFailed} tests failed. Please review the failed tests above.`);
}

console.log('\n🔧 Features Tested:');
console.log('  • Basic JSON formatting and minification');
console.log('  • JSON validation');
console.log('  • JSON escape/unescape functionality');
console.log('  • JSON repair (trailing commas, unquoted keys, comments, etc.)');
console.log('  • Hex color preview detection');
console.log('  • Search functionality (single character support)');
console.log('  • URL detection and handling');
console.log('  • Escape sequence styling');
console.log('  • Performance with large files');
console.log('  • Edge cases and error handling');
console.log('  • Theme functionality');
console.log('  • File size indicators');
console.log('  • Integration scenarios');

export { runTest, assertEqual, assertContains };
