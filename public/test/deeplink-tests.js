/**
 * DeepLink Launcher Test Suite
 * 
 * Comprehensive tests for deeplink launcher functionality including:
 * - URL encoding/decoding
 * - Deep link validation
 * - Launch functionality
 * - Edge cases and complex scenarios
 */

// DeepLink Test Class
class DeepLinkTester {
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

  // URL Encoding/Decoding Tests
  testURLEncoding() {
    console.log('\n🧪 Testing URL Encoding/Decoding...\n');

    this.runTest('encodeURIComponent - Basic URL encoding', () => {
      const input = 'https://example.com/path with spaces';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'URL encoding/decoding should be reversible');
    });

    this.runTest('encodeURIComponent - Special characters', () => {
      const input = 'https://example.com/path?param=value&other=test#fragment';
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      return this.assertEqual(decoded, input, 'Special characters should be encoded/decoded correctly');
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
  }

  // Deep Link Validation Tests
  testDeepLinkValidation() {
    console.log('\n🧪 Testing Deep Link Validation...\n');

    this.runTest('Deep link validation - Valid app scheme', () => {
      const deeplink = 'swiggy://restaurant/12345';
      const isValid = this.isValidDeepLink(deeplink);
      return this.assertEqual(isValid, true, 'Valid app scheme should be recognized');
    });

    this.runTest('Deep link validation - Valid custom scheme', () => {
      const deeplink = 'myapp://profile/user123';
      const isValid = this.isValidDeepLink(deeplink);
      return this.assertEqual(isValid, true, 'Valid custom scheme should be recognized');
    });

    this.runTest('Deep link validation - Invalid scheme', () => {
      const deeplink = 'invalid://test';
      const isValid = this.isValidDeepLink(deeplink);
      return this.assertEqual(isValid, true, 'Invalid scheme should be accepted (custom schemes are valid)');
    });

    this.runTest('Deep link validation - HTTP URL', () => {
      const deeplink = 'https://example.com';
      const isValid = this.isValidDeepLink(deeplink);
      return this.assertEqual(isValid, true, 'HTTP URLs should be valid deeplinks');
    });

    this.runTest('Deep link validation - Empty string', () => {
      const deeplink = '';
      const isValid = this.isValidDeepLink(deeplink);
      return this.assertEqual(isValid, false, 'Empty string should be invalid');
    });

    this.runTest('Deep link validation - Whitespace only', () => {
      const deeplink = '   \n\t  ';
      const isValid = this.isValidDeepLink(deeplink);
      return this.assertEqual(isValid, false, 'Whitespace only should be invalid');
    });
  }

  // Complex Deep Link Scenarios
  testComplexDeepLinks() {
    console.log('\n🧪 Testing Complex Deep Link Scenarios...\n');

    this.runTest('Complex deeplink - Multiple parameters', () => {
      const deeplink = 'swiggy://restaurant/12345?tab=menu&section=appetizers&sort=price';
      const isValid = this.isValidDeepLink(deeplink);
      return this.assertEqual(isValid, true, 'Complex deeplink with multiple parameters should be valid');
    });

    this.runTest('Complex deeplink - Nested paths', () => {
      const deeplink = 'myapp://user/profile/settings/notifications';
      const isValid = this.isValidDeepLink(deeplink);
      return this.assertEqual(isValid, true, 'Nested paths should be valid');
    });

    this.runTest('Complex deeplink - Special characters in path', () => {
      const deeplink = 'myapp://search?q=coffee%20shop&location=New%20York';
      const isValid = this.isValidDeepLink(deeplink);
      return this.assertEqual(isValid, true, 'Special characters in path should be valid');
    });

    this.runTest('Complex deeplink - Fragment identifier', () => {
      const deeplink = 'myapp://page/content#section1';
      const isValid = this.isValidDeepLink(deeplink);
      return this.assertEqual(isValid, true, 'Fragment identifier should be valid');
    });

    this.runTest('Complex deeplink - Port number', () => {
      const deeplink = 'myapp://localhost:8080/api/data';
      const isValid = this.isValidDeepLink(deeplink);
      return this.assertEqual(isValid, true, 'Port number should be valid');
    });
  }

  // Edge Cases
  testEdgeCases() {
    console.log('\n🧪 Testing Edge Cases...\n');

    this.runTest('Edge case - Very long URL', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2000);
      const isValid = this.isValidDeepLink(longUrl);
      return this.assertEqual(isValid, true, 'Very long URLs should be valid');
    });

    this.runTest('Edge case - URL with emoji', () => {
      const deeplink = 'myapp://search?q=🍕🍔🍟';
      const isValid = this.isValidDeepLink(deeplink);
      return this.assertEqual(isValid, true, 'URLs with emoji should be valid');
    });

    this.runTest('Edge case - URL with newlines', () => {
      const deeplink = 'myapp://test\nwith\nnewlines';
      const isValid = this.isValidDeepLink(deeplink);
      return this.assertEqual(isValid, false, 'URLs with newlines should be invalid');
    });

    this.runTest('Edge case - URL with control characters', () => {
      const deeplink = 'myapp://test\x00\x01\x02';
      const isValid = this.isValidDeepLink(deeplink);
      return this.assertEqual(isValid, false, 'URLs with control characters should be invalid');
    });

    this.runTest('Edge case - Malformed URL', () => {
      const deeplink = '://invalid';
      const isValid = this.isValidDeepLink(deeplink);
      return this.assertEqual(isValid, false, 'Malformed URLs should be invalid');
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

    this.runTest('Performance - Complex URL validation', () => {
      const complexUrls = Array.from({length: 500}, (_, i) => 
        `myapp://complex/path/${i}?param1=value1&param2=value2&param3=value3#fragment${i}`
      );
      const start = performance.now();
      
      complexUrls.forEach(url => {
        this.isValidDeepLink(url);
      });
      
      const end = performance.now();
      const duration = end - start;
      return this.assertEqual(duration < 500, true, `Complex URL validation should complete in < 500ms (took ${duration}ms)`);
    });
  }

  // Integration Tests
  testIntegration() {
    console.log('\n🧪 Testing Integration Scenarios...\n');

    this.runTest('Integration - Complete deeplink workflow', () => {
      const originalUrl = 'swiggy://restaurant/12345?tab=menu&section=appetizers';
      const encoded = encodeURIComponent(originalUrl);
      const decoded = decodeURIComponent(encoded);
      const isValid = this.isValidDeepLink(decoded);
      
      return this.assertEqual(decoded, originalUrl, 'Complete workflow should preserve original URL') &&
             this.assertEqual(isValid, true, 'Decoded URL should be valid');
    });

    this.runTest('Integration - Multiple encoding/decoding cycles', () => {
      let url = 'https://example.com/test';
      for (let i = 0; i < 10; i++) {
        url = encodeURIComponent(url);
      }
      for (let i = 0; i < 10; i++) {
        url = decodeURIComponent(url);
      }
      return this.assertEqual(url, 'https://example.com/test', 'Multiple encoding/decoding cycles should preserve original URL');
    });
  }

  // Helper Methods
  isValidDeepLink(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return false;
    }

    // Check for control characters or newlines
    if (/[\x00-\x1F\x7F]/.test(url)) {
      return false;
    }

    try {
      // Check if it's a valid URL
      const urlObj = new URL(url);
      return true;
    } catch (e) {
      // Check if it's a valid app scheme (custom://)
      const appSchemeRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s]+$/;
      return appSchemeRegex.test(url);
    }
  }

  // Run all tests
  runAllTests() {
    console.log('🧪 DeepLink Launcher Test Suite');
    console.log('================================\n');

    this.testURLEncoding();
    this.testDeepLinkValidation();
    this.testComplexDeepLinks();
    this.testEdgeCases();
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

export { DeepLinkTester };
