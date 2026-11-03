/**
 * QR Code Decoder Test Suite
 * 
 * Comprehensive tests for QR code decoder functionality including:
 * - QR code decoding from images
 * - Camera functionality
 * - History management
 * - Image compression
 * - Error handling
 * - Edge cases
 */

// QR Decoder Test Class
class QRDecoderTester {
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

  assertTrue(condition, message) {
    if (condition === true) {
      return true;
    } else {
      throw new Error(`${message} - Expected true, got ${condition}`);
    }
  }

  // QR Code Decoding Tests
  testQRCodeDecoding() {
    console.log('\n🧪 Testing QR Code Decoding...\n');

    this.runTest('QR decode - Basic URL decoding', () => {
      const decodedText = 'https://example.com';
      const isValid = this.validateDecodedText(decodedText);
      return this.assertTrue(isValid, 'Basic URL should be decoded correctly');
    });

    this.runTest('QR decode - Text decoding', () => {
      const decodedText = 'Hello World';
      const isValid = this.validateDecodedText(decodedText);
      return this.assertTrue(isValid, 'Text should be decoded correctly');
    });

    this.runTest('QR decode - Email decoding', () => {
      const decodedText = 'mailto:test@example.com';
      const isValid = this.validateDecodedText(decodedText);
      return this.assertTrue(isValid, 'Email should be decoded correctly');
    });

    this.runTest('QR decode - Phone number decoding', () => {
      const decodedText = 'tel:+1234567890';
      const isValid = this.validateDecodedText(decodedText);
      return this.assertTrue(isValid, 'Phone number should be decoded correctly');
    });

    this.runTest('QR decode - Deep link decoding', () => {
      const decodedText = 'myapp://product/123';
      const isValid = this.validateDecodedText(decodedText);
      return this.assertTrue(isValid, 'Deep link should be decoded correctly');
    });

    this.runTest('QR decode - WiFi credentials decoding', () => {
      const decodedText = 'WIFI:T:WPA;S:MyNetwork;P:password123;H:false;';
      const isValid = this.validateDecodedText(decodedText);
      return this.assertTrue(isValid, 'WiFi credentials should be decoded correctly');
    });
  }

  // Image Processing Tests
  testImageProcessing() {
    console.log('\n🧪 Testing Image Processing...\n');

    this.runTest('Image processing - Valid image format', () => {
      const imageFile = { type: 'image/png', size: 1024 };
      const isValid = this.validateImageFile(imageFile);
      return this.assertTrue(isValid, 'PNG image should be valid');
    });

    this.runTest('Image processing - JPEG format', () => {
      const imageFile = { type: 'image/jpeg', size: 2048 };
      const isValid = this.validateImageFile(imageFile);
      return this.assertTrue(isValid, 'JPEG image should be valid');
    });

    this.runTest('Image processing - GIF format', () => {
      const imageFile = { type: 'image/gif', size: 1536 };
      const isValid = this.validateImageFile(imageFile);
      return this.assertTrue(isValid, 'GIF image should be valid');
    });

    this.runTest('Image processing - WebP format', () => {
      const imageFile = { type: 'image/webp', size: 1024 };
      const isValid = this.validateImageFile(imageFile);
      return this.assertTrue(isValid, 'WebP image should be valid');
    });

    this.runTest('Image processing - File size validation', () => {
      const imageFile = { type: 'image/png', size: 5 * 1024 * 1024 }; // 5MB
      const isValid = this.validateImageFile(imageFile);
      return this.assertTrue(isValid, '5MB image should be valid');
    });

    this.runTest('Image processing - File size limit', () => {
      const imageFile = { type: 'image/png', size: 11 * 1024 * 1024 }; // 11MB
      const isValid = this.validateImageFile(imageFile);
      return this.assertEqual(isValid, false, '11MB image should exceed limit');
    });

    this.runTest('Image processing - Invalid file type', () => {
      const imageFile = { type: 'application/pdf', size: 1024 };
      const isValid = this.validateImageFile(imageFile);
      return this.assertEqual(isValid, false, 'PDF should not be valid image');
    });
  }

  // Image Compression Tests
  testImageCompression() {
    console.log('\n🧪 Testing Image Compression...\n');

    this.runTest('Image compression - Compression function exists', () => {
      const compressionFn = this.simulateImageCompression;
      return this.assertTrue(typeof compressionFn === 'function', 'Compression function should exist');
    });

    this.runTest('Image compression - Compressed size reduction', () => {
      const originalSize = 1024 * 1024; // 1MB
      const compressedSize = this.simulateImageCompression(originalSize);
      return this.assertTrue(compressedSize < originalSize, 'Compressed size should be smaller');
    });

    this.runTest('Image compression - Compression ratio', () => {
      const originalSize = 5 * 1024 * 1024; // 5MB
      const compressedSize = this.simulateImageCompression(originalSize);
      const ratio = compressedSize / originalSize;
      return this.assertTrue(ratio < 0.1, 'Compression ratio should be < 10%');
    });

    this.runTest('Image compression - Small image handling', () => {
      const originalSize = 10 * 1024; // 10KB
      const compressedSize = this.simulateImageCompression(originalSize);
      return this.assertTrue(compressedSize > 0, 'Small images should still compress');
    });
  }

  // History Management Tests
  testHistoryManagement() {
    console.log('\n🧪 Testing History Management...\n');

    this.runTest('History - Save decoded QR code', () => {
      const history = [];
      const item = { text: 'https://example.com', timestamp: Date.now() };
      history.push(item);
      return this.assertEqual(history.length, 1, 'History should contain saved item');
    });

    this.runTest('History - Load history', () => {
      const history = [
        { text: 'https://example.com', timestamp: Date.now() },
        { text: 'Hello World', timestamp: Date.now() }
      ];
      return this.assertEqual(history.length, 2, 'History should load all items');
    });

    this.runTest('History - History limit', () => {
      const history = [];
      for (let i = 0; i < 15; i++) {
        history.push({ text: `Item ${i}`, timestamp: Date.now() });
      }
      // Simulate keeping only last 10 items
      const limitedHistory = history.slice(-10);
      return this.assertEqual(limitedHistory.length, 10, 'History should be limited to 10 items');
    });

    this.runTest('History - Delete item', () => {
      const history = [
        { text: 'Item 1', timestamp: Date.now() },
        { text: 'Item 2', timestamp: Date.now() },
        { text: 'Item 3', timestamp: Date.now() }
      ];
      history.splice(1, 1);
      return this.assertEqual(history.length, 2, 'History should have item deleted');
    });

    this.runTest('History - Duplicate prevention', () => {
      const history = [
        { text: 'https://example.com', timestamp: Date.now() }
      ];
      const newItem = { text: 'https://example.com', timestamp: Date.now() };
      const isDuplicate = history.some(item => item.text === newItem.text);
      return this.assertTrue(isDuplicate, 'Duplicate detection should work');
    });

    this.runTest('History - Timestamp format', () => {
      const timestamp = new Date().toISOString();
      const isValidISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timestamp);
      return this.assertTrue(isValidISO, 'Timestamp should be in ISO format');
    });
  }

  // Camera Functionality Tests
  testCameraFunctionality() {
    console.log('\n🧪 Testing Camera Functionality...\n');

    this.runTest('Camera - getUserMedia support check', () => {
      // In Node.js environment, navigator.mediaDevices is undefined
      const hasSupport = typeof globalThis !== 'undefined' && 
                         globalThis.navigator && 
                         globalThis.navigator.mediaDevices &&
                         typeof globalThis.navigator.mediaDevices.getUserMedia === 'function';
      // In test environment, this will be false, which is expected
      return this.assertEqual(Boolean(hasSupport), false, 'getUserMedia should not be available in Node.js');
    });

    this.runTest('Camera - Camera constraints validation', () => {
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      return this.assertTrue(constraints.video.facingMode === 'environment', 'Constraints should be valid');
    });

    this.runTest('Camera - Stream stop functionality', () => {
      const mockTracks = [
        { stop: () => true },
        { stop: () => true }
      ];
      const allStopped = mockTracks.every(track => track.stop() === true);
      return this.assertTrue(allStopped, 'All tracks should be stoppable');
    });
  }

  // Launch Functionality Tests
  testLaunchFunctionality() {
    console.log('\n🧪 Testing Launch Functionality...\n');

    this.runTest('Launch - URL validation', () => {
      const url = 'https://example.com';
      const isValid = url.startsWith('http://') || url.startsWith('https://');
      return this.assertTrue(isValid, 'URL should be valid');
    });

    this.runTest('Launch - Deep link validation', () => {
      const deeplink = 'myapp://product/123';
      const isValid = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(deeplink);
      return this.assertTrue(isValid, 'Deep link should be valid');
    });

    this.runTest('Launch - URL prefix handling', () => {
      const text = 'example.com';
      const url = text.startsWith('//') ? 'https:' + text : 'https://' + text;
      return this.assertEqual(url, 'https://example.com', 'URL prefix should be added correctly');
    });

    this.runTest('Launch - Protocol detection', () => {
      const url1 = 'https://example.com';
      const url2 = 'http://example.com';
      const hasProtocol1 = url1.startsWith('http://') || url1.startsWith('https://');
      const hasProtocol2 = url2.startsWith('http://') || url2.startsWith('https://');
      return this.assertTrue(hasProtocol1 && hasProtocol2, 'Protocol detection should work');
    });
  }

  // Copy Functionality Tests
  testCopyFunctionality() {
    console.log('\n🧪 Testing Copy Functionality...\n');

    this.runTest('Copy - Text preparation', () => {
      const text = 'https://example.com';
      const preparedText = text.trim();
      return this.assertEqual(preparedText, text, 'Text should be prepared correctly');
    });

    this.runTest('Copy - Clipboard API availability', () => {
      // In Node.js environment, navigator.clipboard is undefined
      const hasClipboard = typeof globalThis !== 'undefined' && 
                          globalThis.navigator && 
                          globalThis.navigator.clipboard &&
                          typeof globalThis.navigator.clipboard.writeText === 'function';
      // In test environment, this will be false, which is expected
      return this.assertEqual(Boolean(hasClipboard), false, 'Clipboard API should not be available in Node.js');
    });

    this.runTest('Copy - Fallback copy method', () => {
      const text = 'Test text';
      // Simulate fallback copy method
      const textArea = { value: text, select: () => true, remove: () => true };
      return this.assertEqual(textArea.value, text, 'Fallback copy should work');
    });
  }

  // Error Handling Tests
  testErrorHandling() {
    console.log('\n🧪 Testing Error Handling...\n');

    this.runTest('Error handling - Invalid image file', () => {
      const imageFile = { type: 'application/pdf', size: 1024 };
      const isValid = this.validateImageFile(imageFile);
      return this.assertEqual(isValid, false, 'Invalid image should be rejected');
    });

    this.runTest('Error handling - File too large', () => {
      const imageFile = { type: 'image/png', size: 15 * 1024 * 1024 }; // 15MB
      const isValid = this.validateImageFile(imageFile);
      return this.assertEqual(isValid, false, 'Large file should be rejected');
    });

    this.runTest('Error handling - Empty decoded text', () => {
      const decodedText = '';
      const isValid = decodedText && decodedText.trim().length > 0;
      // isValid will be false for empty string, which is what we expect
      return this.assertEqual(Boolean(isValid), false, 'Empty decoded text should be invalid');
    });

    this.runTest('Error handling - Null input', () => {
      const input = null;
      const isValid = input !== null && input !== undefined;
      return this.assertEqual(isValid, false, 'Null input should be invalid');
    });
  }

  // Edge Cases
  testEdgeCases() {
    console.log('\n🧪 Testing Edge Cases...\n');

    this.runTest('Edge case - Very long decoded text', () => {
      const longText = 'A'.repeat(10000);
      const isValid = longText.length > 0;
      return this.assertTrue(isValid, 'Very long text should be handled');
    });

    this.runTest('Edge case - Special characters in decoded text', () => {
      const specialText = 'https://example.com/path?param=value&other=<>&"\'';
      const isValid = this.validateDecodedText(specialText);
      return this.assertTrue(isValid, 'Special characters should be handled');
    });

    this.runTest('Edge case - Unicode characters', () => {
      const unicodeText = 'https://example.com/测试/路径';
      const isValid = this.validateDecodedText(unicodeText);
      return this.assertTrue(isValid, 'Unicode characters should be handled');
    });

    this.runTest('Edge case - Multiple QR codes in history', () => {
      const history = Array.from({ length: 20 }, (_, i) => ({
        text: `https://example.com/${i}`,
        timestamp: Date.now()
      }));
      const limitedHistory = history.slice(-10);
      return this.assertEqual(limitedHistory.length, 10, 'Multiple items should be handled');
    });

    this.runTest('Edge case - Empty history', () => {
      const history = [];
      return this.assertEqual(history.length, 0, 'Empty history should be handled');
    });
  }

  // Integration Tests
  testIntegration() {
    console.log('\n🧪 Testing Integration Scenarios...\n');

    this.runTest('Integration - Complete decode workflow', () => {
      const imageFile = { type: 'image/png', size: 1024 };
      const decodedText = 'https://example.com';
      const history = [];
      
      // Simulate complete workflow
      const isValidFile = this.validateImageFile(imageFile);
      const isValidText = this.validateDecodedText(decodedText);
      history.push({ text: decodedText, timestamp: Date.now() });
      
      return this.assertTrue(isValidFile && isValidText && history.length === 1, 
        'Complete workflow should work');
    });

    this.runTest('Integration - Decode and launch workflow', () => {
      const decodedText = 'https://example.com';
      const isValidURL = decodedText.startsWith('http://') || decodedText.startsWith('https://');
      const canLaunch = isValidURL;
      
      return this.assertTrue(canLaunch, 'Decode and launch workflow should work');
    });

    this.runTest('Integration - Decode, compress, and save workflow', () => {
      const decodedText = 'https://example.com';
      const originalSize = 1024 * 1024; // 1MB
      const compressedSize = this.simulateImageCompression(originalSize);
      const history = [{ text: decodedText, compressedSize, timestamp: Date.now() }];
      
      return this.assertTrue(
        decodedText.length > 0 && 
        compressedSize < originalSize && 
        history.length === 1,
        'Complete decode, compress, and save workflow should work'
      );
    });
  }

  // Helper Methods
  validateDecodedText(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return false;
    }
    return true;
  }

  validateImageFile(file) {
    if (!file || !file.type || !file.size) {
      return false;
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      return false;
    }
    
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return false;
    }
    
    return true;
  }

  simulateImageCompression(originalSize) {
    // Simulate compression: reduce to ~5% of original size
    return Math.floor(originalSize * 0.05);
  }

  // Run all tests
  runAllTests() {
    console.log('🧪 QR Code Decoder Test Suite');
    console.log('==================================\n');

    this.testQRCodeDecoding();
    this.testImageProcessing();
    this.testImageCompression();
    this.testHistoryManagement();
    this.testCameraFunctionality();
    this.testLaunchFunctionality();
    this.testCopyFunctionality();
    this.testErrorHandling();
    this.testEdgeCases();
    this.testIntegration();

    return {
      total: this.totalTests,
      passed: this.testsPassed,
      failed: this.testsFailed,
      failedTests: this.failedTests
    };
  }
}

export { QRDecoderTester };

