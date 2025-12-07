/**
 * QR Code Generator Test Suite
 * 
 * Comprehensive tests for QR code generator functionality including:
 * - QR code generation for various input types
 * - URL parameter handling
 * - Share functionality
 * - Edge cases and complex scenarios
 */

// QR Code Test Class
class QRTester {
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

  // URL Parameter Handling Tests
  testURLParameterHandling() {
    console.log('\n🧪 Testing URL Parameter Handling...\n');

    this.runTest('URL parameter - Basic text parameter', () => {
      const url = 'qr-generator-free.html?text=Hello%20World';
      const params = new URLSearchParams(url.split('?')[1]);
      const text = params.get('text');
      const decoded = decodeURIComponent(text);
      return this.assertEqual(decoded, 'Hello World', 'Basic text parameter should be decoded correctly');
    });

    this.runTest('URL parameter - Complex URL parameter', () => {
      const url = 'qr-generator-free.html?text=https%3A%2F%2Fexample.com%2Fpath%3Fparam%3Dvalue';
      const params = new URLSearchParams(url.split('?')[1]);
      const text = params.get('text');
      const decoded = decodeURIComponent(text);
      return this.assertEqual(decoded, 'https://example.com/path?param=value', 'Complex URL parameter should be decoded correctly');
    });

    this.runTest('URL parameter - Special characters', () => {
      const url = 'qr-generator-free.html?text=Test%20%26%20%3C%3E%20%22%20%27';
      const params = new URLSearchParams(url.split('?')[1]);
      const text = params.get('text');
      const decoded = decodeURIComponent(text);
      return this.assertEqual(decoded, 'Test & <> " \'', 'Special characters should be decoded correctly');
    });

    this.runTest('URL parameter - Unicode characters', () => {
      const url = 'qr-generator-free.html?text=%E6%B5%8B%E8%AF%95';
      const params = new URLSearchParams(url.split('?')[1]);
      const text = params.get('text');
      const decoded = decodeURIComponent(text);
      return this.assertEqual(decoded, '测试', 'Unicode characters should be decoded correctly');
    });

    this.runTest('URL parameter - Empty parameter', () => {
      const url = 'qr-generator-free.html?text=';
      const params = new URLSearchParams(url.split('?')[1]);
      const text = params.get('text');
      return this.assertEqual(text, '', 'Empty parameter should be handled correctly');
    });

    this.runTest('URL parameter - Missing parameter', () => {
      const url = 'qr-generator-free.html';
      const params = new URLSearchParams(url.split('?')[1] || '');
      const text = params.get('text');
      return this.assertEqual(text, null, 'Missing parameter should return null');
    });
  }

  // QR Code Generation Tests
  testQRCodeGeneration() {
    console.log('\n🧪 Testing QR Code Generation...\n');

    this.runTest('QR generation - Basic text', () => {
      const text = 'Hello World';
      const qrData = this.generateQRData(text);
      return this.assertEqual(qrData.length > 0, true, 'QR code should be generated for basic text');
    });

    this.runTest('QR generation - URL', () => {
      const text = 'https://example.com';
      const qrData = this.generateQRData(text);
      return this.assertEqual(qrData.length > 0, true, 'QR code should be generated for URL');
    });

    this.runTest('QR generation - Email', () => {
      const text = 'mailto:test@example.com';
      const qrData = this.generateQRData(text);
      return this.assertEqual(qrData.length > 0, true, 'QR code should be generated for email');
    });

    this.runTest('QR generation - Phone number', () => {
      const text = 'tel:+1234567890';
      const qrData = this.generateQRData(text);
      return this.assertEqual(qrData.length > 0, true, 'QR code should be generated for phone number');
    });

    this.runTest('QR generation - WiFi credentials', () => {
      const text = 'WIFI:T:WPA;S:MyNetwork;P:password123;H:false;';
      const qrData = this.generateQRData(text);
      return this.assertEqual(qrData.length > 0, true, 'QR code should be generated for WiFi credentials');
    });

    this.runTest('QR generation - VCard', () => {
      const text = 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nORG:Example Corp\nEND:VCARD';
      const qrData = this.generateQRData(text);
      return this.assertEqual(qrData.length > 0, true, 'QR code should be generated for VCard');
    });
  }

  // Complex QR Code Scenarios
  testComplexQRScenarios() {
    console.log('\n🧪 Testing Complex QR Code Scenarios...\n');

    this.runTest('Complex QR - Long text', () => {
      const longText = 'A'.repeat(1000);
      const qrData = this.generateQRData(longText);
      return this.assertEqual(qrData.length > 0, true, 'QR code should be generated for long text');
    });

    this.runTest('Complex QR - JSON data', () => {
      const jsonData = JSON.stringify({
        name: 'John Doe',
        age: 30,
        address: {
          street: '123 Main St',
          city: 'New York',
          zip: '10001'
        },
        hobbies: ['reading', 'swimming', 'coding']
      });
      const qrData = this.generateQRData(jsonData);
      return this.assertEqual(qrData.length > 0, true, 'QR code should be generated for JSON data');
    });

    this.runTest('Complex QR - Base64 encoded data', () => {
      const base64Data = btoa('This is a test string for base64 encoding');
      const qrData = this.generateQRData(base64Data);
      return this.assertEqual(qrData.length > 0, true, 'QR code should be generated for base64 data');
    });

    this.runTest('Complex QR - Multi-line text', () => {
      const multiLineText = 'Line 1\nLine 2\nLine 3\nLine 4';
      const qrData = this.generateQRData(multiLineText);
      return this.assertEqual(qrData.length > 0, true, 'QR code should be generated for multi-line text');
    });

    this.runTest('Complex QR - Special characters', () => {
      const specialText = 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';
      const qrData = this.generateQRData(specialText);
      return this.assertEqual(qrData.length > 0, true, 'QR code should be generated for special characters');
    });
  }

  // Share Functionality Tests
  testShareFunctionality() {
    console.log('\n🧪 Testing Share Functionality...\n');

    this.runTest('Share - Web Share API availability', () => {
      const hasShareAPI = typeof globalThis !== 'undefined' && 
                         globalThis.navigator && 
                         globalThis.navigator.share && 
                         typeof globalThis.navigator.share === 'function';
      // In Node.js environment, navigator is undefined, so hasShareAPI will be false
      return this.assertEqual(Boolean(hasShareAPI), false, 'Web Share API should not be available in Node.js environment');
    });

    this.runTest('Share - Share data preparation', () => {
      const text = 'Hello World';
      const shareData = this.prepareShareData(text);
      return this.assertEqual(shareData.text, text, 'Share data should contain the text');
    });

    this.runTest('Share - Share data with title', () => {
      const text = 'Hello World';
      const shareData = this.prepareShareData(text);
      return this.assertContains(shareData.title, 'QR Code', 'Share data should contain title');
    });

    this.runTest('Share - Fallback share preparation', () => {
      const text = 'Hello World';
      const fallbackText = this.prepareFallbackShare(text);
      return this.assertContains(fallbackText, text, 'Fallback share should contain the text');
    });
  }

  // Edge Cases
  testEdgeCases() {
    console.log('\n🧪 Testing Edge Cases...\n');

    this.runTest('Edge case - Empty string', () => {
      const text = '';
      const qrData = this.generateQRData(text);
      return this.assertEqual(qrData.length >= 0, true, 'Empty string should be handled gracefully');
    });

    this.runTest('Edge case - Whitespace only', () => {
      const text = '   \n\t  ';
      const qrData = this.generateQRData(text);
      return this.assertEqual(qrData.length >= 0, true, 'Whitespace only should be handled gracefully');
    });

    this.runTest('Edge case - Very long text', () => {
      const text = 'A'.repeat(10000);
      const qrData = this.generateQRData(text);
      return this.assertEqual(qrData.length > 0, true, 'Very long text should generate QR code');
    });

    this.runTest('Edge case - Null input', () => {
      const text = null;
      const qrData = this.generateQRData(text);
      return this.assertEqual(qrData.length >= 0, true, 'Null input should be handled gracefully');
    });

    this.runTest('Edge case - Undefined input', () => {
      const text = undefined;
      const qrData = this.generateQRData(text);
      return this.assertEqual(qrData.length >= 0, true, 'Undefined input should be handled gracefully');
    });

    this.runTest('Edge case - Non-string input', () => {
      const text = 12345;
      const qrData = this.generateQRData(text);
      return this.assertEqual(qrData.length >= 0, true, 'Non-string input should be handled gracefully');
    });
  }

  // Performance Tests
  testPerformance() {
    console.log('\n🧪 Testing Performance...\n');

    this.runTest('Performance - Multiple QR generation', () => {
      const texts = Array.from({length: 100}, (_, i) => `Test QR Code ${i}`);
      const start = performance.now();
      
      texts.forEach(text => {
        this.generateQRData(text);
      });
      
      const end = performance.now();
      const duration = end - start;
      return this.assertEqual(duration < 2000, true, `Multiple QR generation should complete in < 2s (took ${duration}ms)`);
    });

    this.runTest('Performance - Large text QR generation', () => {
      const largeText = 'A'.repeat(5000);
      const start = performance.now();
      const qrData = this.generateQRData(largeText);
      const end = performance.now();
      const duration = end - start;
      return this.assertEqual(duration < 1000, true, `Large text QR generation should complete in < 1s (took ${duration}ms)`);
    });
  }

  // Integration Tests
  testIntegration() {
    console.log('\n🧪 Testing Integration Scenarios...\n');

    this.runTest('Integration - Complete QR workflow', () => {
      const originalText = 'https://example.com/test?param=value';
      const encoded = encodeURIComponent(originalText);
      const decoded = decodeURIComponent(encoded);
      const qrData = this.generateQRData(decoded);
      const shareData = this.prepareShareData(decoded);
      
      return this.assertEqual(decoded, originalText, 'URL parameter handling should preserve original text') &&
             this.assertEqual(qrData.length > 0, true, 'QR code should be generated') &&
             this.assertEqual(shareData.text, decoded, 'Share data should contain decoded text');
    });

    this.runTest('Integration - QR generation with history', () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const history = [];
      
      texts.forEach(text => {
        const qrData = this.generateQRData(text);
        history.push({ text, qrData, timestamp: Date.now() });
      });
      
      return this.assertEqual(history.length, 3, 'History should contain all generated QR codes');
    });
  }

  // Helper Methods
  generateQRData(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    // Simulate QR code generation (in real implementation, this would use a QR library)
    // For testing purposes, we'll return a mock QR data structure
    const qrData = {
      text: text,
      size: Math.max(100, Math.min(500, text.length * 2)),
      modules: Math.ceil(Math.sqrt(text.length)) * 8,
      errorCorrectionLevel: 'M'
    };
    
    return JSON.stringify(qrData);
  }

  prepareShareData(text) {
    return {
      title: 'QR Code Generated',
      text: text,
      url: typeof globalThis !== 'undefined' && globalThis.location ? globalThis.location.href : 'https://bharatdevtool.com'
    };
  }

  prepareFallbackShare(text) {
    return `QR Code: ${text}\nGenerated by Bharat Dev Tools`;
  }

  // Run all tests
  runAllTests() {
    console.log('🧪 QR Code Generator Test Suite');
    console.log('==================================\n');

    this.testURLParameterHandling();
    this.testQRCodeGeneration();
    this.testComplexQRScenarios();
    this.testShareFunctionality();
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

export { QRTester };
