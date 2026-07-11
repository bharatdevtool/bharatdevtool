/**
 * Diff Checker Tests
 * Tests the core diff algorithm logic used by diff-checker.html
 */

export class DiffCheckerTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.failedTests = [];
  }

  assert(condition, testName) {
    if (condition) {
      this.passed++;
      console.log('  ✅ ' + testName);
    } else {
      this.failed++;
      this.failedTests.push(testName);
      console.log('  ❌ ' + testName);
    }
  }

  assertEqual(actual, expected, testName) {
    if (actual === expected) {
      this.passed++;
      console.log('  ✅ ' + testName);
    } else {
      this.failed++;
      this.failedTests.push(testName);
      console.log('  ❌ ' + testName + ' — expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual));
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Core diff algorithm (mirrors diff-checker.html implementation)
  // ────────────────────────────────────────────────────────────────

  computeLineDiff(originalLines, modifiedLines) {
    const m = originalLines.length;
    const n = modifiedLines.length;
    const dp = [];
    for (let i = 0; i <= m; i++) dp[i] = new Array(n + 1).fill(0);
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = originalLines[i - 1] === modifiedLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const result = [];
    let i = m;
    let j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && originalLines[i - 1] === modifiedLines[j - 1]) {
        result.push({ type: 'equal', value: originalLines[i - 1] });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        result.push({ type: 'added', value: modifiedLines[j - 1] });
        j--;
      } else {
        result.push({ type: 'removed', value: originalLines[i - 1] });
        i--;
      }
    }
    result.reverse();
    return result;
  }

  computeCharDiff(a, b) {
    const ac = Array.from(a);
    const bc = Array.from(b);
    const m = ac.length;
    const n = bc.length;
    if (m > 500 || n > 500) {
      return [{ type: 'removed', value: a }, { type: 'added', value: b }];
    }
    const dp = [];
    for (let i = 0; i <= m; i++) dp[i] = new Array(n + 1).fill(0);
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = ac[i - 1] === bc[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const result = [];
    let i = m;
    let j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && ac[i - 1] === bc[j - 1]) {
        result.push({ type: 'equal', value: ac[i - 1] });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        result.push({ type: 'added', value: bc[j - 1] });
        j--;
      } else {
        result.push({ type: 'removed', value: ac[i - 1] });
        i--;
      }
    }
    result.reverse();
    // Merge adjacent same-type
    const merged = [];
    for (const item of result) {
      const last = merged[merged.length - 1];
      if (last && last.type === item.type) last.value += item.value;
      else merged.push({ type: item.type, value: item.value });
    }
    return merged;
  }

  countByType(diff, type) {
    return diff.filter(function(d) { return d.type === type; }).length;
  }

  // ────────────────────────────────────────────────────────────────
  // Tests
  // ────────────────────────────────────────────────────────────────

  runAllTests() {
    console.log('\n🧪 DIFF CHECKER TEST SUITE');
    console.log('='.repeat(40));

    this.testIdenticalTexts();
    this.testSingleLineAdded();
    this.testSingleLineRemoved();
    this.testLineChanged();
    this.testMultipleLinesAdded();
    this.testMultipleLinesRemoved();
    this.testEmptyOriginal();
    this.testEmptyModified();
    this.testOrderPreserved();
    this.testCharDiffSameString();
    this.testCharDiffOneCharChange();
    this.testCharDiffAddition();
    this.testCharDiffDeletion();
    this.testCharDiffCompletelyDifferent();
    this.testCharDiffUnicode();

    console.log('\n  Total: ' + (this.passed + this.failed) + ' | Passed: ' + this.passed + ' | Failed: ' + this.failed);
    return { total: this.passed + this.failed, passed: this.passed, failed: this.failed, failedTests: this.failedTests };
  }

  testIdenticalTexts() {
    const lines = ['line one', 'line two', 'line three'];
    const diff = this.computeLineDiff(lines, lines);
    this.assertEqual(this.countByType(diff, 'equal'), 3, 'Identical texts — all lines equal');
    this.assertEqual(this.countByType(diff, 'added'), 0, 'Identical texts — no additions');
    this.assertEqual(this.countByType(diff, 'removed'), 0, 'Identical texts — no removals');
  }

  testSingleLineAdded() {
    const orig = ['line one', 'line two'];
    const mod = ['line one', 'NEW LINE', 'line two'];
    const diff = this.computeLineDiff(orig, mod);
    this.assertEqual(this.countByType(diff, 'added'), 1, 'Single line added — 1 addition');
    this.assertEqual(this.countByType(diff, 'removed'), 0, 'Single line added — 0 removals');
    this.assert(diff.some(function(d) { return d.type === 'added' && d.value === 'NEW LINE'; }), 'Single line added — correct value');
  }

  testSingleLineRemoved() {
    const orig = ['line one', 'DELETED LINE', 'line two'];
    const mod = ['line one', 'line two'];
    const diff = this.computeLineDiff(orig, mod);
    this.assertEqual(this.countByType(diff, 'removed'), 1, 'Single line removed — 1 removal');
    this.assertEqual(this.countByType(diff, 'added'), 0, 'Single line removed — 0 additions');
    this.assert(diff.some(function(d) { return d.type === 'removed' && d.value === 'DELETED LINE'; }), 'Single line removed — correct value');
  }

  testLineChanged() {
    const orig = ['hello world'];
    const mod = ['hello earth'];
    const diff = this.computeLineDiff(orig, mod);
    this.assertEqual(this.countByType(diff, 'removed'), 1, 'Line changed — 1 removal');
    this.assertEqual(this.countByType(diff, 'added'), 1, 'Line changed — 1 addition');
    this.assertEqual(this.countByType(diff, 'equal'), 0, 'Line changed — 0 equal');
  }

  testMultipleLinesAdded() {
    const orig = ['a'];
    const mod = ['a', 'b', 'c', 'd'];
    const diff = this.computeLineDiff(orig, mod);
    this.assertEqual(this.countByType(diff, 'added'), 3, 'Multiple lines added — 3 additions');
    this.assertEqual(this.countByType(diff, 'equal'), 1, 'Multiple lines added — 1 equal');
  }

  testMultipleLinesRemoved() {
    const orig = ['a', 'b', 'c', 'd'];
    const mod = ['a'];
    const diff = this.computeLineDiff(orig, mod);
    this.assertEqual(this.countByType(diff, 'removed'), 3, 'Multiple lines removed — 3 removals');
    this.assertEqual(this.countByType(diff, 'equal'), 1, 'Multiple lines removed — 1 equal');
  }

  testEmptyOriginal() {
    const diff = this.computeLineDiff([], ['line one', 'line two']);
    this.assertEqual(this.countByType(diff, 'added'), 2, 'Empty original — all lines added');
    this.assertEqual(this.countByType(diff, 'removed'), 0, 'Empty original — no removals');
  }

  testEmptyModified() {
    const diff = this.computeLineDiff(['line one', 'line two'], []);
    this.assertEqual(this.countByType(diff, 'removed'), 2, 'Empty modified — all lines removed');
    this.assertEqual(this.countByType(diff, 'added'), 0, 'Empty modified — no additions');
  }

  testOrderPreserved() {
    const orig = ['a', 'b', 'c'];
    const mod = ['a', 'X', 'c'];
    const diff = this.computeLineDiff(orig, mod);
    const types = diff.map(function(d) { return d.type; });
    this.assert(
      types[0] === 'equal' && types[types.length - 1] === 'equal',
      'Order preserved — equal lines at start/end'
    );
  }

  testCharDiffSameString() {
    const result = this.computeCharDiff('hello', 'hello');
    this.assertEqual(result.length, 1, 'Char diff same string — single chunk');
    this.assertEqual(result[0].type, 'equal', 'Char diff same string — type equal');
    this.assertEqual(result[0].value, 'hello', 'Char diff same string — value matches');
  }

  testCharDiffOneCharChange() {
    const result = this.computeCharDiff('cat', 'bat');
    const removed = result.filter(function(d) { return d.type === 'removed'; });
    const added = result.filter(function(d) { return d.type === 'added'; });
    this.assert(removed.some(function(d) { return d.value === 'c'; }), 'Char diff one char change — "c" removed');
    this.assert(added.some(function(d) { return d.value === 'b'; }), 'Char diff one char change — "b" added');
  }

  testCharDiffAddition() {
    const result = this.computeCharDiff('hi', 'high');
    const added = result.filter(function(d) { return d.type === 'added'; });
    this.assert(added.length > 0, 'Char diff addition — has additions');
    this.assert(added.some(function(d) { return d.value.includes('g') || d.value.includes('h'); }), 'Char diff addition — correct chars added');
  }

  testCharDiffDeletion() {
    const result = this.computeCharDiff('hello world', 'hello');
    const removed = result.filter(function(d) { return d.type === 'removed'; });
    this.assert(removed.length > 0, 'Char diff deletion — has removals');
  }

  testCharDiffCompletelyDifferent() {
    const result = this.computeCharDiff('abc', 'xyz');
    const removed = result.filter(function(d) { return d.type === 'removed'; });
    const added = result.filter(function(d) { return d.type === 'added'; });
    this.assert(removed.length > 0, 'Char diff completely different — has removals');
    this.assert(added.length > 0, 'Char diff completely different — has additions');
  }

  testCharDiffUnicode() {
    const result = this.computeCharDiff('नमस्ते', 'नमस्कार');
    this.assert(Array.isArray(result), 'Char diff Unicode — returns array');
    this.assert(result.length > 0, 'Char diff Unicode — non-empty result');
  }
}
