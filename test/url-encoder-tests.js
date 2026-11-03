/**
 * URL Encoder/Decoder Test Suite
 * 
 * Comprehensive tests for URL encoder/decoder functionality including:
 * - URL encoding/decoding
 * - Special characters handling
 * - Edge cases and complex scenarios
 * - Performance testing
 */

// URL Encoder Test Class
class URLEncoderTester {
  constructor() {
    this.testsPassed = 0;
    this.testsFailed = 0;
    this.totalTests = 0;
    this.failedTests = [];
  }

  runTest(testName, testFunction) {
    this.totalTests++;
    try {
      const result = testFunction();
      if (result === true) {
        this.testsPassed++;
        console.log(`✅ ${testName}`);
      } else {
        this.testsFailed++;
        this.failedTests.push(testName);
        console.log(`❌ ${testName} - Expected true, got ${result}`);
      }
    } catch (error) {
      this.testsFailed++;
      this.failedTests.push(testName);
      console.log(`❌ ${testName} - Error: ${error.message}`);
    }
  }

  assertEqual(actual, expected, message) {
    if (actual === expected) {
      return true;
    } else {
      throw new Error(`${message} - Expected: ${expected}, Got: ${actual}`);
    }
  }

  assertContains(actual, expected, message) {
    if (actual.includes(expected)) {
      return true;
    } else {
      throw new Error(`${message} - Expected to contain: ${expected}, Got: ${actual}`);
    }
  }

  // URL Encoding Tests
  testURLEncoding() {
    console.log('\n🧪 Testing URL Encoding...\n');

    this.runTest('encodeURIComponent - Basic URL encoding', () => {
      const input = 'https://example.com/path with spaces';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'URL encoding/decoding should be reversible');
    });

    this.runTest('encodeURIComponent - Spaces encoding', () => {
      const input = 'hello world';
      const encoded = encodeURIComponent(input);
      return this.assertContains(encoded, '%20', 'Spaces should be encoded as %20');
    });

    this.runTest('encodeURIComponent - Special characters encoding', () => {
      const input = 'https://example.com/path?param=value&other=test#fragment';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Special characters should be encoded/decoded correctly');
    });

    this.runTest('encodeURIComponent - Reserved characters', () => {
      const input = 'test!@#$%^&*()';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Reserved characters should be encoded/decoded correctly');
    });

    this.runTest('encodeURIComponent - Unicode characters', () => {
      const input = 'https://example.com/测试/路径';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Unicode characters should be encoded/decoded correctly');
    });

    this.runTest('encodeURIComponent - Complex query parameters', () => {
      const input = 'https://example.com/search?q=hello world&category=electronics&price=100-500';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Complex query parameters should be encoded/decoded correctly');
    });

    this.runTest('encodeURIComponent - Already encoded URL', () => {
      const input = 'https://example.com/path%20with%20spaces';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Already encoded URLs should be handled correctly');
    });

    this.runTest('encodeURIComponent - Empty string', () => {
      const input = '';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Empty string should be handled correctly');
    });
  }

  // URL Decoding Tests
  testURLDecoding() {
    console.log('\n🧪 Testing URL Decoding...\n');

    this.runTest('decodeURIComponent - Basic URL decoding', () => {
      const encoded = 'https%3A%2F%2Fexample.com%2Fpath%20with%20spaces';
      const decoded = decodeURIComponent(encoded);
      return this.assertContains(decoded, 'https://example.com/path with spaces', 'Basic URL decoding should work');
    });

    this.runTest('decodeURIComponent - Percent-encoded spaces', () => {
      const encoded = 'hello%20world';
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, 'hello world', 'Percent-encoded spaces should be decoded');
    });

    this.runTest('decodeURIComponent - Multiple encoded characters', () => {
      const encoded = 'test%21%40%23%24%25';
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, 'test!@#$%', 'Multiple encoded characters should be decoded');
    });

    this.runTest('decodeURIComponent - Unicode decoding', () => {
      const encoded = encodeURIComponent('测试');
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, '测试', 'Unicode characters should be decoded correctly');
    });

    this.runTest('decodeURIComponent - Invalid percent encoding handling', () => {
      try {
        decodeURIComponent('test%');
        return false; // Should throw error
      } catch (e) {
        return true; // Expected to throw
      }
    });

    this.runTest('decodeURIComponent - Invalid hex characters', () => {
      try {
        decodeURIComponent('test%G0');
        return false; // Should throw error
      } catch (e) {
        return true; // Expected to throw
      }
    });

    this.runTest('decodeURIComponent - Empty string', () => {
      const decoded = decodeURIComponent('');
      return this.assertEqual(decoded, '', 'Empty string should decode to empty string');
    });
  }

  // Complex URL Scenarios
  testComplexURLs() {
    console.log('\n🧪 Testing Complex URL Scenarios...\n');

    this.runTest('Complex URL - Multiple query parameters', () => {
      const url = 'https://example.com/search?q=coffee shop&location=New York&sort=price&order=asc';
      const encoded = encodeURIComponent(url);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, url, 'Multiple query parameters should be encoded/decoded correctly');
    });

    this.runTest('Complex URL - Fragment identifier', () => {
      const url = 'https://example.com/page/content#section1';
      const encoded = encodeURIComponent(url);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, url, 'Fragment identifier should be encoded/decoded correctly');
    });

    this.runTest('Complex URL - Port number', () => {
      const url = 'https://example.com:8080/api/data';
      const encoded = encodeURIComponent(url);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, url, 'Port number should be encoded/decoded correctly');
    });

    this.runTest('Complex URL - User credentials', () => {
      const url = 'https://user:password@example.com/path';
      const encoded = encodeURIComponent(url);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, url, 'User credentials should be encoded/decoded correctly');
    });

    this.runTest('Complex URL - Nested paths', () => {
      const url = 'https://example.com/api/v1/users/profile/settings';
      const encoded = encodeURIComponent(url);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, url, 'Nested paths should be encoded/decoded correctly');
    });

    this.runTest('Complex URL - JSON in query parameter', () => {
      const jsonData = JSON.stringify({key: 'value', num: 123});
      const url = `https://example.com/api?data=${encodeURIComponent(jsonData)}`;
      const decoded = decodeURIComponent(url.split('=')[1]);
      const parsed = JSON.parse(decoded);
      return this.assertEqual(parsed.key, 'value', 'JSON in query parameter should be handled correctly');
    });

    this.runTest('Complex URL - Email addresses', () => {
      const url = 'mailto:test@example.com?subject=Hello&body=World';
      const encoded = encodeURIComponent(url);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, url, 'Email addresses should be encoded/decoded correctly');
    });

    this.runTest('Complex URL - Phone numbers', () => {
      const url = 'tel:+1-555-123-4567';
      const encoded = encodeURIComponent(url);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, url, 'Phone numbers should be encoded/decoded correctly');
    });
  }

  // Edge Cases
  testEdgeCases() {
    console.log('\n🧪 Testing Edge Cases...\n');

    this.runTest('Edge case - Very long URL', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2000) + '?param=' + 'b'.repeat(1000);
      const encoded = encodeURIComponent(longUrl);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, longUrl, 'Very long URLs should be encoded/decoded correctly');
    });

    this.runTest('Edge case - URL with emoji', () => {
      const url = 'https://example.com/search?q=🍕🍔🍟';
      const encoded = encodeURIComponent(url);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, url, 'URLs with emoji should be encoded/decoded correctly');
    });

    this.runTest('Edge case - Only special characters', () => {
      const input = '!@#$%^&*()';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Only special characters should be encoded/decoded correctly');
    });

    this.runTest('Edge case - Mixed case encoding', () => {
      const input = 'TestURL123';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Mixed case should be preserved');
    });

    this.runTest('Edge case - Multiple consecutive spaces', () => {
      const input = 'test    multiple    spaces';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Multiple consecutive spaces should be preserved');
    });

    this.runTest('Edge case - Newline characters', () => {
      const input = 'line1\nline2\nline3';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Newline characters should be encoded/decoded correctly');
    });

    this.runTest('Edge case - Tab characters', () => {
      const input = 'word1\tword2\tword3';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Tab characters should be encoded/decoded correctly');
    });

    this.runTest('Edge case - Already partially encoded', () => {
      const input = 'test%20value%40example.com';
      // Double encoding test
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(decodeURIComponent(encoded));
      return this.assertEqual(decoded, 'test value@example.com', 'Double encoding should be handled correctly');
    });

    this.runTest('Edge case - Percent sign in text', () => {
      const input = '50% off sale';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Percent sign in text should be handled correctly');
    });
  }

  // Performance Tests
  testPerformance() {
    console.log('\n🧪 Testing Performance...\n');

    this.runTest('Performance - Large batch encoding', () => {
      const urls = Array.from({length: 1000}, (_, i) => `https://example.com/page${i}?param=value${i}`);
      const start = performance.now();
      
      urls.forEach(url => {
        encodeURIComponent(url);
        decodeURIComponent(encodeURIComponent(url));
      });
      
      const end = performance.now();
      const duration = end - start;
      return this.assertEqual(duration < 1000, true, `Large batch encoding should complete in < 1s (took ${duration}ms)`);
    });

    this.runTest('Performance - Complex URL encoding', () => {
      const complexUrls = Array.from({length: 500}, (_, i) => 
        `https://example.com/complex/path/${i}?param1=value1%20with%20spaces&param2=value2&param3=value3#fragment${i}`
      );
      const start = performance.now();
      
      complexUrls.forEach(url => {
        encodeURIComponent(url);
        decodeURIComponent(encodeURIComponent(url));
      });
      
      const end = performance.now();
      const duration = end - start;
      return this.assertEqual(duration < 500, true, `Complex URL encoding should complete in < 500ms (took ${duration}ms)`);
    });

    this.runTest('Performance - Unicode encoding', () => {
      const unicodeStrings = Array.from({length: 500}, (_, i) => `测试字符串${i} with 中文`);
      const start = performance.now();
      
      unicodeStrings.forEach(str => {
        encodeURIComponent(str);
        decodeURIComponent(encodeURIComponent(str));
      });
      
      const end = performance.now();
      const duration = end - start;
      return this.assertEqual(duration < 500, true, `Unicode encoding should complete in < 500ms (took ${duration}ms)`);
    });
  }

  // Integration Tests
  testIntegration() {
    console.log('\n🧪 Testing Integration Scenarios...\n');

    this.runTest('Integration - Complete encode/decode workflow', () => {
      const originalUrl = 'https://example.com/search?q=hello world&category=electronics&price=100-500';
      const encoded = encodeURIComponent(originalUrl);
      const decoded = decodeURIComponent(encoded);
      
      return this.assertEqual(decoded, originalUrl, 'Complete workflow should preserve original URL');
    });

    this.runTest('Integration - Multiple encoding/decoding cycles', () => {
      let url = 'https://example.com/test?param=value';
      for (let i = 0; i < 10; i++) {
        url = encodeURIComponent(url);
      }
      for (let i = 0; i < 10; i++) {
        url = decodeURIComponent(url);
      }
      return this.assertEqual(url, 'https://example.com/test?param=value', 'Multiple encoding/decoding cycles should preserve original URL');
    });

    this.runTest('Integration - URL with query string encoding', () => {
      const baseUrl = 'https://example.com/api';
      const params = { name: 'John Doe', email: 'john@example.com', query: 'search term' };
      const queryString = Object.keys(params)
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');
      const fullUrl = `${baseUrl}?${queryString}`;
      
      // Parse back
      const urlObj = new URL(fullUrl);
      const decodedName = decodeURIComponent(urlObj.searchParams.get('name'));
      
      return this.assertEqual(decodedName, 'John Doe', 'Query string encoding/decoding should work correctly');
    });

    this.runTest('Integration - API request URL construction', () => {
      const endpoint = 'https://api.example.com/v1/users';
      const userId = 'user-123';
      const action = 'update profile';
      const constructedUrl = `${endpoint}/${encodeURIComponent(userId)}?action=${encodeURIComponent(action)}`;
      
      const urlObj = new URL(constructedUrl);
      const decodedAction = decodeURIComponent(urlObj.searchParams.get('action'));
      
      return this.assertEqual(decodedAction, 'update profile', 'API request URL construction should work correctly');
    });

    this.runTest('Integration - Share URL encoding', () => {
      const shareText = 'Check out this link: https://example.com/product?name=Awesome Product';
      const encoded = encodeURIComponent(shareText);
      const shareUrl = `https://share.example.com/share?text=${encoded}`;
      
      const urlObj = new URL(shareUrl);
      const decoded = decodeURIComponent(urlObj.searchParams.get('text'));
      
      return this.assertEqual(decoded, shareText, 'Share URL encoding should work correctly');
    });
  }

  // Special Character Tests
  testSpecialCharacters() {
    console.log('\n🧪 Testing Special Characters...\n');

    this.runTest('Special characters - Ampersand in URL', () => {
      const url = 'https://example.com/path?param1=value1&param2=value2';
      const encoded = encodeURIComponent(url);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, url, 'Ampersand should be handled correctly');
    });

    this.runTest('Special characters - Plus sign', () => {
      const input = 'test+value';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Plus sign should be handled correctly');
    });

    this.runTest('Special characters - Equals sign', () => {
      const input = 'key=value';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Equals sign should be handled correctly');
    });

    this.runTest('Special characters - Hash/pound sign', () => {
      const input = 'section#id';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Hash/pound sign should be handled correctly');
    });

    this.runTest('Special characters - Question mark', () => {
      const input = 'query?test';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Question mark should be handled correctly');
    });

    this.runTest('Special characters - Slash', () => {
      const input = 'path/to/resource';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Slash should be handled correctly');
    });

    this.runTest('Special characters - Colon', () => {
      const input = 'https://example.com';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Colon should be handled correctly');
    });

    this.runTest('Special characters - Semicolon', () => {
      const input = 'test;value';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Semicolon should be handled correctly');
    });
  }

  // Run all tests
  runAllTests() {
    console.log('🧪 URL Encoder/Decoder Test Suite');
    console.log('==================================\n');

    this.testURLEncoding();
    this.testURLDecoding();
    this.testComplexURLs();
    this.testEdgeCases();
    this.testSpecialCharacters();
    this.testPerformance();
    this.testIntegration();

    return {
      total: this.totalTests,
      passed: this.testsPassed,
      failed: this.testsFailed,
      failedTests: this.failedTests
    };
  }
}

export { URLEncoderTester };

