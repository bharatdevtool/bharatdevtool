/**
 * Text Case Converter Test Suite
 */

export class TextCaseConverterTester {
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
        console.log('❌ ' + name + ' - Expected true, got ' + result);
      }
    } catch (e) {
      this.testsFailed++;
      this.failedTests.push(name);
      console.log('❌ ' + name + ' - Error: ' + e.message);
    }
  }

  assertEqual(actual, expected, msg) {
    if (actual === expected) return true;
    throw new Error((msg || '') + ' | Expected: ' + JSON.stringify(expected) + ', Got: ' + JSON.stringify(actual));
  }

  // -----------------------------------------------------------------------
  // Conversion functions (mirrored from the HTML page)
  // -----------------------------------------------------------------------

  toUpper(t) { return t.toUpperCase(); }
  toLower(t) { return t.toLowerCase(); }

  toTitle(t) {
    return t.replace(/\w\S*/g, function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });
  }

  toSentence(t) {
    return t.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, function (m) {
      return m.toUpperCase();
    });
  }

  tokenise(t) {
    return t.trim()
      .replace(/[_\-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/[\s,./\\:;()\[\]{}<>!?@#$%^&*+=|"'`~]+/)
      .filter(function (w) { return w.length > 0; });
  }

  toCamel(t) {
    const words = this.tokenise(t);
    if (words.length === 0) return '';
    return words[0].toLowerCase() + words.slice(1).map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join('');
  }

  toPascal(t) {
    return this.tokenise(t).map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join('');
  }

  toSnake(t) {
    return this.tokenise(t).map(function (w) { return w.toLowerCase(); }).join('_');
  }

  toKebab(t) {
    return this.tokenise(t).map(function (w) { return w.toLowerCase(); }).join('-');
  }

  toConstant(t) {
    return this.tokenise(t).map(function (w) { return w.toUpperCase(); }).join('_');
  }

  toAlternating(t) {
    let toggle = false;
    return t.replace(/[a-zA-Z]/g, function (ch) {
      const r = toggle ? ch.toUpperCase() : ch.toLowerCase();
      toggle = !toggle;
      return r;
    });
  }

  toInverse(t) {
    return t.split('').map(function (ch) {
      return ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase();
    }).join('');
  }

  toSlug(t) {
    return t.toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/-{2,}/g, '-');
  }

  // -----------------------------------------------------------------------
  // Tests
  // -----------------------------------------------------------------------

  runAllTests() {
    console.log('\n📋 Text Case Converter Tests\n');

    this.runTest('UPPERCASE - basic', () => this.assertEqual(this.toUpper('hello world'), 'HELLO WORLD'));
    this.runTest('UPPERCASE - mixed input', () => this.assertEqual(this.toUpper('Hello World!'), 'HELLO WORLD!'));

    this.runTest('lowercase - basic', () => this.assertEqual(this.toLower('HELLO WORLD'), 'hello world'));
    this.runTest('lowercase - mixed input', () => this.assertEqual(this.toLower('Hello World!'), 'hello world!'));

    this.runTest('Title Case - basic', () => this.assertEqual(this.toTitle('hello world'), 'Hello World'));
    this.runTest('Title Case - all caps input', () => this.assertEqual(this.toTitle('HELLO WORLD'), 'Hello World'));

    this.runTest('Sentence case - basic', () => this.assertEqual(this.toSentence('hello world. another sentence'), 'Hello world. Another sentence'));
    this.runTest('Sentence case - already correct', () => this.assertEqual(this.toSentence('Hello world.'), 'Hello world.'));

    this.runTest('camelCase - basic', () => this.assertEqual(this.toCamel('hello world'), 'helloWorld'));
    this.runTest('camelCase - multiple words', () => this.assertEqual(this.toCamel('the quick brown fox'), 'theQuickBrownFox'));
    this.runTest('camelCase - from snake_case', () => this.assertEqual(this.toCamel('hello_world'), 'helloWorld'));
    this.runTest('camelCase - from kebab-case', () => this.assertEqual(this.toCamel('hello-world'), 'helloWorld'));
    this.runTest('camelCase - single word', () => this.assertEqual(this.toCamel('hello'), 'hello'));

    this.runTest('PascalCase - basic', () => this.assertEqual(this.toPascal('hello world'), 'HelloWorld'));
    this.runTest('PascalCase - multiple words', () => this.assertEqual(this.toPascal('the quick brown fox'), 'TheQuickBrownFox'));
    this.runTest('PascalCase - from snake_case', () => this.assertEqual(this.toPascal('hello_world'), 'HelloWorld'));

    this.runTest('snake_case - basic', () => this.assertEqual(this.toSnake('hello world'), 'hello_world'));
    this.runTest('snake_case - multiple words', () => this.assertEqual(this.toSnake('The Quick Brown Fox'), 'the_quick_brown_fox'));
    this.runTest('snake_case - from camelCase', () => this.assertEqual(this.toSnake('helloWorld'), 'hello_world'));

    this.runTest('kebab-case - basic', () => this.assertEqual(this.toKebab('hello world'), 'hello-world'));
    this.runTest('kebab-case - multiple words', () => this.assertEqual(this.toKebab('The Quick Brown Fox'), 'the-quick-brown-fox'));
    this.runTest('kebab-case - from snake_case', () => this.assertEqual(this.toKebab('hello_world'), 'hello-world'));

    this.runTest('CONSTANT_CASE - basic', () => this.assertEqual(this.toConstant('hello world'), 'HELLO_WORLD'));
    this.runTest('CONSTANT_CASE - multiple words', () => this.assertEqual(this.toConstant('The Quick Brown Fox'), 'THE_QUICK_BROWN_FOX'));

    this.runTest('Alternating - basic letters', () => this.assertEqual(this.toAlternating('hello'), 'hElLo'));
    this.runTest('Alternating - preserves non-alpha', () => this.assertEqual(this.toAlternating('hi!'), 'hI!'));

    this.runTest('Inverse - lowercase to upper', () => this.assertEqual(this.toInverse('hello'), 'HELLO'));
    this.runTest('Inverse - uppercase to lower', () => this.assertEqual(this.toInverse('HELLO'), 'hello'));
    this.runTest('Inverse - mixed', () => this.assertEqual(this.toInverse('Hello World'), 'hELLO wORLD'));

    this.runTest('URL slug - basic', () => this.assertEqual(this.toSlug('Hello World'), 'hello-world'));
    this.runTest('URL slug - special chars', () => this.assertEqual(this.toSlug('Hello, World!'), 'hello-world'));
    this.runTest('URL slug - multiple spaces', () => this.assertEqual(this.toSlug('hello   world'), 'hello-world'));

    this.runTest('Empty string - UPPERCASE', () => this.assertEqual(this.toUpper(''), ''));
    this.runTest('Empty string - camelCase', () => this.assertEqual(this.toCamel(''), ''));
    this.runTest('Single word - PascalCase', () => this.assertEqual(this.toPascal('hello'), 'Hello'));

    const passed = this.testsPassed;
    const failed = this.testsFailed;
    const total = this.totalTests;
    console.log('\nText Case Converter: ' + total + ' tests (' + passed + ' passed, ' + failed + ' failed)');

    if (this.failedTests.length > 0) {
      console.log('\nText Case Converter failures:');
      this.failedTests.forEach(function (t) { console.log('   - ' + t); });
    }

    return { passed, failed, total, failedTests: this.failedTests };
  }
}
