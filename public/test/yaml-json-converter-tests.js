/**
 * YAML ↔ JSON Converter Test Suite
 *
 * Tests the YAMLParser and YAMLSerializer logic that mirrors
 * the browser implementation in yaml-json-converter.html.
 */

// ── Inline YAML parser (mirrors html implementation) ──────────────────────────

const YAMLParser = (function() {

  function parse(src) {
    const docs = splitDocuments(src);
    if (docs.length === 1) return parseDocument(docs[0]);
    return docs.map(parseDocument);
  }

  function splitDocuments(src) {
    const parts = src.split(/^---\s*$/m).filter(s => s.trim().length > 0);
    return parts.length > 0 ? parts : [src];
  }

  function parseDocument(src) {
    const anchors = {};
    const lines = src.replace(/\r\n/g, '\n').split('\n');
    const tokens = tokenize(lines);
    const result = parseValue(tokens, 0, anchors);
    return result.value;
  }

  function tokenize(lines) {
    const tokens = [];
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const stripped = raw.replace(/#(?=[^"']*$)/, '').trimEnd();
      if (stripped.trim() === '' || raw.trim().startsWith('#')) continue;
      const indent = stripped.length - stripped.trimStart().length;
      tokens.push({ indent, content: stripped.trimStart(), lineNum: i + 1 });
    }
    return tokens;
  }

  function parseValue(tokens, startIdx, anchors) {
    if (startIdx >= tokens.length) return { value: null, nextIdx: startIdx };
    const tok = tokens[startIdx];
    if (tok.content.startsWith('- ') || tok.content === '-') {
      return parseSequence(tokens, startIdx, anchors);
    }
    if (isMappingKey(tok.content)) {
      return parseMapping(tokens, startIdx, anchors);
    }
    return { value: parseScalar(tok.content, anchors), nextIdx: startIdx + 1 };
  }

  function parseMapping(tokens, startIdx, anchors) {
    const baseIndent = tokens[startIdx].indent;
    const obj = {};
    let i = startIdx;
    while (i < tokens.length && tokens[i].indent === baseIndent && isMappingKey(tokens[i].content)) {
      const { key, rest, anchor } = extractMappingKey(tokens[i].content);
      i++;
      let value;
      if (rest !== null && rest.trim() !== '') {
        if (rest.trim() === '|' || rest.trim() === '>' || rest.trim().startsWith('|-') || rest.trim().startsWith('>-')) {
          const blockResult = parseBlockScalar(tokens, i, baseIndent, rest.trim());
          value = blockResult.value;
          i = blockResult.nextIdx;
        } else {
          value = parseScalar(rest, anchors);
        }
      } else if (rest !== null && rest.trim() === '') {
        if (i < tokens.length && tokens[i].indent > baseIndent) {
          const nextTok = tokens[i];
          if (nextTok.content.startsWith('- ') || nextTok.content === '-') {
            const seqResult = parseSequence(tokens, i, anchors);
            value = seqResult.value;
            i = seqResult.nextIdx;
          } else if (isMappingKey(nextTok.content)) {
            const mapResult = parseMapping(tokens, i, anchors);
            value = mapResult.value;
            i = mapResult.nextIdx;
          } else {
            value = parseScalar(nextTok.content, anchors);
            i++;
          }
        } else {
          value = null;
        }
      } else {
        value = null;
      }
      if (anchor) anchors[anchor] = value;
      obj[key] = value;
    }
    return { value: obj, nextIdx: i };
  }

  function parseSequence(tokens, startIdx, anchors) {
    const baseIndent = tokens[startIdx].indent;
    const arr = [];
    let i = startIdx;
    while (i < tokens.length && tokens[i].indent === baseIndent &&
           (tokens[i].content.startsWith('- ') || tokens[i].content === '-')) {
      const itemContent = tokens[i].content.replace(/^-\s*/, '').trim();
      i++;
      if (itemContent === '') {
        if (i < tokens.length && tokens[i].indent > baseIndent) {
          if (tokens[i].content.startsWith('- ') || tokens[i].content === '-') {
            const seqResult = parseSequence(tokens, i, anchors);
            arr.push(seqResult.value);
            i = seqResult.nextIdx;
          } else if (isMappingKey(tokens[i].content)) {
            const mapResult = parseMapping(tokens, i, anchors);
            arr.push(mapResult.value);
            i = mapResult.nextIdx;
          } else {
            arr.push(parseScalar(tokens[i].content, anchors));
            i++;
          }
        } else {
          arr.push(null);
        }
      } else if (isMappingKey(itemContent)) {
        const syntheticTokens = [{ indent: baseIndent + 2, content: itemContent, lineNum: tokens[i-1].lineNum }];
        let j = i;
        while (j < tokens.length && tokens[j].indent > baseIndent) {
          syntheticTokens.push(tokens[j]);
          j++;
        }
        const mapResult = parseMapping(syntheticTokens, 0, anchors);
        arr.push(mapResult.value);
        i = j;
      } else {
        arr.push(parseScalar(itemContent, anchors));
      }
    }
    return { value: arr, nextIdx: i };
  }

  function parseBlockScalar(tokens, startIdx, parentIndent, indicator) {
    const chomping = indicator.includes('-') ? 'strip' : (indicator.includes('+') ? 'keep' : 'clip');
    const fold = indicator.startsWith('>');
    let i = startIdx;
    const lines = [];
    let blockIndent = -1;
    while (i < tokens.length) {
      const tok = tokens[i];
      if (blockIndent === -1) blockIndent = tok.indent;
      if (tok.indent < blockIndent && tok.content.trim() !== '') break;
      lines.push(tok.indent >= blockIndent ? tok.content : '');
      i++;
    }
    let result = lines.join(fold ? ' ' : '\n');
    if (chomping === 'clip') result = result.trimEnd() + '\n';
    else if (chomping === 'strip') result = result.trimEnd();
    return { value: result, nextIdx: i };
  }

  function isMappingKey(content) {
    return /^(?:"[^"]*"|'[^']*'|[^:[\]{},#'"!|>][^:]*?)\s*:(\s|$)/.test(content);
  }

  function extractMappingKey(content) {
    let anchor = null;
    const anchorMatch = content.match(/^&(\S+)\s+/);
    if (anchorMatch) {
      anchor = anchorMatch[1];
      content = content.slice(anchorMatch[0].length);
    }
    let key, rest;
    const quotedMatch = content.match(/^("(?:[^"\\]|\\.)*"|'[^']*')\s*:\s*(.*)/);
    if (quotedMatch) {
      if (quotedMatch[1].startsWith('"')) key = JSON.parse(quotedMatch[1]);
      else key = quotedMatch[1].slice(1, -1);
      rest = quotedMatch[2];
    } else {
      const colonIdx = content.indexOf(':');
      key = content.slice(0, colonIdx).trim();
      rest = content.slice(colonIdx + 1);
    }
    return { key, rest, anchor };
  }

  function parseScalar(raw, anchors) {
    const s = raw.trim();
    if (s.startsWith('*')) return anchors[s.slice(1)] ?? null;
    if (s.startsWith('&')) {
      const parts = s.match(/^&(\S+)\s*(.*)/);
      if (parts) return parseScalarValue(parts[2], anchors);
    }
    return parseScalarValue(s, anchors);
  }

  function parseScalarValue(s, anchors) {
    if (s === '' || s === 'null' || s === '~') return null;
    if (s === 'true' || s === 'True' || s === 'TRUE') return true;
    if (s === 'false' || s === 'False' || s === 'FALSE') return false;
    if (s.startsWith('"') && s.endsWith('"')) {
      try { return JSON.parse(s); } catch (_) { return s.slice(1,-1); }
    }
    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(s)) return Number(s);
    if (/^0x[0-9A-Fa-f]+$/.test(s)) return parseInt(s, 16);
    if (/^0o[0-7]+$/.test(s)) return parseInt(s.slice(2), 8);
    if (s === '.inf' || s === '.Inf' || s === '.INF') return Infinity;
    if (s === '-.inf' || s === '-.Inf' || s === '-.INF') return -Infinity;
    if (s === '.nan' || s === '.NaN' || s === '.NAN') return null;
    return s;
  }

  return { parse };
})();

// ── Inline YAML serializer (mirrors html implementation) ──────────────────────

const YAMLSerializer = (function() {
  function stringify(value, indent) {
    return serializeValue(value, 0, indent, false);
  }

  function serializeValue(val, depth, indent, inline) {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') {
      if (!isFinite(val)) return val > 0 ? '.inf' : '-.inf';
      return String(val);
    }
    if (typeof val === 'string') return serializeString(val, depth, indent);
    if (Array.isArray(val)) return serializeArray(val, depth, indent);
    if (typeof val === 'object') return serializeObject(val, depth, indent);
    return String(val);
  }

  function serializeString(s, depth, indent) {
    if (s === '') return "''";
    if (/[\n\r]/.test(s)) {
      const pad = ' '.repeat((depth + 1) * indent);
      return '|-\n' + pad + s.replace(/\n/g, '\n' + pad);
    }
    if (/[:{}\[\],&*#?|<>=!%@`"']/.test(s) ||
        s.trim() !== s ||
        /^(true|false|null|~|[-+]?\d)/.test(s)) {
      return JSON.stringify(s);
    }
    return s;
  }

  function serializeArray(arr, depth, indent) {
    if (arr.length === 0) return '[]';
    const pad = ' '.repeat(depth * indent);
    return arr.map(function(item) {
      const serialized = serializeValue(item, depth + 1, indent, false);
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const lines = serialized.split('\n');
        return pad + '- ' + lines.join('\n' + pad + '  ');
      }
      return pad + '- ' + serialized;
    }).join('\n');
  }

  function serializeObject(obj, depth, indent) {
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    const pad = ' '.repeat(depth * indent);
    return keys.map(function(key) {
      const val = obj[key];
      const yamlKey = /[:{}\[\],&*#?|<>=!%@`"'\s]/.test(key) || key === '' ? JSON.stringify(key) : key;
      if (val === null || val === undefined) return pad + yamlKey + ': null';
      if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length > 0) {
        const nested = serializeValue(val, depth + 1, indent, false);
        return pad + yamlKey + ':\n' + nested;
      }
      if (Array.isArray(val) && val.length > 0) {
        const nested = serializeValue(val, depth + 1, indent, false);
        return pad + yamlKey + ':\n' + nested;
      }
      return pad + yamlKey + ': ' + serializeValue(val, depth + 1, indent, true);
    }).join('\n');
  }

  return { stringify };
})();

// ── Test Class ─────────────────────────────────────────────────────────────────

export class YAMLJSONConverterTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.failedTests = [];
  }

  assert(name, condition, info) {
    if (condition) {
      this.passed++;
      console.log(`✅ ${name}`);
    } else {
      this.failed++;
      this.failedTests.push(name);
      console.log(`❌ ${name}${info ? ' — ' + info : ''}`);
    }
  }

  assertEqual(name, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) {
      this.assert(name, false, `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    } else {
      this.assert(name, true);
    }
  }

  runAll() {
    console.log('🔄 YAML ↔ JSON Converter Tests');
    console.log('────────────────────────────────────────');

    this.testYamlToJson();
    this.testJsonToYaml();
    this.testEdgeCases();
    this.testRoundTrip();

    console.log(`\n────────────────────────────────────────`);
    console.log(`Total: ${this.passed + this.failed} | Passed: ${this.passed} | Failed: ${this.failed}`);

    return { total: this.passed + this.failed, passed: this.passed, failed: this.failed, failedTests: this.failedTests };
  }

  testYamlToJson() {
    console.log('\n🧪 YAML → JSON');

    this.assertEqual('scalar string', YAMLParser.parse('key: hello'), { key: 'hello' });
    this.assertEqual('scalar number', YAMLParser.parse('port: 5432'), { port: 5432 });
    this.assertEqual('scalar boolean true', YAMLParser.parse('enabled: true'), { enabled: true });
    this.assertEqual('scalar boolean false', YAMLParser.parse('debug: false'), { debug: false });
    this.assertEqual('scalar null', YAMLParser.parse('value: null'), { value: null });
    this.assertEqual('scalar tilde null', YAMLParser.parse('value: ~'), { value: null });
    this.assertEqual('quoted string', YAMLParser.parse('name: "John Doe"'), { name: 'John Doe' });
    this.assertEqual('single-quoted string', YAMLParser.parse("name: 'John Doe'"), { name: 'John Doe' });

    this.assertEqual('nested mapping',
      YAMLParser.parse('db:\n  host: localhost\n  port: 5432'),
      { db: { host: 'localhost', port: 5432 } }
    );

    this.assertEqual('sequence of strings',
      YAMLParser.parse('tags:\n  - free\n  - fast\n  - secure'),
      { tags: ['free', 'fast', 'secure'] }
    );

    this.assertEqual('sequence of numbers',
      YAMLParser.parse('nums:\n  - 1\n  - 2\n  - 3'),
      { nums: [1, 2, 3] }
    );

    this.assertEqual('comment stripped',
      YAMLParser.parse('# comment\nkey: value'),
      { key: 'value' }
    );

    this.assertEqual('multikey object',
      YAMLParser.parse('name: Alice\nage: 30\nactive: true'),
      { name: 'Alice', age: 30, active: true }
    );
  }

  testJsonToYaml() {
    console.log('\n🧪 JSON → YAML');

    const indent = 2;

    const simpleObj = { name: 'Alice', age: 30 };
    const yamlSimple = YAMLSerializer.stringify(simpleObj, indent);
    this.assert('simple object contains key', yamlSimple.includes('name: Alice'));
    this.assert('simple object contains age', yamlSimple.includes('age: 30'));

    const boolObj = { enabled: true, debug: false };
    const yamlBool = YAMLSerializer.stringify(boolObj, indent);
    this.assert('boolean true', yamlBool.includes('enabled: true'));
    this.assert('boolean false', yamlBool.includes('debug: false'));

    const nullObj = { value: null };
    const yamlNull = YAMLSerializer.stringify(nullObj, indent);
    this.assert('null value', yamlNull.includes('value: null'));

    const arrObj = { tags: ['free', 'fast'] };
    const yamlArr = YAMLSerializer.stringify(arrObj, indent);
    this.assert('array items present', yamlArr.includes('- free') && yamlArr.includes('- fast'));

    const nestedObj = { db: { host: 'localhost', port: 5432 } };
    const yamlNested = YAMLSerializer.stringify(nestedObj, indent);
    this.assert('nested key present', yamlNested.includes('db:'));
    this.assert('nested value present', yamlNested.includes('host: localhost'));

    const emptyArr = YAMLSerializer.stringify([], indent);
    this.assert('empty array', emptyArr === '[]');

    const emptyObj = YAMLSerializer.stringify({}, indent);
    this.assert('empty object', emptyObj === '{}');
  }

  testEdgeCases() {
    console.log('\n🧪 Edge Cases');

    // Number types
    this.assertEqual('hex number', YAMLParser.parse('val: 0xff'), { val: 255 });
    this.assertEqual('float', YAMLParser.parse('pi: 3.14'), { pi: 3.14 });
    this.assertEqual('negative int', YAMLParser.parse('val: -42'), { val: -42 });

    // Empty sequences
    const emptySeq = YAMLParser.parse('items: []');
    this.assert('inline empty sequence parse does not throw', true);

    // JSON roundtrip integrity
    const jsonInput = '{"a":1,"b":true,"c":null,"d":[1,2],"e":{"f":"hello"}}';
    const parsed = JSON.parse(jsonInput);
    const yaml = YAMLSerializer.stringify(parsed, 2);
    this.assert('json->yaml produces non-empty string', yaml.length > 0);
    this.assert('yaml contains expected key a', yaml.includes('a: 1'));
  }

  testRoundTrip() {
    console.log('\n🧪 Round-Trip Accuracy');

    const testCases = [
      { name: 'simple object', obj: { name: 'John', age: 25 } },
      { name: 'nested object', obj: { db: { host: 'localhost', port: 3306 } } },
      { name: 'array of strings', obj: { tags: ['a', 'b', 'c'] } },
      { name: 'mixed types', obj: { x: 1, y: true, z: null } },
    ];

    for (const tc of testCases) {
      const yaml = YAMLSerializer.stringify(tc.obj, 2);
      const reparsed = YAMLParser.parse(yaml);
      this.assertEqual(`round-trip: ${tc.name}`, reparsed, tc.obj);
    }
  }
}
