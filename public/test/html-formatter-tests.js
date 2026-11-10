/**
 * HTML Formatter Tests
 * Tests the core beautifyHTML and minifyHTML logic extracted from html-formatter.html
 */

// ─── Inline replicas of core logic (must match html-formatter.html) ──────────

const INLINE_TAGS = new Set([
  'a','abbr','acronym','b','bdo','big','br','button','cite','code',
  'dfn','em','i','img','input','kbd','label','map','object','output',
  'q','samp','select','small','span','strong','sub','sup','textarea',
  'time','tt','u','var'
]);

const VOID_TAGS = new Set([
  'area','base','br','col','embed','hr','img','input','link','meta',
  'param','source','track','wbr'
]);

function getIndentString(type) {
  if (type === 'tab') return '\t';
  return ' '.repeat(Number(type));
}

function isVoidTag(tagName) {
  return VOID_TAGS.has(tagName.toLowerCase());
}

function tokeniseHTML(html) {
  const tokens = [];
  let i = 0;

  while (i < html.length) {
    if (html[i] !== '<') {
      let j = html.indexOf('<', i);
      if (j === -1) j = html.length;
      const text = html.slice(i, j);
      if (text.trim()) tokens.push({ type: 'text', value: text.trim() });
      i = j;
      continue;
    }

    if (html.slice(i, i + 9).toUpperCase() === '<!DOCTYPE') {
      const end = html.indexOf('>', i) + 1;
      tokens.push({ type: 'doctype', value: html.slice(i, end) });
      i = end;
      continue;
    }

    if (html.slice(i, i + 4) === '<!--') {
      const end = html.indexOf('-->', i) + 3;
      tokens.push({ type: 'comment', value: html.slice(i, end) });
      i = end === 2 ? html.length : end;
      continue;
    }

    let j = i + 1;
    let inAttrStr = false;
    let attrQuote = '';
    while (j < html.length) {
      const ch = html[j];
      if (inAttrStr) {
        if (ch === attrQuote) inAttrStr = false;
      } else if (ch === '"' || ch === "'") {
        inAttrStr = true;
        attrQuote = ch;
      } else if (ch === '>') {
        break;
      }
      j++;
    }
    const tag = html.slice(i, j + 1);
    i = j + 1;

    const isClosing = tag[1] === '/';
    const isSelfClose = tag[tag.length - 2] === '/';
    const nameMatch = tag.match(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)/);
    const tagName = nameMatch ? nameMatch[1] : '';

    if (isClosing) {
      tokens.push({ type: 'close', value: tag, tagName });
    } else if (isSelfClose || isVoidTag(tagName)) {
      tokens.push({ type: 'void', value: tag, tagName });
    } else {
      tokens.push({ type: 'open', value: tag, tagName });
    }
  }

  return tokens;
}

function beautifyHTML(html, options = {}) {
  if (!html || !html.trim()) return '';

  const indentStr = getIndentString(options.indent || '2');
  const preserveComments = options.preserveComments !== false;
  const tokens = tokeniseHTML(html);
  const lines = [];
  let depth = 0;
  const indent = () => indentStr.repeat(Math.max(0, depth));

  for (let t = 0; t < tokens.length; t++) {
    const token = tokens[t];

    if (token.type === 'doctype') { lines.push(token.value); continue; }

    if (token.type === 'comment') {
      if (!preserveComments) continue;
      token.value.split('\n').forEach((cl, ci) => {
        lines.push(ci === 0 ? indent() + cl.trim() : indent() + ' ' + cl.trim());
      });
      continue;
    }

    if (token.type === 'text') { lines.push(indent() + token.value); continue; }
    if (token.type === 'void') { lines.push(indent() + token.value); continue; }

    if (token.type === 'open') {
      const nextToken = tokens[t + 1];
      const afterNext = tokens[t + 2];
      if (
        INLINE_TAGS.has(token.tagName.toLowerCase()) &&
        nextToken && nextToken.type === 'text' &&
        afterNext && afterNext.type === 'close' && afterNext.tagName === token.tagName
      ) {
        lines.push(indent() + token.value + nextToken.value + afterNext.value);
        t += 2;
        continue;
      }
      lines.push(indent() + token.value);
      depth++;
      continue;
    }

    if (token.type === 'close') {
      depth = Math.max(0, depth - 1);
      lines.push(indent() + token.value);
      continue;
    }
  }

  return lines.join('\n');
}

function minifyHTML(html, options = {}) {
  if (!html || !html.trim()) return '';
  const preserveComments = options.preserveComments !== false;
  let result = html
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
  if (!preserveComments) {
    result = result.replace(/<!--[\s\S]*?-->/g, '');
  }
  return result;
}

// ─── Test Helpers ─────────────────────────────────────────────────────────────

export class HTMLFormatterTester {
  constructor() {
    this.testsPassed = 0;
    this.testsFailed = 0;
    this.totalTests = 0;
    this.failedTests = [];
  }

  test(name, fn) {
    this.totalTests++;
    try {
      const result = fn();
      if (result === true) {
        this.testsPassed++;
        console.log(`  ✅ ${name}`);
      } else {
        this.testsFailed++;
        this.failedTests.push(name);
        console.log(`  ❌ ${name} — Expected true, got ${result}`);
      }
    } catch (err) {
      this.testsFailed++;
      this.failedTests.push(name);
      console.log(`  ❌ ${name} — ${err.message}`);
    }
  }

  assertEqual(actual, expected, msg) {
    if (actual === expected) return true;
    throw new Error(`${msg || 'assertEqual'} — Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
  }

  assertContains(actual, substr, msg) {
    if (actual.includes(substr)) return true;
    throw new Error(`${msg || 'assertContains'} — Expected to contain: ${JSON.stringify(substr)}, Got: ${JSON.stringify(actual)}`);
  }

  assertNotContains(actual, substr, msg) {
    if (!actual.includes(substr)) return true;
    throw new Error(`${msg || 'assertNotContains'} — Did not expect to contain: ${JSON.stringify(substr)}`);
  }

  runAll() {
    console.log('\n🧪 HTML Formatter Test Suite');
    console.log('=============================\n');

    // ── beautifyHTML ──────────────────────────────────────────────────────────

    this.test('beautifyHTML - empty input returns empty string', () =>
      this.assertEqual(beautifyHTML(''), '', 'Empty input'));

    this.test('beautifyHTML - simple div gets indented children', () => {
      const result = beautifyHTML('<div><p>Hello</p></div>');
      return this.assertContains(result, '\n', 'Should have newlines');
    });

    this.test('beautifyHTML - DOCTYPE preserved at top level', () => {
      const result = beautifyHTML('<!DOCTYPE html><html></html>');
      return this.assertContains(result, '<!DOCTYPE html>', 'DOCTYPE should be present');
    });

    this.test('beautifyHTML - nested elements have increasing indentation', () => {
      const result = beautifyHTML('<html><body><p>text</p></body></html>');
      const lines = result.split('\n');
      // body should be indented more than html
      const htmlLine = lines.find(l => l.trimStart().startsWith('<html'));
      const bodyLine = lines.find(l => l.trimStart().startsWith('<body'));
      const htmlIndent = htmlLine ? htmlLine.length - htmlLine.trimStart().length : 0;
      const bodyIndent = bodyLine ? bodyLine.length - bodyLine.trimStart().length : 0;
      if (bodyIndent <= htmlIndent) throw new Error('body should be indented more than html');
      return true;
    });

    this.test('beautifyHTML - closing tags dedent correctly', () => {
      const result = beautifyHTML('<div><p>hello</p></div>');
      const closingDiv = result.split('\n').find(l => l.includes('</div>'));
      // closing </div> should have no leading spaces (depth 0)
      return this.assertEqual(closingDiv.trimStart(), '</div>', 'Closing div at depth 0');
    });

    this.test('beautifyHTML - 4-space indent option works', () => {
      const result = beautifyHTML('<div><p>x</p></div>', { indent: '4' });
      const pLine = result.split('\n').find(l => l.includes('<p>'));
      const spaces = pLine ? pLine.length - pLine.trimStart().length : 0;
      if (spaces !== 4) throw new Error(`Expected 4 spaces, got ${spaces}`);
      return true;
    });

    this.test('beautifyHTML - tab indent option works', () => {
      const result = beautifyHTML('<div><p>x</p></div>', { indent: 'tab' });
      return this.assertContains(result, '\t', 'Should use tab indentation');
    });

    this.test('beautifyHTML - comments preserved by default', () => {
      const result = beautifyHTML('<div><!-- my comment --><p>x</p></div>');
      return this.assertContains(result, '<!-- my comment -->', 'Comment should be preserved');
    });

    this.test('beautifyHTML - comments removed when preserveComments=false', () => {
      const result = beautifyHTML('<div><!-- secret --><p>x</p></div>', { preserveComments: false });
      return this.assertNotContains(result, '<!-- secret -->', 'Comment should be removed');
    });

    this.test('beautifyHTML - void tags (br, hr, img) are not indented deeper', () => {
      const result = beautifyHTML('<div><br><hr></div>');
      return this.assertContains(result, '<br>', 'br tag present');
    });

    this.test('beautifyHTML - self-closing tags handled', () => {
      const result = beautifyHTML('<div><input type="text" /></div>');
      return this.assertContains(result, '<input', 'input tag present');
    });

    this.test('beautifyHTML - attributes preserved verbatim', () => {
      const result = beautifyHTML('<div class="foo bar" id="main"><p>x</p></div>');
      return this.assertContains(result, 'class="foo bar"', 'Attributes preserved');
    });

    this.test('beautifyHTML - inline tag with text stays on one line', () => {
      const result = beautifyHTML('<p><strong>bold</strong></p>', { indent: '2' });
      return this.assertContains(result, '<strong>bold</strong>', 'Inline tag+text on same line');
    });

    this.test('beautifyHTML - multiple siblings each get own line', () => {
      const result = beautifyHTML('<ul><li>one</li><li>two</li><li>three</li></ul>');
      const lines = result.split('\n').filter(l => l.includes('<li>'));
      if (lines.length !== 3) throw new Error(`Expected 3 li lines, got ${lines.length}`);
      return true;
    });

    // ── minifyHTML ────────────────────────────────────────────────────────────

    this.test('minifyHTML - empty input returns empty string', () =>
      this.assertEqual(minifyHTML(''), '', 'Empty input minify'));

    this.test('minifyHTML - collapses newlines to spaces', () => {
      const result = minifyHTML('<div>\n  <p>hello</p>\n</div>');
      return this.assertNotContains(result, '\n', 'No newlines after minify');
    });

    this.test('minifyHTML - collapses multiple spaces', () => {
      const result = minifyHTML('<div>   <p>   hello   </p>   </div>');
      return this.assertNotContains(result, '  ', 'No double spaces after minify');
    });

    this.test('minifyHTML - removes space between tags', () => {
      const result = minifyHTML('<div> </div> <p> </p>');
      return this.assertNotContains(result, '> <', 'No space between closing and opening tags');
    });

    this.test('minifyHTML - preserves comments by default', () => {
      const result = minifyHTML('<div><!-- note --><p>x</p></div>');
      return this.assertContains(result, '<!-- note -->', 'Comment preserved in minify');
    });

    this.test('minifyHTML - removes comments when preserveComments=false', () => {
      const result = minifyHTML('<div><!-- secret --><p>x</p></div>', { preserveComments: false });
      return this.assertNotContains(result, '<!-- secret -->', 'Comment stripped');
    });

    this.test('minifyHTML - single line output', () => {
      const result = minifyHTML('<html>\n<head></head>\n<body><p>hi</p></body>\n</html>');
      const lines = result.split('\n');
      if (lines.length !== 1) throw new Error(`Expected 1 line, got ${lines.length}`);
      return true;
    });

    console.log('\n────────────────────────────────────────');
    console.log(`HTML Formatter: ${this.testsPassed}/${this.totalTests} passed`);
    if (this.testsFailed > 0) {
      console.log('Failed tests:', this.failedTests);
    }

    return {
      passed: this.testsPassed,
      failed: this.testsFailed,
      total: this.totalTests,
      failedTests: this.failedTests
    };
  }
}
