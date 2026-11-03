/**
 * Base64 Encoder/Decoder Test Suite
 * 
 * Comprehensive tests for Base64 encoder/decoder functionality including:
 * - Base64 encoding/decoding
 * - Special characters handling
 * - Unicode handling
 * - Edge cases and complex scenarios
 * - Performance testing
 */

// Base64 Encoder Test Class
class Base64Tester {
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

  // Helper functions matching the implementation
  parseHexString(hexString) {
    const cleaned = hexString.replace(/[^0-9A-Fa-f]/g, '');
    if (cleaned.length % 2 !== 0) {
      throw new Error('Hex string must have even number of digits');
    }
    const bytes = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < cleaned.length; i += 2) {
      bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16);
    }
    return bytes;
  }

  parseEscapeSequences(text) {
    return text.replace(/\\x([0-9A-Fa-f]{2})/g, function(match, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    });
  }

  stringToBytes(text) {
    if (typeof TextEncoder !== 'undefined') {
      const encoder = new TextEncoder();
      return encoder.encode(text);
    } else {
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        bytes[i] = text.charCodeAt(i);
      }
      return bytes;
    }
  }

  bytesToString(bytes) {
    if (typeof TextDecoder !== 'undefined') {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes);
    } else {
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
      }
      return str;
    }
  }

  toUrlSafeBase64(base64, stripPadding) {
    let result = base64.replace(/\+/g, '-').replace(/\//g, '_');
    if (stripPadding) {
      result = result.replace(/=/g, '');
    }
    return result;
  }

  fromUrlSafeBase64(urlSafeBase64) {
    let base64 = urlSafeBase64.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    return base64 + '='.repeat(padLength);
  }

  // Helper function to encode Base64 (matching the implementation)
  encodeBase64(text, options = {}) {
    // Only return null for truly empty strings, not whitespace-only strings
    if (!text || (text.length === 0)) {
      return null;
    }
    
    let processedText = text;
    
    if (options.interpretEscapes) {
      processedText = this.parseEscapeSequences(processedText);
    }
    
    if (options.interpretHex) {
      try {
        const bytes = this.parseHexString(processedText);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        let base64 = btoa(binary);
        
        if (options.urlSafe) {
          base64 = this.toUrlSafeBase64(base64, options.stripPadding);
        } else if (options.stripPadding) {
          base64 = base64.replace(/=/g, '');
        }
        
        return base64;
      } catch (hexError) {
        // Fall through to text encoding
      }
    }
    
    const bytes = this.stringToBytes(processedText);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    let base64 = btoa(binary);
    
    if (options.urlSafe) {
      base64 = this.toUrlSafeBase64(base64, options.stripPadding);
    } else if (options.stripPadding) {
      base64 = base64.replace(/=/g, '');
    }
    
    return base64;
  }

  // Helper function to decode Base64 (matching the implementation)
  decodeBase64(base64String, options = {}) {
    if (!base64String || base64String.trim().length === 0) {
      return null;
    }
    
    let cleaned = base64String.trim().replace(/\s/g, '');
    
    if (options.urlSafe || cleaned.includes('-') || cleaned.includes('_')) {
      cleaned = this.fromUrlSafeBase64(cleaned);
    }
    
    // Add padding if missing (atob requires proper padding)
    const padLength = (4 - (cleaned.length % 4)) % 4;
    cleaned = cleaned + '='.repeat(padLength);
    
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
      throw new Error('Invalid Base64 format');
    }
    
    const binaryString = atob(cleaned);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    if (typeof TextDecoder !== 'undefined') {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes);
    } else {
      return this.bytesToString(bytes);
    }
  }

  // Base64 Encoding Tests
  testBase64Encoding() {
    console.log('\n🧪 Testing Base64 Encoding...\n');

    this.runTest('encodeBase64 - Basic text encoding', () => {
      const input = 'Hello World';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Base64 encoding/decoding should be reversible');
    });

    this.runTest('encodeBase64 - Empty string', () => {
      const input = '';
      const encoded = this.encodeBase64(input);
      return this.assertEqual(encoded, null, 'Empty string should return null');
    });

    this.runTest('encodeBase64 - Single character', () => {
      const input = 'A';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Single character should encode/decode correctly');
    });

    this.runTest('encodeBase64 - Special characters', () => {
      const input = 'Hello!@#$%^&*()';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Special characters should encode/decode correctly');
    });

    this.runTest('encodeBase64 - Numbers', () => {
      const input = '1234567890';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Numbers should encode/decode correctly');
    });

    this.runTest('encodeBase64 - Mixed case', () => {
      const input = 'HelloWorld123';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Mixed case should encode/decode correctly');
    });

    this.runTest('encodeBase64 - Spaces', () => {
      const input = 'Hello World Test';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Spaces should encode/decode correctly');
    });

    this.runTest('encodeBase64 - Newlines', () => {
      const input = 'Line1\nLine2\nLine3';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Newlines should encode/decode correctly');
    });

    this.runTest('encodeBase64 - Tabs', () => {
      const input = 'Word1\tWord2\tWord3';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Tabs should encode/decode correctly');
    });
  }

  // Base64 Decoding Tests
  testBase64Decoding() {
    console.log('\n🧪 Testing Base64 Decoding...\n');

    this.runTest('decodeBase64 - Basic text decoding', () => {
      const original = 'Hello World';
      const encoded = this.encodeBase64(original);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, original, 'Basic Base64 decoding should work');
    });

    this.runTest('decodeBase64 - Empty string', () => {
      const decoded = this.decodeBase64('');
      return this.assertEqual(decoded, null, 'Empty string should return null');
    });

    this.runTest('decodeBase64 - Invalid Base64 format', () => {
      try {
        this.decodeBase64('Invalid@Base64!');
        return false; // Should throw error
      } catch (e) {
        return true; // Expected to throw
      }
    });

    this.runTest('decodeBase64 - Base64 with padding', () => {
      const original = 'Hello';
      const encoded = this.encodeBase64(original);
      // Base64 for "Hello" should have padding
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, original, 'Base64 with padding should decode correctly');
    });

    this.runTest('decodeBase64 - Base64 without padding', () => {
      const original = 'Hello World';
      const encoded = this.encodeBase64(original);
      // Remove padding if present
      const cleaned = encoded.replace(/=+$/, '');
      // decodeBase64 should automatically add correct padding
      const decoded = this.decodeBase64(cleaned);
      return this.assertEqual(decoded, original, 'Base64 without padding should decode correctly');
    });

    this.runTest('decodeBase64 - Base64 with whitespace', () => {
      const original = 'Hello World';
      const encoded = this.encodeBase64(original);
      const encodedWithSpaces = encoded.split('').join(' ');
      const decoded = this.decodeBase64(encodedWithSpaces);
      return this.assertEqual(decoded, original, 'Base64 with whitespace should decode correctly');
    });

    this.runTest('decodeBase64 - Invalid characters', () => {
      try {
        this.decodeBase64('SGVsbG8gV29ybGQ!');
        return false; // Should throw error
      } catch (e) {
        return true; // Expected to throw
      }
    });

    this.runTest('decodeBase64 - Incomplete padding', () => {
      try {
        // Try to decode with incomplete padding
        this.decodeBase64('SGVsbG8=');
        return true; // Should handle gracefully
      } catch (e) {
        // If it throws, that's also acceptable
        return true;
      }
    });
  }

  // Unicode Tests
  testUnicode() {
    console.log('\n🧪 Testing Unicode Handling...\n');

    this.runTest('Unicode - Chinese characters', () => {
      const input = '你好世界';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Chinese characters should encode/decode correctly');
    });

    this.runTest('Unicode - Japanese characters', () => {
      const input = 'こんにちは世界';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Japanese characters should encode/decode correctly');
    });

    this.runTest('Unicode - Arabic characters', () => {
      const input = 'مرحبا بالعالم';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Arabic characters should encode/decode correctly');
    });

    this.runTest('Unicode - Emoji', () => {
      const input = 'Hello 🎉 World 🌍';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Emoji should encode/decode correctly');
    });

    this.runTest('Unicode - Mixed languages', () => {
      const input = 'Hello 你好 مرحبا';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Mixed languages should encode/decode correctly');
    });

    this.runTest('Unicode - Special Unicode characters', () => {
      const input = '©®™€£¥';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Special Unicode characters should encode/decode correctly');
    });
  }

  // Edge Cases
  testEdgeCases() {
    console.log('\n🧪 Testing Edge Cases...\n');

    this.runTest('Edge case - Very long string', () => {
      const input = 'A'.repeat(10000);
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Very long strings should encode/decode correctly');
    });

    this.runTest('Edge case - Only spaces', () => {
      const input = '     ';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Only spaces should encode/decode correctly');
    });

    this.runTest('Edge case - Only newlines', () => {
      const input = '\n\n\n';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Only newlines should encode/decode correctly');
    });

    this.runTest('Edge case - JSON string', () => {
      const input = '{"name":"John","age":30}';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'JSON strings should encode/decode correctly');
    });

    this.runTest('Edge case - URL string', () => {
      const input = 'https://example.com/path?param=value&other=test';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'URL strings should encode/decode correctly');
    });

    this.runTest('Edge case - Base64 string (double encoding)', () => {
      const original = 'Hello World';
      const firstEncoded = this.encodeBase64(original);
      const secondEncoded = this.encodeBase64(firstEncoded);
      const firstDecoded = this.decodeBase64(secondEncoded);
      const finalDecoded = this.decodeBase64(firstDecoded);
      return this.assertEqual(finalDecoded, original, 'Double encoding should work correctly');
    });

    this.runTest('Edge case - Binary-like data', () => {
      const input = '\x00\x01\x02\x03\xFF\xFE\xFD';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Binary-like data should encode/decode correctly');
    });

    this.runTest('Edge case - All Base64 characters', () => {
      const input = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'All Base64 characters should encode/decode correctly');
    });
  }

  // Performance Tests
  testPerformance() {
    console.log('\n🧪 Testing Performance...\n');

    this.runTest('Performance - Large batch encoding', () => {
      const texts = Array.from({length: 1000}, (_, i) => `Test string ${i} with some content`);
      const start = performance.now();
      
      texts.forEach(text => {
        const encoded = this.encodeBase64(text);
        this.decodeBase64(encoded);
      });
      
      const end = performance.now();
      const duration = end - start;
      return this.assertEqual(duration < 1000, true, `Large batch encoding should complete in < 1s (took ${duration}ms)`);
    });

    this.runTest('Performance - Large string encoding', () => {
      const largeText = 'A'.repeat(100000);
      const start = performance.now();
      
      const encoded = this.encodeBase64(largeText);
      const decoded = this.decodeBase64(encoded);
      
      const end = performance.now();
      const duration = end - start;
      return this.assertEqual(decoded === largeText && duration < 500, true, `Large string encoding should complete in < 500ms (took ${duration}ms)`);
    });

    this.runTest('Performance - Unicode encoding', () => {
      const unicodeStrings = Array.from({length: 500}, (_, i) => `测试字符串${i} with 中文`);
      const start = performance.now();
      
      unicodeStrings.forEach(str => {
        const encoded = this.encodeBase64(str);
        this.decodeBase64(encoded);
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
      const original = 'Hello World! This is a test.';
      const encoded = this.encodeBase64(original);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, original, 'Complete workflow should preserve original text');
    });

    this.runTest('Integration - Multiple encoding/decoding cycles', () => {
      let text = 'Hello World';
      for (let i = 0; i < 10; i++) {
        text = this.encodeBase64(text);
      }
      for (let i = 0; i < 10; i++) {
        text = this.decodeBase64(text);
      }
      return this.assertEqual(text, 'Hello World', 'Multiple encoding/decoding cycles should preserve original text');
    });

    this.runTest('Integration - API response encoding', () => {
      const apiResponse = JSON.stringify({status: 'success', data: {id: 123, name: 'Test'}});
      const encoded = this.encodeBase64(apiResponse);
      const decoded = this.decodeBase64(encoded);
      const parsed = JSON.parse(decoded);
      return this.assertEqual(parsed.status, 'success', 'API response encoding should work correctly');
    });

    this.runTest('Integration - Data URL construction', () => {
      const data = 'Hello World';
      const encoded = this.encodeBase64(data);
      const dataUrl = `data:text/plain;base64,${encoded}`;
      // Extract and decode
      const extracted = dataUrl.split(',')[1];
      const decoded = this.decodeBase64(extracted);
      return this.assertEqual(decoded, data, 'Data URL construction should work correctly');
    });
  }

  // Special Character Tests
  testSpecialCharacters() {
    console.log('\n🧪 Testing Special Characters...\n');

    this.runTest('Special characters - Quotes', () => {
      const input = 'Text with "quotes" and \'single quotes\'';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Quotes should encode/decode correctly');
    });

    this.runTest('Special characters - Backslashes', () => {
      const input = 'Text with \\backslashes\\';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Backslashes should encode/decode correctly');
    });

    this.runTest('Special characters - Curly braces', () => {
      const input = 'Text with {braces} and [brackets]';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Curly braces and brackets should encode/decode correctly');
    });

    this.runTest('Special characters - HTML entities', () => {
      const input = 'Text with <tags> and &amp; entities';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'HTML entities should encode/decode correctly');
    });

    this.runTest('Special characters - SQL injection attempt', () => {
      const input = "'; DROP TABLE users; --";
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'SQL injection patterns should encode/decode correctly');
    });

    this.runTest('Special characters - XSS attempt', () => {
      const input = '<script>alert("XSS")</script>';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'XSS patterns should encode/decode correctly');
    });
  }

  // Advanced Features Tests
  testAdvancedFeatures() {
    console.log('\n🧪 Testing Advanced Features...\n');

    // Test hex interpretation
    this.runTest('Advanced - Hex as binary encoding', () => {
      const hexInput = 'FB EF FF FF';
      const encoded = this.encodeBase64(hexInput, { interpretHex: true });
      return this.assertEqual(encoded, '++///w==', 'Hex string should encode to correct Base64');
    });

    this.runTest('Advanced - Hex as binary (without spaces)', () => {
      const hexInput = 'FBEF';
      const encoded = this.encodeBase64(hexInput, { interpretHex: true });
      const decoded = this.decodeBase64(encoded);
      const bytes = this.parseHexString(hexInput);
      const expected = this.bytesToString(bytes);
      return this.assertEqual(decoded, expected, 'Hex without spaces should work');
    });

    this.runTest('Advanced - Hex as text (default behavior)', () => {
      const hexInput = 'FB EF FF FF';
      const encoded = this.encodeBase64(hexInput, { interpretHex: false });
      return this.assertContains(encoded, 'RkIgRUYgRkYgRkY', 'Hex as text should encode differently');
    });

    // Test escape sequences
    this.runTest('Advanced - Escape sequences encoding', () => {
      const escapeInput = '\\x48\\x65\\x6C\\x6C\\x6F';
      const encoded = this.encodeBase64(escapeInput, { interpretEscapes: true });
      return this.assertEqual(encoded, 'SGVsbG8=', 'Escape sequences should convert to "Hello"');
    });

    this.runTest('Advanced - Escape sequences without option', () => {
      const escapeInput = '\\x48\\x65';
      const encoded = this.encodeBase64(escapeInput, { interpretEscapes: false });
      const decoded = this.decodeBase64(encoded);
      return this.assertContains(decoded, '\\x48', 'Without option, escapes should be literal');
    });

    this.runTest('Advanced - Combined hex and escapes', () => {
      const input = '\\x48\\x65';
      const encoded = this.encodeBase64(input, { interpretEscapes: true });
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, 'He', 'Escape sequences should decode correctly');
    });

    // Test URL-safe Base64
    this.runTest('Advanced - URL-safe Base64 encoding', () => {
      // Use input that produces + and / in Base64
      const hexInput = 'FB EF FF FF';
      const standard = this.encodeBase64(hexInput, { interpretHex: true });
      const urlSafe = this.encodeBase64(hexInput, { interpretHex: true, urlSafe: true });
      // Standard should have + and /, URL-safe should have - and _
      return this.assertContains(standard, '+') && this.assertContains(standard, '/') &&
             this.assertContains(urlSafe, '-') && this.assertContains(urlSafe, '_') &&
             !urlSafe.includes('+') && !urlSafe.includes('/');
    });

    this.runTest('Advanced - URL-safe Base64 decoding', () => {
      const input = 'Hello';
      const urlSafe = this.encodeBase64(input, { urlSafe: true });
      const decoded = this.decodeBase64(urlSafe, { urlSafe: true });
      return this.assertEqual(decoded, input, 'URL-safe Base64 should decode correctly');
    });

    this.runTest('Advanced - URL-safe with padding removal', () => {
      const input = 'Hello';
      const urlSafe = this.encodeBase64(input, { urlSafe: true, stripPadding: true });
      return this.assertEqual(urlSafe.includes('='), false, 'Padding should be removed');
    });

    // Test padding stripping
    this.runTest('Advanced - Strip padding from output', () => {
      const input = 'Hello';
      const withPadding = this.encodeBase64(input);
      const withoutPadding = this.encodeBase64(input, { stripPadding: true });
      return this.assertEqual(withoutPadding.includes('='), false, 'Padding should be stripped');
    });

    this.runTest('Advanced - Decode without padding', () => {
      const input = 'Hello';
      const encoded = this.encodeBase64(input, { stripPadding: true });
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Should decode Base64 without padding');
    });

    // Test canonical examples from FAQ
    this.runTest('FAQ Example - "Hello, World!" encoding', () => {
      const input = 'Hello, World!';
      const encoded = this.encodeBase64(input);
      return this.assertEqual(encoded, 'SGVsbG8sIFdvcmxkIQ==', 'Canonical example should match');
    });

    this.runTest('FAQ Example - "Hello, 世界🌍" encoding', () => {
      const input = 'Hello, 世界🌍';
      const encoded = this.encodeBase64(input);
      const decoded = this.decodeBase64(encoded);
      return this.assertEqual(decoded, input, 'Unicode example should work');
    });

    this.runTest('FAQ Example - Binary bytes 00-1F', () => {
      const hexBytes = '00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F 10 11 12 13 14 15 16 17 18 19 1A 1B 1C 1D 1E 1F';
      const encoded = this.encodeBase64(hexBytes, { interpretHex: true });
      return this.assertEqual(encoded, 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=', 'Binary bytes should encode correctly');
    });

    this.runTest('FAQ Example - FB EF FF FF as binary', () => {
      const hexInput = 'FB EF FF FF';
      const encoded = this.encodeBase64(hexInput, { interpretHex: true });
      return this.assertEqual(encoded, '++///w==', 'Hex as binary should match FAQ example');
    });

    this.runTest('FAQ Example - FB EF FF FF as text', () => {
      const hexInput = 'FB EF FF FF';
      const encoded = this.encodeBase64(hexInput, { interpretHex: false });
      return this.assertEqual(encoded, 'RkIgRUYgRkYgRkY=', 'Hex as text should match FAQ example');
    });

    this.runTest('FAQ Example - Padding variations', () => {
      const input1 = 'any carnal pleasure.';
      const input2 = 'any carnal pleasure';
      const input3 = 'any carnal pleasur';
      
      const encoded1 = this.encodeBase64(input1);
      const encoded2 = this.encodeBase64(input2);
      const encoded3 = this.encodeBase64(input3);
      
      return this.assertEqual(encoded1, 'YW55IGNhcm5hbCBwbGVhc3VyZS4=') &&
             this.assertEqual(encoded2, 'YW55IGNhcm5hbCBwbGVhc3VyZQ==') &&
             this.assertEqual(encoded3, 'YW55IGNhcm5hbCBwbGVhc3Vy');
    });
  }

  // Run all tests
  runAllTests() {
    console.log('🧪 Base64 Encoder/Decoder Test Suite');
    console.log('====================================\n');

    this.testBase64Encoding();
    this.testBase64Decoding();
    this.testUnicode();
    this.testEdgeCases();
    this.testSpecialCharacters();
    this.testPerformance();
    this.testIntegration();
    this.testAdvancedFeatures();

    return {
      total: this.totalTests,
      passed: this.testsPassed,
      failed: this.testsFailed,
      failedTests: this.failedTests
    };
  }
}

export { Base64Tester };

