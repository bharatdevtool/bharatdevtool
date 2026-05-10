/**
 * Lorem Ipsum Generator Test Suite
 *
 * Tests the Lorem Ipsum generation logic mirroring the browser
 * implementation in lorem-ipsum.html.
 */

// ── Helpers (mirrors html implementation) ────────────────────────────────────

const LOREM_WORDS = [
  'lorem','ipsum','dolor','sit','amet','consectetur','adipiscing','elit',
  'sed','do','eiusmod','tempor','incididunt','ut','labore','et','dolore','magna',
  'aliqua','enim','ad','minim','veniam','quis','nostrud','exercitation','ullamco',
  'laboris','nisi','aliquip','ex','ea','commodo','consequat','duis','aute','irure',
  'reprehenderit','voluptate','velit','esse','cillum','fugiat','nulla','pariatur',
  'excepteur','sint','occaecat','cupidatat','non','proident','sunt','culpa','qui',
  'officia','deserunt','mollit','anim','id','est','laborum'
];

const CLASSIC_START = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomWord(exclude) {
  let word;
  do {
    word = LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)];
  } while (word === exclude);
  return word;
}

function generateSentence(forceClassic) {
  if (forceClassic) return CLASSIC_START;
  const wordCount = getRandomInt(7, 18);
  const words = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(getRandomWord(i > 0 ? words[i - 1] : null));
  }
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(' ') + '.';
}

function generateParagraph(isFirst, useClassic) {
  const sentenceCount = getRandomInt(4, 8);
  const sentences = [];
  for (let i = 0; i < sentenceCount; i++) {
    sentences.push(generateSentence(isFirst && i === 0 && useClassic));
  }
  return sentences.join(' ');
}

function generateWords(count, useClassic) {
  if (useClassic) {
    const classicWords = CLASSIC_START.replace(/[.,]/g, '').split(' ');
    if (count <= classicWords.length) return classicWords.slice(0, count).join(' ');
    const extra = count - classicWords.length;
    const extraWords = [];
    for (let i = 0; i < extra; i++) {
      extraWords.push(getRandomWord(i > 0 ? extraWords[i - 1] : null));
    }
    return classicWords.join(' ') + ' ' + extraWords.join(' ');
  }
  const words = [];
  for (let i = 0; i < count; i++) {
    words.push(getRandomWord(i > 0 ? words[i - 1] : null));
  }
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(' ');
}

function generateLoremIpsum(type, count, useClassic) {
  if (type === 'paragraphs') {
    const paras = [];
    for (let i = 0; i < count; i++) {
      paras.push(generateParagraph(i === 0, useClassic));
    }
    return paras.join('\n\n');
  }
  if (type === 'sentences') {
    const sentences = [];
    for (let i = 0; i < count; i++) {
      sentences.push(generateSentence(i === 0 && useClassic));
    }
    return sentences.join(' ');
  }
  return generateWords(count, useClassic);
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Test Class ────────────────────────────────────────────────────────────────

export class LoremIpsumTester {
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
        console.log(`  ✅ ${name}`);
      } else {
        this.testsFailed++;
        this.failedTests.push(name);
        console.log(`  ❌ ${name} — returned: ${result}`);
      }
    } catch (err) {
      this.testsFailed++;
      this.failedTests.push(name);
      console.log(`  ❌ ${name} — error: ${err.message}`);
    }
  }

  runAllTests() {
    console.log('\n🧪 Lorem Ipsum Generator Tests\n');

    // ── Paragraph generation ─────────────────────────────────────────────────

    this.runTest('generates 1 paragraph', () => {
      const result = generateLoremIpsum('paragraphs', 1, false);
      return typeof result === 'string' && result.length > 0;
    });

    this.runTest('generates 3 paragraphs separated by double newline', () => {
      const result = generateLoremIpsum('paragraphs', 3, false);
      return result.split('\n\n').length === 3;
    });

    this.runTest('paragraph with classic start begins with "Lorem ipsum"', () => {
      const result = generateLoremIpsum('paragraphs', 1, true);
      return result.startsWith('Lorem ipsum');
    });

    this.runTest('paragraph without classic start is a non-empty string', () => {
      const result = generateLoremIpsum('paragraphs', 1, false);
      return result.trim().length > 0;
    });

    // ── Sentence generation ──────────────────────────────────────────────────

    this.runTest('generates 1 sentence ending with a period', () => {
      const result = generateLoremIpsum('sentences', 1, false);
      return result.endsWith('.');
    });

    this.runTest('generates 5 sentences with classic start beginning "Lorem ipsum"', () => {
      const result = generateLoremIpsum('sentences', 5, true);
      return result.startsWith('Lorem ipsum');
    });

    this.runTest('generated sentence is capitalised', () => {
      const sentence = generateSentence(false);
      return sentence.charAt(0) === sentence.charAt(0).toUpperCase();
    });

    this.runTest('classic sentence equals CLASSIC_START constant', () => {
      return generateSentence(true) === CLASSIC_START;
    });

    // ── Word generation ──────────────────────────────────────────────────────

    this.runTest('generates exactly 10 words', () => {
      const result = generateLoremIpsum('words', 10, false);
      return countWords(result) === 10;
    });

    this.runTest('generates exactly 1 word', () => {
      const result = generateLoremIpsum('words', 1, false);
      return countWords(result) === 1;
    });

    this.runTest('word output with classic start begins with "Lorem"', () => {
      const result = generateLoremIpsum('words', 5, true);
      return result.startsWith('Lorem');
    });

    this.runTest('generates 50 words', () => {
      const result = generateLoremIpsum('words', 50, false);
      return countWords(result) === 50;
    });

    // ── Word count helper ────────────────────────────────────────────────────

    this.runTest('countWords returns 3 for "lorem ipsum dolor"', () => {
      return countWords('lorem ipsum dolor') === 3;
    });

    this.runTest('countWords handles extra whitespace', () => {
      return countWords('  lorem   ipsum  ') === 2;
    });

    this.runTest('countWords returns 0 for empty string', () => {
      return countWords('') === 0;
    });

    // ── Edge cases ───────────────────────────────────────────────────────────

    this.runTest('generates 10 paragraphs without throwing', () => {
      const result = generateLoremIpsum('paragraphs', 10, true);
      return result.split('\n\n').length === 10;
    });

    this.runTest('consecutive words are never identical', () => {
      const result = generateLoremIpsum('words', 20, false);
      const words = result.split(' ');
      for (let i = 1; i < words.length; i++) {
        if (words[i].toLowerCase() === words[i - 1].toLowerCase()) return false;
      }
      return true;
    });

    const summary = {
      total: this.totalTests,
      passed: this.testsPassed,
      failed: this.testsFailed,
      failedTests: this.failedTests
    };

    console.log(`\n  Lorem Ipsum: ${this.testsPassed}/${this.totalTests} passed`);
    return summary;
  }
}
