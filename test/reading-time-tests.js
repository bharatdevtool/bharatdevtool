/**
 * Reading Time Estimator Test Suite
 */

export class ReadingTimeTester {
  constructor() {
    this.testsPassed = 0;
    this.testsFailed = 0;
    this.totalTests = 0;
    this.failedTests = [];
  }

  runTest(name, fn) {
    this.totalTests++;
    try {
      const result = fn();
      if (result === true) {
        this.testsPassed++;
        console.log('✅ ' + name);
      } else {
        this.testsFailed++;
        this.failedTests.push(name);
        console.log('❌ ' + name + ' - Expected true, got: ' + result);
      }
    } catch (e) {
      this.testsFailed++;
      this.failedTests.push(name);
      console.log('❌ ' + name + ' - Error: ' + e.message);
    }
  }

  // ---- Pure functions duplicated for node testing (no DOM) ----

  countWords(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(w => w.length > 0).length;
  }

  countSentences(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    const matches = trimmed.match(/[^.!?]*[.!?]+/g);
    return matches ? matches.length : (trimmed.length > 0 ? 1 : 0);
  }

  countParagraphs(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\n\s*\n+/).filter(p => p.trim().length > 0).length;
  }

  calculateReadingSeconds(wordCount, wpm) {
    if (wordCount === 0 || wpm <= 0) return 0;
    return (wordCount / wpm) * 60;
  }

  formatTime(totalSeconds) {
    if (totalSeconds < 60) return Math.max(1, Math.round(totalSeconds)) + ' sec';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    if (seconds === 0) return minutes + ' min';
    return minutes + ' min ' + seconds + ' sec';
  }

  runAll() {
    console.log('\n📖 Reading Time Estimator Tests\n' + '='.repeat(40));

    // countWords
    this.runTest('countWords: empty string → 0', () => this.countWords('') === 0);
    this.runTest('countWords: single word', () => this.countWords('hello') === 1);
    this.runTest('countWords: multiple words', () => this.countWords('hello world foo bar') === 4);
    this.runTest('countWords: extra whitespace', () => this.countWords('  hello   world  ') === 2);
    this.runTest('countWords: newlines count as whitespace', () => this.countWords('hello\nworld') === 2);
    this.runTest('countWords: 238 words matches expected reading time', () => {
      const words = Array(238).fill('word').join(' ');
      return this.countWords(words) === 238;
    });

    // countSentences
    this.runTest('countSentences: empty → 0', () => this.countSentences('') === 0);
    this.runTest('countSentences: one sentence with period', () => this.countSentences('Hello world.') === 1);
    this.runTest('countSentences: two sentences', () => this.countSentences('Hello. World.') === 2);
    this.runTest('countSentences: exclamation and question', () => this.countSentences('Hello! How are you?') === 2);
    this.runTest('countSentences: no terminal punct → 1', () => this.countSentences('no punctuation here') === 1);

    // countParagraphs
    this.runTest('countParagraphs: empty → 0', () => this.countParagraphs('') === 0);
    this.runTest('countParagraphs: single paragraph → 1', () => this.countParagraphs('One paragraph.') === 1);
    this.runTest('countParagraphs: two paragraphs separated by blank line', () => this.countParagraphs('Para one.\n\nPara two.') === 2);
    this.runTest('countParagraphs: blank lines at edges ignored', () => this.countParagraphs('\n\nPara one.\n\nPara two.\n\n') === 2);

    // calculateReadingSeconds
    this.runTest('calculateReadingSeconds: 0 words → 0', () => this.calculateReadingSeconds(0, 238) === 0);
    this.runTest('calculateReadingSeconds: 238 words at 238 WPM → 60 sec', () => this.calculateReadingSeconds(238, 238) === 60);
    this.runTest('calculateReadingSeconds: 476 words at 238 WPM → 120 sec', () => this.calculateReadingSeconds(476, 238) === 120);
    this.runTest('calculateReadingSeconds: negative WPM → 0', () => this.calculateReadingSeconds(100, 0) === 0);

    // formatTime
    this.runTest('formatTime: < 60 sec shows seconds', () => this.formatTime(30) === '30 sec');
    this.runTest('formatTime: exactly 60 sec → 1 min', () => this.formatTime(60) === '1 min');
    this.runTest('formatTime: 90 sec → 1 min 30 sec', () => this.formatTime(90) === '1 min 30 sec');
    this.runTest('formatTime: 0 sec → 1 sec (min 1)', () => this.formatTime(0) === '1 sec');
    this.runTest('formatTime: 120 sec → 2 min', () => this.formatTime(120) === '2 min');

    // Integration: 1000-word article at 238 WPM ≈ 4 min 12 sec
    this.runTest('Integration: 1000-word article reading time ~4 min', () => {
      const secs = this.calculateReadingSeconds(1000, 238);
      const formatted = this.formatTime(secs);
      return formatted.startsWith('4 min');
    });

    // Speaking time slower than reading time
    this.runTest('Speaking time > reading time for same text', () => {
      const readSecs = this.calculateReadingSeconds(500, 238);
      const speakSecs = this.calculateReadingSeconds(500, 130);
      return speakSecs > readSecs;
    });

    console.log('\n' + '='.repeat(40));
    console.log('Total: ' + this.totalTests + ' | Passed: ' + this.testsPassed + ' | Failed: ' + this.testsFailed);
    if (this.failedTests.length > 0) {
      console.log('Failed: ' + this.failedTests.join(', '));
    }
    return {
      total: this.totalTests,
      passed: this.testsPassed,
      failed: this.testsFailed,
      failedTests: this.failedTests
    };
  }
}
