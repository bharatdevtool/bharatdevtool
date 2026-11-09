/**
 * Image Resizer Tests
 * Tests pure utility logic for the image resizer tool.
 */

export class ImageResizerTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.failedTests = [];
  }

  assert(condition, testName) {
    if (condition) {
      this.passed++;
    } else {
      this.failed++;
      this.failedTests.push(testName);
    }
  }

  // ---- Helpers mirroring the tool's logic ----

  formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  formatExtension(mimeType) {
    const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    return map[mimeType] || 'jpg';
  }

  computeAspectRatioHeight(width, originalWidth, originalHeight) {
    const ratio = originalWidth / originalHeight;
    return Math.round(width / ratio);
  }

  computeAspectRatioWidth(height, originalWidth, originalHeight) {
    const ratio = originalWidth / originalHeight;
    return Math.round(height * ratio);
  }

  computePercentageDimensions(pct, originalWidth, originalHeight) {
    return {
      width: Math.round(originalWidth * pct / 100),
      height: Math.round(originalHeight * pct / 100)
    };
  }

  isValidDimension(value) {
    return Number.isInteger(value) && value >= 1 && value <= 16000;
  }

  isValidFileType(mimeType) {
    return typeof mimeType === 'string' && mimeType.startsWith('image/');
  }

  buildOutputFileName(originalName, mimeType) {
    const ext = this.formatExtension(mimeType);
    const base = originalName.replace(/\.[^.]+$/, '');
    return base + '-resized.' + ext;
  }

  // ---- Test suites ----

  testFormatBytes() {
    this.assert(this.formatBytes(0) === '0 B', 'formatBytes: 0 bytes');
    this.assert(this.formatBytes(512) === '512 B', 'formatBytes: 512 bytes');
    this.assert(this.formatBytes(1024) === '1.0 KB', 'formatBytes: 1024 bytes = 1.0 KB');
    this.assert(this.formatBytes(1536) === '1.5 KB', 'formatBytes: 1536 bytes = 1.5 KB');
    this.assert(this.formatBytes(1048576) === '1.0 MB', 'formatBytes: 1 MB');
    this.assert(this.formatBytes(2097152) === '2.0 MB', 'formatBytes: 2 MB');
  }

  testFormatExtension() {
    this.assert(this.formatExtension('image/jpeg') === 'jpg', 'formatExtension: jpeg → jpg');
    this.assert(this.formatExtension('image/png') === 'png', 'formatExtension: png → png');
    this.assert(this.formatExtension('image/webp') === 'webp', 'formatExtension: webp → webp');
    this.assert(this.formatExtension('image/gif') === 'jpg', 'formatExtension: gif → jpg (default)');
    this.assert(this.formatExtension('unknown') === 'jpg', 'formatExtension: unknown → jpg (default)');
  }

  testAspectRatioCompute() {
    // 1920×1080 (16:9)
    this.assert(
      this.computeAspectRatioHeight(960, 1920, 1080) === 540,
      'aspect ratio: 1920×1080 halved → height 540'
    );
    this.assert(
      this.computeAspectRatioWidth(540, 1920, 1080) === 960,
      'aspect ratio: 1920×1080 halved → width 960'
    );

    // Square image (1:1)
    this.assert(
      this.computeAspectRatioHeight(400, 800, 800) === 400,
      'aspect ratio: square image'
    );

    // Portrait (4:5)
    this.assert(
      this.computeAspectRatioHeight(800, 1000, 1250) === 1000,
      'aspect ratio: portrait 4:5'
    );
  }

  testPercentageDimensions() {
    const orig = { w: 1920, h: 1080 };

    const d50 = this.computePercentageDimensions(50, orig.w, orig.h);
    this.assert(d50.width === 960 && d50.height === 540, 'percentage 50% of 1920×1080');

    const d100 = this.computePercentageDimensions(100, orig.w, orig.h);
    this.assert(d100.width === 1920 && d100.height === 1080, 'percentage 100% = original');

    const d200 = this.computePercentageDimensions(200, orig.w, orig.h);
    this.assert(d200.width === 3840 && d200.height === 2160, 'percentage 200% doubles');

    const d1 = this.computePercentageDimensions(1, orig.w, orig.h);
    this.assert(d1.width === 19 && d1.height === 11, 'percentage 1% minimum');
  }

  testDimensionValidation() {
    this.assert(this.isValidDimension(1) === true, 'valid dimension: 1 (min)');
    this.assert(this.isValidDimension(16000) === true, 'valid dimension: 16000 (max)');
    this.assert(this.isValidDimension(800) === true, 'valid dimension: 800');
    this.assert(this.isValidDimension(0) === false, 'invalid dimension: 0');
    this.assert(this.isValidDimension(-1) === false, 'invalid dimension: -1');
    this.assert(this.isValidDimension(16001) === false, 'invalid dimension: 16001 (over max)');
    this.assert(this.isValidDimension(1.5) === false, 'invalid dimension: 1.5 (non-integer)');
  }

  testFileTypeValidation() {
    this.assert(this.isValidFileType('image/jpeg') === true, 'valid file type: image/jpeg');
    this.assert(this.isValidFileType('image/png') === true, 'valid file type: image/png');
    this.assert(this.isValidFileType('image/webp') === true, 'valid file type: image/webp');
    this.assert(this.isValidFileType('image/gif') === true, 'valid file type: image/gif');
    this.assert(this.isValidFileType('application/pdf') === false, 'invalid file type: pdf');
    this.assert(this.isValidFileType('text/plain') === false, 'invalid file type: text/plain');
    this.assert(this.isValidFileType('') === false, 'invalid file type: empty string');
  }

  testOutputFileName() {
    this.assert(
      this.buildOutputFileName('photo.jpg', 'image/jpeg') === 'photo-resized.jpg',
      'output filename: jpg'
    );
    this.assert(
      this.buildOutputFileName('banner.png', 'image/png') === 'banner-resized.png',
      'output filename: png'
    );
    this.assert(
      this.buildOutputFileName('image.webp', 'image/webp') === 'image-resized.webp',
      'output filename: webp'
    );
    this.assert(
      this.buildOutputFileName('my.photo.with.dots.jpg', 'image/jpeg') === 'my.photo.with.dots-resized.jpg',
      'output filename: multi-dot filename'
    );
    this.assert(
      this.buildOutputFileName('picture', 'image/png') === 'picture-resized.png',
      'output filename: no extension'
    );
  }

  runAll() {
    this.testFormatBytes();
    this.testFormatExtension();
    this.testAspectRatioCompute();
    this.testPercentageDimensions();
    this.testDimensionValidation();
    this.testFileTypeValidation();
    this.testOutputFileName();

    return {
      passed: this.passed,
      failed: this.failed,
      failedTests: this.failedTests,
      total: this.passed + this.failed
    };
  }
}
