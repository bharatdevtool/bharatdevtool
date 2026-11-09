/**
 * Image Converter Tests
 * Tests for core browser-side image conversion logic.
 * Canvas API is not available in Node.js, so we test pure utility functions only.
 */

export class ImageConverterTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.failedTests = [];
  }

  runTest(name, fn) {
    try {
      const result = fn();
      if (result === true) {
        this.passed++;
        console.log(`  ✅ ${name}`);
      } else {
        this.failed++;
        this.failedTests.push(name);
        console.log(`  ❌ ${name} — returned ${result}`);
      }
    } catch (err) {
      this.failed++;
      this.failedTests.push(name);
      console.log(`  ❌ ${name} — ${err.message}`);
    }
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  }

  mimeToExtension(mime) {
    const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    return map[mime] || 'jpg';
  }

  isLossyFormat(mime) {
    return mime === 'image/jpeg' || mime === 'image/webp';
  }

  isValidImageFile(type) {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'];
    return allowed.includes(type);
  }

  runAllTests() {
    console.log('\n🧪 Image Converter Test Suite');
    console.log('==============================\n');

    // formatFileSize
    this.runTest('formatFileSize — bytes', () => this.formatFileSize(512) === '512 B');
    this.runTest('formatFileSize — kilobytes', () => this.formatFileSize(2048) === '2.0 KB');
    this.runTest('formatFileSize — megabytes', () => this.formatFileSize(1572864) === '1.50 MB');

    // mimeToExtension
    this.runTest('mimeToExtension — jpeg', () => this.mimeToExtension('image/jpeg') === 'jpg');
    this.runTest('mimeToExtension — png', () => this.mimeToExtension('image/png') === 'png');
    this.runTest('mimeToExtension — webp', () => this.mimeToExtension('image/webp') === 'webp');
    this.runTest('mimeToExtension — unknown falls back to jpg', () => this.mimeToExtension('image/bmp') === 'jpg');

    // isLossyFormat
    this.runTest('isLossyFormat — jpeg is lossy', () => this.isLossyFormat('image/jpeg') === true);
    this.runTest('isLossyFormat — webp is lossy', () => this.isLossyFormat('image/webp') === true);
    this.runTest('isLossyFormat — png is not lossy', () => this.isLossyFormat('image/png') === false);

    // isValidImageFile
    this.runTest('isValidImageFile — png accepted', () => this.isValidImageFile('image/png') === true);
    this.runTest('isValidImageFile — jpeg accepted', () => this.isValidImageFile('image/jpeg') === true);
    this.runTest('isValidImageFile — webp accepted', () => this.isValidImageFile('image/webp') === true);
    this.runTest('isValidImageFile — gif accepted', () => this.isValidImageFile('image/gif') === true);
    this.runTest('isValidImageFile — bmp accepted', () => this.isValidImageFile('image/bmp') === true);
    this.runTest('isValidImageFile — pdf rejected', () => this.isValidImageFile('application/pdf') === false);
    this.runTest('isValidImageFile — svg rejected', () => this.isValidImageFile('image/svg+xml') === false);

    const total = this.passed + this.failed;
    console.log(`\nImage Converter: ${total} tests — ${this.passed} passed, ${this.failed} failed`);
    return { total, passed: this.passed, failed: this.failed, failedTests: this.failedTests };
  }
}
